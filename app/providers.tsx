'use client'
import { useEffect, useRef } from 'react'
import { AuthProvider } from './services/auth'

// ✅ ÚNICO mecanismo de recarregamento automático no sistema — de
// propósito, pra nunca mais entrar naquele loop que já tivemos
// (quando dois mecanismos diferentes ficavam se disparando um ao
// outro). Esse aqui só faz uma coisa: se a checagem de login (que já
// tem seu próprio limite de 45s dentro do auth.tsx) passar muito
// tempo "Carregando..." depois da aba voltar a ficar visível, força
// um reload — porque isso normalmente significa que o Chrome
// descartou a aba por falta de memória e o JavaScript ficou num
// estado zumbi, sem conseguir se recuperar sozinho.
function RecarregaSeTravado() {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    function handleVisibilidade() {
      if (document.hidden) {
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
        return
      }
      // Aba voltou a ficar visível: dá uma folga de 50s (mais que o
      // limite interno de 45s do auth.tsx) — se depois disso a tela
      // ainda estiver mostrando "Carregando...", força reload.
      timeoutRef.current = setTimeout(() => {
        const aindaCarregando = document.body.innerText.includes('Carregando...')
        if (aindaCarregando) {
          console.warn('Tela travada em "Carregando..." por mais de 50s após voltar — recarregando.')
          window.location.reload()
        }
      }, 50000)
    }

    document.addEventListener('visibilitychange', handleVisibilidade)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilidade)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  return null
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <RecarregaSeTravado />
      {children}
    </AuthProvider>
  )
}
