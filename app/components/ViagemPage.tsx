'use client'
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../services/supabase'
import { useAuth } from '../services/auth'
import { Search, Save, Trash2, ArrowLeft, FileText, DollarSign, CheckCircle, Clock, User, Building2, MapPin, Truck, Calendar, AlertCircle, Loader2 } from 'lucide-react'

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
  const [loadingLista, setLoadingLista] = useState(false)
  const [msg, setMsg] = useState('')
  const [confirmExcluir, setConfirmExcluir] = useState(false)
  const [busca, setBusca] = useState('')
  const [filtroMes, setFiltroMes] = useState(0)
  const [filtroAno, setFiltroAno] = useState(new Date().getFullYear())

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

  async function fetch_() {
    setLoadingLista(true)
    try {
      let query = supabase
        .from('contratos')
        .select('id, contrato, data, cliente, cliente_nome_completo, cnpj, motorista, cpf_motorista, placa, placa_carreta, frota, origem, destino, fat_bruto, qtd_veiculos, chapa, status, obs, adiantamento_pago, dt_pagamento')
        .order('data', { ascending: false })

      if (filtroAno) {
        query = query
          .gte('data', `${filtroAno}-01-01`)
          .lte('data', `${filtroAno}-12-31`)
      }
      if (filtroMes) {
        const mesStr = String(filtroMes).padStart(2, '0')
        const ultimoDia = new Date(filtroAno, filtroMes, 0).getDate()
        query = query
          .gte('data', `${filtroAno}-${mesStr}-01`)
          .lte('data', `${filtroAno}-${mesStr}-${ultimoDia}`)
      }

      const { data } = await query
      if (data) setContratos(data as Contrato[])
    } finally {
      setLoadingLista(false)
    }
  }

  useEffect(() => {
    Promise.all([
      fetch_(),
      // CORREÇÃO: Buscar motoristas diretamente do Supabase ao invés de usar motoristasAPI
      supabase.from('motoristas').select('id, nome, cpf, caminhao_id').order('nome').then(({ data }) => data && setMotoristas(data)),
      supabase.from('clientes').select('id, nome, cnpj').order('nome').then(({ data }) => data && setClientes(data)),
      supabase.from('carretas').select('id, placa').order('placa').then(({ data }) => data && setCarretas(data))
    ])
  }, [filtroMes, filtroAno])

  function handleSelectCliente(id: string) {
    const clienteEncontrado = clientes.find(c => c.id === id)
    if (clienteEncontrado) {
      setEditCliente(clienteEncontrado.nome)
      setEditCnpj(fmtCNPJ(clienteEncontrado.cnpj || ''))
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
    setEditCnpj(fmtCNPJ(c.cnpj || ''))
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
    try {
      if (perm !== 'demo') {
        // Direto no Supabase — sem passar pelo FastAPI
        const { error } = await supabase
          .from('contratos')
          .update({
            data: editData,
            cliente: editCliente,
            cliente_nome_completo: editCliente,
            cnpj: editCnpj.replace(/\D/g, ''),
            motorista: editMotorista,
            placa: editPlaca,
            placa_carreta: editPlacaCarreta,
            frota: editFrota,
            origem: editOrigem,
            destino: editDestino,
            fat_bruto: parseFloat(editFatBruto) || 0,
            qtd_veiculos: parseInt(editQtdVeiculos) || 0,
            chapa: parseInt(editChapa) || null,
            status: editStatus,
            obs: editObs,
            adiantamento_pago: editAdiantamentoPago,
            dt_pagamento: editDtPagamento || null,
          })
          .eq('id', sel.id)

        if (error) throw error
      }
      await fetch_()
      showMsg('✅ Atualizado!')
      voltar()
    } catch (error: any) {
      console.error(error)
      showMsg('❌ Erro ao salvar: ' + (error?.message || ''))
    } finally {
      setLoading(false)
    }
  }

  async function excluir() {
    if (!sel) return
    setLoading(true)
    try {
      if (perm !== 'demo') {
        const { error } = await supabase.from('contratos').delete().eq('id', sel.id)
        if (error) throw error
      }
      await fetch_()
      showMsg('Contrato excluído.')
      voltar()
    } catch (error: any) {
      showMsg('❌ Erro ao excluir: ' + (error?.message || ''))
    } finally {
      setLoading(false)
    }
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
    return n
      .replace(/^(\d{2})(\d)/, "$1.$2")
      .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1/$2")
      .replace(/(\d{4})(\d)/, "$1-$2")
      .substring(0, 18)
  }

  return (
    <div className="p-6 max-w-full bg-gray-50 min-h-screen">
      {msg && (
        <div className="fixed top-6 right-6 z-50 p-4 bg-green-600 text-white rounded-2xl shadow-2xl font-black text-xs uppercase tracking-widest animate-bounce">
          {msg}
        </div>
      )}

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
                    value={clientes.find(c => c.nome === editCliente && (c.cnpj || '').replace(/\D/g, '') === editCnpj.replace(/\D/g, ''))?.id || ""}
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
                  <input
                    value={editCnpj}
                    onChange={e => setEditCnpj(fmtCNPJ(e.target.value))}
                    className={InputClass}
                    placeholder="00.000.000/0000-00"
                  />
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
                    <label className={LabelClass}><DollarSign size={12}/> Faturamento Bruto</label>
                    <input type="number" step="0.01" value={editFatBruto} onChange={e => setEditFatBruto(e.target.value)} className={InputClass} />
                  </div>
                  <div className="space-y-1">
                    <label className={LabelClass}>Chapa</label>
                    <input type="number" value={editChapa} onChange={e => setEditChapa(e.target.value)} className={InputClass} />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className={LabelClass}>Observações</label>
                  <textarea value={editObs} onChange={e => setEditObs(e.target.value)} rows={3} className={InputClass} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-3 p-3 bg-gray-100 rounded-xl">
                    <input
                      type="checkbox"
                      checked={editAdiantamentoPago}
                      onChange={e => setEditAdiantamentoPago(e.target.checked)}
                      className="w-5 h-5 rounded border-gray-300"
                    />
                    <label className={LabelClass + ' m-0'}>Adiantamento Pago</label>
                  </div>
                  <div className="space-y-1">
                    <label className={LabelClass}>Data de Pagamento</label>
                    <input type="date" value={editDtPagamento} onChange={e => setEditDtPagamento(e.target.value)} className={InputClass} />
                  </div>
                </div>
              </div>
            </div>

            <div className="px-8 py-6 bg-gray-50 border-t border-gray-100 flex gap-4 justify-end">
              <button
                onClick={voltar}
                className="px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest border border-gray-200 text-gray-600 hover:bg-gray-100 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={() => setConfirmExcluir(true)}
                className="px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest bg-red-100 text-red-600 hover:bg-red-200 transition-all flex items-center gap-2"
              >
                <Trash2 size={14} /> Excluir
              </button>
              <button
                onClick={salvar}
                disabled={loading}
                className="px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest bg-red-600 text-white hover:bg-red-700 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Salvar
              </button>
            </div>

            {confirmExcluir && (
              <div className="px-8 py-6 bg-red-50 border-t border-red-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertCircle size={20} className="text-red-600" />
                  <p className="text-sm font-bold text-red-700">Tem certeza que deseja excluir este contrato?</p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setConfirmExcluir(false)}
                    className="px-4 py-2 rounded-lg font-black text-xs uppercase tracking-widest border border-red-300 text-red-600 hover:bg-red-100 transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={excluir}
                    disabled={loading}
                    className="px-4 py-2 rounded-lg font-black text-xs uppercase tracking-widest bg-red-600 text-white hover:bg-red-700 transition-all disabled:opacity-50"
                  >
                    {loading ? 'Excluindo...' : 'Confirmar Exclusão'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="max-w-full">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-8">
              <div>
                <h1 className="text-4xl font-black text-gray-900 tracking-tighter mb-2">Contratos</h1>
                <p className="text-sm text-gray-500 font-bold uppercase tracking-widest">Gerencie todos os contratos de fretes</p>
              </div>
              <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
                <div className="relative flex-1 md:flex-none">
                  <Search size={16} className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Buscar por motorista, cliente ou contrato..."
                    value={busca}
                    onChange={e => setBusca(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-red-500 bg-white"
                  />
                </div>
                <select
                  value={filtroMes}
                  onChange={e => setFiltroMes(parseInt(e.target.value))}
                  className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-red-500 bg-white"
                >
                  <option value={0}>Todos os meses</option>
                  {MESES.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
                </select>
                <select
                  value={filtroAno}
                  onChange={e => setFiltroAno(parseInt(e.target.value))}
                  className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-red-500 bg-white"
                >
                  {[2024, 2025, 2026].map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Faturamento Total</p>
                    <p className="text-2xl font-black text-gray-900">{totalFat.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                  </div>
                  <DollarSign size={32} className="text-red-200" />
                </div>
              </div>

              <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Contratos Abertos</p>
                    <p className="text-2xl font-black text-gray-900">{abertos}</p>
                  </div>
                  <Clock size={32} className="text-yellow-200" />
                </div>
              </div>

              <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Contratos Pagos</p>
                    <p className="text-2xl font-black text-gray-900">{pagos}</p>
                  </div>
                  <CheckCircle size={32} className="text-green-200" />
                </div>
              </div>
            </div>

            {loadingLista ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={32} className="animate-spin text-red-600" />
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="px-8 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Contrato</th>
                      <th className="px-8 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Motorista</th>
                      <th className="px-8 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Rota</th>
                      <th className="px-8 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Faturamento</th>
                      <th className="px-8 py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filtrados.map(c => (
                      <tr key={c.id} onClick={() => selecionar(c)} className="group hover:bg-red-50 cursor-pointer transition-colors">
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
            )}
          </div>
        </>
      )}
    </div>
  )
}
