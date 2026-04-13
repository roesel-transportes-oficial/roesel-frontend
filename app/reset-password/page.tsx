'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../services/supabase'
import Image from 'next/image'

export default function ResetPassword() {
  const [senha, setSenha] = useState('')
  const [senha2, setSenha2] = useState('')
  const [erro, setErro] = useState('')
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)
  const [pronto, setPronto] = useState(false)
  const [concluido, setConcluido] = useState(false)

  useEffect(() => {
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setPronto(true)
      }
    })
  }, [])

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    if (senha !== senha2) { setErro('As senhas não conferem'); return }
    if (senha.length < 6) { setErro('Senha deve ter pelo menos 6 caracteres'); return }
    setLoading(true)

    const { error } = await supabase.auth.updateUser({ password: senha })

    if (error) {
      setErro('Erro ao atualizar senha. Tente novamente.')
      setLoading(false)
      return
    }

    setConcluido(true)
    setLoading(false)
  }

  const InputClass = "w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-gray-50"

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm">
        <div className="flex justify-center mb-6">
          <Image src="/logo.jpg" alt="Roesel Transportes" width={160} height={80} className="object-contain" />
        </div>

        {concluido ? (
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">✅</span>
            </div>
            <p className="text-gray-800 font-semibold mb-2">Senha atualizada!</p>
            <p className="text-sm text-gray-500 mb-6">Sua senha foi redefinida com sucesso.</p>
            <a href="/" className="block w-full bg-red-600 hover:bg-red-700 text-white rounded-xl py-3 text-sm font-medium transition text-center">
              Ir para o login
            </a>
          </div>
        ) : (
          <>
            <p className="text-center text-sm text-gray-500 mb-6">Redefinir senha</p>
            {erro && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-xl text-sm">{erro}</div>}
            {msg && <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-xl text-sm">{msg}</div>}

            {!pronto ? (
              <p className="text-center text-sm text-gray-400">Verificando link de redefinição...</p>
            ) : (
              <form onSubmit={handleReset} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Nova senha</label>
                  <input type="password" value={senha} onChange={e => setSenha(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className={InputClass + " mt-1"} required />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Confirmar nova senha</label>
                  <input type="password" value={senha2} onChange={e => setSenha2(e.target.value)}
                    placeholder="Repita a senha"
                    className={InputClass + " mt-1"} required />
                </div>
                <button type="submit" disabled={loading}
                  className="w-full bg-red-600 hover:bg-red-700 text-white rounded-xl py-3 text-sm font-medium transition">
                  {loading ? 'Salvando...' : 'Salvar nova senha'}
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  )
}