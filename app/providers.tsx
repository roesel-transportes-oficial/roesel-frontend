'use client'
import { useEffect } from 'react'
import { AuthProvider } from './services/auth'
import { supabase } from './services/supabase'

// ✅ Sem limite de tempo fixo. Toda vez que a aba volta a ficar visível
// (não importa se você ficou fora 1 minuto ou 5 horas), o sistema
// checa sozinho, em segundo plano, se a sessão ainda está válida.
//
// - Se estiver tudo certo → não acontece nada, você nem percebe.
// - Se a checagem travar ou falhar → só AÍ recarrega, como último
//   recurso, porque isso indica que algo realmente quebrou (sessão
//   expirada, conexão perdida) e só um recarregamento resolve.
//
// Isso troca o "recarrega depois de X minutos" por "só recarrega se
// precisar de verdade" — você pode ficar fora o tempo que quiser.
function VerificaSessaoAoVoltar() {
  useEffect(() => {
    async function handleVisibilidade() {
      if (document.hidden) return

      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 15000)

        const resultado = await Promise.race([
          supabase.auth.getSession(),
          new Promise<'timeout'>(resolve => setTimeout(() => resolve('timeout'), 15000)),
        ])
        clearTimeout(timeoutId)

        if (resultado === 'timeout') {
          console.warn('Checagem de sessão ao voltar para a aba expirou — recarregando.')
          window.location.reload()
          return
        }

        // Se a sessão sumiu (expirou de vez) enquanto a aba estava
        // escondida, recarrega pra cair na tela de login corretamente
        // em vez de deixar o sistema num estado incerto.
        const { data } = resultado as any
        if (!data?.session) {
          console.warn('Sessão não encontrada ao voltar para a aba — recarregando.')
          window.location.reload()
        }
      } catch (e) {
        console.warn('Erro ao checar sessão ao voltar para a aba — recarregando.', e)
        window.location.reload()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilidade)
    return () => document.removeEventListener('visibilitychange', handleVisibilidade)
  }, [])

  return null
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <VerificaSessaoAoVoltar />
      {children}
    </AuthProvider>
  )
}