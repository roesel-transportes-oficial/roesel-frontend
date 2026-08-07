import { NextResponse } from 'next/server'

// ✅ Rota de emissão de CT-e. Enquanto FOCUS_NFE_TOKEN não estiver
// configurado nas variáveis de ambiente da Vercel, retorna erro
// explicando o que falta — assim que o token existir, é só preencher
// a chamada real pra API do provedor aqui dentro.
const FOCUS_NFE_TOKEN = process.env.FOCUS_NFE_TOKEN

export async function POST(req: Request) {
  if (!FOCUS_NFE_TOKEN) {
    return NextResponse.json(
      { erro: 'Emissão de CT-e ainda não configurada — falta o token do provedor (FOCUS_NFE_TOKEN) nas variáveis de ambiente.' },
      { status: 501 }
    )
  }

  // TODO: quando o token existir, montar aqui a chamada real:
  // const dados = await req.json()
  // const resposta = await fetch('https://homologacao.focusnfe.com.br/v2/cte', {
  //   method: 'POST',
  //   headers: { Authorization: `Basic ${Buffer.from(FOCUS_NFE_TOKEN + ':').toString('base64')}`, 'Content-Type': 'application/json' },
  //   body: JSON.stringify(dados),
  // })
  // const resultado = await resposta.json()
  // return NextResponse.json(resultado)

  return NextResponse.json({ erro: 'Integração ainda não implementada.' }, { status: 501 })
}