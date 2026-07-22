'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import { supabase, resetSupabaseClient, setPermAtual } from './supabase'

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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<string | null>(null)
  const [perm, setPerm] = useState('')
  const [email, setEmail] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // ✅ Sempre que a permissão mudar (login, logout, troca de usuário),
  // sincroniza com o supabase.ts para o bloqueio de modo demo funcionar.
  useEffect(() => {
    setPermAtual(perm)
  }, [perm])

  async function carregarUsuario(emailAuth: string) {
    const { data, error } = await supabase
      .from('usuarios')
      .select('nome, login, perm, email, status')
      .eq('email', emailAuth)
      .maybeSingle()
    if (error) { console.warn('Erro ao buscar usuário:', error); return }
    if (data) {
      setUser(data.nome || data.login); setPerm(data.perm); setEmail(data.email)
    } else {
      setUser(null); setPerm(''); setEmail(null)
    }
  }

  useEffect(() => {
    let mounted = true

    async function checkSession() {
      try {
        const sessionPromise = supabase.auth.getSession()
        const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000))
        const result = await Promise.race([sessionPromise, timeoutPromise])

        if (!mounted) return

        if (result === null) {
          console.warn('Timeout ao verificar sessão — limpando sessão presa')
          resetSupabaseClient()
          setUser(null); setPerm(''); setEmail(null)
          setLoading(false)
          return
        }

        const { data: { session } } = result
        if (session?.user?.email) await carregarUsuario(session.user.email)
      } catch (e) {
        console.warn('Erro ao verificar sessão:', e)
        resetSupabaseClient()
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

  async function tentarSignIn(email: string, senha: string) {
    const signInPromise = supabase.auth.signInWithPassword({ email, password: senha })
    const timeoutPromise = new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), 8000))
    return Promise.race([signInPromise, timeoutPromise])
  }

  async function login(loginOrEmail: string, senha: string): Promise<string | null> {
    try {
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

      let result = await tentarSignIn(emailLogin, senha)

      if (result === 'timeout') {
        console.warn('Timeout no login — limpando sessão presa e tentando de novo')
        resetSupabaseClient()
        result = await tentarSignIn(emailLogin, senha)
      }

      if (result === 'timeout') {
        return 'A conexão demorou demais mesmo após nova tentativa. Recarregue a página (F5) e tente novamente.'
      }

      const { error } = result
      if (error) return 'Usuário ou senha incorretos'
      return null
    } catch (e: any) {
      console.error('Erro inesperado na função login():', e)
      resetSupabaseClient()
      return 'Erro inesperado: ' + (e?.message || 'tente novamente.')
    }
  }

  async function logout() {
    try { await supabase.auth.signOut() } catch (e) { console.warn('Erro ao fazer signOut:', e) }
    resetSupabaseClient()
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