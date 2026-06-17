import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_KEY!

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: typeof window !== 'undefined' ? window.sessionStorage : undefined,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    flowType: 'implicit',
    lock: async (name, acquireTimeout, fn) => fn(),
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