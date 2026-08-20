import { NextRequest, NextResponse } from 'next/server'

// ✅ Rota específica pra importação de NF-e — o frontend continua
// fazendo o PARSE do XML (isso é leitura de arquivo local, não precisa
// de backend), mas a GRAVAÇÃO no banco (nota fiscal + conta a pagar +
// vínculo com abastecimento) agora é uma operação só, no backend.
const BACKEND_URL = process.env.ROESEL_BACKEND_URL

export async function POST(req: NextRequest) {
  if (!BACKEND_URL) {
    return NextResponse.json(
      { error: 'ROESEL_BACKEND_URL não configurada nas variáveis de ambiente da Vercel.' },
      { status: 500 }
    )
  }

  const authorization = req.headers.get('authorization')
  if (!authorization) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const body = await req.json()
  const resposta = await fetch(`${BACKEND_URL}/contas-pagar/importar-nfe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: authorization },
    body: JSON.stringify(body),
  })
  const dados = await resposta.json()
  return NextResponse.json(dados, { status: resposta.status })
}