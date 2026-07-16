import { NextRequest, NextResponse } from 'next/server'

const MAPA_FROTA: Record<string, string> = {
  '12018': '2333', '12052': '2086', '12089': '2085', '12087': '2405',
  '12057': '116', '12170': 'P123', '12156': '110', '12134': '2109',
  '8082': '8082', '4923': '4923/4723', '4723': '4923/4723',
  '4923/4723': '4923/4723', '287': '287', 'S287': '287', 'SD287': '287',
  'S0287': '287', 'SO287': '287', '135': '135', 'M005': 'M005',
  'M009': 'M009', '1067': '1067', '4797': '4797/4717', '4717': '4797/4717',
  '4797/4717': '4797/4717', '8135': '8135', '80825': '80825', '8082S': '80825',
}

const PROMPT = `Analise este contrato de transporte rodoviário brasileiro e extraia os dados. Responda APENAS com JSON válido, sem markdown, sem backticks, sem explicações.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EXISTEM 3 TIPOS DE CONTRATO:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TIPO A (SADA): seções em caixa alta "CONTRATANTE", "CONTRATADO", "EQUIPAMENTOS DE TRANSPORTE", "MOTORISTA", "SERVIÇOS CONTRATADOS", "PREÇO DE SERVIÇOS CONTRATADOS E QUITAÇÃO". Número após "VIAGENS:" no título.
TIPO B (BRAZUL / DACUNHA): mesma estrutura do TIPO A.
TIPO C (AUTOPORT): cabeçalho com logo AUTOPORT, campos "Contrato:", "Data Contrato:", seções "Contratado", "Veículo", "Motorista/Preposto", "Valor do Serviço Contratado e Quitação".

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
IDENTIFICAÇÃO DO CLIENTE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TIPO A/B → seção "CONTRATANTE" campo "Nome:"
TIPO C → cabeçalho campo "Nome:" (empresa emitente)
CONTRATADO = Carlos Alberto Roesel Transportes — NUNCA é o cliente.
CNPJ do contratado é sempre 66330549000152 — NUNCA use esse.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CAMPOS A EXTRAIR:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

"contrato":
  TIPO A/B → número após "VIAGENS:" no título. Este número fica SOMENTE no título do documento, logo após a palavra "VIAGENS:". NÃO leia campos chamados "Viagem:", "Número:", "Nº:", "N°:", "Planejamento:" — esses campos NÃO existem no retorno JSON; se encontrar apenas esses, retorne "".
  TIPO C → campo "Contrato:" primeira linha. Formato AAAA/NNNNNN-N.
    ⚠️ NUNCA use "Número:", "Viagem:", "Planejamento:".
    ⚠️ Se o campo "Contrato:" não estiver presente ou não tiver formato AAAA/NNNNNN-N, retorne "".
  ⚠️ Apenas dígitos, barras e hífens. OCR: B→8, O→0, I→1, S→5, G→6, Z→2.
    NUNCA USE o valor do campo "Viagem" — ele não é o número do contrato.

"data": Formato YYYY-MM-DD.
  TIPO A/B → "Data de Pagamento:" no topo direito
  TIPO C → "Data Contrato:" no topo direito
  ⚠️ NUNCA use "Data de Saída:", "Prazo do Contrato:", "Emitido em:".
  ⚠️ Leia cada dígito separadamente. Ano é 2025 ou 2026.
  Formato DD/MM/AAAA → converta para AAAA-MM-DD.

"cliente_nome_completo":
  TIPO A/B → seção "CONTRATANTE" campo "Nome:"
  TIPO C → campo "Nome:" no cabeçalho
  NUNCA coloque Carlos Alberto Roesel.

"cnpj": CNPJ do cliente. 14 dígitos.
  TIPO A/B → campo "CNPJ:" na seção CONTRATANTE.
  TIPO C → campo "CNPJ:" no cabeçalho junto ao nome da empresa emitente.
  NUNCA use 66330549000152. Se dúvida retorne "".

"motorista":
  TIPO A/B → seção "MOTORISTA" campo "Nome:"
  TIPO C → seção "Motorista/Preposto" campo "NOME:"
  NUNCA coloque nome de empresa.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LEITURA DE PLACAS — REGRAS CRÍTICAS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TODAS as placas seguem MERCOSUL: 7 caracteres — AAA#A##
  pos 1,2,3,5 = LETRAS | pos 4,6,7 = ALGARISMOS
  Não confunda: R↔P, H↔M↔N, 9↔4↔7, C↔G↔0, 8↔B
  Se resultado não for AAA#A##, RELEIA.

"placa": TIPO A/B → "Placa Cavalo Mecânico:" | TIPO C → "Placa Caminhão:"
"placa_carreta": TIPO A/B → "Placa Semi-reboque:" | TIPO C → "Placa Carreta:"
"frota": valor exato após "Frota:".

"fat_bruto": ━━ ATENÇÃO MÁXIMA ━━
  O contrato tem DOIS campos numéricos que CONFUNDEM:

  ❌ CAMPO ERRADO — "Peso:" na seção SERVIÇOS CONTRATADOS:
    Fica junto com Origem/Destino/Quant → peso em KG → NUNCA USE
    Ex: "Peso: 17050,00" = 17050 quilogramas → IGNORE

  ✅ CAMPO CORRETO — "Frete Contratado" na seção PREÇO DE SERVIÇOS CONTRATADOS E QUITAÇÃO:
    Fica na tabela de valores financeiros → valor em R$ → USE ESTE
    Ex: "Frete Contratado  31904,12" = R$ 31904,12 → RETORNE "31904.12"

  TIPO C → linha "(+) Frete Contratado: X.XXX,XX" — valor após os dois pontos

  ⚠️ LEITURA DO VALOR — OBRIGATÓRIO:
  1. Leia o número COMPLETO da esquerda para direita, TODOS os dígitos.
     Ex: "31.904,12" → leia 3,1,.,9,0,4,,,1,2 → retorne "31904.12"
     ❌ NUNCA pule o primeiro dígito: "1904.12" quando é "31904.12" é ERRO GRAVE
  2. VERIFICAÇÃO: se Adiantamento(-) = 0 e demais deduções monetárias = 0,
     então Frete Contratado ≈ Saldo a Receber. Se diferir muito, você perdeu dígitos — RELEIA.
  3. Nunca use "Saldo a Receber" como valor final — use apenas para verificar.

  Formato: VÍRGULA=decimal, PONTO=milhar.
  "31.904,12"→"31904.12" | "2.258,37"→"2258.37" | "374,73"→"374.73"
  SEMPRE com ponto decimal e 2 casas.

"qtd_veiculos":
  TIPO A/B → campo "Quant.:"
  TIPO C → campo "Veículos:" — total. Se não identificar, some a distribuição por cidade.
  Inteiro.

"origem": campo "Origem:" exato. ⚠️ Leia exatamente o que está escrito.
"destino": campo "Destino:" exato. TIPO C → "Destino Final:".
"status": sempre "ABERTO"
"chapa": sempre ""
"obs": sempre ""

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
JSON de retorno (SOMENTE isso):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  "motorista": "",
  "cliente_nome_completo": "",
  "cnpj": "",
  "placa": "",
  "placa_carreta": "",
  "frota": "",
  "contrato": "",
  "data": "",
  "fat_bruto": "",
  "chapa": "",
  "origem": "",
  "destino": "",
  "qtd_veiculos": "",
  "status": "ABERTO",
  "obs": ""
}`

// ─────────────────────────────────────────────────────────────────────────
// PROVEDOR: controla qual IA é usada.
// Defina IA_PROVIDER=gemini nas env vars da Vercel para usar o Gemini
// temporariamente. Sem essa variável (ou com IA_PROVIDER=anthropic), usa
// o Claude normalmente. Basta remover/trocar a env var para voltar.
// ─────────────────────────────────────────────────────────────────────────
const PROVIDER = (process.env.IA_PROVIDER || 'anthropic').toLowerCase()

async function chamarAnthropic(base64: string, mediaType: string, isPDF: boolean) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 1500,
      messages: [{
        role: 'user',
        content: [
          {
            type: isPDF ? 'document' : 'image',
            source: { type: 'base64', media_type: mediaType, data: base64 }
          },
          { type: 'text', text: PROMPT }
        ]
      }]
    })
  })

  if (!response.ok) {
    const errorBody = await response.text()
    console.error('Erro Anthropic API:', response.status, errorBody)
    return { erro: `Erro ${response.status}: ${errorBody}` }
  }

  const data = await response.json()

  if (!data.content || !data.content[0]?.text) {
    console.error('Resposta inesperada da Anthropic:', JSON.stringify(data))
    return { erro: 'Resposta vazia da IA: ' + JSON.stringify(data) }
  }

  return { texto: data.content[0].text }
}

async function chamarGemini(base64: string, mediaType: string) {
  const GEMINI_KEY = process.env.GEMINI_API_KEY!
  const modelo = 'gemini-3.5-flash'

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${GEMINI_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [
            { inline_data: { mime_type: mediaType, data: base64 } },
            { text: PROMPT }
          ]
        }],
        generationConfig: {
          responseMimeType: 'application/json',
        }
      })
    }
  )

  if (!response.ok) {
    const errorBody = await response.text()
    console.error('Erro Gemini API:', response.status, errorBody)
    return { erro: `Erro ${response.status}: ${errorBody}` }
  }

  const data = await response.json()

  const texto = data?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!texto) {
    console.error('Resposta inesperada do Gemini:', JSON.stringify(data))
    return { erro: 'Resposta vazia da IA: ' + JSON.stringify(data) }
  }

  return { texto }
}

export async function POST(req: NextRequest) {
  const { base64, mediaType, isPDF } = await req.json()

  const resultado = PROVIDER === 'gemini'
    ? await chamarGemini(base64, mediaType)
    : await chamarAnthropic(base64, mediaType, isPDF)

  if (resultado.erro) {
    return NextResponse.json({ _erro: resultado.erro }, { status: 200 })
  }

  const text = resultado.texto!

  try {
    // ✅ Remove blocos markdown (```json ... ```) antes de parsear
    const textLimpo = text
      .trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/, '')
      .replace(/```\s*$/, '')
      .trim()

    const parsed = JSON.parse(textLimpo)

    // ── FROTA ──────────────────────────────────────────────────────────────
    if (parsed.frota) {
      const frotaLida = String(parsed.frota).trim()
      const frotaConvertida = MAPA_FROTA[frotaLida]
      if (frotaConvertida) parsed.frota = frotaConvertida
    }

    // ── CONTRATO ───────────────────────────────────────────────────────────
    if (parsed.contrato) {
      let contrato = String(parsed.contrato).trim()

      // 🔴 Rejeitar se o modelo retornou valor de campo proibido
      const camposProibidos = /viagem|viag|numero|nro|n[°º]|planejamento/i
      if (camposProibidos.test(contrato)) {
        parsed.contrato = ''
      } else {
        // Limpeza OCR
        contrato = contrato
          .replace(/B/g, '8').replace(/O/g, '0').replace(/I/g, '1')
          .replace(/S/g, '5').replace(/G/g, '6').replace(/Z/g, '2')
          .replace(/[A-Z]/g, '').replace(/[^0-9\/\-]/g, '')

        // Descartar se for número curto sem formato esperado (ex: número de viagem simples)
        if (/^\d{1,4}$/.test(contrato)) contrato = ''

        // 🔴 Tipo C: validar formato AAAA/NNNNN-N
        if (contrato.includes('/')) {
          const formatoAutoport = /^\d{4}\/\d{5,7}-\d$/.test(contrato)
          if (!formatoAutoport) contrato = ''
        }

        parsed.contrato = contrato
      }
    }

    // ── CNPJ ───────────────────────────────────────────────────────────────
    const CNPJ_CONTRATADO = '66330549000152'
    if (parsed.cnpj) {
      const cnpjLimpo = parsed.cnpj.replace(/\D/g, '')
      if (cnpjLimpo.length < 14 || cnpjLimpo === CNPJ_CONTRATADO) parsed.cnpj = ''
    }

    // ── DATA ───────────────────────────────────────────────────────────────
    if (parsed.data) {
      const dataStr = String(parsed.data).trim()
      const matchBR = dataStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
      if (matchBR) parsed.data = `${matchBR[3]}-${matchBR[2]}-${matchBR[1]}`
      const anoMatch = String(parsed.data).match(/^(\d{4})-/)
      if (anoMatch) {
        const ano = parseInt(anoMatch[1])
        if (ano < 2024 || ano > 2027) parsed.data = ''
      }
    }

    // ── FAT_BRUTO ──────────────────────────────────────────────────────────
    if (parsed.fat_bruto !== undefined && parsed.fat_bruto !== '') {
      let val = String(parsed.fat_bruto).trim()
      if (val.includes(',')) {
        val = val.replace(/\./g, '').replace(',', '.')
      } else if (val.includes('.')) {
        const partes = val.split('.')
        if (partes.length > 2) {
          val = val.replace(/\./g, '')
          if (val.length > 2) val = val.slice(0, -2) + '.' + val.slice(-2)
        }
      } else {
        if (val.length > 2) val = val.slice(0, -2) + '.' + val.slice(-2)
      }
      const num = parseFloat(val)
      if (!isNaN(num) && num > 0) parsed.fat_bruto = String(num)
      else parsed.fat_bruto = ''
    }

    // ── QTD_VEICULOS ───────────────────────────────────────────────────────
    if (parsed.qtd_veiculos) {
      parsed.qtd_veiculos = String(parseInt(String(parsed.qtd_veiculos)) || '')
    }

    return NextResponse.json(parsed)
  } catch {
    console.error('Erro ao parsear JSON da IA:', text)
    return NextResponse.json({ _erro: text }, { status: 200 })
  }
}