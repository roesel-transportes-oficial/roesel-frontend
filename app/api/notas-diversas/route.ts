import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const BACKEND_URL = (process.env.ROESEL_BACKEND_URL || '').replace(/\/+$/, '')

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

  const resposta = await fetch(`${BACKEND_URL}/notas-diversas/${query ? '?' + query : ''}`, {
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
  const resposta = await fetch(`${BACKEND_URL}/notas-diversas/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: authorization },
    body: JSON.stringify(body),
  })
  const dados = await resposta.json()
  return NextResponse.json(dados, { status: resposta.status })
}