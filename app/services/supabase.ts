import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_KEY

let _client: SupabaseClient | null = null

// ✅ Lock "vazio": desativa o navigator.locks do Supabase.
async function semTrava<R>(_name: string, _acquireTimeout: number, fn: () => Promise<R>): Promise<R> {
  return fn()
}

// ✅ FETCH GLOBAL COM TIMEOUT + RETRY — agora cobrindo os DOIS tipos de
// falha de conexão:
//
// 1) TRAVAMENTO (a chamada não responde) — já existia, resolvido com
//    timeout de 6s + retry de mais 10s.
// 2) FALHA IMEDIATA (a chamada nem chega a sair — erro de rede genuíno,
//    comum logo depois de um reload de página, como acontece no
//    logout que navega pra "/" e recarrega tudo do zero) — esse tipo
//    de erro REJEITA na hora, não trava, então precisava de um retry
//    separado. Sem isso, era exatamente por isso que trocar de usuário
//    (logout → login de outro) às vezes precisava de várias tentativas
//    manuais até "pegar".
async function fetchComTimeoutERetry(url: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  async function tentar(timeoutMs: number): Promise<Response> {
    if (init?.signal) {
      return fetch(url, init)
    }
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const resposta = await fetch(url, { ...init, signal: controller.signal })
      clearTimeout(timeoutId)
      return resposta
    } catch (e) {
      clearTimeout(timeoutId)
      throw e
    }
  }

  try {
    return await tentar(6000)
  } catch (e: any) {
    // Antes só tentava de novo se fosse AbortError (timeout nosso).
    // Agora tenta de novo pra QUALQUER falha de rede na primeira
    // tentativa — cobre tanto travamento quanto erro imediato de
    // conexão fria — com uma pequena pausa antes de tentar de novo.
    console.warn('Falha na 1ª tentativa de conexão (conexão fria) — tentando de novo silenciosamente:', String(url), e?.message || e)
    await new Promise(r => setTimeout(r, 500))
    return await tentar(10000)
  }
}

function getClient(): SupabaseClient {
  if (_client) return _client

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      'Supabase não configurado: verifique NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_KEY nas variáveis de ambiente da Vercel.'
    )
  }

  _client = createClient(supabaseUrl, supabaseKey, {
    auth: {
      storage: typeof window !== 'undefined' ? window.sessionStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      flowType: 'implicit',
      lock: semTrava,
    },
    global: {
      fetch: fetchComTimeoutERetry,
    },
  })

  return _client
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getClient()
    const value = (client as any)[prop]
    return typeof value === 'function' ? value.bind(client) : value
  }
})