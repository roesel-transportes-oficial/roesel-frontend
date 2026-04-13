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
        model: 'claude-opus-4-5',
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
                text: `Extraia as seguintes informações deste cupom fiscal de abastecimento e retorne APENAS um JSON válido, sem texto adicional, sem markdown, sem explicações:
{
  "cnpj_posto": "CNPJ do fornecedor/posto somente números sem pontuação",
  "nome_posto": "Nome ou razão social do posto/fornecedor",
  "cidade": "Cidade do posto em maiúsculas",
  "estado": "UF do posto com 2 letras maiúsculas",
  "litros_combustivel": número de litros de diesel/combustível (float, 0 se não houver),
  "valor_litro_combustivel": valor por litro do combustível em reais (float, 0 se não houver),
  "litros_arla": número de litros de Arla 32 (float, 0 se não houver),
  "valor_litro_arla": valor por litro do Arla em reais (float, 0 se não houver),
  "valor_total": valor total pago em reais (float),
  "data_abastecimento": "data no formato YYYY-MM-DD",
  "km": quilometragem do veículo (inteiro, null se não presente),
  "placa": "placa do veículo se presente, null se não presente"
}`,
              },
            ],
          },
        ],
      }),
    })

    const data = await response.json()
    const text = data.content?.[0]?.text || ''

    try {
      const parsed = JSON.parse(text)
      return NextResponse.json({ ok: true, dados: parsed })
    } catch {
      return NextResponse.json({ ok: false, erro: 'Não foi possível extrair os dados do cupom.' })
    }
  } catch (err) {
    return NextResponse.json({ ok: false, erro: 'Erro interno.' }, { status: 500 })
  }
}
