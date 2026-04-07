'use client'
import { createContext, useContext, useState, ReactNode } from 'react'

interface AuthCtx { user: string | null; perm: string; login: (s: string) => boolean; logout: () => void }
const Ctx = createContext<AuthCtx>({} as AuthCtx)

const SENHAS: Record<string, { nome: string; perm: string }> = {
  'admin123':  { nome: 'Administrador', perm: 'total' },
  'view123':   { nome: 'Visualizador',  perm: 'view'  },
  'demo123':   { nome: 'Demo',          perm: 'demo'  },
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<string | null>(null)
  const [perm, setPerm] = useState('view')

  function login(senha: string) {
    const u = SENHAS[senha]
    if (!u) return false
    setUser(u.nome); setPerm(u.perm); return true
  }

  function logout() { setUser(null); setPerm('view') }

  return <Ctx.Provider value={{ user, perm, login, logout }}>{children}</Ctx.Provider>
}

export function useAuth() { return useContext(Ctx) }