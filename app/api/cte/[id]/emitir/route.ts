import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.ROESEL_BACKEND_URL

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!BACKEND_URL) {
    return NextResponse.json(
      { error: 'ROESEL_BACKEND_URL não configurada nas variáveis de ambiente da Vercel.' },
      { status: 500 }
    )
  }
  const authorization = req.headers.get('authorization')
  if (!authorization) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const resposta = await fetch(`${BACKEND_URL}/ctes/${params.id}/emitir`, {
    method: 'POST',
    headers: { Authorization: authorization },
  })
  const dados = await resposta.json()
  return NextResponse.json(dados, { status: resposta.status })
}