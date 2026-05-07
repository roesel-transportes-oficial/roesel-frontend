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
  '8082S': '80825',
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
      max_tokens: 1500,
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
  ⚠️ Contém APENAS dígitos, barras (/) e hífens (-). NUNCA letras.
  ⚠️ Corrigir OCR: B→8, O→0, I→1, S→5, G→6, Z→2.

"data": Formato YYYY-MM-DD.
  TIPO A → "Data de Pagamento:" no topo direito
  TIPO B → "Data Contrato:" no topo direito
  ⚠️ NUNCA use "Data de Saída:" nem "Prazo do Contrato:".
  ⚠️ Formato DD/MM/AAAA → converta para AAAA-MM-DD.
  ⚠️ Ano é 2025 ou 2026.

"cliente_nome_completo":
  TIPO A → seção "CONTRATANTE" campo "Nome:"
  TIPO B → campo "Nome:" no cabeçalho
  NUNCA coloque Carlos Alberto Roesel.

"cnpj": CNPJ do cliente. 14 dígitos. NUNCA use 66330549000152.

"motorista":
  TIPO A → seção "MOTORISTA" campo "Nome:"
  TIPO B → seção "Motorista/Preposto" campo "NOME:"

"placa":
  TIPO A → "Placa Cavalo Mecânico:"
  TIPO B → "Placa Caminhão:"
  7 caracteres, um por um. Não confunda: 0≠O, 1≠I, 8≠B.

"placa_carreta":
  TIPO A → "Placa Semi-reboque:"
  TIPO B → "Placa Carreta:"

"frota": valor exato após "Frota:".

"fat_bruto":
  TIPO A → seção "PREÇO DE SERVIÇOS CONTRATADOS E QUITAÇÃO", linha "Frete Contratado"
    ❌ NUNCA use "Peso:" — é peso em KG, não dinheiro!
  TIPO B → linha "(+) Frete Contratado: X.XXX,XX" — valor após os dois pontos
  Formato: VÍRGULA=decimal, PONTO=milhar → retorne com ponto e 2 casas.

"qtd_veiculos": ━━ ATENÇÃO MÁXIMA ━━
  TIPO A → campo "Quant.:" — número simples, ex: "Quant: 10" → 10

  TIPO B → campo "Veículos:" — REGRA CRÍTICA:
    O formato é: "Veículos: TOTAL  X CIDADE1 / X CIDADE2 / X CIDADE3"
    O TOTAL é o número que aparece IMEDIATAMENTE após "Veículos:" antes de qualquer cidade.
    Os números que aparecem depois (como "1 FEIRA DE SANTANA", "1 JUAZEIRO") são a DISTRIBUIÇÃO por cidade — IGNORE-OS para este campo.

    Exemplos obrigatórios:
    "Veículos: 6  1 FEIRA DE SANTANA / 1 JUAZEIRO DO NORTE / 1 PETROLINA 1 TERESINA / 1 MOSSORO / 1 NATAL"
    → qtd_veiculos = 6  ✅  (NÃO 1 ❌)

    "Veículos: 3  3 JUIZ DE FORA"
    → qtd_veiculos = 3  ✅

    "Veículos: 11  11 CONTAGEM"
    → qtd_veiculos = 11  ✅

    Sempre retorne o número TOTAL, nunca o da distribuição.

"origem": cidade e estado de origem.
"destino": cidade e estado de destino final.
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

    // Normaliza número do contrato
    if (parsed.contrato) {
      parsed.contrato = String(parsed.contrato)
        .replace(/B/g, '8')
        .replace(/O/g, '0')
        .replace(/I/g, '1')
        .replace(/S/g, '5')
        .replace(/G/g, '6')
        .replace(/Z/g, '2')
        .replace(/[A-Z]/g, '')
        .replace(/[^0-9\/\-]/g, '')
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
      const matchBR = dataStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
      if (matchBR) {
        parsed.data = `${matchBR[3]}-${matchBR[2]}-${matchBR[1]}`
      }
      const anoMatch = String(parsed.data).match(/^(\d{4})-/)
      if (anoMatch) {
        const ano = parseInt(anoMatch[1])
        if (ano < 2024 || ano > 2027) parsed.data = ''
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
      if (!isNaN(num) && num > 0) {
        parsed.fat_bruto = String(num)
      } else {
        parsed.fat_bruto = ''
      }
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