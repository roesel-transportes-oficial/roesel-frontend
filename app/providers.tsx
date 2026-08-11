'use client'
import { useEffect } from 'react'
import { AuthProvider } from './services/auth'
import { supabase } from './services/supabase'

// ✅ Renova o token de sessão em segundo plano quando a aba volta a
// ficar visível — SEM recarregar a página.
//
// Por que isso e não um reload como antes: a versão anterior recarregava
// a página quando a checagem de sessão travava/falhava, e isso entrou
// em loop com o timeout do checkSession() do auth.tsx (um disparava o
// outro sem parar). Essa versão é bem mais simples e não tem esse
// risco: ela só pede pro Supabase renovar o token (refreshSession),
// sem reagir ao resultado de jeito nenhum — nem sucesso nem falha
// disparam reload. Se der certo, as próximas consultas das páginas já
// usam o token novo e funcionam de primeira. Se falhar, as próprias
// páginas (Contratos, Fechamento etc) já têm timeout + retry próprios
// e mostram erro visível em vez de ficar travado silenciosamente.
function RenovaSessaoAoVoltar() {
  useEffect(() => {
    function handleVisibilidade() {
      if (document.hidden) return
      supabase.auth.refreshSession().catch(() => {
        // Silencioso de propósito — se falhar, as páginas individuais
        // já tratam erro de conexão sozinhas. Não faz nada aqui pra
        // evitar qualquer risco de loop.
      })
    }

    document.addEventListener('visibilitychange', handleVisibilidade)
    return () => document.removeEventListener('visibilitychange', handleVisibilidade)
  }, [])

  return null
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <RenovaSessaoAoVoltar />
      {children}
    </AuthProvider>
  )
}