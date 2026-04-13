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

  useEffect(() => {
    const stored = localStorage.getItem('roesel_user')
    if (stored) {
      const parsed = JSON.parse(stored)
      setUser(parsed.user)
      setPerm(parsed.perm)
      setEmail(parsed.email)
    }
    setLoading(false)
  }, [])

  async function login(loginOrEmail: string, senha: string): Promise<string | null> {
    // Busca usuário por login ou email
    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .or(`login.eq.${loginOrEmail},email.eq.${loginOrEmail}`)
      .single()

    if (error || !data) return 'Usuário não encontrado'
    if (data.senha !== senha) return 'Senha incorreta'
    if (data.status === 'pendente') return 'Conta aguardando aprovação do administrador'
    if (data.status === 'inativo') return 'Conta inativa'

    const userData = { user: data.nome || data.login, perm: data.perm, email: data.email }
    localStorage.setItem('roesel_user', JSON.stringify(userData))
    setUser(userData.user)
    setPerm(userData.perm)
    setEmail(userData.email)
    return null
  }

  function logout() {
    localStorage.removeItem('roesel_user')
    setUser(null); setPerm(''); setEmail(null)
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