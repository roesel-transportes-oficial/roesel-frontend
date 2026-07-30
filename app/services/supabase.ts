import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_KEY

let _client: SupabaseClient | null = null

// ✅ Lock "vazio": desativa o navigator.locks do Supabase.
// Evita travamento quando um lock de uma aba anterior fica preso.
async function semTrava<R>(_name: string, _acquireTimeout: number, fn: () => Promise<R>): Promise<R> {
  return fn()
}

// ✅ FETCH GLOBAL COM TIMEOUT + RETRY SILENCIOSO
// ─────────────────────────────────────────────────────────────────────
// Esse é o coração da correção: TODA chamada que o Supabase faz (tanto
// consultas ao banco quanto autenticação) passa por essa função — não
// importa em qual página. Antes, só o login/sessão tinham proteção
// contra travamento; qualquer outra chamada (buscar motoristas,
// clientes, caminhões etc.) podia ficar esperando pra sempre se a
// conexão estivesse "fria" — o que acontece depois de F5 ou depois de
// voltar de outra aba do navegador (o navegador pausa a aba em segundo
// plano e a conexão precisa ser reestabelecida).
//
// Com isso: 1ª tentativa rápida (6s) → se travar, tenta de novo sozinho
// (mais 10s) sem mostrar nada pro usuário → só desiste e deixa o erro
// estourar (que cada página já trata do seu jeito) se as duas falharem.
async function fetchComTimeoutERetry(url: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  async function tentar(timeoutMs: number): Promise<Response> {
    // Se quem chamou já passou um signal próprio (ex: telas que usam seu
    // próprio AbortController), respeitamos ele e não competimos com ele.
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
    if (e?.name === 'AbortError') {
      console.warn('Requisição lenta (conexão fria) — tentando de novo silenciosamente:', String(url))
      return await tentar(10000)
    }
    throw e
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