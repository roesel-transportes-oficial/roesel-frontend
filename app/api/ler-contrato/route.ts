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
            text: `Analise este contrato de transporte rodoviário com EXTREMO CUIDADO e extraia os dados. Responda APENAS com JSON válido, sem markdown, sem backticks, sem texto adicional.

REGRAS CRÍTICAS:

1. "motorista": nome da PESSOA FÍSICA na seção "MOTORISTA". NÃO é Carlos Alberto Roesel Transportes. É o motorista pessoa física listado na seção MOTORISTA.

2. "cliente_nome_completo": nome EXATO da empresa CONTRATANTE (quem está contratando o serviço, seção "CONTRATANTE"). Leia cada letra com cuidado. Copie exatamente como está escrito no documento.

3. "cnpj": CNPJ do CONTRATANTE. Formato XX.XXX.XXX/XXXX-XX. Leia CADA dígito com atenção — não confunda 1/7, 8/9, 3/8, 0/6.

4. "placa": placa do CAVALO MECÂNICO (campo "Placa Cavalo Mecânico"). 7 caracteres. Ex: QXA4C97.

5. "placa_carreta": placa da PLACA SEMI-REBOQUE (campo "Placa Semi-reboque"). 7 caracteres. Ex: HHF0311.

6. "frota": número exato após "Frota:" nos equipamentos de transporte.

7. "fat_bruto": valor em "Frete Contratado". Leia o valor COMPLETO com TODOS os dígitos. Use ponto como separador decimal. Ex: 11851.28 e NÃO 1851.28.

8. "qtd_veiculos": número no campo "Quant." nos serviços contratados.

9. "contrato": número após "VIAGENS:" ou "CONTRATO:" no título.

10. "origem": cidade e estado de origem (campo "Origem:").

11. "destino": cidade e estado de destino (campo "Destino:").

12. "data": data do campo "Data de Pagamento" no formato YYYY-MM-DD.

13. "status": sempre "ABERTO".

14. "chapa" e "obs": deixe vazio.

Retorne APENAS este JSON:
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

    return NextResponse.json(parsed)
  } catch {
    return NextResponse.json({ _erro: text }, { status: 200 })
  }
}