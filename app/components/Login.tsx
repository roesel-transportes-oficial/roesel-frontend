'use client'
import { useState } from 'react'
import { useAuth } from '../services/auth'

export default function Login() {
  const { login } = useAuth()
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')

  function entrar() {
    const ok = login(senha)
    if (!ok) setErro('Senha incorreta')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <img src="/logo.jpg" alt="Roesel Transportes" className="h-28 object-contain" />
        </div>
        <h2 className="text-center text-sm text-gray-500 mb-6">Acesso ao sistema interno</h2>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-600">Senha</label>
            <input
              type="password"
              value={senha}
              onChange={e => { setSenha(e.target.value); setErro('') }}
              onKeyDown={e => e.key === 'Enter' && entrar()}
              placeholder="Digite sua senha"
              className="mt-1 w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
          {erro && <p className="text-xs text-red-500">{erro}</p>}
          <button
            onClick={entrar}
            className="w-full bg-red-600 hover:bg-red-700 text-white rounded-xl py-2.5 text-sm font-medium transition"
          >
            Entrar
          </button>
        </div>
      </div>
    </div>
  )
}