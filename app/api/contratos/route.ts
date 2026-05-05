import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_KEY!

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const id = uuidv4()

    // Cria o contrato
    const resContrato = await fetch(`${SUPABASE_URL}/rest/v1/contratos`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...body, id }),
    })

    if (!resContrato.ok) {
      const err = await resContrato.text()
      return NextResponse.json({ error: err }, { status: resContrato.status })
    }

    // Gera comissão automaticamente
    const fatBruto = parseFloat(body.fat_bruto) || 0
    let mes = 0, ano = 0
    if (body.data) {
      const partes = body.data.split('-')
      ano = parseInt(partes[0])
      mes = parseInt(partes[1])
    }

    const comissao = {
      id: uuidv4(),
      contrato_id: id,
      contrato: body.contrato,
      motorista: body.motorista,
      data: body.data || null,
      fat_bruto: fatBruto,
      comissao_total: Math.round(fatBruto * 0.10 * 100) / 100,
      comissao_carga: Math.round(fatBruto * 0.05 * 100) / 100,
      comissao_folha: Math.round(fatBruto * 0.05 * 100) / 100,
      carga_paga: false,
      folha_paga: false,
      mes,
      ano,
    }

    await fetch(`${SUPABASE_URL}/rest/v1/comissoes`, {
      method: 'POST',
      headers,
      body: JSON.stringify(comissao),
    })

    return NextResponse.json({ id, ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}