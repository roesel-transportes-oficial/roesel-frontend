import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_KEY

let _client: SupabaseClient | null = null

function criarClient(): SupabaseClient {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      'Supabase não configurado: verifique NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_KEY nas variáveis de ambiente da Vercel.'
    )
  }
  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      storage: typeof window !== 'undefined' ? window.sessionStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      flowType: 'implicit',
    }
  })
}

function getClient(): SupabaseClient {
  if (!_client) _client = criarClient()
  return _client
}

export function resetSupabaseClient() {
  if (typeof window !== 'undefined') {
    try {
      Object.keys(window.sessionStorage)
        .filter(k => k.startsWith('sb-'))
        .forEach(k => window.sessionStorage.removeItem(k))
    } catch {}
  }
  _client = null
}

// ═══════════════════════════════════════════════════════════════════════
// MODO DEMO — bloqueio central de escrita
// ═══════════════════════════════════════════════════════════════════════
// `permAtual` é atualizado pelo AuthProvider sempre que a permissão do
// usuário logado muda. Quando for 'demo', qualquer .insert/.update/
// .upsert/.delete em QUALQUER tabela, de QUALQUER página do sistema,
// é interceptado aqui e nunca chega ao banco — retorna uma resposta
// "de mentira" com sucesso, sem gravar nada. Isso evita ter que
// adicionar `if (perm !== 'demo')` em cada página individualmente.
// ═══════════════════════════════════════════════════════════════════════

let permAtual: string = ''

export function setPermAtual(perm: string) {
  permAtual = perm
}

function criarNoOpDemo(acao: string, tabela: string): any {
  console.warn(`[MODO DEMO] Ação bloqueada: ${acao} em "${tabela}" — nada foi gravado.`)
  const resultado = { data: null, error: null }
  const handler: ProxyHandler<any> = {
    get(_t, prop) {
      if (prop === 'then') return (resolve: any) => resolve(resultado)
      if (prop === 'catch' || prop === 'finally') return () => noop
      // Qualquer outro método encadeado (.eq, .select, .single, etc.)
      // retorna o próprio no-op, permitindo encadear sem quebrar.
      return (..._args: any[]) => noop
    },
    apply() { return noop }
  }
  const noop: any = new Proxy(function () {}, handler)
  return noop
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getClient()

    // Intercepta especificamente o .from(tabela) para poder bloquear
    // escrita tabela por tabela, mantendo leitura (.select) sempre livre.
    if (prop === 'from') {
      return (tabela: string) => {
        const builder = (client as any).from(tabela)
        if (permAtual !== 'demo') return builder

        return new Proxy(builder, {
          get(t, p) {
            if (['insert', 'update', 'upsert', 'delete'].includes(p as string)) {
              return (..._args: any[]) => criarNoOpDemo(String(p), tabela)
            }
            const v = (t as any)[p]
            return typeof v === 'function' ? v.bind(t) : v
          }
        })
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
      } else {
        supabase.auth.getSession()
      }
    }
  })
}