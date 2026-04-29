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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<string | null>(null)
  const [perm, setPerm] = useState('')
  const [email, setEmail] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  async function carregarUsuario(emailAuth: string) {
    const { data } = await supabase
      .from('usuarios')
      .select('*')
      .eq('email', emailAuth)
      .limit(1)

    if (data && data.length > 0) {
      const u = data[0]
      setUser(u.nome || u.login)
      setPerm(u.perm)
      setEmail(u.email)
    } else {
      setUser(null)
      setPerm('')
      setEmail(null)
    }
  }

  // Limpa tokens zumbi do Supabase no localStorage
  function limparTokensZumbi() {
    try {
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('sb-') || key.startsWith('supabase')) {
          localStorage.removeItem(key)
        }
      })
      sessionStorage.clear()
    } catch (e) {
      console.warn('Erro ao limpar storage:', e)
    }
  }

  useEffect(() => {
    let timeoutSessao: NodeJS.Timeout

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Cancela timeout anterior se houver
      clearTimeout(timeoutSessao)

      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (session?.user?.email) {
          // Timeout de segurança: se carregarUsuario não resolver em 8 segundos,
          // o token é zumbi. Limpa tudo e libera a tela de login.
          timeoutSessao = setTimeout(() => {
            console.warn('Timeout ao carregar usuário — limpando sessão zumbi')
            limparTokensZumbi()
            supabase.auth.signOut().catch(() => {})
            setUser(null)
            setPerm('')
            setEmail(null)
            setLoading(false)
          }, 8000)

          try {
            await carregarUsuario(session.user.email)
            clearTimeout(timeoutSessao) // Deu certo, cancela o timeout
          } catch (e) {
            clearTimeout(timeoutSessao)
            console.warn('Erro ao carregar usuário, limpando sessão:', e)
            limparTokensZumbi()
            await supabase.auth.signOut().catch(() => {})
            setUser(null)
            setPerm('')
            setEmail(null)
          }
        }
        setLoading(false)
      } else if (event === 'SIGNED_OUT') {
        setUser(null)
        setPerm('')
        setEmail(null)
        setLoading(false)
      }
    })

    // Timeout geral: se nada acontecer em 10 segundos, libera a tela
    const timeoutGeral = setTimeout(() => {
      setLoading(false)
    }, 10000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeoutSessao)
      clearTimeout(timeoutGeral)
    }
  }, [])

  async function login(loginOrEmail: string, senha: string): Promise<string | null> {
    // IMPORTANTE: limpa qualquer token zumbi ANTES de tentar logar
    limparTokensZumbi()

    let emailLogin = loginOrEmail

    if (!loginOrEmail.includes('@')) {
      const { data } = await supabase
        .from('usuarios')
        .select('email, status')
        .eq('login', loginOrEmail)
        .limit(1)

      if (!data || data.length === 0) return 'Usuário não encontrado'
      if (data[0].status === 'pendente') return 'Conta aguardando aprovação do administrador'
      if (data[0].status === 'inativo') return 'Conta inativa'
      emailLogin = data[0].email
    } else {
      const { data } = await supabase
        .from('usuarios')
        .select('status')
        .eq('email', loginOrEmail)
        .limit(1)

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

  async function logout() {
    try {
      await supabase.auth.signOut()
    } catch (e) {
      console.warn('Erro ao fazer signOut no Supabase:', e)
    }

    limparTokensZumbi()

    setUser(null)
    setPerm('')
    setEmail(null)

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