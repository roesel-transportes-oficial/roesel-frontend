'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '../services/auth'
import { Search, Plus, ArrowLeft, Save, Trash2, ChevronRight, AlertTriangle } from 'lucide-react'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_KEY!

interface Multa {
  id: string; motorista: string; data: string; valor: number; descricao: string; status: string
}
interface Motorista { id: string; nome: string }

const InputClass = "mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-gray-50"
const LabelClass = "text-xs font-semibold text-gray-500 uppercase tracking-wide"

export default function MultasPage() {
  const { perm } = useAuth()
  const [multas, setMultas] = useState<Multa[]>([])
  const [motoristas, setMotoristas] = useState<Motorista[]>([])
  const [busca, setBusca] = useState('')
  const [sel, setSel] = useState<Multa | null>(null)
  const [mostraCad, setMostraCad] = useState(false)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [confirmExcluir, setConfirmExcluir] = useState(false)

  const [editMotorista, setEditMotorista] = useState('')
  const [editData, setEditData] = useState('')
  const [editValor, setEditValor] = useState('')
  const [editDescricao, setEditDescricao] = useState('')
  const [editStatus, setEditStatus] = useState('PENDENTE')

  const [cadMotorista, setCadMotorista] = useState('')
  const [cadData, setCadData] = useState(new Date().toISOString().split('T')[0])
  const [cadValor, setCadValor] = useState('')
  const [cadDescricao, setCadDescricao] = useState('')
  const [cadStatus, setCadStatus] = useState('PENDENTE')

  useEffect(() => { fetch_(); fetchMotoristas() }, [])

  async function fetch_() {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/multas?order=data.desc`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
      })
      const data = await res.json()
      setMultas(Array.isArray(data) ? data : [])
    } catch {}
  }

  async function fetchMotoristas() {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/motoristas?order=nome.asc&ativo=eq.true`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
      })
      const data = await res.json()
      setMotoristas(Array.isArray(data) ? data : [])
    } catch {}
  }

  const filtrados = busca.trim()
    ? multas.filter(m =>
        m.motorista?.toLowerCase().includes(busca.toLowerCase()) ||
        m.descricao?.toLowerCase().includes(busca.toLowerCase())
      )
    : multas

  function selecionar(m: Multa) {
    setSel(m)
    setEditMotorista(m.motorista || '')
    setEditData(m.data || '')
    setEditValor(String(m.valor || ''))
    setEditDescricao(m.descricao || '')
    setEditStatus(m.status || 'PENDENTE')
    setConfirmExcluir(false)
  }

  function voltar() { setSel(null); setConfirmExcluir(false) }
  function showMsg(t: string) { setMsg(t); setTimeout(() => setMsg(''), 3000) }
  function fmtData(d: string) {
    if (!d) return ''
    const [y, m, dia] = d.split('-')
    return `${dia}/${m}/${y}`
  }

  async function salvar() {
    if (!sel) return
    setLoading(true)
    if (perm !== 'demo') {
      await fetch(`${SUPABASE_URL}/rest/v1/multas?id=eq.${sel.id}`, {
        method: 'PATCH',
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ motorista: editMotorista, data: editData, valor: parseFloat(editValor) || 0, descricao: editDescricao, status: editStatus })
      })
    }
    await fetch_(); setLoading(false); voltar(); showMsg('✅ Atualizado!')
  }

  async function excluir() {
    if (!sel) return
    setLoading(true)
    if (perm !== 'demo') {
      await fetch(`${SUPABASE_URL}/rest/v1/multas?id=eq.${sel.id}`, {
        method: 'DELETE',
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
      })
    }
    await fetch_(); setLoading(false); voltar(); showMsg('Multa excluída.')
  }

  async function cadastrar() {
    if (!cadMotorista) return
    setLoading(true)
    if (perm !== 'demo') {
      await fetch(`${SUPABASE_URL}/rest/v1/multas`, {
        method: 'POST',
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ motorista: cadMotorista, data: cadData, valor: parseFloat(cadValor) || 0, descricao: cadDescricao, status: cadStatus })
      })
    }
    await fetch_(); setLoading(false)
    setCadMotorista(''); setCadData(new Date().toISOString().split('T')[0]); setCadValor(''); setCadDescricao(''); setCadStatus('PENDENTE')
    setMostraCad(false); showMsg('✅ Multa registrada!')
  }

  if (mostraCad) return (
    <div className="p-6 max-w-2xl mx-auto">
      <button onClick={() => setMostraCad(false)} className="flex items-center gap-2 text-gray-500 hover:text-gray-800 mb-4 text-sm transition">
        <ArrowLeft size={16}/> Voltar
      </button>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-bold text-gray-800 mb-4 text-lg">Nova Multa</h3>
        <div className="space-y-3">
          <div>
            <label className={LabelClass}>Motorista *</label>
            <select value={cadMotorista} onChange={e => setCadMotorista(e.target.value)} className={InputClass}>
              <option value="">Selecione...</option>
              {motoristas.map(m => <option key={m.id} value={m.nome}>{m.nome}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LabelClass}>Data</label>
              <input type="date" value={cadData} onChange={e => setCadData(e.target.value)} className={InputClass} />
            </div>
            <div>
              <label className={LabelClass}>Valor (R$)</label>
              <input type="number" step="0.01" value={cadValor} onChange={e => setCadValor(e.target.value)} placeholder="0,00" className={InputClass} />
            </div>
          </div>
          <div>
            <label className={LabelClass}>Descrição</label>
            <textarea value={cadDescricao} onChange={e => setCadDescricao(e.target.value)} rows={3} className={InputClass} placeholder="Descreva a multa..." />
          </div>
          <div>
            <label className={LabelClass}>Status</label>
            <select value={cadStatus} onChange={e => setCadStatus(e.target.value)} className={InputClass}>
              <option value="PENDENTE">PENDENTE</option>
              <option value="PAGO">PAGO</option>
            </select>
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={cadastrar} disabled={loading || !cadMotorista}
              className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl py-2.5 text-sm font-medium transition">
              Registrar multa
            </button>
            <button onClick={() => setMostraCad(false)}
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
      {msg && <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-xl text-sm">{msg}</div>}

      {sel ? (
        <div>
          <button onClick={voltar} className="flex items-center gap-2 text-gray-500 hover:text-gray-800 mb-4 text-sm transition">
            <ArrowLeft size={16}/> Voltar
          </button>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-5 bg-gradient-to-r from-red-600 to-red-700">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center text-white">
                  <AlertTriangle size={24} />
                </div>
                <div>
                  <h2 className="text-white font-bold text-xl">{sel.motorista}</h2>
                  <p className="text-white/80 text-sm">{fmtData(sel.data)} · {sel.status}</p>
                </div>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className={LabelClass}>Motorista</label>
                <select value={editMotorista} onChange={e => setEditMotorista(e.target.value)} className={InputClass}>
                  <option value="">Selecione...</option>
                  {motoristas.map(m => <option key={m.id} value={m.nome}>{m.nome}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LabelClass}>Data</label>
                  <input type="date" value={editData} onChange={e => setEditData(e.target.value)} className={InputClass} />
                </div>
                <div>
                  <label className={LabelClass}>Valor (R$)</label>
                  <input type="number" step="0.01" value={editValor} onChange={e => setEditValor(e.target.value)} className={InputClass} />
                </div>
              </div>
              <div>
                <label className={LabelClass}>Descrição</label>
                <textarea value={editDescricao} onChange={e => setEditDescricao(e.target.value)} rows={3} className={InputClass} />
              </div>
              <div>
                <label className={LabelClass}>Status</label>
                <select value={editStatus} onChange={e => setEditStatus(e.target.value)} className={InputClass}>
                  <option value="PENDENTE">PENDENTE</option>
                  <option value="PAGO">PAGO</option>
                </select>
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
                  <p className="text-sm text-red-700 font-medium mb-3">⚠️ Excluir esta multa?</p>
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
            <h1 className="text-2xl font-bold text-gray-900">Multas</h1>
            {perm !== 'view' && (
              <button onClick={() => setMostraCad(true)}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition shadow-sm">
                <Plus size={16}/> Registrar
              </button>
            )}
          </div>
          <div className="relative mb-4">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={busca} onChange={e => setBusca(e.target.value)}
              placeholder="Buscar por motorista ou descrição..."
              className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-white shadow-sm" />
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Registros</p>
              <p className="text-xs text-gray-400">{filtrados.length} registro(s)</p>
            </div>
            {filtrados.length === 0 ? (
              <div className="p-10 text-center">
                <AlertTriangle size={32} className="mx-auto text-gray-200 mb-2" />
                <p className="text-sm text-gray-400">Nenhuma multa registrada</p>
              </div>
            ) : filtrados.map(m => (
              <button key={m.id} onClick={() => selecionar(m)}
                className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition border-b border-gray-50 last:border-0 text-left">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 text-red-600">
                  <AlertTriangle size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900">{m.motorista}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{m.descricao || 'Sem descrição'}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{fmtData(m.data)}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-gray-800">{(m.valor||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${m.status === 'PAGO' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                    {m.status}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}