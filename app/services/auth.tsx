'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'

interface AuthContextType {
  user: string | null
  perm: string
  email: string | null
  login: (loginOrEmail: string, senha: string) => Promise<string | null>
  logout: () => void
  loading: boolean
}

const AuthContext = createContext<AuthContextType>({
  user: null, perm: '', email: null,
  login: async () => null, logout: () => {}, loading: true
})

function limparTokenSessaoPresa() {
  if (typeof window === 'undefined') return
  try {
    Object.keys(window.sessionStorage)
      .filter(k => k.startsWith('sb-'))
      .forEach(k => window.sessionStorage.removeItem(k))
  } catch {}
}

async function comTimeout<T>(promessa: Promise<T>, ms: number): Promise<T | 'timeout'> {
  const timeoutPromise = new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), ms))
  return Promise.race([promessa, timeoutPromise])
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<string | null>(null)
  const [perm, setPerm] = useState('')
  const [email, setEmail] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  async function carregarUsuario(emailAuth: string) {
    const { data, error } = await supabase
      .from('usuarios')
      .select('nome, login, perm, email, status')
      .eq('email', emailAuth)
      .maybeSingle()

    if (error) {
      console.warn('Erro ao buscar usuário:', error)
      return
    }

    if (data) {
      setUser(data.nome || data.login)
      setPerm(data.perm)
      setEmail(data.email)
    } else {
      setUser(null); setPerm(''); setEmail(null)
    }
  }

  useEffect(() => {
    let mounted = true

    async function checkSessionCompleta() {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user?.email) {
        await carregarUsuario(session.user.email)
      }
    }

    async function checkSession() {
      try {
        // ✅ Apenas UM timeout de segurança aqui. O retry de "conexão
        // fria" já acontece sozinho dentro do supabase.ts (fetch global
        // com retry silencioso). Ter uma SEGUNDA camada de retry aqui
        // em cima causava dois problemas: tempos somados demais, e a
        // tentativa antiga continuava rodando escondida no fundo depois
        // que essa camada desistia e começava outra — o que deixava a
        // tela presa em estados inconsistentes (ex: botão preso em
        // "Entrando..." mesmo depois de já ter vindo uma resposta).
        const resultado = await comTimeout(checkSessionCompleta(), 20000)

        if (!mounted) return

        if (resultado === 'timeout') {
          console.warn('Verificação de sessão excedeu 20s — mostrando login')
          limparTokenSessaoPresa()
          setUser(null); setPerm(''); setEmail(null)
        }
      } catch (e) {
        console.warn('Erro ao verificar sessão:', e)
        limparTokenSessaoPresa()
      } finally {
        if (mounted) setLoading(false)
      }
    }

    checkSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          if (session?.user?.email) await carregarUsuario(session.user.email)
        } else if (event === 'SIGNED_OUT') {
          setUser(null); setPerm(''); setEmail(null)
        }
      }
    )

    return () => { mounted = false; subscription.unsubscribe() }
  }, [])

  async function login(loginOrEmail: string, senha: string): Promise<string | null> {
    async function processoDeLogin(): Promise<string | null> {
      let emailLogin = loginOrEmail

      if (!loginOrEmail.includes('@')) {
        const { data, error: errBusca } = await supabase
          .from('usuarios').select('email, status').eq('login', loginOrEmail).limit(1)
        if (errBusca) return 'Erro ao verificar usuário. Tente novamente.'
        if (!data || data.length === 0) return 'Usuário não encontrado'
        if (data[0].status === 'pendente') return 'Conta aguardando aprovação do administrador'
        if (data[0].status === 'inativo') return 'Conta inativa'
        emailLogin = data[0].email
      } else {
        const { data, error: errBusca } = await supabase
          .from('usuarios').select('status').eq('email', loginOrEmail).limit(1)
        if (errBusca) return 'Erro ao verificar usuário. Tente novamente.'
        if (data && data.length > 0) {
          if (data[0].status === 'pendente') return 'Conta aguardando aprovação do administrador'
          if (data[0].status === 'inativo') return 'Conta inativa'
        }
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: emailLogin,
        password: senha,
      })

      if (error) return 'Usuário ou senha incorretos'
      return null
    }

    try {
      // ✅ Apenas UM timeout de segurança, pelo mesmo motivo explicado
      // no checkSession(): o retry de conexão já acontece sozinho no
      // supabase.ts, então uma segunda camada de retry aqui só causava
      // tempos empilhados e tentativas antigas "fantasmas" rodando
      // escondidas, deixando o botão preso em "Entrando..." mesmo após
      // a resposta real (como "usuário ou senha incorretos") já ter
      // chegado por uma tentativa que a camada de fora já tinha descartado.
      const resultado = await comTimeout(processoDeLogin(), 20000)

      if (resultado === 'timeout') {
        limparTokenSessaoPresa()
        return 'A conexão está instável. Tente novamente em alguns instantes.'
      }

      return resultado
    } catch (e: any) {
      console.error('Erro inesperado na função login():', e)
      limparTokenSessaoPresa()
      return 'Erro inesperado: ' + (e?.message || 'tente novamente.')
    }
  }

  async function logout() {
    try { await supabase.auth.signOut() } catch (e) { console.warn('Erro ao fazer signOut:', e) }
    limparTokenSessaoPresa()
    setUser(null); setPerm(''); setEmail(null)
    window.location.replace('/')
  }

  return (
    <AuthContext.Provider value={{ user, perm, email, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}