'use client'
import { AuthProvider } from './services/auth'

export function Providers({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>
}