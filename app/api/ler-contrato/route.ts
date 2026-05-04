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

ESTRUTURA DO CONTRATO — leia nesta ordem:
- Seção "CONTRATANTE": empresa que contrata o serviço (cliente)
- Seção "CONTRATADO": Carlos Alberto Roesel Transportes (nossa empresa — IGNORE para cliente)
- Seção "EQUIPAMENTOS DE TRANSPORTE": dados do caminhão
- Seção "MOTORISTA": pessoa física que dirige
- Seção "SERVIÇOS CONTRATADOS": origem, destino, data, quantidade
- Seção "PREÇO DE SERVIÇOS CONTRATADOS E QUITAÇÃO": valores

REGRAS CRÍTICAS:

1. "motorista": nome da PESSOA FÍSICA na seção "MOTORISTA". NÃO é Carlos Alberto Roesel Transportes nem nenhuma empresa.

2. "cliente_nome_completo": nome EXATO da empresa na seção "CONTRATANTE" — primeira seção do contrato. NÃO é o CONTRATADO.

3. "cnpj": CNPJ que aparece na seção "CONTRATANTE", no campo "CNPJ:" logo abaixo do nome da empresa contratante. ATENÇÃO: este CNPJ começa com os mesmos dígitos do nome da empresa contratante. Leia dígito por dígito da esquerda para a direita. NÃO invente nem copie CNPJ de outra seção. Se não encontrar com certeza, retorne string vazia.

4. "placa": placa do CAVALO MECÂNICO (campo "Placa Cavalo Mecânico"). 7 caracteres.

5. "placa_carreta": placa SEMI-REBOQUE (campo "Placa Semi-reboque"). 7 caracteres.

6. "frota": número exato após "Frota:" nos equipamentos.

7. "fat_bruto": valor em "Frete Contratado". Leia TODOS os dígitos. Use ponto como decimal. Ex: 11851.28

8. "qtd_veiculos": número no campo "Quant." nos serviços contratados.

9. "contrato": número após "VIAGENS:" ou "CONTRATO:" no título.

10. "origem": cidade e estado no campo "Origem:".

11. "destino": cidade e estado no campo "Destino:".

12. "data": data do campo "Data de Pagamento" no formato YYYY-MM-DD.

13. "status": sempre "ABERTO".

14. "chapa" e "obs": sempre string vazia.

Retorne APENAS este JSON sem nenhum texto adicional:
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

    // Se o CNPJ vier vazio ou com menos de 14 dígitos, limpa para não dar match errado
    if (parsed.cnpj && parsed.cnpj.replace(/\D/g, '').length < 14) {
      parsed.cnpj = ''
    }

    return NextResponse.json(parsed)
  } catch {
    return NextResponse.json({ _erro: text }, { status: 200 })
  }
}