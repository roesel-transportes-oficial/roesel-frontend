'use client'
import { useEffect, useRef } from 'react'
import { AuthProvider } from './services/auth'

// ✅ Recarrega a página inteira sozinha se ela ficou muito tempo em
// segundo plano (aba minimizada, trocou de aba do navegador, PC
// hibernou etc) — cobre TODAS as páginas do sistema de uma vez,
// sem precisar mexer em cada uma individualmente.
//
// Por que isso resolve de vez: o navegador pode PAUSAR de verdade
// timers e conexões de rede quando uma aba fica muito tempo escondida
// — inclusive os timeouts de segurança que já protegem cada
// busca podem ficar pausados junto. Não dá pra "blindar" contra isso
// com mais timeout, porque o próprio timeout pode ser pausado. A
// solução confiável é recomeçar do zero quando a aba volta a ficar
// visível depois de tempo demais escondida.
//
// ⚠️ Essa é a ÚNICA lógica de recarregamento automático no sistema.
// Da outra vez que isso foi tentado, havia DOIS mecanismos brigando
// entre si (esse + uma checagem de sessão separada), e cada um podia
// disparar o outro de novo — isso é que causou o loop de
// recarregamento. Removendo a duplicação, não tem mais como entrar
// em loop: essa função só reage a "ficou escondida > 2 minutos e
// voltou", nada mais aciona reload em lugar nenhum do sistema.
function AutoReloadAposInatividade() {
  const escondidoDesde = useRef<number | null>(null)
  const LIMITE_MS = 2 * 60 * 1000 // 2 minutos

  useEffect(() => {
    function handleVisibilidade() {
      if (document.hidden) {
        escondidoDesde.current = Date.now()
        return
      }
      if (escondidoDesde.current) {
        const tempoEscondido = Date.now() - escondidoDesde.current
        escondidoDesde.current = null
        if (tempoEscondido > LIMITE_MS) {
          window.location.reload()
        }
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
      <AutoReloadAposInatividade />
      {children}
    </AuthProvider>
  )
}