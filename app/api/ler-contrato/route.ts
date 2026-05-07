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
EXISTEM 3 TIPOS DE CONTRATO:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TIPO A (SADA): PDF digital com seções em caixa alta "CONTRATANTE", "CONTRATADO", "EQUIPAMENTOS DE TRANSPORTE", "MOTORISTA", "SERVIÇOS CONTRATADOS", "PREÇO DE SERVIÇOS CONTRATADOS E QUITAÇÃO". Número após "VIAGENS:" no título.
TIPO B (BRAZUL / DACUNHA): mesma estrutura do TIPO A. Número após "VIAGENS:" no título.
TIPO C (AUTOPORT): cabeçalho com logo AUTOPORT, campos "Contrato:", "Data Contrato:", seções "Contratado", "Veículo", "Motorista/Preposto", "Valor do Serviço Contratado e Quitação".

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
IDENTIFICAÇÃO DO CLIENTE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TIPO A/B → cliente na seção "CONTRATANTE" campo "Nome:"
TIPO C → cliente no cabeçalho campo "Nome:" (empresa emitente)
CONTRATADO = Carlos Alberto Roesel Transportes — NUNCA é o cliente.
CNPJ do contratado é sempre 66330549000152 — NUNCA use esse.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CAMPOS A EXTRAIR:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

"contrato":
  TIPO A/B → número após "VIAGENS:" no título.
  TIPO C → campo "Contrato:" primeira linha. Formato AAAA/NNNNNN-N.
    ⚠️ NUNCA use "Número:", "Viagem:", "Planejamento:".
  ⚠️ Apenas dígitos, barras e hífens. OCR: B→8, O→0, I→1, S→5, G→6, Z→2.

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
TODAS as placas seguem o padrão MERCOSUL: exatamente 7 caracteres no formato:
  POSIÇÃO 1: LETRA
  POSIÇÃO 2: LETRA
  POSIÇÃO 3: LETRA
  POSIÇÃO 4: ALGARISMO (0-9)
  POSIÇÃO 5: LETRA
  POSIÇÃO 6: ALGARISMO (0-9)
  POSIÇÃO 7: ALGARISMO (0-9)
  Exemplo: R M H 9 C 9 0

PROCEDIMENTO OBRIGATÓRIO para cada placa:
  1. Localize o campo da placa no documento
  2. Leia os 7 caracteres UM POR UM da esquerda para a direita
  3. Para cada posição, aplique a regra:
     - Posições 1,2,3,5: devem ser LETRAS (A-Z). Se leu um número, você errou.
     - Posições 4,6,7: devem ser ALGARISMOS (0-9). Se leu uma letra, você errou.
     - Posição 4: se leu letra O → é 0, se leu letra I → é 1
     - Posições 6,7: mesma regra
  4. Valide: o resultado deve ter exatamente 7 chars no padrão AAA#A##
  5. Se não bater com o padrão, RELEIA a placa do zero

Confusões comuns a EVITAR:
  - R ↔ P (traço vertical + curvas)
  - H ↔ M ↔ N (traços verticais)
  - 9 ↔ 4 ↔ 7 (numerais parecidos)
  - C ↔ G ↔ 0 (letras/números curvos)
  - 8 ↔ B (curvas duplas)
  - 6 ↔ G ↔ 0

"placa":
  TIPO A/B → "Placa Cavalo Mecânico:"
  TIPO C → "Placa Caminhão:"
  Aplique o procedimento acima. Resultado deve ser AAA#A##.

"placa_carreta":
  TIPO A/B → "Placa Semi-reboque:"
  TIPO C → "Placa Carreta:"
  Aplique o procedimento acima. Resultado deve ser AAA#A##.

"frota": valor exato após "Frota:".

"fat_bruto":
  TIPO A/B → seção "PREÇO DE SERVIÇOS CONTRATADOS E QUITAÇÃO", linha "Frete Contratado"
    ❌ NUNCA use "Peso:" — é peso em KG!
    ❌ NUNCA use "Saldo a Receber", "Vale-Pedágio"
  TIPO C → linha "(+) Frete Contratado: X.XXX,XX" — valor após os dois pontos
  Formato: VÍRGULA=decimal, PONTO=milhar → retorne com ponto e 2 casas.

"qtd_veiculos":
  TIPO A/B → campo "Quant.:"
  TIPO C → campo "Veículos:" — leia o total. Se não identificar, some a distribuição por cidade.
  Inteiro.

"origem":
  TIPO A/B → campo "Origem:" na seção SERVIÇOS CONTRATADOS.
  TIPO C → campo "Origem:" na seção Serviços Contratados.
  ⚠️ Leia EXATAMENTE o que está escrito.

"destino":
  TIPO A/B → campo "Destino:" na seção SERVIÇOS CONTRATADOS.
  TIPO C → campo "Destino Final:" na seção Serviços Contratados.
  ⚠️ Leia EXATAMENTE o que está escrito.

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

    if (parsed.frota) {
      const frotaLida = String(parsed.frota).trim()
      const frotaConvertida = MAPA_FROTA[frotaLida]
      if (frotaConvertida) parsed.frota = frotaConvertida
    }

    if (parsed.contrato) {
      let contrato = String(parsed.contrato)
        .replace(/B/g, '8').replace(/O/g, '0').replace(/I/g, '1')
        .replace(/S/g, '5').replace(/G/g, '6').replace(/Z/g, '2')
        .replace(/[A-Z]/g, '').replace(/[^0-9\/\-]/g, '')
      if (/^\d{1,4}$/.test(contrato)) contrato = ''
      parsed.contrato = contrato
    }

    const CNPJ_CONTRATADO = '66330549000152'
    if (parsed.cnpj) {
      const cnpjLimpo = parsed.cnpj.replace(/\D/g, '')
      if (cnpjLimpo.length < 14 || cnpjLimpo === CNPJ_CONTRATADO) parsed.cnpj = ''
    }

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

    if (parsed.qtd_veiculos) {
      parsed.qtd_veiculos = String(parseInt(String(parsed.qtd_veiculos)) || '')
    }

    return NextResponse.json(parsed)
  } catch {
    return NextResponse.json({ _erro: text }, { status: 200 })
  }
}