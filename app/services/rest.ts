'use client'

import { supabase } from './supabase'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_KEY!

/**
 * Wrapper para o PostgREST usado pelos módulos legados.
 * Leituras sem sessão continuam usando a chave pública para não quebrar o
 * carregamento inicial; qualquer gravação exige uma sessão autenticada e usa
 * o access token real do usuário.
 */
export async function supabaseRestFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const url = typeof input === 'string' ? input : input.toString()
  const isSupabaseRest = url.startsWith(`${SUPABASE_URL}/rest/v1/`)

  if (!isSupabaseRest) return fetch(input, init)

  const method = (init.method || 'GET').toUpperCase()
  const { data: { session } } = await supabase.auth.getSession()
  const accessToken = session?.access_token

  if (method !== 'GET' && !accessToken) {
    throw new Error('Sua sessão expirou. Saia e entre novamente para salvar.')
  }

  const headers = new Headers(init.headers)
  headers.set('apikey', SUPABASE_KEY)
  headers.set('Authorization', `Bearer ${accessToken || SUPABASE_KEY}`)

  return fetch(input, { ...init, headers })
}
