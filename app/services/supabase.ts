import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_KEY

let _client: SupabaseClient | null = null

// ✅ Trava simples, só em memória do JavaScript — NÃO usa a API
// navigator.locks do navegador. A trava padrão do Supabase usa essa API,
// que é "presa ao navegador" e pode ficar órfã se a página recarregar
// (F5) no meio de uma operação — a página nova espera uma trava que
// nunca é liberada, travando pra sempre. Essa trava em memória nasce
// sempre limpa a cada F5, porque o módulo JS é recriado do zero.
let filaDeTravas: Promise<any> = Promise.resolve()

async function trancaEmMemoria<T>(fn: () => Promise<T>): Promise<T> {
  const execucaoAnterior = filaDeTravas
  let liberar: () => void
  filaDeTravas = new Promise<void>((resolve) => { liberar = resolve })

  await execucaoAnterior
  try {
    return await fn()
  } finally {
    liberar!()
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
      lock: async (_name, _acquireTimeout, fn) => trancaEmMemoria(fn),
    }
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