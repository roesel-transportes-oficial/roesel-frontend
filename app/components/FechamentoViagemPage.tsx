'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../services/supabase'
import { X, Search, List, Truck, User, Calendar, Gauge, MapPin, Fuel, ArrowRight, History, Download, Plus, CheckCircle2, CreditCard } from 'lucide-react'

type Motorista = { id: string; nome: string; caminhao_id?: string }
type Caminhao = { id: string; placa: string }
type Contrato = { id: string; contrato: string; fat_bruto: number | null; cliente?: string | null; origem?: string | null; destino?: string | null }
type Abastecimento = { id: string; data: string; posto?: string | null; litros_combustivel?: number | null; valor_combustivel?: number | null; litros_arla?: number | null; valor_arla?: number | null }
type Fechamento = {
  id: string
  created_at: string
  motorista: { nome: string }
  caminhao: { placa: string }
  data_inicio: string
  data_fim: string
  km_inicial: number
  km_final: number
  data_vencimento: string
  total_frete: number
  total_abastecido: number
}

export default function FechamentoViagemPage() {
  const [abaAtiva, setAbaAtiva] = useState<'novo' | 'historico'>('novo')
  
  // Estados para Novo Fechamento
  const [motoristas, setMotoristas] = useState<Motorista[]>([])
  const [motoristaId, setMotoristaId] = useState('')
  const [caminhao, setCaminhao] = useState<Caminhao | null>(null)
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [kmInicial, setKmInicial] = useState('')
  const [kmFinal, setKmFinal] = useState('')
  const [dataVencimento, setDataVencimento] = useState('')
  
  const [buscaContrato, setBuscaContrato] = useState('')
  const [contratosDisponiveis, setContratosDisponiveis] = useState<Contrato[]>([])
  const [selecionados, setSelecionados] = useState<Contrato[]>([])
  
  const [abastecimentos, setAbastecimentos] = useState<Abastecimento[]>([])
  const [abastSelecionados, setAbastSelecionados] = useState<Set<string>>(new Set())
  
  // Estados para Histórico
  const [historico, setHistorico] = useState<Fechamento[]>([])
  const [buscaHistorico, setBuscaHistorico] = useState('')
  const [carregandoHistorico, setCarregandoHistorico] = useState(false)

  const [carregandoContratos, setCarregandoContratos] = useState(false)
  const [carregandoAbastecimentos, setCarregandoAbastecimentos] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState(false)

  // Carregar dados iniciais
  useEffect(() => {
    supabase.from('motoristas').select('id, nome, caminhao_id').order('nome').then(({ data }) => data && setMotoristas(data))
  }, [])

  // Carregar Histórico
  useEffect(() => {
    if (abaAtiva === 'historico') {
      setCarregandoHistorico(true)
      supabase
        .from('fechamento_viagens')
        .select(`
          id, created_at, data_inicio, data_fim, km_inicial, km_final, data_vencimento,
          motorista:motoristas(nome),
          caminhao:caminhoes(placa)
        `)
        .order('created_at', { ascending: false })
        .then(({ data, error }) => {
          setCarregandoHistorico(false)
          if (data) setHistorico(data as any)
        })
    }
  }, [abaAtiva])

  // Lógica ao selecionar motorista
  useEffect(() => {
    if (!motoristaId) { setCaminhao(null); setContratosDisponiveis([]); return }
    const motoristaSel = motoristas.find(m => m.id === motoristaId)
    
    async function vincularCaminhao() {
      const { data } = await supabase.from('caminhoes').select('id, placa').or(`id.eq.${motoristaSel?.caminhao_id},motorista_atual.eq.${motoristaId}`).maybeSingle()
      if (data) setCaminhao(data)
    }
    vincularCaminhao()

    setCarregandoContratos(true)
    supabase.from('contratos').select('id, contrato, fat_bruto, cliente, origem, destino').order('created_at', { ascending: false }).limit(30)
      .then(({ data }) => { setCarregandoContratos(false); if (data) setContratosDisponiveis(data) })
  }, [motoristaId, motoristas])

  // Carregar abastecimentos por placa e período
  useEffect(() => {
    if (!caminhao?.placa || !dataInicio || !dataFim) { setAbastecimentos([]); return }
    setCarregandoAbastecimentos(true)
    supabase.from('abastecimentos').select('id, data, posto, litros_combustivel, valor_combustivel, litros_arla, valor_arla')
      .eq('placa', caminhao.placa)
      .gte('data', dataInicio).lte('data', dataFim).order('data', { ascending: true })
      .then(({ data }) => {
        setCarregandoAbastecimentos(false)
        const lista = data || []
        setAbastecimentos(lista)
        setAbastSelecionados(new Set(lista.map(a => a.id)))
      })
  }, [caminhao?.placa, dataInicio, dataFim])

  // Funções de Ação
  function adicionarContrato(contrato: Contrato) {
    setSelecionados(prev => [...prev, contrato])
    setBuscaContrato('')
  }

  function removerContrato(id: string) {
    setSelecionados(prev => prev.filter(c => c.id !== id))
  }

  function toggleAbastecimento(id: string) {
    setAbastSelecionados(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  // Filtros e Cálculos
  const contratosFiltrados = useMemo(() => {
    const jaSel = new Set(selecionados.map(s => s.id))
    return contratosDisponiveis.filter(c => !jaSel.has(c.id) && (c.contrato.includes(buscaContrato) || c.cliente?.toLowerCase().includes(buscaContrato.toLowerCase())))
  }, [contratosDisponiveis, selecionados, buscaContrato])

  const historicoFiltrado = useMemo(() => {
    if (!buscaHistorico) return historico
    const b = buscaHistorico.toLowerCase()
    return historico.filter(h => h.motorista.nome.toLowerCase().includes(b) || h.caminhao.placa.toLowerCase().includes(b))
  }, [historico, buscaHistorico])

  const abastAtivos = useMemo(() => abastecimentos.filter(a => abastSelecionados.has(a.id)), [abastecimentos, abastSelecionados])

  const resumo = useMemo(() => {
    const km = (Number(kmFinal) || 0) - (Number(kmInicial) || 0)
    const litros = abastAtivos.reduce((t, a) => t + Number(a.litros_combustivel || 0), 0)
    const valor = abastAtivos.reduce((t, a) => t + Number(a.valor_combustivel || 0) + Number(a.valor_arla || 0), 0)
    const frete = selecionados.reduce((t, c) => t + Number(c.fat_bruto || 0), 0)
    return { km, litros, valor, frete, mediaKmL: km > 0 && litros > 0 ? km / litros : 0 }
  }, [abastAtivos, kmInicial, kmFinal, selecionados])

  const fmt = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const fmtData = (d: string) => (d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—')

  async function salvar() {
    if (!motoristaId || !dataInicio || !dataFim || !kmInicial || !kmFinal || !dataVencimento || selecionados.length === 0) {
      setErro('Preencha todos os campos, incluindo o vencimento financeiro.'); return
    }
    setSalvando(true); setErro(''); setSucesso(false)
    
    const { data: fech, error } = await supabase.from('fechamento_viagens').insert({
      motorista_id: motoristaId,
      caminhao_id: caminhao?.id || null,
      data_inicio: dataInicio,
      data_fim: dataFim,
      km_inicial: Number(kmInicial),
      km_final: Number(kmFinal),
      data_vencimento: dataVencimento,
      status_financeiro: 'pendente'
    }).select().single()

    if (error || !fech) { setErro('Erro ao salvar: ' + error?.message); setSalvando(false); return }

    await Promise.all([
      supabase.from('fechamento_contratos').insert(selecionados.map(c => ({ fechamento_id: fech.id, contrato_id: c.id }))),
      abastAtivos.length > 0 && supabase.from('fechamento_abastecimentos').insert(abastAtivos.map(a => ({ fechamento_id: fech.id, abastecimento_id: a.id })))
    ])

    setSucesso(true); setSalvando(false)
    setTimeout(() => window.location.reload(), 2000)
  }

  function exportarHistorico() {
    const csv = [
      ['Data Registro', 'Motorista', 'Placa', 'Saída', 'Retorno', 'KM Inicial', 'KM Final', 'Vencimento'],
      ...historicoFiltrado.map(h => [
        new Date(h.created_at).toLocaleDateString('pt-BR'),
        h.motorista.nome,
        h.caminhao.placa,
        fmtData(h.data_inicio),
        fmtData(h.data_fim),
        h.km_inicial,
        h.km_final,
        fmtData(h.data_vencimento)
      ])
    ].map(e => e.join(';')).join('\n')
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `historico_fechamentos_${new Date().toLocaleDateString('pt-BR')}.csv`
    link.click()
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 bg-gray-50 min-h-screen font-sans">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">SISTEMA DE FECHAMENTO</h1>
          <p className="text-sm text-gray-500 font-medium">Gestão de viagens, contratos e abastecimentos</p>
        </div>
        <div className="flex bg-white p-1 rounded-xl shadow-sm border border-gray-200">
          <button onClick={() => setAbaAtiva('novo')} className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${abaAtiva === 'novo' ? 'bg-red-600 text-white shadow-md' : 'text-gray-400 hover:text-gray-600'}`}>Novo Fechamento</button>
          <button onClick={() => setAbaAtiva('historico')} className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${abaAtiva === 'historico' ? 'bg-red-600 text-white shadow-md' : 'text-gray-400 hover:text-gray-600'}`}>Histórico</button>
        </div>
      </header>

      {abaAtiva === 'novo' ? (
        <>
          <div className="sticky top-4 z-40">
            <div className="bg-gray-900 text-white rounded-2xl p-6 shadow-2xl border border-gray-800 grid grid-cols-2 md:grid-cols-5 gap-8">
              <div className="space-y-1"><p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">Distância</p><p className="text-2xl font-bold">{resumo.km > 0 ? `${resumo.km.toLocaleString('pt-BR')} km` : '—'}</p></div>
              <div className="space-y-1"><p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">Combustível</p><p className="text-2xl font-bold text-blue-400">{resumo.litros > 0 ? `${fmt(resumo.litros)} L` : '—'}</p></div>
              <div className="space-y-1"><p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">Média KM/L</p><p className="text-2xl font-bold text-green-400">{resumo.mediaKmL > 0 ? `${fmt(resumo.mediaKmL)}` : '—'}</p></div>
              <div className="space-y-1"><p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">Total Frete</p><p className="text-2xl font-bold text-yellow-400">{resumo.frete > 0 ? `R$ ${fmt(resumo.frete)}` : '—'}</p></div>
              <div className="space-y-1"><p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">Custo Abast.</p><p className="text-2xl font-bold text-red-400">{resumo.valor > 0 ? `R$ ${fmt(resumo.valor)}` : '—'}</p></div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 space-y-6">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-xs font-bold text-gray-600 uppercase tracking-wider"><User size={14} className="text-red-600" /> Motorista</label>
                    <select value={motoristaId} onChange={e => setMotoristaId(e.target.value)} className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 text-sm font-bold focus:border-red-500 focus:bg-white outline-none transition-all">
                      <option value="">Selecione o motorista</option>
                      {motoristas.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-xs font-bold text-gray-600 uppercase tracking-wider"><Truck size={14} className="text-red-600" /> Placa do Caminhão</label>
                    <div className="w-full bg-red-50 border-2 border-red-100 rounded-xl px-4 py-3 text-sm font-black text-red-700 flex items-center justify-between">
                      {caminhao ? caminhao.placa : 'Aguardando...'}
                      {caminhao && <CheckCircle2 size={16} className="text-red-500" />}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 pt-4 border-t border-gray-50">
                  <div className="space-y-2"><label className="text-[10px] font-bold text-gray-500 uppercase">Saída</label><input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs font-bold outline-none focus:border-red-500" /></div>
                  <div className="space-y-2"><label className="text-[10px] font-bold text-gray-500 uppercase">Retorno</label><input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs font-bold outline-none focus:border-red-500" /></div>
                  <div className="space-y-2"><label className="text-[10px] font-bold text-gray-500 uppercase">KM Inicial</label><input type="number" value={kmInicial} onChange={e => setKmInicial(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs font-bold outline-none focus:border-red-500" /></div>
                  <div className="space-y-2"><label className="text-[10px] font-bold text-gray-500 uppercase">KM Final</label><input type="number" value={kmFinal} onChange={e => setKmFinal(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs font-bold outline-none focus:border-red-500" /></div>
                  <div className="space-y-2"><label className="text-[10px] font-bold text-red-600 uppercase flex items-center gap-1"><CreditCard size={10} /> Vencimento</label><input type="date" value={dataVencimento} onChange={e => setDataVencimento(e.target.value)} className="w-full bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs font-bold outline-none focus:border-red-600" /></div>
                </div>
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                  <h2 className="text-xs font-black text-gray-700 uppercase tracking-widest flex items-center gap-2"><Fuel size={16} className="text-red-600" /> Abastecimentos (Placa: {caminhao?.placa || '—'})</h2>
                  <div className="flex gap-4">
                    <button onClick={() => setAbastSelecionados(new Set(abastecimentos.map(a => a.id)))} className="text-[10px] font-black text-red-600 uppercase">Todos</button>
                    <button onClick={() => setAbastSelecionados(new Set())} className="text-[10px] font-black text-gray-400 uppercase">Limpar</button>
                  </div>
                </div>
                <div className="p-6">
                  {!caminhao || !dataInicio || !dataFim ? (
                    <p className="text-center py-12 text-sm text-gray-400 italic">Selecione o motorista e o período.</p>
                  ) : carregandoAbastecimentos ? (
                    <div className="flex items-center justify-center py-12 gap-3"><div className="w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div></div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {abastecimentos.map(a => {
                        const marcado = abastSelecionados.has(a.id)
                        return (
                          <label key={a.id} className={`flex flex-col p-4 rounded-2xl border-2 cursor-pointer transition-all ${marcado ? 'border-red-100 bg-red-50/30' : 'border-gray-100 bg-white opacity-60'}`}>
                            <div className="flex justify-between items-start mb-3">
                              <div className="flex items-center gap-3"><input type="checkbox" checked={marcado} onChange={() => toggleAbastecimento(a.id)} className="w-5 h-5 rounded-lg accent-red-600" /><span className="text-sm font-black text-gray-900">{fmtData(a.data)}</span></div>
                              <span className="text-sm font-black text-red-600">R$ {fmt((a.valor_combustivel || 0) + (a.valor_arla || 0))}</span>
                            </div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase flex items-center gap-1.5 mb-2"><MapPin size={10} /> {a.posto || 'POSTO NÃO IDENTIFICADO'}</p>
                            <div className="flex gap-2"><span className="bg-white px-2 py-1 rounded border text-[10px] font-black text-gray-600 uppercase">Diesel: {a.litros_combustivel ? `${fmt(a.litros_combustivel)} L` : '—'}</span></div>
                          </label>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="lg:col-span-4 space-y-6">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-full max-h-[900px]">
                <div className="p-5 border-b border-gray-100 bg-gray-50/50 space-y-4">
                  <h2 className="text-xs font-black text-gray-700 uppercase tracking-widest">Contratos Disponíveis</h2>
                  <div className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input type="text" placeholder="Buscar contrato..." value={buscaContrato} onChange={e => setBuscaContrato(e.target.value)} className="w-full pl-10 pr-4 py-3 text-sm bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-red-500 transition-all" /></div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                  {contratosFiltrados.map(c => (
                    <button key={c.id} onClick={() => adicionarContrato(c)} className="w-full p-5 text-left bg-white border border-gray-100 rounded-2xl hover:border-red-200 hover:bg-red-50/50 transition-all shadow-sm group">
                      <div className="flex justify-between items-start mb-2"><span className="font-black text-gray-900 text-base">#{c.contrato}</span><span className="text-green-600 font-black text-sm">R$ {fmt(c.fat_bruto || 0)}</span></div>
                      <p className="text-[11px] font-bold text-gray-500 truncate mb-3 uppercase">{c.cliente || 'CLIENTE NÃO INFORMADO'}</p>
                      <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 group-hover:bg-white transition-colors flex items-center justify-between gap-2">
                        <div className="flex-1"><p className="text-[9px] font-black text-gray-400 uppercase">Origem</p><p className="text-[11px] font-black text-red-600 truncate">{c.origem || '—'}</p></div>
                        <ArrowRight size={14} className="text-gray-300" />
                        <div className="flex-1 text-right"><p className="text-[9px] font-black text-gray-400 uppercase">Destino</p><p className="text-[11px] font-black text-red-600 truncate">{c.destino || '—'}</p></div>
                      </div>
                    </button>
                  ))}
                </div>
                {selecionados.length > 0 && (
                  <div className="p-5 bg-red-600 text-white shadow-inner">
                    <h3 className="text-[10px] font-black uppercase tracking-widest mb-4 opacity-90">Selecionados ({selecionados.length})</h3>
                    <div className="flex flex-wrap gap-2">
                      {selecionados.map(c => (
                        <div key={c.id} className="flex items-center gap-2 bg-white/20 backdrop-blur-md border border-white/30 rounded-xl pl-3 pr-2 py-2"><span className="text-xs font-black">#{c.contrato}</span><button onClick={() => removerContrato(c.id)}><X size={14} /></button></div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 pt-8 border-t border-gray-200">
            <div className="flex-1">{erro && <div className="text-red-700 text-sm font-black uppercase tracking-tighter">⚠️ {erro}</div>}{sucesso && <div className="text-green-700 text-sm font-black uppercase tracking-tighter">✓ Fechamento realizado com sucesso!</div>}</div>
            <button onClick={salvar} disabled={!motoristaId || selecionados.length === 0 || salvando} className="w-full md:w-auto bg-red-600 text-white px-16 py-5 rounded-2xl font-black text-base uppercase tracking-widest hover:bg-red-700 disabled:opacity-50 shadow-2xl shadow-red-200 transition-all transform active:scale-95">{salvando ? 'Processando...' : 'Finalizar Fechamento'}</button>
          </div>
        </>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md"><Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" /><input type="text" placeholder="Pesquisar..." value={buscaHistorico} onChange={e => setBuscaHistorico(e.target.value)} className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-red-500 transition-all text-sm font-medium" /></div>
            <button onClick={exportarHistorico} className="flex items-center gap-2 bg-gray-900 text-white px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-gray-800 transition-all"><Download size={16} /> Exportar CSV</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100">
                  <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Data Registro</th>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Motorista / Placa</th>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Período</th>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-red-600">Vencimento</th>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {carregandoHistorico ? (<tr><td colSpan={5} className="px-6 py-12 text-center text-sm text-gray-400 font-bold uppercase">Carregando...</td></tr>) : historicoFiltrado.length === 0 ? (<tr><td colSpan={5} className="px-6 py-12 text-center text-sm text-gray-400 font-bold uppercase">Nenhum registro</td></tr>) : (
                  historicoFiltrado.map(h => (
                    <tr key={h.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4 text-xs font-bold text-gray-500">{new Date(h.created_at).toLocaleDateString('pt-BR')}</td>
                      <td className="px-6 py-4"><p className="text-sm font-black text-gray-900">{h.motorista.nome}</p><p className="text-[10px] font-bold text-red-600 uppercase">{h.caminhao.placa}</p></td>
                      <td className="px-6 py-4 text-xs font-bold text-gray-600">{fmtData(h.data_inicio)} → {fmtData(h.data_fim)}</td>
                      <td className="px-6 py-4 text-xs font-black text-red-600">{fmtData(h.data_vencimento)}</td>
                      <td className="px-6 py-4 text-right"><button className="text-gray-400 hover:text-red-600 transition-colors"><Download size={18} /></button></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
