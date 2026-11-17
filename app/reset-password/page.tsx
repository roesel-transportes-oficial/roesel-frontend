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
    // O cliente Supabase do sistema usa detectSessionInUrl: false, então ele
    // NÃO lê sozinho o token que vem no link do email. Lemos aqui manualmente.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setPronto(true)
    })

    const LINK_RUIM = 'Link inválido ou expirado. Volte ao login e peça um novo email de redefinição.'

    async function lerLink() {
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
      const query = new URLSearchParams(window.location.search)
      const limparUrl = () => window.history.replaceState(null, '', window.location.pathname)

      // 1) Supabase devolveu erro no link (ex.: link expirado ou já usado)
      if (hash.get('error') || hash.get('error_description') || query.get('error') || query.get('error_description')) {
        console.error('Erro no link de redefinição:', hash.get('error_description') || query.get('error_description'))
        limparUrl()
        setErro(LINK_RUIM)
        return
      }

      const accessToken = hash.get('access_token')
      const refreshToken = hash.get('refresh_token')
      const code = query.get('code')
      const tokenHash = query.get('token_hash') || hash.get('token_hash')

      // 2) Fluxo implícito (o padrão deste sistema): #access_token=...&refresh_token=...
      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
        limparUrl()
        if (error) { console.error(error); setErro(LINK_RUIM); return }
        setPronto(true)
        return
      }

      // 3) Fluxo PKCE: ?code=...
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        limparUrl()
        if (error) { console.error(error); setErro(LINK_RUIM); return }
        setPronto(true)
        return
      }

      // 4) Template de email personalizado: ?token_hash=...&type=recovery
      if (tokenHash) {
        const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' })
        limparUrl()
        if (error) { console.error(error); setErro(LINK_RUIM); return }
        setPronto(true)
        return
      }

      // 5) Sem token na URL: aceita se já houver sessão (ex.: página recarregada)
      const { data } = await supabase.auth.getSession()
      if (data.session) setPronto(true)
      else setErro('Link de redefinição não encontrado. Abra o link direto do email ou peça um novo.')
    }

    lerLink().catch((e) => {
      console.error('Falha ao ler link de redefinição:', e)
      setErro(LINK_RUIM)
    })

    return () => sub.subscription.unsubscribe()
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

    const { data: usuarioAuth } = await supabase.auth.getUser()
    if (usuarioAuth.user?.email) {
      const { error: perfilError } = await supabase
        .from('usuarios')
        .update({ senha_trocada_em: new Date().toISOString(), primeiro_acesso: false })
        .eq('email', usuarioAuth.user.email)

      if (perfilError) {
        setErro('Senha alterada, mas não foi possível registrar a validade. Tente novamente.')
        setLoading(false)
        return
      }
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

            {!pronto && erro ? (
              <a href="/" className="block w-full bg-red-600 hover:bg-red-700 text-white rounded-xl py-3 text-sm font-medium transition text-center">
                Voltar para o login
              </a>
            ) : !pronto ? (
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