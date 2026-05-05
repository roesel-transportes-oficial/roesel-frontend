import { NextRequest, NextResponse } from 'next/server'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    console.log('API URL:', API)
    console.log('Body:', JSON.stringify(body))
    
    const res = await fetch(`${API}/contratos/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    
    const text = await res.text()
    console.log('Backend response:', res.status, text)
    
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