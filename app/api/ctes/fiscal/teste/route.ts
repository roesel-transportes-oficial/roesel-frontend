import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const BACKEND_URL = (process.env.ROESEL_BACKEND_URL || '').replace(/\/+$/, '')

// Testa o certificado e a conexão com a SEFAZ (botão "Testar SEFAZ" da tela de CT-e)
export async function GET(req: NextRequest) {
  if (!BACKEND_URL) {
    return NextResponse.json({ error: 'ROESEL_BACKEND_URL não configurada nas variáveis de ambiente da Vercel.' }, { status: 500 })
  }
  const authorization = req.headers.get('authorization')
  if (!authorization) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const pegar = async (caminho: string) => {
    try {
      const r = await fetch(`${BACKEND_URL}${caminho}`, { headers: { Authorization: authorization }, cache: 'no-store' })
      const dados = await r.json().catch(() => ({ detail: `Resposta inválida do backend (${r.status}).` }))
      return r.ok ? { ok: true, ...dados } : { ok: false, erro: dados?.detail || dados?.error || `Erro ${r.status}` }
    } catch (e: any) {
      return { ok: false, erro: `Backend não respondeu: ${e?.message || e}` }
    }
  }
  const certificado = await pegar('/ctes/fiscal/certificado')
  const sefaz = certificado.ok ? await pegar('/ctes/fiscal/status-sefaz') : { ok: false, erro: 'Teste da SEFAZ precisa do certificado funcionando.' }
  return NextResponse.json({ certificado, sefaz })
}
