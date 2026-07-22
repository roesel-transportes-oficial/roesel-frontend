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

  // ✅ Configuração padrão da biblioteca, sem "lock" customizado.
  // Tentativas de trava própria (memória, bypass) causaram mais bugs
  // do que resolveram — o comportamento padrão do Supabase já é testado
  // pela própria equipe deles. A proteção contra travamento fica a cargo
  // do timeout de segurança no auth.tsx, não de reinventar a trava aqui.
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

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getClient()
    const value = (client as any)[prop]
    return typeof value === 'function' ? value.bind(client) : value
  }
})