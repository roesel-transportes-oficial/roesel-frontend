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

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getClient()
    const value = (client as any)[prop]
    return typeof value === 'function' ? value.bind(client) : value
  }
})

// ═══════════════════════════════════════════════════════════════════════
// MODO DEMO — bloqueio no nível de rede, só para dados (/rest/v1/...)
// Não bloqueia /auth/v1/ — bloquear autenticação travava o app.
// ═══════════════════════════════════════════════════════════════════════

if (typeof window !== 'undefined' && !(window as any).__fetchPatchedParaDemo) {
  (window as any).__fetchPatchedParaDemo = true
  const fetchOriginal = window.fetch.bind(window)

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === 'string' ? input :
      input instanceof URL ? input.toString() :
      (input as Request).url

    const ehChamadaDeDados = !!supabaseUrl && url.startsWith(`${supabaseUrl}/rest/v1/`)

    if (permAtual === 'demo' && ehChamadaDeDados) {
      const method = (
        init?.method ||
        (typeof input !== 'string' && !(input instanceof URL) ? (input as Request).method : 'GET')
      ).toUpperCase()

      console.warn(`[MODO DEMO] Bloqueado fetch ${method} → ${url}`)

      if (method === 'GET' || method === 'HEAD') {
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      return new Response(JSON.stringify({}), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    return fetchOriginal(input, init)
  }
}

// ✅ REMOVIDO: o reload automático após inatividade (visibilitychange +
// window.location.reload()). Esse reload estava disparando em momentos
// ruins — no meio de uma renovação de token, por exemplo — e travando
// a tela em "Carregando..." depois de recarregar. Os timeouts de
// segurança já existentes em getSession() e login() (no auth.tsx) já
// protegem contra travamentos sem precisar de reload forçado da página.