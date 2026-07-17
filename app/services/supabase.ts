import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_KEY

let _client: SupabaseClient | null = null

function getClient(): SupabaseClient {
  if (_client) return _client

  if (!supabaseUrl || !supabaseKey) {
    // Isso só deve disparar em runtime real (browser) se as env vars
    // realmente não estiverem configuradas na Vercel — nunca durante
    // o build estático, pois o client não é criado até ser usado.
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
      lock: async (name, acquireTimeout, fn) => fn(),
    }
  })

  return _client
}

// ✅ Proxy: o client real só é instanciado (getClient()) na primeira
// propriedade acessada, ex: supabase.from(...) ou supabase.auth.getSession().
// Isso evita que o build estático (páginas como /_not-found) quebre
// tentando criar o client antes das env vars estarem disponíveis.
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    const client = getClient()
    const value = Reflect.get(client, prop, receiver)
    return typeof value === 'function' ? value.bind(client) : value
  }
})

// ── Recuperação após inatividade ──────────────────────────────────────────
// O navegador suspende conexões de rede em abas inativas por muito tempo.
// Quando isso acontece, requisições pendentes nunca recebem resposta e a
// tela fica travada em "carregando". A solução é detectar quanto tempo a
// aba ficou oculta e, se passou de um limite, recarregar a página inteira
// para garantir que tudo volte a funcionar.

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
        // Ficou tempo demais inativo — recarrega para evitar tela travada
        window.location.reload()
      } else {
        // Pouco tempo inativo — só renova a sessão, sem precisar recarregar
        supabase.auth.getSession()
      }
    }
  })
}