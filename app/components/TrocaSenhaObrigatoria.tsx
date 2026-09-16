'use client'

import { useState } from 'react'
import { useAuth } from '../services/auth'

export default function TrocaSenhaObrigatoria() {
  const { atualizarSenha, logout } = useAuth()
  const [senhaAtual, setSenhaAtual] = useState('')
  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState(false)
  const [salvando, setSalvando] = useState(false)

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setErro('')

    if (senha.length < 8) {
      setErro('A nova senha deve ter pelo menos 8 caracteres.')
      return
    }
    if (senha !== confirmacao) {
      setErro('As senhas não conferem.')
      return
    }

    setSalvando(true)
    const resultado = await atualizarSenha(senhaAtual, senha)
    setSalvando(false)

    if (resultado) {
      setErro(resultado)
      return
    }

    setSucesso(true)
    setSenhaAtual('')
    setSenha('')
    setConfirmacao('')
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8">
        <div className="w-14 h-14 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center text-2xl font-black mb-5">
          !
        </div>
        <h1 className="text-2xl font-black text-gray-900">Troca de senha obrigatória</h1>
        <p className="mt-3 text-sm text-gray-500 leading-6">
          Por segurança, sua senha precisa ser alterada a cada 60 dias. Atualize agora para continuar usando o sistema.
        </p>

        {erro && <div className="mt-5 p-3 rounded-xl bg-red-50 border border-red-200 text-sm font-bold text-red-700">{erro}</div>}
        {sucesso && <div className="mt-5 p-3 rounded-xl bg-green-50 border border-green-200 text-sm font-bold text-green-700">Senha atualizada com sucesso. Seu acesso foi liberado.</div>}

        {!sucesso ? (
          <form onSubmit={salvar} className="mt-6 space-y-4">
            <div>
              <label className="text-xs font-black uppercase tracking-wider text-gray-500">Senha atual</label>
              <input
                type="password"
                value={senhaAtual}
                onChange={e => setSenhaAtual(e.target.value)}
                className="mt-1 w-full border border-gray-200 rounded-xl px-4 py-3 bg-gray-50 outline-none focus:ring-2 focus:ring-red-500"
                autoComplete="current-password"
                required
              />
            </div>
            <div>
              <label className="text-xs font-black uppercase tracking-wider text-gray-500">Nova senha</label>
              <input
                type="password"
                value={senha}
                onChange={e => setSenha(e.target.value)}
                className="mt-1 w-full border border-gray-200 rounded-xl px-4 py-3 bg-gray-50 outline-none focus:ring-2 focus:ring-red-500"
                minLength={8}
                required
              />
            </div>
            <div>
              <label className="text-xs font-black uppercase tracking-wider text-gray-500">Confirmar nova senha</label>
              <input
                type="password"
                value={confirmacao}
                onChange={e => setConfirmacao(e.target.value)}
                className="mt-1 w-full border border-gray-200 rounded-xl px-4 py-3 bg-gray-50 outline-none focus:ring-2 focus:ring-red-500"
                minLength={8}
                required
              />
            </div>
            <button type="submit" disabled={salvando} className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl py-3 font-black uppercase tracking-wider">
              {salvando ? 'Atualizando...' : 'Atualizar senha'}
            </button>
          </form>
        ) : (
          <button onClick={() => window.location.reload()} className="mt-6 w-full bg-green-600 hover:bg-green-700 text-white rounded-xl py-3 font-black uppercase tracking-wider">
            Continuar
          </button>
        )}

        <button onClick={logout} className="mt-4 w-full text-sm font-bold text-gray-400 hover:text-red-600">
          Sair
        </button>
      </div>
    </div>
  )
}
