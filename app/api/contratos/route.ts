import { NextRequest, NextResponse } from 'next/server'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_KEY!

const sbHeaders = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const id = crypto.randomUUID()

    const contrato = {
      id,
      motorista: body.motorista || '',
      cliente: body.cliente || '',
      cliente_nome_completo: body.cliente_nome_completo || body.cliente || '',
      cnpj: body.cnpj || '',
      placa: body.placa || '',
      placa_carreta: body.placa_carreta || '',
      frota: body.frota || '',
      contrato: body.contrato || '',
      data: body.data || null,
      fat_bruto: parseFloat(body.fat_bruto) || 0,
      chapa: parseFloat(body.chapa) || 0,
      origem: body.origem || '',
      destino: body.destino || '',
      qtd_veiculos: parseInt(body.qtd_veiculos) || 0,
      adiantamento_pago: body.adiantamento_pago || false,
      dt_pagamento: body.dt_pagamento || null,
      status: body.status || 'ABERTO',
      obs: body.obs || '',
    }

    const resContrato = await fetch(`${SUPABASE_URL}/rest/v1/contratos`, {
      method: 'POST',
      headers: sbHeaders,
      body: JSON.stringify(contrato),
    })

    if (!resContrato.ok) {
      const err = await resContrato.text()
      console.error('Supabase error:', err)
      return NextResponse.json({ error: err }, { status: resContrato.status })
    }

    // Gera comissão automaticamente
    const fatBruto = parseFloat(body.fat_bruto) || 0
    let mes = 0, ano = 0
    if (body.data) {
      try {
        const partes = body.data.split('-')
        ano = parseInt(partes[0])
        mes = parseInt(partes[1])
      } catch {}
    }

    await fetch(`${SUPABASE_URL}/rest/v1/comissoes`, {
      method: 'POST',
      headers: sbHeaders,
      body: JSON.stringify({
        id: crypto.randomUUID(),
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
      }),
    })

    return NextResponse.json({ id, ok: true })
  } catch (e: any) {
    console.error('Route error:', e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}