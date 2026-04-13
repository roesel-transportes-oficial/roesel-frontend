'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../services/supabase'
import { useAuth } from '../services/auth'
import { Users, Check, X, Shield, Eye, Trash2 } from 'lucide-react'

interface Usuario {
  id: string; nome: string; login: string; email: string
  perm: string; status: string; primeiro_acesso: boolean
}

const InputClass = "mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-gray-50"
const LabelClass = "text-xs font-semibold text-gray-500 uppercase tracking-wide"

export default function UsuariosPage() {
  const { perm } = useAuth()
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [confirmExcluir, setConfirmExcluir] = useState<string | null>(null)

  useEffect(() => { fetch_() }, [])

  async function fetch_() {
    const { data } = await supabase.from('usuarios').select('*').order('status').order('nome')
    setUsuarios(data || [])
  }

  function showMsg(t: string) { setMsg(t); setTimeout(() => setMsg(''), 3000) }

  async function aprovar(u: Usuario) {
    setLoading(true)
    await supabase.from('usuarios').update({ status: 'ativo' }).eq('id', u.id)
    await fetch_(); setLoading(false); showMsg(`✅ ${u.nome} aprovado!`)
  }

  async function rejeitar(u: Usuario) {
    setLoading(true)
    await supabase.from('usuarios').update({ status: 'inativo' }).eq('id', u.id)
    await fetch_(); setLoading(false); showMsg(`${u.nome} rejeitado.`)
  }

  async function alterarPerm(id: string, novaPerm: string) {
    await supabase.from('usuarios').update({ perm: novaPerm }).eq('id', id)
    await fetch_()
    showMsg('✅ Permissão atualizada!')
  }

  async function excluir(id: string) {
    setLoading(true)
    await supabase.from('usuarios').delete().eq('id', id)
    await fetch_(); setLoading(false)
    setConfirmExcluir(null); showMsg('Usuário excluído.')
  }

  if (perm !== 'total') return (
    <div className="p-6 text-center">
      <p className="text-gray-500 text-sm">Acesso restrito ao administrador.</p>
    </div>
  )

  const pendentes = usuarios.filter(u => u.status === 'pendente')
  const ativos = usuarios.filter(u => u.status === 'ativo')
  const inativos = usuarios.filter(u => u.status === 'inativo')

  function StatusBadge({ status }: { status: string }) {
    return (
      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
        status === 'ativo' ? 'bg-green-100 text-green-700' :
        status === 'pendente' ? 'bg-yellow-100 text-yellow-700' :
        'bg-gray-100 text-gray-500'
      }`}>{status}</span>
    )
  }

  function PermBadge({ p }: { p: string }) {
    return (
      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
        p === 'total' ? 'bg-red-100 text-red-700' :
        p === 'view' ? 'bg-blue-100 text-blue-700' :
        'bg-gray-100 text-gray-500'
      }`}>{p}</span>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {msg && <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-xl text-sm">{msg}</div>}

      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-bold text-gray-900">Usuários</h1>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-2">Ativos</p>
          <p className="text-3xl font-bold text-green-600">{ativos.length}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-2">Pendentes</p>
          <p className="text-3xl font-bold text-yellow-500">{pendentes.length}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-2">Inativos</p>
          <p className="text-3xl font-bold text-gray-400">{inativos.length}</p>
        </div>
      </div>

      {/* Pendentes */}
      {pendentes.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-2xl overflow-hidden mb-4">
          <div className="px-5 py-3 border-b border-yellow-200">
            <p className="text-xs font-semibold text-yellow-700 uppercase tracking-wide">⚠️ Aguardando aprovação</p>
          </div>
          {pendentes.map(u => (
            <div key={u.id} className="px-5 py-4 border-b border-yellow-100 last:border-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-yellow-200 flex items-center justify-center text-yellow-700 font-bold text-sm">
                    {u.nome?.charAt(0) || u.login?.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{u.nome}</p>
                    <p className="text-xs text-gray-500">@{u.login} · {u.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    defaultValue="view"
                    onChange={e => alterarPerm(u.id, e.target.value)}
                    className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-red-500 bg-white">
                    <option value="view">View</option>
                    <option value="total">Total</option>
                    <option value="demo">Demo</option>
                  </select>
                  <button onClick={() => aprovar(u)} disabled={loading}
                    className="flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition">
                    <Check size={12}/> Aprovar
                  </button>
                  <button onClick={() => rejeitar(u)} disabled={loading}
                    className="flex items-center gap-1 bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-1.5 rounded-lg text-xs font-medium transition">
                    <X size={12}/> Rejeitar
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Todos os usuários */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Todos os usuários</p>
          <p className="text-xs text-gray-400">{usuarios.length} cadastrado(s)</p>
        </div>
        {usuarios.length === 0 ? (
          <div className="p-10 text-center">
            <Users size={32} className="mx-auto text-gray-200 mb-2" />
            <p className="text-sm text-gray-400">Nenhum usuário cadastrado</p>
          </div>
        ) : usuarios.map(u => (
          <div key={u.id} className="px-5 py-4 border-b border-gray-50 last:border-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-bold text-sm">
                  {u.nome?.charAt(0) || u.login?.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-900">{u.nome}</p>
                    <StatusBadge status={u.status} />
                    <PermBadge p={u.perm} />
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">@{u.login} · {u.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={u.perm}
                  onChange={e => alterarPerm(u.id, e.target.value)}
                  className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-red-500 bg-white">
                  <option value="view">View</option>
                  <option value="total">Total</option>
                  <option value="demo">Demo</option>
                </select>
                {u.status === 'pendente' && (
                  <button onClick={() => aprovar(u)} disabled={loading}
                    className="flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition">
                    <Check size={12}/> Aprovar
                  </button>
                )}
                {u.status === 'ativo' && (
                  <button onClick={() => rejeitar(u)} disabled={loading}
                    className="flex items-center gap-1 bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-1.5 rounded-lg text-xs font-medium transition">
                    <X size={12}/> Desativar
                  </button>
                )}
                {u.status === 'inativo' && (
                  <button onClick={() => aprovar(u)} disabled={loading}
                    className="flex items-center gap-1 bg-green-100 hover:bg-green-200 text-green-700 px-3 py-1.5 rounded-lg text-xs font-medium transition">
                    <Check size={12}/> Reativar
                  </button>
                )}
                <button onClick={() => setConfirmExcluir(u.id)}
                  className="flex items-center gap-1 border border-red-200 text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-lg text-xs transition">
                  <Trash2 size={12}/>
                </button>
              </div>
            </div>
            {confirmExcluir === u.id && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-xl">
                <p className="text-sm text-red-700 font-medium mb-2">⚠️ Excluir {u.nome}?</p>
                <div className="flex gap-2">
                  <button onClick={() => excluir(u.id)} className="flex-1 bg-red-600 text-white rounded-lg py-1.5 text-xs font-medium">Confirmar</button>
                  <button onClick={() => setConfirmExcluir(null)} className="flex-1 border border-gray-300 rounded-lg py-1.5 text-xs">Cancelar</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}