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
            text: `Analise este contrato de transporte rodoviário com MUITO CUIDADO e extraia os dados. Responda APENAS com JSON válido, sem markdown, sem backticks.

Instruções DETALHADAS:
- "motorista": nome da PESSOA FÍSICA na seção chamada "MOTORISTA" (NÃO é o CONTRATADO que é empresa)
- "cliente_nome_completo": nome da empresa na seção "CONTRATANTE"
- "cnpj": CNPJ da empresa CONTRATANTE (leia com cuidado cada dígito)
- "contrato": número após "VIAGENS:" ou "CONTRATO:" no título
- "placa": placa do CAVALO MECÂNICO (Placa Cavalo Mecânico), NÃO a placa semirreboque
- "frota": número após "Frota:" — leia com MUITA ATENÇÃO cada dígito
- "origem": cidade/estado de origem da viagem
- "destino": cidade/estado de destino da viagem
- "qtd_veiculos": número no campo "Quant." — leia com MUITA ATENÇÃO, pode ser 11, 12, etc.
- "fat_bruto": valor em "Frete Contratado" — número sem símbolo, ponto como decimal
- "data": data em "Data de Saída" no formato YYYY-MM-DD
- "status": sempre "ABERTO"
- "obs": deixe vazio

Retorne exatamente este JSON sem nenhum texto adicional:
{
  "motorista": "",
  "cliente_nome_completo": "",
  "cnpj": "",
  "placa": "",
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

    // Converte frota do contrato para frota da empresa
    if (parsed.frota) {
      const frotaLida = String(parsed.frota).trim()
      const frotaConvertida = MAPA_FROTA[frotaLida]
      if (frotaConvertida) parsed.frota = frotaConvertida
    }

    return NextResponse.json(parsed)
  } catch {
    return NextResponse.json({ _erro: text }, { status: 200 })
  }
}