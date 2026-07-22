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
// MODO DEMO — bloqueio no nível de rede (window.fetch)
// ═══════════════════════════════════════════════════════════════════════
// Muitas telas fazem chamadas diretas via fetch() pra API REST do
// Supabase (padrão "supaFetch"), sem passar pelo client supabase-js e
// sem enviar o JWT do usuário — por isso RLS baseado em auth.jwt() não
// enxergava o usuário demo nessas chamadas.
//
// A solução aqui intercepta QUALQUER requisição do navegador para o
// domínio do Supabase, não importa qual código a disparou. Quando
// permAtual === 'demo': GET retorna lista vazia, qualquer escrita
// (POST/PATCH/PUT/DELETE) é bloqueada sem chegar ao banco.
// ═══════════════════════════════════════════════════════════════════════

if (typeof window !== 'undefined' && !(window as any).__fetchPatchedParaDemo) {
  (window as any).__fetchPatchedParaDemo = true
  const fetchOriginal = window.fetch.bind(window)

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === 'string' ? input :
      input instanceof URL ? input.toString() :
      (input as Request).url

    const ehChamadaSupabase = !!supabaseUrl && url.startsWith(supabaseUrl)

    if (permAtual === 'demo' && ehChamadaSupabase) {
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

      // POST / PATCH / PUT / DELETE: finge sucesso sem gravar nada
      return new Response(JSON.stringify({}), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    return fetchOriginal(input, init)
  }
}

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