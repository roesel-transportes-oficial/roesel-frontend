import { NextRequest, NextResponse } from 'next/server'

// Repassa ao backend as ações do CT-e que não têm arquivo próprio:
// carta-correcao, dacte (PDF), eventos...
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const BACKEND_URL = (process.env.ROESEL_BACKEND_URL || '').replace(/\/+$/, '')
type Ctx = { params: Promise<{ id: string; acao: string }> }

async function repassar(req: NextRequest, ctx: Ctx, metodo: 'GET' | 'POST') {
  if (!BACKEND_URL) {
    return NextResponse.json({ error: 'ROESEL_BACKEND_URL não configurada nas variáveis de ambiente da Vercel.' }, { status: 500 })
  }
  const authorization = req.headers.get('authorization')
  if (!authorization) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  const { id, acao } = await ctx.params
  const corpo = metodo === 'POST' ? (await req.text()) || '{}' : undefined
  try {
    const resposta = await fetch(`${BACKEND_URL}/ctes/${encodeURIComponent(id)}/${encodeURIComponent(acao)}`, {
      method: metodo,
      headers: { Authorization: authorization, ...(corpo ? { 'Content-Type': 'application/json' } : {}) },
      body: corpo,
      cache: 'no-store',
    })
    const dados = await resposta.json().catch(() => ({ error: `Resposta inválida do backend (${resposta.status}).` }))
    return NextResponse.json(dados, { status: resposta.status })
  } catch (e: any) {
    return NextResponse.json({ error: `Backend não respondeu: ${e?.message || e}` }, { status: 502 })
  }
}

export const GET = (req: NextRequest, ctx: Ctx) => repassar(req, ctx, 'GET')
export const POST = (req: NextRequest, ctx: Ctx) => repassar(req, ctx, 'POST')
