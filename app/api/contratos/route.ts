import { NextRequest, NextResponse } from 'next/server'

// ✅ Essa rota deixou de duplicar a lógica de criar contrato + gerar
// comissão direto no Supabase (com a chave anônima). Agora ela é só
// um "proxy fino": repassa a chamada pro backend Python de verdade
// (que já faz exatamente essa lógica em routers/contratos.py), levando
// junto o token de login do usuário — o backend agora exige isso.
//
// Por que passar pelo Next.js em vez do frontend chamar o backend
// direto? Porque isso mantém a URL do backend fora do navegador (não
// precisa virar uma variável NEXT_PUBLIC_*), e evita configurar CORS
// pra aceitar chamadas direto do navegador — só o próprio servidor da
// Vercel (rodando esse route.ts) conversa com o backend.
const BACKEND_URL = process.env.ROESEL_BACKEND_URL

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