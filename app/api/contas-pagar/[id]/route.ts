import { NextRequest, NextResponse } from 'next/server'

// ✅ Proxy fino pro backend — mesmo padrão do /api/contratos. Cobre
// listar (GET), criar (POST) e o endpoint especial de importação de
// NF-e, que fica em /api/contas-pagar/importar-nfe.
//
// ✅ force-dynamic: força essa rota a nunca ficar presa em cache de
// CDN da Vercel — sem isso, uma resposta antiga (de antes da rota
// existir de verdade) pode continuar sendo servida indefinidamente
// pra chamadas com a mesma "assinatura" de cabeçalhos.
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

  const resposta = await fetch(`${BACKEND_URL}/contas-pagar/${query ? '?' + query : ''}`, {
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
  const resposta = await fetch(`${BACKEND_URL}/contas-pagar/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: authorization },
    body: JSON.stringify(body),
  })
  const dados = await resposta.json()
  return NextResponse.json(dados, { status: resposta.status })
}