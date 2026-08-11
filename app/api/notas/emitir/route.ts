import { NextResponse } from 'next/server'

// ✅ Rota de emissão pra NFS-e, Devolução e Remessa. Usa o MESMO token
// do CT-e (FOCUS_NFE_TOKEN), já que é o mesmo provedor cobrindo os
// diferentes tipos de documento fiscal.
const FOCUS_NFE_TOKEN = process.env.FOCUS_NFE_TOKEN

export async function POST(req: Request) {
  const { tipo } = await req.json().catch(() => ({ tipo: '' }))

  if (!FOCUS_NFE_TOKEN) {
    return NextResponse.json(
      { erro: 'Emissão ainda não configurada — falta o token do provedor (FOCUS_NFE_TOKEN) nas variáveis de ambiente.' },
      { status: 501 }
    )
  }

  // TODO: quando o token existir, cada tipo chama um endpoint diferente
  // do provedor:
  //   nfse      → POST /v2/nfse
  //   devolucao → POST /v2/nfe (com natureza de operação de devolução)
  //   remessa   → POST /v2/nfe (com natureza de operação de remessa)
  //
  // const endpoint = tipo === 'nfse' ? '/v2/nfse' : '/v2/nfe'
  // const resposta = await fetch(`https://homologacao.focusnfe.com.br${endpoint}`, {
  //   method: 'POST',
  //   headers: { Authorization: `Basic ${Buffer.from(FOCUS_NFE_TOKEN + ':').toString('base64')}`, 'Content-Type': 'application/json' },
  //   body: JSON.stringify(dados),
  // })
  // return NextResponse.json(await resposta.json())

  return NextResponse.json({ erro: `Integração de ${tipo} ainda não implementada.` }, { status: 501 })
}
