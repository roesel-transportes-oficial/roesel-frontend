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

    async function checkSessionCompleta() {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user?.email) {
        await carregarUsuario(session.user.email)
      }
    }

    async function checkSession() {
      try {
        const processoPromise = checkSessionCompleta()
        const timeoutPromise = new Promise<'timeout'>((resolve) =>
          setTimeout(() => resolve('timeout'), 8000)
        )

        const resultado = await Promise.race([processoPromise, timeoutPromise])

        if (!mounted) return

        if (resultado === 'timeout') {
          console.warn('Timeout ao verificar sessão/permissão — mostrando tela de login')
          setUser(null); setPerm(''); setEmail(null)
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
          if (session?.user?.email) await carregarUsuario(session.user.email)
        } else if (event === 'SIGNED_OUT') {
          setUser(null); setPerm(''); setEmail(null)
        }
      }
    )

    return () => { mounted = false; subscription.unsubscribe() }
  }, [])

  // ✅ Antes, só o signInWithPassword (a última etapa) tinha timeout.
  // As consultas anteriores (buscar email pelo login, ou checar status
  // pelo email) não tinham proteção nenhuma — se travassem, o botão
  // ficava preso pra sempre, mesmo com o timeout "existindo" no código.
  // Agora todo o PROCESSO de login roda dentro de um único timeout.
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
      const timeoutPromise = new Promise<'timeout'>((resolve) =>
        setTimeout(() => resolve('timeout'), 15000)
      )

      const resultado = await Promise.race([processoDeLogin(), timeoutPromise])

      if (resultado === 'timeout') {
        console.warn('Timeout no processo de login — alguma consulta travou')
        return 'A conexão demorou demais. Recarregue a página (F5) e tente novamente.'
      }

      return resultado
    } catch (e: any) {
      console.error('Erro inesperado na função login():', e)
      return 'Erro inesperado: ' + (e?.message || 'tente novamente.')
    }
  }

  async function logout() {
    try { await supabase.auth.signOut() } catch (e) { console.warn('Erro ao fazer signOut:', e) }
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