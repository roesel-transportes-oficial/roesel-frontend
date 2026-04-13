'use client'
import { useState } from 'react'
import { useAuth } from '../services/auth'
import { supabase } from '../services/supabase'
import Image from 'next/image'

export default function Login() {
  const { login } = useAuth()
  const [tela, setTela] = useState<'login' | 'cadastro' | 'recuperar'>('login')
  const [loginInput, setLoginInput] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  // Cadastro
  const [cadNome, setCadNome] = useState('')
  const [cadLogin, setCadLogin] = useState('')
  const [cadEmail, setCadEmail] = useState('')
  const [cadSenha, setCadSenha] = useState('')
  const [cadSenha2, setCadSenha2] = useState('')

  // Recuperar
  const [recEmail, setRecEmail] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setErro('')
    const err = await login(loginInput, senha)
    if (err) setErro(err)
    setLoading(false)
  }

  async function handleCadastro(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    if (cadSenha !== cadSenha2) { setErro('As senhas não conferem'); return }
    if (cadSenha.length < 6) { setErro('Senha deve ter pelo menos 6 caracteres'); return }
    setLoading(true)

    // Verifica se login já existe
    const { data: existe } = await supabase
      .from('usuarios')
      .select('id')
      .eq('login', cadLogin)
      .single()

    if (existe) { setErro('Este usuário já existe'); setLoading(false); return }

    // Cria usuário com status pendente
    const { error } = await supabase.from('usuarios').insert({
      nome: cadNome.toUpperCase(),
      login: cadLogin.toLowerCase(),
      email: cadEmail.toLowerCase(),
      senha: cadSenha,
      perm: 'view',
      status: 'pendente',
      primeiro_acesso: false,
    })

    if (error) { setErro('Erro ao criar conta. Tente novamente.'); setLoading(false); return }

    setMsg('✅ Cadastro realizado! Aguarde a aprovação do administrador.')
    setLoading(false)
    setTimeout(() => { setTela('login'); setMsg('') }, 4000)
  }

  async function handleRecuperar(e: React.FormEvent) {
    e.preventDefault()
    setErro(''); setLoading(true)

    const { data } = await supabase
      .from('usuarios')
      .select('login')
      .eq('email', recEmail.toLowerCase())
      .single()

    if (!data) {
      setErro('Email não encontrado')
      setLoading(false)
      return
    }

    setMsg(`✅ Email encontrado! Seu usuário é: ${data.login}. Entre em contato com o administrador para redefinir sua senha.`)
    setLoading(false)
  }

  const InputClass = "w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-gray-50"

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm">
        <div className="flex justify-center mb-6">
          <Image src="/logo.jpg" alt="Roesel Transportes" width={160} height={80} className="object-contain" />
        </div>

        {tela === 'login' && (
          <>
            <p className="text-center text-sm text-gray-500 mb-6">Acesso ao sistema interno</p>
            {erro && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-xl text-sm">{erro}</div>}
            {msg && <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-xl text-sm">{msg}</div>}
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Usuário ou Email</label>
                <input value={loginInput} onChange={e => setLoginInput(e.target.value)}
                  placeholder="Digite seu usuário ou email"
                  className={InputClass + " mt-1"} required />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Senha</label>
                <input type="password" value={senha} onChange={e => setSenha(e.target.value)}
                  placeholder="Digite sua senha"
                  className={InputClass + " mt-1"} required />
              </div>
              <button type="submit" disabled={loading}
                className="w-full bg-red-600 hover:bg-red-700 text-white rounded-xl py-3 text-sm font-medium transition">
                {loading ? 'Entrando...' : 'Entrar'}
              </button>
            </form>
            <div className="flex justify-between mt-4">
              <button onClick={() => { setTela('recuperar'); setErro('') }}
                className="text-xs text-gray-400 hover:text-red-600 transition">
                Esqueci minha senha
              </button>
              <button onClick={() => { setTela('cadastro'); setErro('') }}
                className="text-xs text-gray-400 hover:text-red-600 transition">
                Criar conta
              </button>
            </div>
          </>
        )}

        {tela === 'cadastro' && (
          <>
            <p className="text-center text-sm text-gray-500 mb-6">Criar nova conta</p>
            {erro && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-xl text-sm">{erro}</div>}
            {msg && <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-xl text-sm">{msg}</div>}
            <form onSubmit={handleCadastro} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Nome completo</label>
                <input value={cadNome} onChange={e => setCadNome(e.target.value)}
                  placeholder="Seu nome completo"
                  className={InputClass + " mt-1"} required />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Usuário</label>
                <input value={cadLogin} onChange={e => setCadLogin(e.target.value.toLowerCase())}
                  placeholder="Escolha um usuário"
                  className={InputClass + " mt-1"} required />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Email</label>
                <input type="email" value={cadEmail} onChange={e => setCadEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className={InputClass + " mt-1"} required />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Senha</label>
                <input type="password" value={cadSenha} onChange={e => setCadSenha(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className={InputClass + " mt-1"} required />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Confirmar senha</label>
                <input type="password" value={cadSenha2} onChange={e => setCadSenha2(e.target.value)}
                  placeholder="Repita a senha"
                  className={InputClass + " mt-1"} required />
              </div>
              <button type="submit" disabled={loading}
                className="w-full bg-red-600 hover:bg-red-700 text-white rounded-xl py-3 text-sm font-medium transition mt-2">
                {loading ? 'Cadastrando...' : 'Criar conta'}
              </button>
            </form>
            <button onClick={() => { setTela('login'); setErro('') }}
              className="w-full text-center text-xs text-gray-400 hover:text-red-600 transition mt-4">
              ← Voltar para o login
            </button>
          </>
        )}

        {tela === 'recuperar' && (
          <>
            <p className="text-center text-sm text-gray-500 mb-2">Recuperar acesso</p>
            <p className="text-center text-xs text-gray-400 mb-6">Digite seu email para recuperar seu usuário</p>
            {erro && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-xl text-sm">{erro}</div>}
            {msg && <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-xl text-sm">{msg}</div>}
            <form onSubmit={handleRecuperar} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Email</label>
                <input type="email" value={recEmail} onChange={e => setRecEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className={InputClass + " mt-1"} required />
              </div>
              <button type="submit" disabled={loading}
                className="w-full bg-red-600 hover:bg-red-700 text-white rounded-xl py-3 text-sm font-medium transition">
                {loading ? 'Buscando...' : 'Recuperar acesso'}
              </button>
            </form>
            <button onClick={() => { setTela('login'); setErro('') }}
              className="w-full text-center text-xs text-gray-400 hover:text-red-600 transition mt-4">
              ← Voltar para o login
            </button>
          </>
        )}
      </div>
    </div>
  )
}