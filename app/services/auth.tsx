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

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (session?.user?.email) {
          try {
            await carregarUsuario(session.user.email)
          } catch (e) {
            // Token zumbi: sessão existe mas falhou ao buscar dados do usuário
            // Limpa tudo e força volta pra tela de login
            console.warn('Token inválido detectado, limpando sessão:', e)
            await supabase.auth.signOut().catch(() => {})
            Object.keys(localStorage).forEach(key => {
              if (key.startsWith('sb-') || key.startsWith('supabase')) {
                localStorage.removeItem(key)
              }
            })
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

    const timeout = setTimeout(() => setLoading(false), 5000)
    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [])

  async function login(loginOrEmail: string, senha: string): Promise<string | null> {
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
    // 1. Tenta fazer signOut no Supabase, mas não trava se der erro de rede
    try {
      await supabase.auth.signOut()
    } catch (e) {
      console.warn('Erro ao fazer signOut no Supabase:', e)
    }

    // 2. Limpa MANUALMENTE qualquer token zumbi do Supabase no navegador
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

    // 3. Reseta o estado da aplicação
    setUser(null)
    setPerm('')
    setEmail(null)

    // 4. Força reload COMPLETO da página (limpa cache do Next.js, service workers)
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