'use client'
import { AuthProvider } from './services/auth'

// ✅ Voltado pra versão simples. O "verificador de sessão ao voltar"
// que tinha aqui antes estava entrando em loop de recarregamento com
// o checkSession() do auth.tsx: cada um tinha seu próprio timeout, e
// quando os dois expiravam quase juntos, um disparava reload, o
// reload acionava o outro de novo, e assim por diante — o app parecia
// "carregando pra sempre" mas na real estava preso recarregando em
// ciclo. O checkSession() do auth.tsx já cuida da sessão sozinho
// (com timeout + onAuthStateChange), então não precisa dessa camada
// extra por cima.
export function Providers({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>
}