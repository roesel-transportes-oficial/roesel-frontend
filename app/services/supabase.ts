import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_KEY

let _client: SupabaseClient | null = null

function getClient(): SupabaseClient {
  if (_client) return _client

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      'Supabase não configurado: verifique NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_KEY nas variáveis de ambiente da Vercel.'
    )
  }

  // ✅ Client único, criado UMA vez só e nunca recriado. Recriar o client
  // (como a função resetSupabaseClient fazia antes) gera uma SEGUNDA
  // instância do GoTrueClient competindo pela mesma trava de sessão no
  // sessionStorage — é isso que causava "Multiple GoTrueClient instances"
  // e os travamentos em cascata.
  _client = createClient(supabaseUrl, supabaseKey, {
    auth: {
      storage: typeof window !== 'undefined' ? window.sessionStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      flowType: 'implicit',
    }
  })

  return _client
}

let permAtual: string = ''
export function setPermAtual(perm: string) {
  permAtual = perm
}

function tabelaFalsaDemo(): any {
  const resultadoVazio = { data: [], error: null, count: 0 }
  const handler: ProxyHandler<any> = {
    get(_t, prop) {
      if (prop === 'then') return (resolve: any) => resolve(resultadoVazio)
      if (prop === 'single' || prop === 'maybeSingle') {
        return () => Promise.resolve({ data: null, error: null })
      }
      return (..._args: any[]) => tabelaFalsaDemo()
    }
  }
  return new Proxy({}, handler)
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getClient()

    if (prop === 'from') {
      return (tabela: string) => {
        if (permAtual === 'demo') {
          console.warn(`[MODO DEMO] Bloqueado acesso a "${tabela}" — retornando vazio.`)
          return tabelaFalsaDemo()
        }
        return (client as any).from(tabela)
      }
    }

    const value = (client as any)[prop]
    return typeof value === 'function' ? value.bind(client) : value
  }
})

// ── Recuperação após inatividade ──────────────────────────────────────────
if (typeof window !== 'undefined') {
  let ocultoDesde: number | null = null
  const LIMITE_INATIVIDADE_MS = 3 * 60 * 1000

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      ocultoDesde = Date.now()
    } else if (document.visibilityState === 'visible') {
      const tempoOculto = ocultoDesde ? Date.now() - ocultoDesde : 0
      ocultoDesde = null
      if (tempoOculto > LIMITE_INATIVIDADE_MS) {
        window.location.reload()
      }
    }
  })
}