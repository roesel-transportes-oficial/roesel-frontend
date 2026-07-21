import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_KEY

let _client: SupabaseClient | null = null

// ✅ Trava simples em memória (mutex), sem depender da API navigator.locks
// do navegador — essa API pode ficar "presa" entre recarregamentos de
// página, travando o app pra sempre. Esta trava vive só na memória do
// JS desta aba e é sempre liberada corretamente.
let filaDeTravas: Promise<any> = Promise.resolve()

async function trancaSimples<T>(fn: () => Promise<T>): Promise<T> {
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
      lock: async (_name, _acquireTimeout, fn) => trancaSimples(fn),
    }
  })

  return _client
}

// ✅ Proxy: o client real só é instanciado (getClient()) na primeira
// propriedade acessada, ex: supabase.from(...) ou supabase.auth.getSession().
// Isso evita que o build estático (páginas como /_not-found) quebre
// tentando criar o client antes das env vars estarem disponíveis.
//
// IMPORTANTE: não passamos o "receiver" (a Proxy) para os getters —
// o SupabaseClient usa getters internos com campos privados (#) que dependem
// de rodar com "this" apontando pro client real, não pro Proxy.
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getClient()
    const value = (client as any)[prop]
    return typeof value === 'function' ? value.bind(client) : value
  }
})

// ── Recuperação após inatividade ──────────────────────────────────────────
if (typeof window !== 'undefined') {
  let ocultoDesde: number | null = null
  const LIMITE_INATIVIDADE_MS = 3 * 60 * 1000 // 3 minutos

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      ocultoDesde = Date.now()
    } else if (document.visibilityState === 'visible') {
      const tempoOculto = ocultoDesde ? Date.now() - ocultoDesde : 0
      ocultoDesde = null

      if (tempoOculto > LIMITE_INATIVIDADE_MS) {
        window.location.reload()
      } else {
        supabase.auth.getSession()
      }
    }
  })
}