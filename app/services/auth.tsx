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
    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('email', emailAuth)
      .limit(1)

    if (error) {
      console.warn('Erro ao buscar usuário:', error)
      return
    }

    if (data && data.length > 0) {
      const u = data[0]
      setUser(u.nome || u.login)
      setPerm(u.perm)
      setEmail(u.email)
    } else {
      // Usuário autenticado no Supabase mas não existe na tabela usuarios.
      // Não força logout — deixa o estado vazio e o page.tsx mostra Login.
      setUser(null)
      setPerm('')
      setEmail(null)
    }
  }

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          if (session?.user?.email) {
            await carregarUsuario(session.user.email)
          }
          setLoading(false)
        } else if (event === 'SIGNED_OUT') {
          setUser(null)
          setPerm('')
          setEmail(null)
          setLoading(false)
        } else if (event === 'USER_UPDATED') {
          if (session?.user?.email) {
            await carregarUsuario(session.user.email)
          }
        }
      }
    )

    // Rede de segurança APENAS pra evitar tela de loading eterna
    // se onAuthStateChange nunca disparar (falha catastrófica de rede).
    // 15 segundos é generoso o bastante pra não interferir no fluxo normal.
    const safetyTimeout = setTimeout(() => {
      setLoading(false)
    }, 15000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(safetyTimeout)
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
    try {
      await supabase.auth.signOut()
    } catch (e) {
      console.warn('Erro ao fazer signOut:', e)
    }
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