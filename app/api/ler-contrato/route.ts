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

"contrato": número do contrato principal. ATENÇÃO — regras de prioridade:
  1. Se existir campo "Contrato:" na primeira linha/cabeçalho, use ESSE valor exato (ex: "Contrato: 2026/284494-13" → "2026/284494-13")
  2. Se existir "VIAGENS:" no título, use o número após ele (ex: "VIAGENS: 48587238" → "48587238")
  NÃO use campos "Viagem:", "Planejamento:" ou outros — apenas "Contrato:" ou "VIAGENS:".
  Leia o número com MÁXIMA atenção, caractere por caractere.

"data": data do CONTRATO. Formato YYYY-MM-DD. Prioridade:
  1. "Data Contrato:" — USE ESTE se existir
  2. "Data de Pagamento:"
  3. "Data:" no cabeçalho
  NUNCA use "Prazo do Contrato" — é prazo de entrega.

"cliente_nome_completo": nome EXATO da empresa CONTRATANTE.
  - Seção "CONTRATANTE" campo "Nome:" OU nome no cabeçalho/topo
  NUNCA coloque Carlos Alberto Roesel.

"cnpj": CNPJ do CONTRATANTE. Leia 14 dígitos um por um.
  Formato XX.XXX.XXX/XXXX-XX. Associado ao cliente, não ao contratado.
  Se tiver dúvida retorne "".

"motorista": nome da PESSOA FÍSICA motorista.
  - Seção "MOTORISTA" ou "Motorista/Preposto" campo "NOME:"
  NUNCA coloque nome de empresa.

"placa": placa do caminhão/cavalo mecânico. Procure por:
  "Placa Cavalo Mecânico:", "Placa Caminhão:", "Placa Cavalo:"
  7 caracteres. Não confunda: I↔1, H↔N, F↔T, 0↔O, 3↔B. Releia duas vezes.

"placa_carreta": placa da carreta. Procure por:
  "Placa Semi-reboque:", "Placa Carreta:", "Placa Semirreboque:"
  Mesmas regras acima.

"frota": número após "Frota:" — pode ter letras (ex: "S287", "M005").

"fat_bruto": valor do frete. Procure por "Frete Contratado" ou "(+) Frete Contratado:".
  FORMATO BRASILEIRO — REGRAS CRÍTICAS:
  - VÍRGULA = separador DECIMAL (centavos)
  - PONTO = separador de MILHAR (ignorar)
  - Retorne SEMPRE no formato americano com PONTO decimal
  Exemplos:
    "2.741,19" → retorne "2741.19"
    "22.878,98" → retorne "22878.98"
    "8.527,22"  → retorne "8527.22"
    "6.706,67"  → retorne "6706.67"
    "2741,19"   → retorne "2741.19"
  NUNCA remova a parte decimal. NUNCA retorne "274119" quando o valor é "2741.19".

"qtd_veiculos": número total de veículos. Procure "Quant.:" ou "Veículos:".
  Retorne apenas o inteiro total.

"origem": cidade e estado de origem.
"destino": cidade e estado de destino final.
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
    if (parsed.fat_bruto !== undefined && parsed.fat_bruto !== '') {
      let val = String(parsed.fat_bruto).trim()

      if (val.includes(',')) {
        // Formato brasileiro: ponto=milhar, vírgula=decimal
        val = val.replace(/\./g, '').replace(',', '.')
      } else if (val.includes('.')) {
        // Já tem ponto — verifica se é milhar ou decimal
        const partes = val.split('.')
        if (partes.length > 2) {
          // Múltiplos pontos = separadores de milhar, sem decimal
          val = val.replace(/\./g, '')
          if (val.length > 2) val = val.slice(0, -2) + '.' + val.slice(-2)
        }
        // Se tem só um ponto, já está no formato correto (ex: "2741.19")
      } else {
        // Sem separador nenhum: assume últimos 2 dígitos são centavos
        if (val.length > 2) {
          val = val.slice(0, -2) + '.' + val.slice(-2)
        }
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