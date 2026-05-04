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
            text: `Analise este contrato de transporte rodoviário e extraia os dados. Responda APENAS com JSON válido, sem markdown, sem backticks.

ESTRUTURA DO CONTRATO:
- Seção "CONTRATANTE": empresa cliente (quem paga pelo serviço)
- Seção "CONTRATADO": Carlos Alberto Roesel Transportes (nossa empresa — IGNORE para cliente/cnpj)
- Seção "EQUIPAMENTOS DE TRANSPORTE": dados do caminhão e carreta
- Seção "MOTORISTA": motorista pessoa física
- Seção "SERVIÇOS CONTRATADOS": origem, destino, data, quantidade
- Seção "PREÇO...": valores financeiros

CAMPOS A EXTRAIR:

"motorista": pessoa física na seção MOTORISTA. NUNCA coloque Carlos Alberto Roesel Transportes.

"cliente_nome_completo": nome EXATO da empresa na seção CONTRATANTE. NUNCA coloque Carlos Alberto Roesel.

"cnpj": CNPJ na seção CONTRATANTE campo "CNPJ:". Leia 14 dígitos um por um. NÃO copie CNPJ do CONTRATADO. Se tiver dúvida retorne "".

"placa": campo "Placa Cavalo Mecânico". ATENÇÃO: leia caractere por caractere da esquerda para a direita. Placas têm 7 caracteres: 3 letras + 1 número + 1 letra + 2 números (padrão Mercosul). Não confunda I/1, H/N, F/T, 0/O, 3/B.

"placa_carreta": campo "Placa Semi-reboque". ATENÇÃO MÁXIMA: leia cada um dos 7 caracteres separadamente. Placas têm 3 letras seguidas de 4 dígitos (padrão antigo) OU 3 letras + 1 número + 1 letra + 2 números (Mercosul). Confusões comuns a EVITAR: H≠I, H≠N, F≠T, F≠P, 0≠O, 1≠I, 3≠B, 8≠B. Releia a placa duas vezes antes de responder.

"frota": número após "Frota:".

"fat_bruto": "Frete Contratado". Todos os dígitos, ponto decimal. Ex: 11851.28

"qtd_veiculos": campo "Quant.".

"contrato": número após "VIAGENS:" ou "CONTRATO:" no título.

"origem": campo "Origem:".

"destino": campo "Destino:".

"data": campo "Data de Pagamento" formato YYYY-MM-DD.

"status": sempre "ABERTO".

"chapa": sempre "".

"obs": sempre "".

JSON de retorno:
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

    // Limpa CNPJ inválido
    if (parsed.cnpj && parsed.cnpj.replace(/\D/g, '').length < 14) {
      parsed.cnpj = ''
    }

    return NextResponse.json(parsed)
  } catch {
    return NextResponse.json({ _erro: text }, { status: 200 })
  }
}