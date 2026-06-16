import { NextResponse } from 'next/server'

const PROFROTAS_TOKEN = process.env.PROFROTAS_TOKEN!
const SUPABASE_URL    = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY    = process.env.NEXT_PUBLIC_SUPABASE_KEY!

async function sbGet(path: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
  })
  return res.json()
}

async function sbPost(table: string, data: any) {
  return fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json', Prefer: 'return=minimal',
    },
    body: JSON.stringify(data),
  })
}

export async function POST(req: Request) {
  try {
    const { dataInicio, dataFim } = await req.json()

    const dataInicialISO = `${dataInicio}T00:00:00.000-0300`
    const dataFinalISO   = `${dataFim}T23:59:59.000-0300`

    // ── Busca todas as páginas da Profrotas ──────────────────────────────
    let pagina = 1
    const todos: any[] = []

    while (true) {
      const res = await fetch('https://api-portal.profrotas.com.br/api/frotista/abastecimento/pesquisa', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${PROFROTAS_TOKEN}`,
        },
        body: JSON.stringify({
          dataInicial:          dataInicialISO,
          dataFinal:            dataFinalISO,
          dataInicialAlteracao: dataInicialISO,
          dataFinalAlteracao:   dataFinalISO,
          identificador:        null,
          pagina,
          tamanhoPagina:        100,
        }),
      })

      if (!res.ok) {
        const err = await res.text()
        return NextResponse.json({ ok: false, error: `Profrotas: ${err}` }, { status: 400 })
      }

      const json = await res.json()
      const registros = json.registros || []
      todos.push(...registros)

      if (registros.length === 0 || todos.length >= (json.totalItems || 0)) break
      pagina++
    }

    // ── Só autorizados (statusAutorizacao === 1) ─────────────────────────
    const autorizados = todos.filter(a => a.statusAutorizacao === 1)

    // ── Busca caminhões para vincular pela placa ─────────────────────────
    const caminhoes: any[] = await sbGet('caminhoes?select=id,placa')

    let importados = 0
    let ignorados  = 0

    for (const a of autorizados) {
      const profrotasId  = a.identificador
      const placaRaw     = a.veiculo?.placa || ''
      const placaNorm    = placaRaw.replace(/[^A-Z0-9]/gi, '').toUpperCase()
      const dataTransacao = (a.dataTransacao || a.data || '').split('T')[0]

      // Verifica duplicata pelo id da Profrotas no campo obs
      const existentes: any[] = await sbGet(
        `abastecimentos?select=id&obs=ilike.*Profrotas+%23${profrotasId}*&limit=1`
      )
      if (existentes.length > 0) { ignorados++; continue }

      // Vincula caminhão pela placa
      const caminhao = caminhoes.find(c =>
        c.placa.replace(/[^A-Z0-9]/gi, '').toUpperCase() === placaNorm
      )

      // Processa itens (diesel, arla, etc.)
      const items = a.items || []
      const itemComb = items.find((i: any) => {
        const nome = (i.nome || '').toLowerCase()
        return nome.includes('diesel') || nome.includes('gasolina') ||
               nome.includes('etanol') || nome.includes('gnv')
      })
      const itemArla = items.find((i: any) =>
        (i.nome || '').toLowerCase().includes('arla')
      )

      const litrosComb    = itemComb?.quantidade    || 0
      const valorLitroComb = itemComb?.valorUnitario || 0
      const litrosArla    = itemArla?.quantidade    || 0
      const valorLitroArla = itemArla?.valorUnitario || 0
      const total         = items.reduce((s: number, i: any) => s + (i.valorTotal || 0), 0)

      // CNPJ vem como inteiro na API
      const cnpjStr = a.pontoVenda?.cnpj
        ? String(a.pontoVenda.cnpj).padStart(14, '0')
        : ''

      await sbPost('abastecimentos', {
        data:                   dataTransacao,
        caminhao_id:            caminhao?.id || null,
        caminhao_placa:         placaRaw,
        motorista:              a.motorista?.nome || '',
        posto:                  a.pontoVenda?.razaoSocial || '',
        cnpj_posto:             cnpjStr,
        cidade:                 a.pontoVenda?.endereco?.municipio || '',
        estado:                 a.pontoVenda?.endereco?.uf || '',
        km:                     a.hodometro || null,
        litros_combustivel:     litrosComb,
        valor_litro_combustivel: valorLitroComb,
        litros_arla:            litrosArla,
        valor_litro_arla:       valorLitroArla,
        total,
        obs:                    `Profrotas #${profrotasId}`,
        desconto:               0,
      })

      importados++
    }

    return NextResponse.json({ ok: true, importados, ignorados, total: autorizados.length })

  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}