'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '../services/auth'
import { Search, Plus, ArrowLeft, Save, Trash2, ChevronRight, UserCircle } from 'lucide-react'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_KEY!

interface Cliente {
  id: string; nome: string; cnpj: string; endereco: string; cep: string
  cidade: string; estado: string; telefone: string; ie: string
}

const InputClass = "mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-gray-50"
const LabelClass = "text-xs font-semibold text-gray-500 uppercase tracking-wide"
const ESTADOS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']

export default function ClientePage() {
  const { perm } = useAuth()
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [busca, setBusca] = useState('')
  const [sel, setSel] = useState<Cliente | null>(null)
  const [mostraCad, setMostraCad] = useState(false)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [confirmExcluir, setConfirmExcluir] = useState(false)

  const [editNome, setEditNome] = useState('')
  const [editCnpj, setEditCnpj] = useState('')
  const [editEndereco, setEditEndereco] = useState('')
  const [editCep, setEditCep] = useState('')
  const [editCidade, setEditCidade] = useState('')
  const [editEstado, setEditEstado] = useState('')
  const [editTelefone, setEditTelefone] = useState('')
  const [editIe, setEditIe] = useState('')

  const [cadNome, setCadNome] = useState('')
  const [cadCnpj, setCadCnpj] = useState('')
  const [cadEndereco, setCadEndereco] = useState('')
  const [cadCep, setCadCep] = useState('')
  const [cadCidade, setCadCidade] = useState('')
  const [cadEstado, setCadEstado] = useState('')
  const [cadTelefone, setCadTelefone] = useState('')
  const [cadIe, setCadIe] = useState('')

  useEffect(() => { fetch_() }, [])

  async function fetch_() {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/clientes?order=nome.asc`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
      })
      const data = await res.json()
      setClientes(Array.isArray(data) ? data : [])
    } catch {}
  }

  function fmtCnpj(v: string) {
    const d = v.replace(/\D/g,'').slice(0,14)
    if (d.length <= 2) return d
    if (d.length <= 5) return `${d.slice(0,2)}.${d.slice(2)}`
    if (d.length <= 8) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5)}`
    if (d.length <= 12) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8)}`
    return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`
  }

  function fmtCep(v: string) {
    const d = v.replace(/\D/g,'').slice(0,8)
    if (d.length <= 5) return d
    return `${d.slice(0,5)}-${d.slice(5)}`
  }

  const filtrados = busca.trim()
    ? clientes.filter(c =>
        c.nome?.toLowerCase().includes(busca.toLowerCase()) ||
        c.cnpj?.includes(busca) ||
        c.cidade?.toLowerCase().includes(busca.toLowerCase())
      )
    : clientes

  function selecionar(c: Cliente) {
    setSel(c)
    setEditNome(c.nome || '')
    setEditCnpj(c.cnpj || '')
    setEditEndereco(c.endereco || '')
    setEditCep(c.cep || '')
    setEditCidade(c.cidade || '')
    setEditEstado(c.estado || '')
    setEditTelefone(c.telefone || '')
    setEditIe(c.ie || '')
    setConfirmExcluir(false)
  }

  function voltar() { setSel(null); setConfirmExcluir(false) }
  function showMsg(t: string) { setMsg(t); setTimeout(() => setMsg(''), 4000) }

  function resetCad() {
    setCadNome(''); setCadCnpj(''); setCadEndereco(''); setCadCep('')
    setCadCidade(''); setCadEstado(''); setCadTelefone(''); setCadIe('')
  }

  async function salvar() {
    if (!sel) return
    setLoading(true)
    if (perm !== 'demo') {
      await fetch(`${SUPABASE_URL}/rest/v1/clientes?id=eq.${sel.id}`, {
        method: 'PATCH',
        headers: {
          apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json', Prefer: 'return=minimal'
        },
        body: JSON.stringify({
          nome: editNome.toUpperCase(), cnpj: editCnpj, endereco: editEndereco,
          cep: editCep, cidade: editCidade.toUpperCase(), estado: editEstado,
          telefone: editTelefone, ie: editIe
        })
      })
    }
    await fetch_(); setLoading(false); voltar(); showMsg('✅ Atualizado!')
  }

  async function excluir() {
    if (!sel) return
    setLoading(true)
    if (perm !== 'demo') {
      await fetch(`${SUPABASE_URL}/rest/v1/clientes?id=eq.${sel.id}`, {
        method: 'DELETE',
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
      })
    }
    await fetch_(); setLoading(false); voltar(); showMsg('Cliente excluído.')
  }

  async function cadastrar() {
    if (!cadNome) return
    setLoading(true)
    if (perm !== 'demo') {
      await fetch(`${SUPABASE_URL}/rest/v1/clientes`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json', Prefer: 'return=minimal'
        },
        body: JSON.stringify({
          nome: cadNome.toUpperCase(), cnpj: cadCnpj, endereco: cadEndereco,
          cep: cadCep, cidade: cadCidade.toUpperCase(), estado: cadEstado,
          telefone: cadTelefone, ie: cadIe
        })
      })
    }
    await fetch_(); setLoading(false)
    resetCad(); setMostraCad(false)
    showMsg('✅ Cliente cadastrado!')
  }

  if (mostraCad) return (
    <div className="p-6 max-w-2xl mx-auto">
      <button onClick={() => { setMostraCad(false); resetCad() }} className="flex items-center gap-2 text-gray-500 hover:text-gray-800 mb-4 text-sm transition">
        <ArrowLeft size={16}/> Voltar
      </button>
      {msg && (
        <div className={`mb-4 p-3 rounded-xl text-sm border ${msg.startsWith('⚠️') ? 'bg-yellow-50 border-yellow-200 text-yellow-700' : 'bg-green-50 border-green-200 text-green-700'}`}>
          {msg}
        </div>
      )}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-bold text-gray-800 mb-4 text-lg">Novo Cliente</h3>
        <div className="space-y-3">
          <div>
            <label className={LabelClass}>Nome / Razão Social *</label>
            <input value={cadNome} onChange={e => setCadNome(e.target.value)} placeholder="Nome da empresa" className={InputClass} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LabelClass}>CNPJ</label>
              <input value={fmtCnpj(cadCnpj)} onChange={e => setCadCnpj(e.target.value.replace(/\D/g,''))}
                placeholder="00.000.000/0000-00" maxLength={18} className={InputClass} />
            </div>
            <div>
              <label className={LabelClass}>IE</label>
              <input value={cadIe} onChange={e => setCadIe(e.target.value)} placeholder="Inscrição Estadual" className={InputClass} />
            </div>
          </div>
          <div>
            <label className={LabelClass}>Endereço</label>
            <input value={cadEndereco} onChange={e => setCadEndereco(e.target.value)} placeholder="Rua, número, bairro" className={InputClass} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LabelClass}>CEP</label>
              <input value={fmtCep(cadCep)} onChange={e => setCadCep(e.target.value.replace(/\D/g,''))}
                placeholder="00000-000" maxLength={9} className={InputClass} />
            </div>
            <div>
              <label className={LabelClass}>Telefone</label>
              <input value={cadTelefone} onChange={e => setCadTelefone(e.target.value)} placeholder="(00) 00000-0000" className={InputClass} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LabelClass}>Cidade</label>
              <input value={cadCidade} onChange={e => setCadCidade(e.target.value.toUpperCase())} placeholder="Nome da cidade" className={InputClass} />
            </div>
            <div>
              <label className={LabelClass}>Estado (UF)</label>
              <select value={cadEstado} onChange={e => setCadEstado(e.target.value)} className={InputClass}>
                <option value="">Selecione...</option>
                {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={cadastrar} disabled={loading || !cadNome}
              className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl py-2.5 text-sm font-medium transition">
              Cadastrar cliente
            </button>
            <button onClick={() => { setMostraCad(false); resetCad() }}
              className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 transition">
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {msg && (
        <div className={`mb-4 p-3 rounded-xl text-sm border ${msg.startsWith('⚠️') ? 'bg-yellow-50 border-yellow-200 text-yellow-700' : 'bg-green-50 border-green-200 text-green-700'}`}>
          {msg}
        </div>
      )}

      {sel ? (
        <div>
          <button onClick={voltar} className="flex items-center gap-2 text-gray-500 hover:text-gray-800 mb-4 text-sm transition">
            <ArrowLeft size={16}/> Voltar
          </button>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-5 bg-gradient-to-r from-red-600 to-red-700">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center text-white">
                  <UserCircle size={24} />
                </div>
                <div>
                  <h2 className="text-white font-bold text-xl">{sel.nome}</h2>
                  <p className="text-white/80 text-sm">{sel.cidade}{sel.estado && ` - ${sel.estado}`}</p>
                </div>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className={LabelClass}>Nome / Razão Social</label>
                <input value={editNome} onChange={e => setEditNome(e.target.value)} className={InputClass} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LabelClass}>CNPJ</label>
                  <input value={fmtCnpj(editCnpj)} onChange={e => setEditCnpj(e.target.value.replace(/\D/g,''))}
                    placeholder="00.000.000/0000-00" maxLength={18} className={InputClass} />
                </div>
                <div>
                  <label className={LabelClass}>IE</label>
                  <input value={editIe} onChange={e => setEditIe(e.target.value)} className={InputClass} />
                </div>
              </div>
              <div>
                <label className={LabelClass}>Endereço</label>
                <input value={editEndereco} onChange={e => setEditEndereco(e.target.value)} className={InputClass} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LabelClass}>CEP</label>
                  <input value={fmtCep(editCep)} onChange={e => setEditCep(e.target.value.replace(/\D/g,''))}
                    placeholder="00000-000" maxLength={9} className={InputClass} />
                </div>
                <div>
                  <label className={LabelClass}>Telefone</label>
                  <input value={editTelefone} onChange={e => setEditTelefone(e.target.value)} className={InputClass} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LabelClass}>Cidade</label>
                  <input value={editCidade} onChange={e => setEditCidade(e.target.value.toUpperCase())} className={InputClass} />
                </div>
                <div>
                  <label className={LabelClass}>Estado (UF)</label>
                  <select value={editEstado} onChange={e => setEditEstado(e.target.value)} className={InputClass}>
                    <option value="">Selecione...</option>
                    {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={salvar} disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white rounded-xl py-2.5 text-sm font-medium transition">
                  <Save size={15}/> Salvar alterações
                </button>
                <button onClick={() => setConfirmExcluir(true)}
                  className="flex items-center gap-2 border border-red-200 text-red-500 hover:bg-red-50 rounded-xl px-4 py-2.5 text-sm transition">
                  <Trash2 size={15}/>
                </button>
              </div>
              {confirmExcluir && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                  <p className="text-sm text-red-700 font-medium mb-3">⚠️ Excluir este cliente?</p>
                  <div className="flex gap-2">
                    <button onClick={excluir} className="flex-1 bg-red-600 text-white rounded-lg py-2 text-sm font-medium">Confirmar</button>
                    <button onClick={() => setConfirmExcluir(false)} className="flex-1 border border-gray-300 rounded-lg py-2 text-sm">Cancelar</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-5">
            <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
            {perm !== 'view' && (
              <button onClick={() => setMostraCad(true)}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition shadow-sm">
                <Plus size={16}/> Cadastrar
              </button>
            )}
          </div>

          <div className="relative mb-4">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={busca} onChange={e => setBusca(e.target.value)}
              placeholder="Buscar por nome, CNPJ ou cidade..."
              className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-white shadow-sm" />
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Clientes</p>
              <p className="text-xs text-gray-400">{filtrados.length} registro(s)</p>
            </div>
            {filtrados.length === 0 ? (
              <div className="p-10 text-center">
                <UserCircle size={32} className="mx-auto text-gray-200 mb-2" />
                <p className="text-sm text-gray-400">Nenhum cliente cadastrado</p>
              </div>
            ) : filtrados.map(c => (
              <button key={c.id} onClick={() => selecionar(c)}
                className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition border-b border-gray-50 last:border-0 text-left">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 text-red-600">
                  <UserCircle size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900">{c.nome}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{c.cnpj ? fmtCnpj(c.cnpj) : 'CNPJ não informado'}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{c.cidade}{c.estado && ` - ${c.estado}`}</p>
                </div>
                <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}