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
  '135': '135',
  'M005': 'M005',
  'M009': 'M009',
  '1067': '1067',
  '4797': '4797/4717',
  '4717': '4797/4717',
  '4797/4717': '4797/4717',
  '8135': '8135',
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
REGRA PRINCIPAL — IDENTIFICAR O CLIENTE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
O contrato tem dois lados:
- CONTRATANTE = empresa cliente (quem paga). Ex: SADA, AUTOPORT, BRAZUL, etc.
- CONTRATADO = Carlos Alberto Roesel Transportes (nossa empresa — NUNCA é o cliente)

O cliente pode aparecer como:
- Seção "CONTRATANTE" com campo "Nome:"
- Empresa no cabeçalho/topo do documento (nome da empresa emitente)
- Campo "Nome:" antes do CNPJ no início do contrato

NUNCA coloque "Carlos Alberto Roesel" em nenhum campo.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CAMPOS A EXTRAIR:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

"contrato": número do contrato. Procure por:
  - Número após "VIAGENS:" no título (ex: "VIAGENS: 48587238" → "48587238")
  - Campo "Contrato:" (ex: "Contrato: 2026/284294-1" → "2026/284294-1")
  - Número principal no cabeçalho do documento

"data": data do CONTRATO (não prazo de entrega). Formato YYYY-MM-DD. Procure por:
  - "Data de Pagamento:"
  - "Data Contrato:" (use ESTE se existir, é o mais confiável)
  - "Data:" no cabeçalho
  NUNCA use "Prazo do Contrato" — esse é prazo de entrega, não a data.

"cliente_nome_completo": nome EXATO da empresa CONTRATANTE. Procure por:
  - Seção "CONTRATANTE" campo "Nome:"
  - Nome da empresa emitente no topo/cabeçalho
  NUNCA coloque Carlos Alberto Roesel ou variações.

"cnpj": CNPJ do CONTRATANTE (cliente). Leia 14 dígitos um por um.
  - Pode estar no formato XX.XXX.XXX/XXXX-XX
  - Associado ao nome do cliente, não ao contratado
  - Se tiver dúvida retorne ""

"motorista": nome da PESSOA FÍSICA motorista. Procure por:
  - Seção "MOTORISTA" — campo com nome completo
  - Seção "Motorista/Preposto" — campo "NOME:"
  NUNCA coloque o nome da empresa.

"placa": placa do caminhão/cavalo mecânico. Procure por:
  - "Placa Cavalo Mecânico:"
  - "Placa Caminhão:"
  - "Placa Cavalo:"
  Leia 7 caracteres um por um. Padrão antigo: 3 letras + 4 números. Padrão Mercosul: 3 letras + 1 número + 1 letra + 2 números.
  Não confunda: I↔1, H↔N, H↔I, F↔T, F↔P, 0↔O, 3↔B, 8↔B. Releia duas vezes.

"placa_carreta": placa da carreta/semirreboque. Procure por:
  - "Placa Semi-reboque:"
  - "Placa Carreta:"
  - "Placa Semirreboque:"
  Mesmas regras de leitura da placa acima.

"frota": número após "Frota:" — pode conter letras como prefixo (ex: "S287", "M005").

"fat_bruto": valor do frete. Procure por:
  - "Frete Contratado" (pode ter sinal + na frente)
  - "(+) Frete Contratado:"
  ATENÇÃO: em valores brasileiros a VÍRGULA é o separador DECIMAL e o PONTO é separador de milhar.
  Ex: "22.878,98" → retorne "22878.98"
  Ex: "8.527,22" → retorne "8527.22"
  Ex: "6.706,67" → retorne "6706.67"
  Ex: "22878,98" → retorne "22878.98"
  Sempre retorne com ponto como decimal, sem pontos de milhar.

"qtd_veiculos": quantidade de veículos. Procure por:
  - Campo "Quant.:"
  - Campo "Veículos:" (pegue o número TOTAL, não por destino)
  Retorne apenas o número inteiro.

"origem": cidade e estado de origem. Ex: "IGARAPE - MG" ou "Cariacica / ES"

"destino": cidade e estado de destino final. Ex: "DUQUE DE CAXIAS - RJ" ou "Contagem / MG"

"status": sempre "ABERTO"
"chapa": sempre ""
"obs": sempre ""

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
JSON de retorno (retorne SOMENTE isso):
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

    // Limpa CNPJ inválido
    if (parsed.cnpj && parsed.cnpj.replace(/\D/g, '').length < 14) {
      parsed.cnpj = ''
    }

    // Garante fat_bruto como número com ponto decimal
    if (parsed.fat_bruto && typeof parsed.fat_bruto === 'string') {
      const limpo = parsed.fat_bruto.replace(/\./g, '').replace(',', '.')
      const num = parseFloat(limpo)
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