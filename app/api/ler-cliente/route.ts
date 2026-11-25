import { NextRequest, NextResponse } from 'next/server'

// A leitura do PDF pode passar de 10s (padrão do plano Hobby).
export const maxDuration = 60

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_KEY!

const PROMPT = `Extraia os dados do CONTRATANTE deste contrato de transporte e retorne APENAS um JSON válido, sem texto adicional, sem markdown:
{
  "nome": "nome ou razão social exata do contratante",
  "cnpj": "CNPJ somente números",
  "endereco": "endereço completo",
  "cep": "CEP somente números",
  "cidade": "cidade em maiúsculas",
  "estado": "UF com 2 letras maiúsculas",
  "telefone": "telefone somente números",
  "ie": "inscrição estadual somente números"
}`

const TIPOS_ACEITOS = ['application/pdf', 'image/png', 'image/jpeg']

// Só deixa usar a rota quem está logado no sistema.
async function usuarioLogado(req: NextRequest): Promise<boolean> {
  const auth = req.headers.get('authorization') || ''
  const token = auth.replace(/^Bearer\s+/i, '').trim()
  if (!token || token === SUPABASE_KEY) return false
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` },
  })
  return r.ok
}

export async function POST(req: NextRequest) {
  if (!(await usuarioLogado(req))) {
    return NextResponse.json({ _erro: 'Sessão expirada. Saia e entre novamente.' }, { status: 401 })
  }

  const chave = process.env.ANTHROPIC_API_KEY
  if (!chave) {
    return NextResponse.json({ _erro: 'Chave ANTHROPIC_API_KEY não configurada na Vercel.' }, { status: 500 })
  }

  const { base64, mediaType } = await req.json()
  if (typeof base64 !== 'string' || !TIPOS_ACEITOS.includes(mediaType)) {
    return NextResponse.json({ _erro: 'Arquivo inválido.' }, { status: 400 })
  }
  const isPDF = mediaType === 'application/pdf'

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': chave,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: [
          { type: isPDF ? 'document' : 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
          { type: 'text', text: PROMPT },
        ],
      }],
    }),
  })

  if (!response.ok) {
    console.error('Erro na leitura do contrato:', response.status, await response.text())
    return NextResponse.json({ _erro: `Erro ${response.status} ao ler o arquivo.` }, { status: 502 })
  }

  const data = await response.json()
  const text: string = data.content?.[0]?.text || ''
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return NextResponse.json({ _erro: 'Não foi possível extrair os dados.' }, { status: 200 })

  try {
    return NextResponse.json(JSON.parse(match[0]))
  } catch {
    return NextResponse.json({ _erro: 'Não foi possível extrair os dados.' }, { status: 200 })
  }
}
