import { NextRequest, NextResponse } from 'next/server'

// ✅ Força essa rota a NUNCA ser armazenada em cache pela CDN da Vercel
// (diferente do "cache: 'no-store'" no fetch do frontend, que só
// controla o cache do NAVEGADOR — esse aqui controla o cache do
// SERVIDOR). Sem isso, uma resposta antiga (de antes dessas rotas
// existirem de verdade) pode ficar presa no cache de borda da Vercel
// e continuar sendo servida pra sempre pra chamadas com a mesma
// "assinatura" de cabeçalhos, mesmo depois do código já estar certo.
export const dynamic = 'force-dynamic'

const BACKEND_URL = process.env.ROESEL_BACKEND_URL

function semBackend() {
  return NextResponse.json(
    { error: 'ROESEL_BACKEND_URL não configurada nas variáveis de ambiente da Vercel.' },
    { status: 500 }
  )
}

export async function GET(req: NextRequest) {
  if (!BACKEND_URL) return semBackend()
  const authorization = req.headers.get('authorization')
  if (!authorization) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const query = searchParams.toString()

  const resposta = await fetch(`${BACKEND_URL}/ctes/${query ? '?' + query : ''}`, {
    headers: { Authorization: authorization },
  })
  const dados = await resposta.json()
  return NextResponse.json(dados, { status: resposta.status })
}

export async function POST(req: NextRequest) {
  if (!BACKEND_URL) return semBackend()
  const authorization = req.headers.get('authorization')
  if (!authorization) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const body = await req.json()
  const resposta = await fetch(`${BACKEND_URL}/ctes/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: authorization },
    body: JSON.stringify(body),
  })
  const dados = await resposta.json()
  return NextResponse.json(dados, { status: resposta.status })
}