import { NextRequest, NextResponse } from 'next/server'

const MAPA_FROTA: Record<string, string> = {
  '12018': '2333',
  '12052': '2086',
  '12089': '2085',
  '12087': '2405',
  '12057': '116',
  '12170': 'P123',
  '12156': '110',
  '12134': '2109',
  '8082': '8082',
  '4923': '4923/4723',
  '4723': '4923/4723',
  '4923/4723': '4923/4723',
  '287': '287',
  'S287': '287',
  'SD287': '287',
  'S0287': '287',
  'SO287': '287',
  '135': '135',
  'M005': 'M005',
  'M009': 'M009',
  '1067': '1067',
  '4797': '4797/4717',
  '4717': '4797/4717',
  '4797/4717': '4797/4717',
  '8135': '8135',
  '80825': '80825',
}

export async function POST(req: NextRequest) {
  const { base64, mediaType, isPDF } = await req.json()

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: [
          {
            type: isPDF ? 'document' : 'image',
            source: { type: 'base64', media_type: mediaType, data: base64 }
          },
          {
            type: 'text',
            text: `Analise este contrato de transporte rodoviário brasileiro e extraia os dados. Responda APENAS com JSON válido, sem markdown, sem backticks, sem explicações.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EXISTEM 2 TIPOS DE CONTRATO:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TIPO A (SADA / BRAZUL / DACUNHA): seções em caixa alta "CONTRATANTE", "CONTRATADO", "EQUIPAMENTOS DE TRANSPORTE", "MOTORISTA", "SERVIÇOS CONTRATADOS", "PREÇO DE SERVIÇOS CONTRATADOS E QUITAÇÃO". Número do contrato após "VIAGENS:" no título.
TIPO B (AUTOPORT): cabeçalho com logo AUTOPORT, campos "Contrato:", "Data Contrato:", seções "Contratado", "Veículo", "Motorista/Preposto", "Valor do Serviço Contratado e Quitação".

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
IDENTIFICAÇÃO DO CLIENTE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TIPO A → cliente na seção "CONTRATANTE" campo "Nome:"
TIPO B → cliente no cabeçalho campo "Nome:" (empresa emitente)
CONTRATADO = Carlos Alberto Roesel Transportes — NUNCA é o cliente.
CNPJ do contratado é sempre 66330549000152 — NUNCA use esse.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CAMPOS A EXTRAIR:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

"contrato":
  TIPO A → número após "VIAGENS:" no título
  TIPO B → campo "Contrato:" primeira linha

"data": REGRAS CRÍTICAS — Formato YYYY-MM-DD.
  TIPO A → campo "Data de Pagamento:" que aparece no TOPO DIREITO do documento, na mesma linha do nome do CONTRATANTE. Exemplo: "Data de Pagamento: 03/03/2026" → "2026-03-03".
  TIPO B → campo "Data Contrato:" no topo direito. Exemplo: "Data Contrato: 02/03/2026" → "2026-03-02".
  ⚠️ NUNCA use "Data de Saída:" — essa é a data de saída do veículo, não do contrato.
  ⚠️ NUNCA use "Prazo do Contrato:" — esse é o prazo de entrega.
  ⚠️ O ANO deve ser lido com atenção: os contratos são de 2025 ou 2026. Leia os 4 dígitos do ano separadamente.
  ⚠️ O formato no documento é DD/MM/AAAA. Converta corretamente para AAAA-MM-DD.
  Exemplo correto: "03/03/2026" → "2026-03-03". NÃO "2025-01-03", NÃO "2026-03-01".

"cliente_nome_completo":
  TIPO A → seção "CONTRATANTE" campo "Nome:"
  TIPO B → campo "Nome:" no cabeçalho
  NUNCA coloque Carlos Alberto Roesel.

"cnpj": CNPJ do cliente. 14 dígitos. NUNCA use 66330549000152. Se dúvida retorne "".

"motorista":
  TIPO A → seção "MOTORISTA" campo "Nome:"
  TIPO B → seção "Motorista/Preposto" campo "NOME:"
  NUNCA coloque nome de empresa.

"placa": placa do caminhão.
  TIPO A → "Placa Cavalo Mecânico:"
  TIPO B → "Placa Caminhão:"
  Leia os 7 caracteres UM POR UM da esquerda para direita.
  Mercosul: 3 letras + 1 número + 1 letra + 2 números (ex: TDJ3C49).
  Não confunda: 0≠O, 1≠I, 8≠B, F≠T, G≠Q, Z≠2. Releia de trás para frente.

"placa_carreta":
  TIPO A → "Placa Semi-reboque:"
  TIPO B → "Placa Carreta:"
  Mesmas regras. Releia duas vezes.

"frota": valor exato após "Frota:" (ex: "SD287", "80825", "116").

"fat_bruto": valor do FRETE em reais.
  TIPO A → seção "PREÇO DE SERVIÇOS CONTRATADOS E QUITAÇÃO", linha "Frete Contratado"
    ⚠️ NÃO use "Peso:" — é peso da carga em kg, NÃO valor financeiro!
    ⚠️ NÃO use "Saldo a Receber" nem "Outros Créditos"
  TIPO B → seção "Valor do Serviço Contratado e Quitação", linha "(+) Frete Contratado:"
  Formato: VÍRGULA = decimal, PONTO = milhar.
  Ex: "374,73"→"374.73" | "8.527,22"→"8527.22" | "2.741,19"→"2741.19"
  SEMPRE retorne com ponto decimal e 2 casas.

"qtd_veiculos":
  TIPO A → campo "Quant.:"
  TIPO B → campo "Veículos:" (total)
  Apenas inteiro.

"origem": cidade e estado de origem exatos.
"destino": cidade e estado de destino final exatos.
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
          }
        ]
      }]
    })
  })

  const data = await response.json()
  const text = data.content?.[0]?.text || '{}'

  try {
    const parsed = JSON.parse(text.trim())

    // Converte frota pelo mapa
    if (parsed.frota) {
      const frotaLida = String(parsed.frota).trim()
      const frotaConvertida = MAPA_FROTA[frotaLida]
      if (frotaConvertida) parsed.frota = frotaConvertida
    }

    // Limpa CNPJ inválido ou do contratado
    const CNPJ_CONTRATADO = '66330549000152'
    if (parsed.cnpj) {
      const cnpjLimpo = parsed.cnpj.replace(/\D/g, '')
      if (cnpjLimpo.length < 14 || cnpjLimpo === CNPJ_CONTRATADO) {
        parsed.cnpj = ''
      }
    }

    // Valida e corrige data
    if (parsed.data) {
      const dataStr = String(parsed.data).trim()
      // Tenta converter formato DD/MM/YYYY para YYYY-MM-DD se necessário
      const matchBR = dataStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
      if (matchBR) {
        parsed.data = `${matchBR[3]}-${matchBR[2]}-${matchBR[1]}`
      }
      // Valida: ano deve ser entre 2024 e 2027
      const anoMatch = String(parsed.data).match(/^(\d{4})-/)
      if (anoMatch) {
        const ano = parseInt(anoMatch[1])
        if (ano < 2024 || ano > 2027) {
          parsed.data = ''
        }
      }
    }

    // Garante fat_bruto como número com ponto decimal
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
      if (!isNaN(num)) parsed.fat_bruto = String(num)
    }

    // Garante qtd_veiculos como inteiro
    if (parsed.qtd_veiculos) {
      parsed.qtd_veiculos = String(parseInt(String(parsed.qtd_veiculos)) || '')
    }

    return NextResponse.json(parsed)
  } catch {
    return NextResponse.json({ _erro: text }, { status: 200 })
  }
}