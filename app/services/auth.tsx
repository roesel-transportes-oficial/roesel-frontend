'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'

const SESSION_TIMEOUT_MS = 15_000
const PROFILE_TIMEOUT_MS = 10_000
const LOGIN_TIMEOUT_MS = 20_000
const SENHA_MAX_AGE_DIAS = 60
const SENHA_MAX_AGE_MS = SENHA_MAX_AGE_DIAS * 24 * 60 * 60 * 1000

type PerfilUsuario = {
  nome: string | null
  login: string | null
  perm: string | null
  email: string | null
  status: string | null
  primeiro_acesso?: boolean | null
  senha_trocada_em?: string | null
}

interface AuthContextType {
  user: string | null
  perm: string
  email: string | null
  senhaExpirada: boolean
  login: (loginOrEmail: string, senha: string) => Promise<string | null>
  atualizarSenha: (novaSenha: string) => Promise<string | null>
  logout: () => void
  loading: boolean
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  perm: '',
  email: null,
  senhaExpirada: false,
  login: async () => null,
  atualizarSenha: async () => 'Usuário não autenticado',
  logout: () => {},
  loading: true,
})

async function comTimeout<T>(promessa: PromiseLike<T>, ms: number): Promise<T | null> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  const timeoutPromise = new Promise<null>((resolve) => {
    timeoutId = setTimeout(() => resolve(null), ms)
  })

  try {
    return await Promise.race([promessa, timeoutPromise])
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}

function senhaVencida(senhaTrocadaEm: string | null | undefined, primeiroAcesso: boolean | null | undefined) {
  if (primeiroAcesso === true) return true
  if (!senhaTrocadaEm) return false
  const data = new Date(senhaTrocadaEm).getTime()
  return !Number.isNaN(data) && Date.now() - data >= SENHA_MAX_AGE_MS
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<string | null>(null)
  const [perm, setPerm] = useState('')
  const [email, setEmail] = useState<string | null>(null)
  const [senhaExpirada, setSenhaExpirada] = useState(false)
  const [loading, setLoading] = useState(true)
  const mountedRef = useRef(false)
  const perfilRequestRef = useRef(0)

  const limparUsuario = useCallback(() => {
    if (!mountedRef.current) return
    setUser(null)
    setPerm('')
    setEmail(null)
    setSenhaExpirada(false)
  }, [])

  const carregarUsuario = useCallback(async (emailAuth: string): Promise<boolean> => {
    const requestId = ++perfilRequestRef.current

    try {
      const resultado = await comTimeout(
        supabase
          .from('usuarios')
          .select('nome, login, perm, email, status, primeiro_acesso, senha_trocada_em')
          .eq('email', emailAuth)
          .maybeSingle(),
        PROFILE_TIMEOUT_MS,
      )

      if (!resultado) {
        console.warn('Busca do perfil excedeu o limite de tempo.')
        return false
      }

      const { data, error } = resultado as {
        data: PerfilUsuario | null
        error: { message?: string } | null
      }

      if (!mountedRef.current || requestId !== perfilRequestRef.current) return true

      if (error) {
        console.warn('Erro ao buscar usuário:', error)
        return false
      }

      if (!data) {
        limparUsuario()
        return false
      }

      setUser(data.nome || data.login)
      setPerm(data.perm || '')
      setEmail(data.email || emailAuth)
      setSenhaExpirada(senhaVencida(data.senha_trocada_em, data.primeiro_acesso))
      return true
    } catch (error) {
      console.warn('Erro ao carregar perfil do usuário:', error)
      return false
    }
  }, [limparUsuario])

  const processarSessao = useCallback(async (session: { user?: { email?: string | null } } | null): Promise<boolean> => {
    const emailSessao = session?.user?.email
    if (!emailSessao) {
      limparUsuario()
      return false
    }

    const perfilCarregado = await carregarUsuario(emailSessao)
    if (!perfilCarregado) limparUsuario()
    return perfilCarregado
  }, [carregarUsuario, limparUsuario])

  useEffect(() => {
    mountedRef.current = true

    async function checkSession() {
      try {
        const resultado = await comTimeout(supabase.auth.getSession(), SESSION_TIMEOUT_MS)

        if (!mountedRef.current) return

        if (!resultado) {
          console.warn('Verificação de sessão excedeu o limite de tempo.')
          limparUsuario()
          return
        }

        const { data, error } = resultado
        if (error) {
          console.warn('Erro ao verificar sessão:', error)
          limparUsuario()
          return
        }

        await processarSessao(data.session)
      } catch (error) {
        console.warn('Erro ao verificar sessão:', error)
        if (mountedRef.current) limparUsuario()
      } finally {
        if (mountedRef.current) setLoading(false)
      }
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mountedRef.current) return

      if (event === 'SIGNED_OUT') {
        limparUsuario()
        return
      }

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'PASSWORD_RECOVERY') {
        window.setTimeout(() => {
          if (mountedRef.current) void processarSessao(session)
        }, 0)
      }
    })

    void checkSession()

    return () => {
      mountedRef.current = false
      subscription.unsubscribe()
    }
  }, [limparUsuario, processarSessao])

  async function login(loginOrEmail: string, senha: string): Promise<string | null> {
    async function processoDeLogin(): Promise<string | null> {
      let emailLogin = loginOrEmail.trim()

      if (!loginOrEmail.includes('@')) {
        const { data, error: errBusca } = await supabase
          .from('usuarios')
          .select('email, status')
          .eq('login', loginOrEmail)
          .limit(1)

        if (errBusca) return 'Erro ao verificar usuário. Tente novamente.'
        if (!data || data.length === 0) return 'Usuário não encontrado'
        if (data[0].status === 'pendente') return 'Conta aguardando aprovação do administrador'
        if (data[0].status === 'inativo') return 'Conta inativa'
        emailLogin = data[0].email
      } else {
        const { data, error: errBusca } = await supabase
          .from('usuarios')
          .select('status')
          .eq('email', emailLogin)
          .limit(1)

        if (errBusca) return 'Erro ao verificar usuário. Tente novamente.'
        if (data && data.length > 0) {
          if (data[0].status === 'pendente') return 'Conta aguardando aprovação do administrador'
          if (data[0].status === 'inativo') return 'Conta inativa'
        }
      }

      const { data: loginData, error } = await supabase.auth.signInWithPassword({
        email: emailLogin,
        password: senha,
      })

      if (error) return 'Usuário ou senha incorretos'

      const emailSessao = loginData.user?.email || emailLogin
      const perfilCarregado = await carregarUsuario(emailSessao)
      if (!perfilCarregado) return 'Login realizado, mas não foi possível carregar seu perfil. Tente novamente.'

      return null
    }

    const resultado = await comTimeout(processoDeLogin(), LOGIN_TIMEOUT_MS)
    if (resultado === null) return 'A conexão está muito lenta. Tente novamente em alguns instantes.'
    return resultado
  }

  async function atualizarSenha(novaSenha: string): Promise<string | null> {
    if (!email) return 'Usuário não autenticado.'
    if (novaSenha.length < 8) return 'A nova senha deve ter pelo menos 8 caracteres.'

    const { error: authError } = await supabase.auth.updateUser({ password: novaSenha })
    if (authError) return authError.message || 'Não foi possível atualizar a senha.'

    const { error: perfilError } = await supabase
      .from('usuarios')
      .update({ senha_trocada_em: new Date().toISOString(), primeiro_acesso: false })
      .eq('email', email)

    if (perfilError) {
      console.error('Senha alterada, mas não foi possível atualizar a data de validade:', perfilError)
      return 'A senha foi alterada, mas não foi possível registrar a validade. Tente novamente.'
    }

    setSenhaExpirada(false)
    return null
  }

  async function logout() {
    try {
      await supabase.auth.signOut()
    } catch (error) {
      console.warn('Erro ao fazer signOut:', error)
    } finally {
      limparUsuario()
      window.location.replace('/')
    }
  }

  return (
    <AuthContext.Provider value={{ user, perm, email, senhaExpirada, login, atualizarSenha, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
