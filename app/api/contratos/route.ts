import { NextRequest, NextResponse } from 'next/server'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Primeiro acorda o backend se necessário
    try {
      await fetch(`${API}/`, { method: 'GET', signal: AbortSignal.timeout(5000) })
    } catch {}

    const res = await fetch(`${API}/contratos/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000), // 30 segundos
    })

    const text = await res.text()
    console.log('Backend status:', res.status, 'Body:', text.slice(0, 200))

    if (!res.ok) return NextResponse.json({ error: text }, { status: res.status })

    try {
      return NextResponse.json(JSON.parse(text))
    } catch {
      return NextResponse.json({ ok: true })
    }
  } catch (e: any) {
    console.error('Route error:', e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export const maxDuration = 30