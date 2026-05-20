import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_KEY!

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: typeof window !== 'undefined' ? window.sessionStorage : undefined,
    persistSession: true,
    autoRefreshToken: true, // ← renova o token automaticamente
    detectSessionInUrl: false,
    flowType: 'implicit',
    lock: async (name, acquireTimeout, fn) => fn(),
  }
})

// Renova a sessão quando o usuário volta para a aba após ficar ausente
if (typeof window !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      supabase.auth.getSession()
    }
  })
}