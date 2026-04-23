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
            text: `Analise este contrato de transporte rodoviário com EXTREMO CUIDADO letra por letra e extraia os dados. Responda APENAS com JSON válido, sem markdown, sem backticks, sem texto adicional.

REGRAS CRÍTICAS — leia com atenção máxima:

1. "motorista": nome da PESSOA FÍSICA na seção "MOTORISTA". NÃO é o contratado (empresa).

2. "cliente_nome_completo": nome EXATO da empresa na seção "CONTRATANTE". Leia cada letra com cuidado — erros de digitação como SANA em vez de SADA são inaceitáveis.

3. "cnpj": CNPJ do CONTRATANTE. Leia CADA DÍGITO com atenção máxima. O CNPJ tem 14 dígitos no formato XX.XXX.XXX/XXXX-XX. Não confunda dígitos parecidos (ex: 1 e 7, 8 e 9, 3 e 8).

4. "placa": placa do CAVALO MECÂNICO APENAS. Placas no padrão Mercosul têm 7 caracteres: 3 letras + 1 número + 1 letra + 2 números (ex: RMH9C90). Leia CADA caractere com atenção — não confunda letras com números (ex: C com 0, B com 8).

5. "frota": número exato após "Frota:" — leia com atenção cada dígito.

6. "fat_bruto": valor em "Frete Contratado". Leia o valor COMPLETO com todos os dígitos. Ex: 22751,92 e não 2751,92. Retorne sem símbolo R$, use ponto como separador decimal.

7. "qtd_veiculos": número no campo "Quant." — leia com atenção.

8. "contrato": número após "VIAGENS:" ou "CONTRATO:" no título.

9. "origem": cidade e estado de origem da viagem.

10. "destino": cidade e estado de destino da viagem.

11. "data": data em "Data de Saída" no formato YYYY-MM-DD.

12. "status": sempre "ABERTO".

13. "chapa" e "obs": deixe vazio.

Retorne APENAS este JSON sem nenhum texto adicional:
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