'use client'
import { useState, useEffect, useMemo } from 'react'
import { contratosAPI, motoristasAPI } from '../services/api'
import { supabase } from '../services/supabase'
import { useAuth } from '../services/auth'
import { Search, Save, Trash2, ChevronRight, ArrowLeft, FileText, DollarSign, CheckCircle, Clock, User, Building2, MapPin, Truck, Calendar, AlertCircle } from 'lucide-react'

interface Contrato {
  id: string; contrato: string; data: string; cliente: string
  cliente_nome_completo: string; cnpj: string; motorista: string
  cpf_motorista: string; placa: string; placa_carreta: string
  frota: string; origem: string; destino: string; fat_bruto: number
  qtd_veiculos: number; chapa: number; status: string; obs: string
  adiantamento_pago: boolean; dt_pagamento: string
}

interface Motorista { id: string; nome: string; cpf?: string; caminhao_id?: string }
interface Cliente { id: string; nome: string; cnpj: string }
interface Carreta { id: string; placa: string }

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

const InputClass = "mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-red-500 bg-gray-50"
const LabelClass = "text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5"

export default function ContratosPage() {
  const { perm } = useAuth()
  const [contratos, setContratos] = useState<Contrato[]>([])
  const [motoristas, setMotoristas] = useState<Motorista[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [carretas, setCarretas] = useState<Carreta[]>([])
  const [sel, setSel] = useState<Contrato | null>(null)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [confirmExcluir, setConfirmExcluir] = useState(false)
  const [busca, setBusca] = useState('')
  const [filtroMes, setFiltroMes] = useState(0)
  const [filtroAno, setFiltroAno] = useState(new Date().getFullYear())

  // Estados de Edição
  const [editData, setEditData] = useState('')
  const [editCliente, setEditCliente] = useState('')
  const [editCnpj, setEditCnpj] = useState('')
  const [editMotorista, setEditMotorista] = useState('')
  const [editPlaca, setEditPlaca] = useState('')
  const [editPlacaCarreta, setEditPlacaCarreta] = useState('')
  const [editFrota, setEditFrota] = useState('')
  const [editOrigem, setEditOrigem] = useState('')
  const [editDestino, setEditDestino] = useState('')
  const [editFatBruto, setEditFatBruto] = useState('')
  const [editQtdVeiculos, setEditQtdVeiculos] = useState('')
  const [editChapa, setEditChapa] = useState('')
  const [editStatus, setEditStatus] = useState('ABERTO')
  const [editObs, setEditObs] = useState('')
  const [editAdiantamentoPago, setEditAdiantamentoPago] = useState(false)
  const [editDtPagamento, setEditDtPagamento] = useState('')

  useEffect(() => {
    fetch_()
    motoristasAPI.listar().then(setMotoristas)
    supabase.from('clientes').select('id, nome, cnpj').order('nome').then(({ data }) => data && setClientes(data))
    // Carregar carretas para a seleção
    supabase.from('carretas').select('id, placa').order('placa').then(({ data }) => data && setCarretas(data))
  }, [filtroMes, filtroAno])

  async function fetch_() {
    const data = await contratosAPI.listar({ mes: filtroMes || undefined, ano: filtroAno || undefined })
    setContratos(data)
  }

  function handleSelectCliente(id: string) {
    const clienteEncontrado = clientes.find(c => c.id === id)
    if (clienteEncontrado) {
      setEditCliente(clienteEncontrado.nome)
      setEditCnpj(clienteEncontrado.cnpj || '')
    } else {
      setEditCliente('')
      setEditCnpj('')
    }
  }

  function handleSelectMotorista(nome: string) {
    setEditMotorista(nome)
    const mot = motoristas.find(m => m.nome === nome)
    if (mot?.caminhao_id) {
      supabase.from('caminhoes').select('placa').eq('id', mot.caminhao_id).maybeSingle().then(({ data }) => {
        if (data) setEditPlaca(data.placa)
      })
    }
  }

  const filtrados = useMemo(() => {
    if (!busca.trim()) return contratos
    const b = busca.toLowerCase()
    return contratos.filter(c =>
      c.motorista?.toLowerCase().includes(b) ||
      c.cliente?.toLowerCase().includes(b) ||
      c.contrato?.toLowerCase().includes(b)
    )
  }, [contratos, busca])

  function selecionar(c: Contrato) {
    setSel(c)
    setEditData(c.data || '')
    setEditCliente(c.cliente || '')
    setEditCnpj(c.cnpj || '')
    setEditMotorista(c.motorista || '')
    setEditPlaca(c.placa || '')
    setEditPlacaCarreta(c.placa_carreta || '')
    setEditFrota(c.frota || '')
    setEditOrigem(c.origem || '')
    setEditDestino(c.destino || '')
    setEditFatBruto(String(c.fat_bruto || ''))
    setEditQtdVeiculos(String(c.qtd_veiculos || ''))
    setEditChapa(String(c.chapa || ''))
    setEditStatus(c.status || 'ABERTO')
    setEditObs(c.obs || '')
    setEditAdiantamentoPago(c.adiantamento_pago || false)
    setEditDtPagamento(c.dt_pagamento || '')
    setConfirmExcluir(false)
  }

  function voltar() { setSel(null); setConfirmExcluir(false) }
  function showMsg(t: string) { setMsg(t); setTimeout(() => setMsg(''), 3000) }

  async function salvar() {
    if (!sel) return
    setLoading(true)
    if (perm !== 'demo') await contratosAPI.atualizar(sel.id, {
      data: editData,
      cliente: editCliente,
      cliente_nome_completo: editCliente,
      cnpj: editCnpj,
      motorista: editMotorista,
      cpf_motorista: sel.cpf_motorista || '',
      placa: editPlaca,
      placa_carreta: editPlacaCarreta,
      frota: editFrota,
      origem: editOrigem,
      destino: editDestino,
      fat_bruto: parseFloat(editFatBruto) || 0,
      qtd_veiculos: parseInt(editQtdVeiculos) || 0,
      chapa: parseInt(editChapa) || 0,
      status: editStatus,
      obs: editObs,
      adiantamento_pago: editAdiantamentoPago,
      dt_pagamento: editDtPagamento || null,
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

  function fmtCNPJ(v: string) {
    if (!v) return ''
    const n = v.replace(/\D/g, '')
    if (n.length !== 14) return v
    return n.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")
  }

  return (
    <div className="p-6 max-w-full bg-gray-50 min-h-screen">
      {msg && <div className="fixed top-6 right-6 z-50 p-4 bg-green-600 text-white rounded-2xl shadow-2xl font-black text-xs uppercase tracking-widest animate-bounce"> {msg} </div>}

      {sel ? (
        <div className="max-w-4xl mx-auto">
          <button onClick={voltar} className="flex items-center gap-2 text-gray-400 hover:text-red-600 mb-6 text-xs font-black uppercase tracking-widest transition-all">
            <ArrowLeft size={16}/> Voltar para lista
          </button>

          <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
            <div className={`px-8 py-8 flex items-center justify-between bg-gradient-to-br ${
              editStatus === 'PAGO' ? 'from-green-600 to-green-800' :
              editStatus === 'CANCELADO' ? 'from-gray-600 to-gray-800' :
              'from-red-600 to-red-800'
            }`}>
              <div className="flex items-center gap-6">
                <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white shadow-inner">
                  <FileText size={32} />
                </div>
                <div>
                  <h2 className="text-white font-black text-3xl tracking-tighter">CONTRATO #{sel.contrato}</h2>
                  <p className="text-white/70 text-xs font-bold uppercase tracking-widest">{editCliente || 'Cliente não informado'}</p>
                </div>
              </div>
              <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl border border-white/20">
                <p className="text-white/60 text-[10px] font-black uppercase tracking-widest mb-1">Status Atual</p>
                <p className="text-white font-black text-sm">{editStatus}</p>
              </div>
            </div>

            <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className={LabelClass}><Calendar size={12}/> Data do Contrato</label>
                    <input type="date" value={editData} onChange={e => setEditData(e.target.value)} className={InputClass} />
                  </div>
                  <div className="space-y-1">
                    <label className={LabelClass}><Clock size={12}/> Status</label>
                    <select value={editStatus} onChange={e => setEditStatus(e.target.value)} className={InputClass}>
                      <option>ABERTO</option>
                      <option>PAGO</option>
                      <option>CANCELADO</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className={LabelClass}><Building2 size={12}/> Cliente</label>
                  <select 
                    value={clientes.find(c => c.nome === editCliente && c.cnpj === editCnpj)?.id || ""} 
                    onChange={e => handleSelectCliente(e.target.value)} 
                    className={InputClass}
                  >
                    <option value="">Selecione o cliente...</option>
                    {clientes.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.nome} {c.cnpj ? ` - ${fmtCNPJ(c.cnpj)}` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className={LabelClass}>CNPJ do Cliente</label>
                  <input value={editCnpj} onChange={e => setEditCnpj(e.target.value)} className={InputClass} placeholder="00.000.000/0000-00" />
                </div>

                <div className="space-y-1">
                  <label className={LabelClass}><User size={12}/> Motorista Responsável</label>
                  <select value={editMotorista} onChange={e => handleSelectMotorista(e.target.value)} className={InputClass}>
                    <option value="">Selecione o motorista...</option>
                    {motoristas.map(m => <option key={m.id} value={m.nome}>{m.nome}</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className={LabelClass}><Truck size={12}/> Placa Cavalo</label>
                    <input value={editPlaca} onChange={e => setEditPlaca(e.target.value.toUpperCase())} className={InputClass} />
                  </div>
                  <div className="space-y-1">
                    <label className={LabelClass}><Truck size={12}/> Placa Carreta</label>
                    <select value={editPlacaCarreta} onChange={e => setEditPlacaCarreta(e.target.value)} className={InputClass}>
                      <option value="">Selecione a carreta...</option>
                      {carretas.map(c => <option key={c.id} value={c.placa}>{c.placa}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className={LabelClass}>Frota</label>
                    <input value={editFrota} onChange={e => setEditFrota(e.target.value)} className={InputClass} />
                  </div>
                  <div className="space-y-1">
                    <label className={LabelClass}>Qtd. Veículos</label>
                    <input type="number" value={editQtdVeiculos} onChange={e => setEditQtdVeiculos(e.target.value)} className={InputClass} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className={LabelClass}><MapPin size={12}/> Origem</label>
                    <input value={editOrigem} onChange={e => setEditOrigem(e.target.value)} className={InputClass} />
                  </div>
                  <div className="space-y-1">
                    <label className={LabelClass}><MapPin size={12}/> Destino</label>
                    <input value={editDestino} onChange={e => setEditDestino(e.target.value)} className={InputClass} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className={LabelClass}><DollarSign size={12}/> Frete Contratado (R$)</label>
                    <input type="number" value={editFatBruto} onChange={e => setEditFatBruto(e.target.value)} className={`${InputClass} text-red-600 font-black`} />
                  </div>
                  <div className="space-y-1">
                    <label className={LabelClass}>Chapa (R$)</label>
                    <input type="number" value={editChapa} onChange={e => setEditChapa(e.target.value)} className={InputClass} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className={LabelClass}>Data Pagamento</label>
                    <input type="date" value={editDtPagamento} onChange={e => setEditDtPagamento(e.target.value)} className={InputClass} />
                  </div>
                  <div className="flex items-center pt-6">
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${editAdiantamentoPago ? 'bg-red-600 border-red-600' : 'border-gray-200 group-hover:border-red-400'}`}>
                        {editAdiantamentoPago && <CheckCircle size={14} className="text-white" />}
                      </div>
                      <input type="checkbox" checked={editAdiantamentoPago} onChange={e => setEditAdiantamentoPago(e.target.checked)} className="hidden" />
                      <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Adiantamento Pago</span>
                    </label>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className={LabelClass}>Observações Internas</label>
                  <textarea value={editObs} onChange={e => setEditObs(e.target.value)} className={`${InputClass} min-h-[100px] font-normal`} placeholder="Notas sobre o contrato..." />
                </div>
              </div>
            </div>

            <div className="p-8 bg-gray-50 border-t border-gray-100 flex flex-col md:flex-row gap-4">
              <button onClick={salvar} disabled={loading}
                className="flex-1 flex items-center justify-center gap-3 bg-red-600 hover:bg-red-700 text-white rounded-2xl py-4 text-sm font-black uppercase tracking-widest transition-all shadow-lg shadow-red-100 active:scale-95">
                <Save size={18}/> {loading ? 'Salvando...' : 'Salvar alterações'}
              </button>
              <button onClick={() => setConfirmExcluir(true)}
                className="flex items-center justify-center gap-2 border-2 border-red-100 text-red-500 hover:bg-red-50 rounded-2xl px-8 py-4 text-sm font-black uppercase tracking-widest transition-all">
                <Trash2 size={18}/>
              </button>
            </div>

            {confirmExcluir && (
              <div className="m-8 p-6 bg-red-50 border-2 border-red-100 rounded-3xl animate-in fade-in zoom-in duration-200">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-red-600">
                    <AlertCircle size={24} />
                  </div>
                  <div>
                    <p className="text-red-900 font-black text-lg tracking-tight">Excluir Contrato?</p>
                    <p className="text-red-600/70 text-xs font-bold uppercase tracking-widest">Esta ação não pode ser desfeita.</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button onClick={excluir} className="flex-1 bg-red-600 text-white rounded-xl py-3 text-xs font-black uppercase tracking-widest hover:bg-red-700 transition-all">Sim, excluir agora</button>
                  <button onClick={() => setConfirmExcluir(false)} className="flex-1 bg-white border border-gray-200 text-gray-500 rounded-xl py-3 text-xs font-black uppercase tracking-widest hover:bg-gray-50 transition-all">Cancelar</button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-black text-gray-900 tracking-tighter">CONTRATOS</h1>
              <p className="text-sm text-gray-400 font-bold uppercase tracking-widest">Gestão e monitoramento de fretes</p>
            </div>
            <div className="flex gap-2">
              <select value={filtroMes} onChange={e => setFiltroMes(Number(e.target.value))}
                className="bg-white border border-gray-200 rounded-2xl px-4 py-3 text-xs font-black uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-red-500 shadow-sm">
                <option value={0}>Todos os meses</option>
                {MESES.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
              </select>
              <select value={filtroAno} onChange={e => setFiltroAno(Number(e.target.value))}
                className="bg-white border border-gray-200 rounded-2xl px-4 py-3 text-xs font-black uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-red-500 shadow-sm">
                <option value={2025}>2025</option>
                <option value={2026}>2026</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
              <p className="text-[10px] text-gray-400 uppercase tracking-widest font-black mb-1">Total de Contratos</p>
              <p className="text-3xl font-black text-gray-900 tracking-tighter">{filtrados.length}</p>
            </div>
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
              <p className="text-[10px] text-gray-400 uppercase tracking-widest font-black mb-1">Faturamento Bruto</p>
              <p className="text-xl font-black text-red-600 tracking-tighter">
                {totalFat.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
            </div>
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
              <p className="text-[10px] text-yellow-600 uppercase tracking-widest font-black mb-1">Aguardando Pagto</p>
              <p className="text-3xl font-black text-yellow-600 tracking-tighter">{abertos}</p>
            </div>
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
              <p className="text-[10px] text-green-600 uppercase tracking-widest font-black mb-1">Contratos Pagos</p>
              <p className="text-3xl font-black text-green-600 tracking-tighter">{pagos}</p>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden">
            <div className="px-8 py-6 bg-gray-50/50 border-b border-gray-100 flex items-center justify-between">
              <div className="relative flex-1 max-w-md">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={busca} onChange={e => setBusca(e.target.value)}
                  placeholder="Pesquisar contrato, motorista ou cliente..."
                  className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-red-500 bg-white shadow-inner" />
              </div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">{filtrados.length} registros encontrados</p>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/30 border-b border-gray-100">
                    <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Contrato</th>
                    <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Motorista / Cliente</th>
                    <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Trajeto</th>
                    <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Valor</th>
                    <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtrados.length === 0 ? (
                    <tr><td colSpan={5} className="px-8 py-20 text-center text-gray-300 font-black uppercase text-xs tracking-widest">Nenhum contrato encontrado</td></tr>
                  ) : filtrados.map(c => (
                    <tr key={c.id} onClick={() => selecionar(c)} className="hover:bg-red-50/30 transition-colors cursor-pointer group">
                      <td className="px-8 py-5">
                        <p className="text-sm font-black text-gray-900 group-hover:text-red-600 transition-colors">#{c.contrato}</p>
                        <p className="text-[10px] font-bold text-gray-400 uppercase">{fmtData(c.data)}</p>
                      </td>
                      <td className="px-8 py-5">
                        <p className="text-sm font-black text-gray-800">{c.motorista}</p>
                        <p className="text-[10px] font-bold text-gray-400 uppercase truncate max-w-[200px]">{c.cliente}</p>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black text-red-600 uppercase">{c.origem || '—'}</span>
                          <ArrowLeft size={10} className="rotate-180 text-gray-300" />
                          <span className="text-[10px] font-black text-red-600 uppercase">{c.destino || '—'}</span>
                        </div>
                        <p className="text-[9px] font-bold text-gray-400 uppercase mt-1">Placa: {c.placa}</p>
                      </td>
                      <td className="px-8 py-5">
                        <p className="text-sm font-black text-gray-900">{(c.fat_bruto || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                      </td>
                      <td className="px-8 py-5 text-right">
                        <span className={`inline-block px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${
                          c.status === 'PAGO' ? 'bg-green-100 text-green-700' :
                          c.status === 'CANCELADO' ? 'bg-gray-100 text-gray-600' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>{c.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
