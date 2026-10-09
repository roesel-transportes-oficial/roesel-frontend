import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const BACKEND_URL = (process.env.ROESEL_BACKEND_URL || '').replace(/\/+$/, '')

export async function POST(req: NextRequest) {
  if (!BACKEND_URL) {
    return NextResponse.json(
      { error: 'ROESEL_BACKEND_URL não configurada nas variáveis de ambiente da Vercel.' },
      { status: 500 }
    )
  }

  const authorization = req.headers.get('authorization')
  if (!authorization) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  }

  try {
    const body = await req.json()

    const resposta = await fetch(`${BACKEND_URL}/contratos/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authorization,
      },
      body: JSON.stringify(body),
    })

    const dados = await resposta.json()

    if (!resposta.ok) {
      return NextResponse.json(dados, { status: resposta.status })
    }

    return NextResponse.json(dados)
  } catch (e: any) {
    console.error('Erro ao repassar pro backend:', e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}