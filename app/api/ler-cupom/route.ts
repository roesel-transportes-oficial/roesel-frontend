import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { base64, mediaType } = await req.json()

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: mediaType === 'application/pdf' ? 'document' : 'image',
                source: { type: 'base64', media_type: mediaType, data: base64 },
              },
              {
                type: 'text',
                text: `Extraia as seguintes informações deste cupom fiscal de abastecimento e retorne APENAS um JSON válido, sem texto adicional, sem markdown, sem explicações.

ATENÇÃO:
- "litros_combustivel" é a quantidade de litros abastecidos (procure por "QTD", "LITROS", "L x", "469 L" etc)
- "valor_litro_combustivel" é o preço unitário por litro (procure por "VL UNIT", "R$/L", "x 6,45" etc)
- "cidade" e "estado" são do POSTO FORNECEDOR (primeiro CNPJ/endereço do cupom), NÃO do cliente comprador
- Ignore completamente o endereço do cliente/comprador que aparece depois
- "km" é a quilometragem do veículo se aparecer no cupom

JSON esperado:
{
  "cnpj_posto": "CNPJ do fornecedor somente números sem pontuação",
  "nome_posto": "Nome ou razão social do posto fornecedor",
  "cidade": "Cidade do posto em maiúsculas",
  "estado": "UF do posto com 2 letras maiúsculas",
  "litros_combustivel": 0,
  "valor_litro_combustivel": 0,
  "litros_arla": 0,
  "valor_litro_arla": 0,
  "valor_total": 0,
  "data_abastecimento": "YYYY-MM-DD",
  "km": null,
  "placa": null
}`,
              },
            ],
          },
        ],
      }),
    })

    const data = await response.json()
    const text = data.content?.[0]?.text || ''

    const match = text.match(/\{[\s\S]*\}/)
    if (match) {
      try {
        const parsed = JSON.parse(match[0])
        return NextResponse.json({ ok: true, dados: parsed })
      } catch {}
    }

    return NextResponse.json({ ok: false, erro: 'Não foi possível extrair os dados do cupom.', raw: text })
  } catch (err) {
    return NextResponse.json({ ok: false, erro: 'Erro interno.' }, { status: 500 })
  }
}