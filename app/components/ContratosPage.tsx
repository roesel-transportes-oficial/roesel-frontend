'use client'
import { useState, useEffect } from 'react'
import { contratosAPI, motoristasAPI } from '../services/api'
import { useAuth } from '../services/auth'
import { Search, Save, Trash2, ChevronRight, ArrowLeft, FileText, DollarSign, CheckCircle, Clock } from 'lucide-react'

interface Contrato {
  id: string; contrato: string; data: string; cliente: string
  motorista: string; placa: string; frota: string; origem: string
  destino: string; fat_bruto: number; status: string; obs: string
}

interface Motorista { id: string; nome: string }

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

const InputClass = "mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-gray-50"
const LabelClass = "text-xs font-semibold text-gray-500 uppercase tracking-wide"

export default function ContratosPage() {
  const { perm } = useAuth()
  const [contratos, setContratos] = useState<Contrato[]>([])
  const [motoristas, setMotoristas] = useState<Motorista[]>([])
  const [sel, setSel] = useState<Contrato | null>(null)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [confirmExcluir, setConfirmExcluir] = useState(false)
  const [busca, setBusca] = useState('')
  const [filtroMes, setFiltroMes] = useState(0)
  const [filtroAno, setFiltroAno] = useState(new Date().getFullYear())

  const [editData, setEditData] = useState('')
  const [editCliente, setEditCliente] = useState('')
  const [editMotorista, setEditMotorista] = useState('')
  const [editPlaca, setEditPlaca] = useState('')
  const [editFrota, setEditFrota] = useState('')
  const [editOrigem, setEditOrigem] = useState('')
  const [editDestino, setEditDestino] = useState('')
  const [editFatBruto, setEditFatBruto] = useState('')
  const [editStatus, setEditStatus] = useState('ABERTO')
  const [editObs, setEditObs] = useState('')

  useEffect(() => {
    fetch_()
    motoristasAPI.listar().then(setMotoristas)
  }, [filtroMes, filtroAno])

  async function fetch_() {
    const data = await contratosAPI.listar({
      mes: filtroMes || undefined,
      ano: filtroAno || undefined
    })
    setContratos(data)
  }

  const filtrados = busca.trim()
    ? contratos.filter(c =>
        c.motorista?.toLowerCase().includes(busca.toLowerCase()) ||
        c.cliente?.toLowerCase().includes(busca.toLowerCase()) ||
        c.contrato?.toLowerCase().includes(busca.toLowerCase())
      )
    : contratos

  function selecionar(c: Contrato) {
    setSel(c)
    setEditData(c.data || '')
    setEditCliente(c.cliente || '')
    setEditMotorista(c.motorista || '')
    setEditPlaca(c.placa || '')
    setEditFrota(c.frota || '')
    setEditOrigem(c.origem || '')
    setEditDestino(c.destino || '')
    setEditFatBruto(String(c.fat_bruto || ''))
    setEditStatus(c.status || 'ABERTO')
    setEditObs(c.obs || '')
    setConfirmExcluir(false)
  }

  function voltar() { setSel(null); setConfirmExcluir(false) }
  function showMsg(t: string) { setMsg(t); setTimeout(() => setMsg(''), 3000) }

  async function salvar() {
    if (!sel) return
    setLoading(true)
    if (perm !== 'demo') await contratosAPI.atualizar(sel.id, {
      data: editData, cliente: editCliente, motorista: editMotorista,
      placa: editPlaca, frota: editFrota, origem: editOrigem,
      destino: editDestino, fat_bruto: parseFloat(editFatBruto) || 0,
      status: editStatus, obs: editObs
    })
    await fetch_(); setLoading(false); voltar(); showMsg('✅ Atualizado!')
  }

  async function excluir() {
    if (!sel) return
    setLoading(true)
    if (perm !== 'demo') await contratosAPI.excluir(sel.id)
    await fetch_(); setLoading(false); voltar(); showMsg('Contrato excluído.')
  }

  const totalFat = filtrados.reduce((s, c) => s + (c.fat_bruto || 0), 0)
  const abertos = filtrados.filter(c => c.status === 'ABERTO').length
  const pagos = filtrados.filter(c => c.status === 'PAGO').length

  function fmtData(d: string) {
    if (!d) return ''
    const [y, m, dia] = d.split('-')
    return `${dia}/${m}/${y}`
  }

  return (
    <div className="p-6 max-w-full">
      {msg && <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-xl text-sm">{msg}</div>}

      {sel ? (
        <div className="max-w-2xl">
          <button onClick={voltar} className="flex items-center gap-2 text-gray-500 hover:text-gray-800 mb-4 text-sm transition">
            <ArrowLeft size={16}/> Voltar
          </button>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className={`px-6 py-5 bg-gradient-to-r ${
              editStatus === 'PAGO' ? 'from-green-600 to-green-700' :
              editStatus === 'CANCELADO' ? 'from-gray-500 to-gray-600' :
              'from-red-600 to-red-700'
            }`}>
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center text-white">
                  <FileText size={24} />
                </div>
                <div>
                  <h2 className="text-white font-bold text-xl">#{sel.contrato}</h2>
                  <p className="text-white/80 text-sm">{sel.cliente}</p>
                </div>
              </div>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LabelClass}>Data</label>
                  <input type="date" value={editData} onChange={e => setEditData(e.target.value)} className={InputClass} />
                </div>
                <div>
                  <label className={LabelClass}>Status</label>
                  <select value={editStatus} onChange={e => setEditStatus(e.target.value)} className={InputClass}>
                    <option>ABERTO</option>
                    <option>PAGO</option>
                    <option>CANCELADO</option>
                  </select>
                </div>
              </div>

              <div>
                <label className={LabelClass}>Cliente</label>
                <input value={editCliente} onChange={e => setEditCliente(e.target.value)} className={InputClass} />
              </div>

              <div>
                <label className={LabelClass}>Motorista</label>
                <select value={editMotorista} onChange={e => setEditMotorista(e.target.value)} className={InputClass}>
                  <option value="">Selecione...</option>
                  {motoristas.map(m => <option key={m.id} value={m.nome}>{m.nome}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LabelClass}>Placa</label>
                  <input value={editPlaca} onChange={e => setEditPlaca(e.target.value.toUpperCase())} className={InputClass} />
                </div>
                <div>
                  <label className={LabelClass}>Frota</label>
                  <input value={editFrota} onChange={e => setEditFrota(e.target.value)} className={InputClass} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LabelClass}>Origem</label>
                  <input value={editOrigem} onChange={e => setEditOrigem(e.target.value)} className={InputClass} />
                </div>
                <div>
                  <label className={LabelClass}>Destino</label>
                  <input value={editDestino} onChange={e => setEditDestino(e.target.value)} className={InputClass} />
                </div>
              </div>

              <div>
                <label className={LabelClass}>Faturamento Bruto (R$)</label>
                <input type="number" value={editFatBruto} onChange={e => setEditFatBruto(e.target.value)} className={InputClass} />
              </div>

              <div>
                <label className={LabelClass}>Observações</label>
                <textarea value={editObs} onChange={e => setEditObs(e.target.value)} rows={2} className={InputClass} />
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
                  <p className="text-sm text-red-700 font-medium mb-3">⚠️ Excluir contrato #{sel.contrato}?</p>
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
            <h1 className="text-2xl font-bold text-gray-900">Contratos</h1>
          </div>

          <div className="flex gap-2 mb-4 flex-wrap">
            <div className="flex-1 relative min-w-48">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={busca} onChange={e => setBusca(e.target.value)}
                placeholder="Buscar contrato, motorista, cliente..."
                className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-white shadow-sm" />
            </div>
            <select value={filtroMes} onChange={e => setFiltroMes(Number(e.target.value))}
              className="border border-gray-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-white shadow-sm">
              <option value={0}>Todos os meses</option>
              {MESES.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
            </select>
            <select value={filtroAno} onChange={e => setFiltroAno(Number(e.target.value))}
              className="border border-gray-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-white shadow-sm">
              <option value={2025}>2025</option>
              <option value={2026}>2026</option>
            </select>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 bg-blue-100 rounded-lg flex items-center justify-center">
                  <FileText size={14} className="text-blue-600" />
                </div>
                <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Total</p>
              </div>
              <p className="text-2xl font-bold text-gray-900">{filtrados.length}</p>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 bg-green-100 rounded-lg flex items-center justify-center">
                  <DollarSign size={14} className="text-green-600" />
                </div>
                <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Faturamento</p>
              </div>
              <p className="text-lg font-bold text-gray-900">
                {totalFat.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 bg-yellow-100 rounded-lg flex items-center justify-center">
                  <Clock size={14} className="text-yellow-600" />
                </div>
                <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Abertos</p>
              </div>
              <p className="text-2xl font-bold text-yellow-600">{abertos}</p>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 bg-green-100 rounded-lg flex items-center justify-center">
                  <CheckCircle size={14} className="text-green-600" />
                </div>
                <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Pagos</p>
              </div>
              <p className="text-2xl font-bold text-green-600">{pagos}</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Contratos</p>
              <p className="text-xs text-gray-400">{filtrados.length} resultado(s)</p>
            </div>
            {filtrados.length === 0 ? (
              <div className="p-10 text-center">
                <FileText size={32} className="mx-auto text-gray-200 mb-2" />
                <p className="text-sm text-gray-400">Nenhum contrato encontrado</p>
              </div>
            ) : filtrados.map(c => (
              <button key={c.id} onClick={() => selecionar(c)}
                className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition border-b border-gray-50 last:border-0 text-left">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                  c.status === 'PAGO' ? 'bg-green-100 text-green-600' :
                  c.status === 'CANCELADO' ? 'bg-gray-100 text-gray-500' :
                  'bg-yellow-100 text-yellow-600'
                }`}>
                  <FileText size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-bold text-gray-900">#{c.contrato}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      c.status === 'PAGO' ? 'bg-green-100 text-green-700' :
                      c.status === 'CANCELADO' ? 'bg-gray-100 text-gray-600' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>{c.status}</span>
                  </div>
                  <p className="text-xs text-gray-500 truncate">{c.motorista} · {c.cliente}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {fmtData(c.data)}
                    {c.origem && c.destino && ` · ${c.origem} → ${c.destino}`}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-gray-800">
                    {(c.fat_bruto || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </p>
                  <ChevronRight size={16} className="text-gray-300 ml-auto mt-1" />
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}