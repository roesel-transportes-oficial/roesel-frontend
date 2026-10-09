import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_KEY
const FETCH_TIMEOUT_MS = 10_000

let _client: SupabaseClient | null = null

/**
 * Evita que uma requisição de rede fique pendurada indefinidamente.
 * O AbortSignal recebido pelo Supabase continua sendo respeitado; quando
 * ele existir, o timeout deste cliente é combinado com o cancelamento externo.
 */
async function fetchComTimeout(url: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const signalExterno = init?.signal
  let cancelarPorSinalExterno: (() => void) | undefined

  if (signalExterno) {
    if (signalExterno.aborted) {
      controller.abort()
    } else {
      cancelarPorSinalExterno = () => controller.abort()
      signalExterno.addEventListener('abort', cancelarPorSinalExterno, { once: true })
    }
  }

  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timeoutId)
    if (signalExterno && cancelarPorSinalExterno) {
      signalExterno.removeEventListener('abort', cancelarPorSinalExterno)
    }
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
      // O localStorage mantém a sessão disponível depois de uma aba ser
      // suspensa/restaurada e também evita uma nova autenticação acidental.
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      flowType: 'implicit',
      // Não substituir o lock interno do Supabase. Ele serializa a leitura
      // e a renovação da sessão com segurança.
    },
    global: {
      fetch: fetchComTimeout,
    },
  })

  return _client
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getClient()
    const value = Reflect.get(client, prop)
    return typeof value === 'function' ? value.bind(client) : value
  },
})
