import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_KEY

let _client: SupabaseClient | null = null

// ✅ Lock "vazio": desativa o navigator.locks do Supabase.
async function semTrava<R>(_name: string, _acquireTimeout: number, fn: () => Promise<R>): Promise<R> {
  return fn()
}

// ✅ FETCH GLOBAL COM TIMEOUT + RETRY — janelas mais curtas.
//
// Antes eram 6s + 10s = até 16s por chamada. Isso parecia ok isoladamente,
// mas o carregamento inicial da sessão faz DUAS chamadas em sequência
// (getSession + busca do usuário) — no pior caso, 16s + 16s = 32s de
// espera, o que o usuário sentia como "carregando muito tempo".
//
// Reduzido pra 4s + 6s = até 10s por chamada. Isso ainda cobre bem o
// caso de "conexão fria" real (que normalmente resolve em 1-3s na
// 2ª tentativa), mas evita que duas chamadas em sequência somem tempo
// demais. Se ainda assim demorar muito, o problema não é mais conexão
// fria — é a rede genuinamente instável, e nesse caso esperar mais
// não ajudaria de qualquer forma.
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
    return await tentar(8000)
  } catch (e: any) {
    console.warn('Falha na 1ª tentativa de conexão (conexão fria) — tentando de novo silenciosamente:', String(url), e?.message || e)
    await new Promise(r => setTimeout(r, 300))
    return await tentar(15000)
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
