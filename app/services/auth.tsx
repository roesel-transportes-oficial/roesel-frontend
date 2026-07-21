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

    async function checkSession() {
      try {
        const sessionPromise = supabase.auth.getSession()
        const timeoutPromise = new Promise<null>((resolve) =>
          setTimeout(() => resolve(null), 5000)
        )

        const result = await Promise.race([sessionPromise, timeoutPromise])

        if (!mounted) return

        if (result === null) {
          console.warn('Timeout ao verificar sessão — indo para login')
          setUser(null); setPerm(''); setEmail(null)
          setLoading(false)
          return
        }

        const { data: { session } } = result
        if (session?.user?.email) {
          await carregarUsuario(session.user.email)
        }
      } catch (e) {
        console.warn('Erro ao verificar sessão:', e)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    checkSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          if (session?.user?.email) {
            await carregarUsuario(session.user.email)
          }
        } else if (event === 'SIGNED_OUT') {
          setUser(null); setPerm(''); setEmail(null)
        }
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  // ✅ Toda a função agora está protegida por try/catch — qualquer erro,
  // síncrono ou assíncrono, gera uma mensagem de erro em vez de travar
  // o botão pra sempre em "Entrando...".
  async function login(loginOrEmail: string, senha: string): Promise<string | null> {
    try {
      let emailLogin = loginOrEmail

      if (!loginOrEmail.includes('@')) {
        const { data, error: errBusca } = await supabase
          .from('usuarios')
          .select('email, status')
          .eq('login', loginOrEmail)
          .limit(1)

        if (errBusca) {
          console.warn('Erro ao buscar usuário por login:', errBusca)
          return 'Erro ao verificar usuário. Tente novamente.'
        }

        if (!data || data.length === 0) return 'Usuário não encontrado'
        if (data[0].status === 'pendente') return 'Conta aguardando aprovação do administrador'
        if (data[0].status === 'inativo') return 'Conta inativa'
        emailLogin = data[0].email
      } else {
        const { data, error: errBusca } = await supabase
          .from('usuarios')
          .select('status')
          .eq('email', loginOrEmail)
          .limit(1)

        if (errBusca) {
          console.warn('Erro ao buscar usuário por email:', errBusca)
          return 'Erro ao verificar usuário. Tente novamente.'
        }

        if (data && data.length > 0) {
          if (data[0].status === 'pendente') return 'Conta aguardando aprovação do administrador'
          if (data[0].status === 'inativo') return 'Conta inativa'
        }
      }

      // ✅ Timeout de segurança pro signInWithPassword em si
      const signInPromise = supabase.auth.signInWithPassword({
        email: emailLogin,
        password: senha,
      })
      const timeoutPromise = new Promise<'timeout'>((resolve) =>
        setTimeout(() => resolve('timeout'), 15000)
      )

      const result = await Promise.race([signInPromise, timeoutPromise])

      if (result === 'timeout') {
        console.warn('Timeout ao fazer login — tente novamente')
        return 'A conexão demorou demais. Tente novamente.'
      }

      const { error } = result
      if (error) return 'Usuário ou senha incorretos'
      return null
    } catch (e: any) {
      // ✅ Captura QUALQUER erro síncrono ou assíncrono dentro de login(),
      // inclusive erros lançados antes de qualquer chamada de rede
      // (ex: problema ao acessar o client do Supabase).
      console.error('Erro inesperado na função login():', e)
      return 'Erro inesperado: ' + (e?.message || 'tente novamente ou recarregue a página.')
    }
  }

  async function logout() {
    try {
      await supabase.auth.signOut()
    } catch (e) {
      console.warn('Erro ao fazer signOut:', e)
    }
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