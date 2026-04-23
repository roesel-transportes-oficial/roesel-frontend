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

REGRAS CRÍTICAS — leia com atenção máxima cada campo:

1. "motorista": nome da PESSOA FÍSICA na seção "MOTORISTA". NÃO é o contratado (empresa).

2. "cliente_nome_completo": nome EXATO da empresa na seção "CONTRATANTE". Leia cada letra com cuidado — erros como BRASIL em vez de BRAZUL são inaceitáveis. Copie exatamente como está escrito.

3. "cnpj": CNPJ do CONTRATANTE. Está logo abaixo do nome da empresa contratante, no campo "CNPJ:". Formato: XX.XXX.XXX/XXXX-XX com 14 dígitos no total. Leia CADA DÍGITO com atenção máxima — não confunda dígitos parecidos (1 e 7, 8 e 9, 3 e 8, 0 e 6). Se não encontrar, retorne string vazia.

4. "placa": placa do CAVALO MECÂNICO APENAS (campo "Placa Cavalo Mecânico"). Placas no padrão Mercosul têm 7 caracteres: 3 letras + 1 número + 1 letra + 2 números (ex: QMZ9B08). Leia CADA caractere — não confunda letras com números.

5. "frota": número exato após "Frota:" nos equipamentos de transporte.

6. "fat_bruto": valor em "Frete Contratado" na seção de preços. ATENÇÃO MÁXIMA: leia o valor COMPLETO com TODOS os dígitos. O valor pode ter 5 ou 6 dígitos antes da vírgula. Ex: 15552,3 e NÃO 1555,21. Ex: 22751,92 e NÃO 2751,92. Retorne sem símbolo R$, use ponto como separador decimal.

7. "qtd_veiculos": número no campo "Quant." nos serviços contratados.

8. "contrato": número após "VIAGENS:" ou "CONTRATO:" no título do documento.

9. "origem": cidade e estado de origem da viagem (campo "Origem:").

10. "destino": cidade e estado de destino da viagem (campo "Destino:").

11. "data": data no campo "Data de Saída" no formato YYYY-MM-DD. Se não houver "Data de Saída", use a data no campo "Data de Saída" nos serviços contratados. Não use "Data de Pagamento".

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