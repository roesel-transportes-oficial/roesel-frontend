import { NextRequest, NextResponse } from 'next/server'

// Um arquivo só repassa todas as chamadas do MDF-e para o backend:
// /api/mdfes, /api/mdfes/{id}, /api/mdfes/{id}/emitir, /encerrar, /cancelar, /xml...
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const BACKEND_URL = (process.env.ROESEL_BACKEND_URL || '').replace(/\/+$/, '')

type Ctx = { params: Promise<{ caminho?: string[] }> }

async function repassar(req: NextRequest, ctx: Ctx, metodo: string) {
  if (!BACKEND_URL) {
    return NextResponse.json({ error: 'ROESEL_BACKEND_URL não configurada nas variáveis de ambiente da Vercel.' }, { status: 500 })
  }
  const authorization = req.headers.get('authorization')
  if (!authorization) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { caminho = [] } = await ctx.params
  const resto = caminho.map(encodeURIComponent).join('/')S
  const query = new URL(req.url).searchParams.toString()
  const url = `${BACKEND_URL}/mdfes/${resto}${query ? '?' + query : ''}`

  const temCorpo = metodo === 'POST' || metodo === 'PUT'
  const corpo = temCorpo ? await req.text() : undefined
  try {
    const resposta = await fetch(url, {
      method: metodo,
      headers: { Authorization: authorization, ...(temCorpo ? { 'Content-Type': 'application/json' } : {}) },
      body: temCorpo ? (corpo || '{}') : undefined,
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
export const PUT = (req: NextRequest, ctx: Ctx) => repassar(req, ctx, 'PUT')
export const DELETE = (req: NextRequest, ctx: Ctx) => repassar(req, ctx, 'DELETE')
