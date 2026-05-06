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
  'SD287': '287',
  'S0287': '287',
  'SO287': '287',
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
IDENTIFICAÇÃO DO CLIENTE — REGRA CRÍTICA:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
O contrato tem DOIS lados distintos:
- CONTRATANTE = empresa cliente (quem paga o frete). Exemplos: SADA, AUTOPORT, BRAZUL, DACUNHA, etc.
- CONTRATADO = Carlos Alberto Roesel Transportes (transportadora — NUNCA é o cliente)

ATENÇÃO: leia o documento com cuidado. O CONTRATANTE está na seção "CONTRATANTE" ou no topo/cabeçalho como emitente do documento. O CNPJ correto é o do CONTRATANTE, não do CONTRATADO.

NUNCA coloque "Carlos Alberto Roesel" como cliente.
NUNCA use o CNPJ da seção "CONTRATADO" (66.330.549/0001-52).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CAMPOS A EXTRAIR:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

"contrato": número do contrato. Prioridade:
  1. Número após "VIAGENS:" no título (ex: "VIAGENS: 933117" → "933117")
  2. Campo "Contrato:" na primeira linha (ex: "Contrato: 2026/284494-13" → "2026/284494-13")
  Leia caractere por caractere com atenção máxima.

"data": data do CONTRATO. Formato YYYY-MM-DD. Prioridade:
  1. "Data Contrato:" — USE ESTE se existir
  2. "Data de Pagamento:"
  3. "Data:" no cabeçalho
  NUNCA use "Prazo do Contrato".

"cliente_nome_completo": nome EXATO do CONTRATANTE.
  Leia a seção "CONTRATANTE" campo "Nome:" com atenção total.
  Exemplos válidos: "DACUNHA NORDESTE TRANSPORTES LTDA", "SADA TRANSPORTES E ARMAZENAGENS LTDA", "BRAZUL TRANSPORTE DE VEÍCULOS LTDA", "AUTOPORT TRANSPORTES E LOGISTICA LTDA".
  NUNCA coloque Carlos Alberto Roesel.

"cnpj": CNPJ do CONTRATANTE. Leia 14 dígitos um por um diretamente da seção CONTRATANTE.
  NÃO use CNPJ da seção CONTRATADO (66330549000152).
  Se tiver dúvida retorne "".

"motorista": pessoa física na seção "MOTORISTA" ou "Motorista/Preposto" campo "NOME:".
  NUNCA coloque nome de empresa.

"placa": placa do caminhão. Procure: "Placa Cavalo Mecânico:", "Placa Caminhão:", "Placa Cavalo:".
  ATENÇÃO MÁXIMA: leia cada um dos 7 caracteres da esquerda para direita, um por um.
  Padrão antigo: 3 letras + 4 números (ex: QMZ9808).
  Padrão Mercosul: 3 letras + 1 número + 1 letra + 2 números (ex: QMZ9B08).
  Confusões PROIBIDAS: 0≠O, 1≠I, 8≠B, 9≠q, Z≠2, G≠Q, M≠N.
  Depois de ler, RELEIA os 7 caracteres de trás para frente para confirmar.

"placa_carreta": placa da carreta. Procure: "Placa Semi-reboque:", "Placa Carreta:".
  MESMAS regras de leitura da placa. Releia duas vezes antes de responder.

"frota": valor exato após "Frota:" incluindo prefixos (ex: "SD287", "S287", "M005", "116").

"fat_bruto": valor do frete contratado.
  FORMATO BRASILEIRO: VÍRGULA = decimal, PONTO = milhar.
  Retorne com PONTO decimal, 2 casas.
  Ex: "16.445,76" → "16445.76"
  Ex: "2.741,19" → "2741.19"
  NUNCA retorne sem decimal (ex: NUNCA "1644576").

"qtd_veiculos": total de veículos. Campo "Quant.:" ou "Veículos:". Apenas inteiro.

"origem": cidade e estado de origem exatos do documento.
"destino": cidade e estado de destino final exatos do documento.
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

    // Converte frota pelo mapa
    if (parsed.frota) {
      const frotaLida = String(parsed.frota).trim()
      const frotaConvertida = MAPA_FROTA[frotaLida]
      if (frotaConvertida) parsed.frota = frotaConvertida
    }

    // Limpa CNPJ inválido ou do contratado
    const CNPJ_CONTRATADO = '66330549000152'
    if (parsed.cnpj) {
      const cnpjLimpo = parsed.cnpj.replace(/\D/g, '')
      if (cnpjLimpo.length < 14 || cnpjLimpo === CNPJ_CONTRATADO) {
        parsed.cnpj = ''
      }
    }

    // Garante fat_bruto como número com ponto decimal
    if (parsed.fat_bruto !== undefined && parsed.fat_bruto !== '') {
      let val = String(parsed.fat_bruto).trim()
      if (val.includes(',')) {
        // Formato brasileiro: ponto=milhar, vírgula=decimal
        val = val.replace(/\./g, '').replace(',', '.')
      } else if (val.includes('.')) {
        // Já tem ponto — verifica se são múltiplos (milhar) ou único (decimal)
        const partes = val.split('.')
        if (partes.length > 2) {
          // Múltiplos pontos = separadores de milhar
          val = val.replace(/\./g, '')
          if (val.length > 2) val = val.slice(0, -2) + '.' + val.slice(-2)
        }
        // Um único ponto = já está correto como decimal
      } else {
        // Sem separador: assume últimos 2 dígitos são centavos
        if (val.length > 2) val = val.slice(0, -2) + '.' + val.slice(-2)
      }
      const num = parseFloat(val)
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