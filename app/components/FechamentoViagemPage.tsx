'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../services/supabase'
import { X, Search, Truck, User, Calendar, MapPin, Fuel, ArrowRight, Download, CheckCircle2, CreditCard, Filter, AlertCircle } from 'lucide-react'

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
}

export default function FechamentoViagemPage() {
  const [abaAtiva, setAbaAtiva] = useState<'novo' | 'historico'>('novo')

  const [motoristas, setMotoristas] = useState<Motorista[]>([])
  const [motoristaId, setMotoristaId] = useState('')
  const [caminhao, setCaminhao] = useState<Caminhao | null>(null)
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [kmInicial, setKmInicial] = useState('')
  const [kmFinal, setKmFinal] = useState('')
  const [dataVencimento, setDataVencimento] = useState('')

  const [abastDataInicio, setAbastDataInicio] = useState('')
  const [abastDataFim, setAbastDataFim] = useState('')

  const [buscaContrato, setBuscaContrato] = useState('')
  const [contratosDisponiveis, setContratosDisponiveis] = useState<Contrato[]>([])
  const [selecionados, setSelecionados] = useState<Contrato[]>([])

  const [abastecimentos, setAbastecimentos] = useState<Abastecimento[]>([])
  const [abastSelecionados, setAbastSelecionados] = useState<Set<string>>(new Set())

  const [historico, setHistorico] = useState<Fechamento[]>([])
  const [buscaHistorico, setBuscaHistorico] = useState('')
  const [carregandoHistorico, setCarregandoHistorico] = useState(false)
  const [carregandoAbastecimentos, setCarregandoAbastecimentos] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState(false)

  useEffect(() => {
    supabase.from('motoristas').select('id, nome, caminhao_id').order('nome')
      .then(({ data }) => data && setMotoristas(data))
  }, [])

  useEffect(() => {
    if (abaAtiva === 'historico') {
      setCarregandoHistorico(true)
      supabase
        .from('fechamento_viagens')
        .select(`id, created_at, data_inicio, data_fim, km_inicial, km_final, data_vencimento,
          motorista:motoristas(nome), caminhao:caminhoes(placa)`)
        .order('created_at', { ascending: false })
        .then(({ data }) => { setCarregandoHistorico(false); if (data) setHistorico(data as any) })
    }
  }, [abaAtiva])

  // Motorista → caminhão
  useEffect(() => {
    if (!motoristaId) { setCaminhao(null); setContratosDisponiveis([]); return }
    const motoristaSel = motoristas.find(m => m.id === motoristaId)

    async function vincularCaminhao() {
      let query = supabase.from('caminhoes').select('id, placa').eq('motorista_atual', motoristaId)
      if (motoristaSel?.caminhao_id) {
        query = supabase.from('caminhoes').select('id, placa').or(`id.eq.${motoristaSel.caminhao_id},motorista_atual.eq.${motoristaId}`)
      }
      const { data } = await query.maybeSingle()
      if (data) setCaminhao(data)
    }
    vincularCaminhao()

    supabase.from('contratos').select('id, contrato, fat_bruto, cliente, origem, destino')
      .order('created_at', { ascending: false }).limit(50)
      .then(({ data }) => { if (data) setContratosDisponiveis(data) })
  }, [motoristaId, motoristas])

  // ✅ CORRIGIDO: filtra por caminhao_id, não por placa
  useEffect(() => {
    if (!caminhao?.id || !abastDataInicio || !abastDataFim) {
      setAbastecimentos([]); setAbastSelecionados(new Set()); return
    }
    setCarregandoAbastecimentos(true)
    setErro('')

    supabase.from('abastecimentos')
      .select('id, data, posto, litros_combustivel, valor_combustivel, litros_arla, valor_arla')
      .eq('caminhao_id', caminhao.id)
      .gte('data', abastDataInicio)
      .lte('data', abastDataFim)
      .order('data', { ascending: true })
      .then(({ data, error }) => {
        setCarregandoAbastecimentos(false)
        if (error) { setErro('Erro na busca: ' + error.message); return }
        const lista = data || []
        setAbastecimentos(lista)
        setAbastSelecionados(new Set(lista.map(a => a.id)))
      })
  }, [caminhao?.id, abastDataInicio, abastDataFim])

  function adicionarContrato(contrato: Contrato) {
    setSelecionados(prev => [...prev, contrato])
    setBuscaContrato('')
  }
  function removerContrato(id: string) { setSelecionados(prev => prev.filter(c => c.id !== id)) }
  function toggleAbastecimento(id: string) {
    setAbastSelecionados(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const contratosFiltrados = useMemo(() => {
    const jaSel = new Set(selecionados.map(s => s.id))
    return contratosDisponiveis.filter(c =>
      !jaSel.has(c.id) &&
      (c.contrato.includes(buscaContrato) || c.cliente?.toLowerCase().includes(buscaContrato.toLowerCase()))
    )
  }, [contratosDisponiveis, selecionados, buscaContrato])

  const historicoFiltrado = useMemo(() => {
    if (!buscaHistorico) return historico
    const b = buscaHistorico.toLowerCase()
    return historico.filter(h =>
      h.motorista.nome.toLowerCase().includes(b) || h.caminhao.placa.toLowerCase().includes(b)
    )
  }, [historico, buscaHistorico])

  const abastAtivos = useMemo(
    () => abastecimentos.filter(a => abastSelecionados.has(a.id)),
    [abastecimentos, abastSelecionados]
  )

  const resumo = useMemo(() => {
    const km = (Number(kmFinal) || 0) - (Number(kmInicial) || 0)
    const litros = abastAtivos.reduce((t, a) => t + Number(a.litros_combustivel || 0), 0)
    const valor = abastAtivos.reduce((t, a) => t + Number(a.valor_combustivel || 0) + Number(a.valor_arla || 0), 0)
    const frete = selecionados.reduce((t, c) => t + Number(c.fat_bruto || 0), 0)
    return { km, litros, valor, frete, mediaKmL: km > 0 && litros > 0 ? km / litros : 0 }
  }, [abastAtivos, kmInicial, kmFinal, selecionados])

  const fmt = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const fmtData = (d: string) => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—'

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
        h.motorista.nome, h.caminhao.placa,
        fmtData(h.data_inicio), fmtData(h.data_fim),
        h.km_inicial, h.km_final, fmtData(h.data_vencimento)
      ])
    ].map(e => e.join(';')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `fechamentos_${new Date().toLocaleDateString('pt-BR')}.csv`
    link.click()
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 bg-gray-50 min-h-screen font-sans">

      {/* ── Header ── */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          {/* ✅ TÍTULO CORRIGIDO */}
          <h1 className="text-2xl font-bold text-gray-900">Fechamento de Viagem</h1>
          <p className="text-sm text-gray-500">Gestão de viagens, contratos e abastecimentos</p>
        </div>
        <div className="flex bg-white p-1 rounded-xl shadow-sm border border-gray-200">
          <button onClick={() => setAbaAtiva('novo')}
            className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all
              ${abaAtiva === 'novo' ? 'bg-red-600 text-white shadow-md' : 'text-gray-400 hover:text-gray-600'}`}>
            Novo Fechamento
          </button>
          <button onClick={() => setAbaAtiva('historico')}
            className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all
              ${abaAtiva === 'historico' ? 'bg-red-600 text-white shadow-md' : 'text-gray-400 hover:text-gray-600'}`}>
            Histórico
          </button>
        </div>
      </header>

      {abaAtiva === 'novo' ? (
        <>
          {/* ── Resumo sticky ── */}
          <div className="sticky top-4 z-40">
            <div className="bg-gray-900 text-white rounded-2xl p-6 shadow-2xl border border-gray-800 grid grid-cols-2 md:grid-cols-5 gap-8">
              <div><p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">Distância</p><p className="text-2xl font-bold mt-1">{resumo.km > 0 ? `${resumo.km.toLocaleString('pt-BR')} km` : '—'}</p></div>
              <div><p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">Combustível</p><p className="text-2xl font-bold text-blue-400 mt-1">{resumo.litros > 0 ? `${fmt(resumo.litros)} L` : '—'}</p></div>
              <div><p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">Média KM/L</p><p className="text-2xl font-bold text-green-400 mt-1">{resumo.mediaKmL > 0 ? fmt(resumo.mediaKmL) : '—'}</p></div>
              <div><p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">Total Frete</p><p className="text-2xl font-bold text-yellow-400 mt-1">{resumo.frete > 0 ? `R$ ${fmt(resumo.frete)}` : '—'}</p></div>
              <div><p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">Custo Abast.</p><p className="text-2xl font-bold text-red-400 mt-1">{resumo.valor > 0 ? `R$ ${fmt(resumo.valor)}` : '—'}</p></div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 space-y-6">

              {/* ── Motorista + Datas + KM ── */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-xs font-bold text-gray-600 uppercase tracking-wider">
                      <User size={14} className="text-red-600" /> Motorista
                    </label>
                    <select value={motoristaId} onChange={e => { setMotoristaId(e.target.value); setSelecionados([]); setAbastecimentos([]); setAbastSelecionados(new Set()) }}
                      className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 text-sm font-bold focus:border-red-500 focus:bg-white outline-none transition-all">
                      <option value="">Selecione o motorista</option>
                      {motoristas.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-xs font-bold text-gray-600 uppercase tracking-wider">
                      <Truck size={14} className="text-red-600" /> Placa do Caminhão
                    </label>
                    <div className="w-full bg-red-50 border-2 border-red-100 rounded-xl px-4 py-3 text-sm font-black text-red-700 flex items-center justify-between">
                      {caminhao ? caminhao.placa : 'Aguardando...'}
                      {caminhao && <CheckCircle2 size={16} className="text-red-500" />}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 pt-4 border-t border-gray-50">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-gray-500 uppercase">Saída Viagem</label>
                    <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs font-bold outline-none focus:border-red-500" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-gray-500 uppercase">Retorno Viagem</label>
                    <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs font-bold outline-none focus:border-red-500" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-gray-500 uppercase">KM Inicial</label>
                    <input type="number" value={kmInicial} onChange={e => setKmInicial(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs font-bold outline-none focus:border-red-500" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-gray-500 uppercase">KM Final</label>
                    <input type="number" value={kmFinal} onChange={e => setKmFinal(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs font-bold outline-none focus:border-red-500" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-red-600 uppercase flex items-center gap-1">
                      <CreditCard size={10} /> Vencimento
                    </label>
                    <input type="date" value={dataVencimento} onChange={e => setDataVencimento(e.target.value)}
                      className="w-full bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs font-bold outline-none focus:border-red-600" />
                  </div>
                </div>
              </div>

              {/* ── Abastecimentos ── */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-5 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between bg-gray-50/50 gap-4">
                  <div className="flex items-center gap-3">
                    <h2 className="text-xs font-black text-gray-700 uppercase tracking-widest flex items-center gap-2">
                      <Fuel size={16} className="text-red-600" /> Abastecimentos
                    </h2>
                    {caminhao && <span className="bg-red-600 text-white px-2 py-0.5 rounded text-[10px] font-black">{caminhao.placa}</span>}
                  </div>
                  <div className="flex items-center gap-2 bg-white p-1.5 rounded-xl border border-gray-200 shadow-sm">
                    <Filter size={14} className="text-gray-400 ml-2" />
                    <input type="date" value={abastDataInicio} onChange={e => setAbastDataInicio(e.target.value)}
                      className="text-[10px] font-bold outline-none border-none p-1" />
                    <span className="text-gray-300">→</span>
                    <input type="date" value={abastDataFim} onChange={e => setAbastDataFim(e.target.value)}
                      className="text-[10px] font-bold outline-none border-none p-1" />
                  </div>
                  <div className="flex gap-4">
                    <button onClick={() => setAbastSelecionados(new Set(abastecimentos.map(a => a.id)))}
                      className="text-[10px] font-black text-red-600 uppercase">Todos</button>
                    <button onClick={() => setAbastSelecionados(new Set())}
                      className="text-[10px] font-black text-gray-400 uppercase">Limpar</button>
                  </div>
                </div>

                <div className="p-6">
                  {erro && (
                    <div className="mb-6 bg-red-50 border border-red-100 p-4 rounded-xl flex items-center gap-3 text-red-700 text-xs font-bold uppercase">
                      <AlertCircle size={18} /> {erro}
                    </div>
                  )}
                  {!caminhao ? (
                    <p className="text-center py-12 text-sm text-gray-400 italic">Selecione o motorista para carregar os abastecimentos.</p>
                  ) : !abastDataInicio || !abastDataFim ? (
                    <p className="text-center py-12 text-sm text-gray-400 italic flex items-center justify-center gap-2">
                      <Calendar size={16} /> Informe o período para buscar abastecimentos da placa {caminhao.placa}.
                    </p>
                  ) : carregandoAbastecimentos ? (
                    <div className="flex items-center justify-center py-12 gap-3">
                      <div className="w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-xs font-bold text-gray-500 uppercase">Buscando...</span>
                    </div>
                  ) : abastecimentos.length === 0 ? (
                    <div className="text-center py-12 space-y-2">
                      <Fuel size={32} className="mx-auto text-gray-200" />
                      <p className="text-sm text-gray-400 italic">
                        Nenhum abastecimento encontrado para {caminhao.placa} entre {fmtData(abastDataInicio)} e {fmtData(abastDataFim)}.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {abastecimentos.map(a => {
                        const marcado = abastSelecionados.has(a.id)
                        const valor = (a.valor_combustivel || 0) + (a.valor_arla || 0)
                        return (
                          <label key={a.id}
                            className={`flex flex-col p-4 rounded-2xl border-2 cursor-pointer transition-all
                              ${marcado ? 'border-red-100 bg-red-50/30' : 'border-gray-100 bg-white opacity-60'}`}>
                            <div className="flex justify-between items-start mb-3">
                              <div className="flex items-center gap-3">
                                <input type="checkbox" checked={marcado} onChange={() => toggleAbastecimento(a.id)}
                                  className="w-5 h-5 rounded-lg accent-red-600" />
                                <span className="text-sm font-black text-gray-900">{fmtData(a.data)}</span>
                              </div>
                              <span className="text-sm font-black text-red-600">R$ {fmt(valor)}</span>
                            </div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase flex items-center gap-1.5 mb-2">
                              <MapPin size={10} /> {a.posto || 'POSTO NÃO IDENTIFICADO'}
                            </p>
                            <div className="flex gap-2 flex-wrap">
                              <span className="bg-white px-2 py-1 rounded border text-[10px] font-black text-gray-600 uppercase">
                                Diesel: {a.litros_combustivel ? `${fmt(a.litros_combustivel)} L` : '—'}
                              </span>
                              {a.litros_arla && a.litros_arla > 0 && (
                                <span className="bg-blue-50 px-2 py-1 rounded border border-blue-100 text-[10px] font-black text-blue-600 uppercase">
                                  Arla: {fmt(a.litros_arla)} L
                                </span>
                              )}
                            </div>
                          </label>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── Contratos ── */}
            <div className="lg:col-span-4 space-y-6">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col" style={{ maxHeight: '900px' }}>
                <div className="p-5 border-b border-gray-100 bg-gray-50/50 space-y-4">
                  <h2 className="text-xs font-black text-gray-700 uppercase tracking-widest">Contratos Disponíveis</h2>
                  <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type="text" placeholder="Buscar contrato..." value={buscaContrato}
                      onChange={e => setBuscaContrato(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 text-sm bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-red-500 transition-all" />
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {contratosFiltrados.map(c => (
                    <button key={c.id} onClick={() => adicionarContrato(c)}
                      className="w-full p-5 text-left bg-white border border-gray-100 rounded-2xl hover:border-red-200 hover:bg-red-50/50 transition-all shadow-sm group">
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-black text-gray-900 text-base">#{c.contrato}</span>
                        <span className="text-green-600 font-black text-sm">R$ {fmt(c.fat_bruto || 0)}</span>
                      </div>
                      <p className="text-[11px] font-bold text-gray-500 truncate mb-3 uppercase">{c.cliente || 'CLIENTE NÃO INFORMADO'}</p>
                      <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 group-hover:bg-white transition-colors flex items-center justify-between gap-2">
                        <div className="flex-1">
                          <p className="text-[9px] font-black text-gray-400 uppercase">Origem</p>
                          <p className="text-[11px] font-black text-red-600 truncate">{c.origem || '—'}</p>
                        </div>
                        <ArrowRight size={14} className="text-gray-300" />
                        <div className="flex-1 text-right">
                          <p className="text-[9px] font-black text-gray-400 uppercase">Destino</p>
                          <p className="text-[11px] font-black text-red-600 truncate">{c.destino || '—'}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
                {selecionados.length > 0 && (
                  <div className="p-5 bg-red-600 text-white">
                    <h3 className="text-[10px] font-black uppercase tracking-widest mb-4 opacity-90">
                      Selecionados ({selecionados.length})
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {selecionados.map(c => (
                        <div key={c.id} className="flex items-center gap-2 bg-white/20 border border-white/30 rounded-xl pl-3 pr-2 py-2">
                          <span className="text-xs font-black">#{c.contrato}</span>
                          <button onClick={() => removerContrato(c.id)}><X size={14} /></button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Salvar ── */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 pt-8 border-t border-gray-200">
            <div className="flex-1">
              {erro && <div className="text-red-700 text-sm font-bold">⚠️ {erro}</div>}
              {sucesso && <div className="text-green-700 text-sm font-bold">✓ Fechamento realizado com sucesso!</div>}
            </div>
            <button onClick={salvar}
              disabled={!motoristaId || selecionados.length === 0 || salvando}
              className="w-full md:w-auto bg-red-600 text-white px-16 py-5 rounded-2xl font-black text-base uppercase tracking-widest hover:bg-red-700 disabled:opacity-50 shadow-2xl shadow-red-200 transition-all active:scale-95">
              {salvando ? 'Processando...' : 'Finalizar Fechamento'}
            </button>
          </div>
        </>
      ) : (
        /* ── Histórico ── */
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" placeholder="Pesquisar..." value={buscaHistorico}
                onChange={e => setBuscaHistorico(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-red-500 text-sm font-medium" />
            </div>
            <button onClick={exportarHistorico}
              className="flex items-center gap-2 bg-gray-900 text-white px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-gray-800 transition-all">
              <Download size={16} /> Exportar CSV
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100">
                  {['Data Registro', 'Motorista / Placa', 'Período', 'Vencimento'].map(h => (
                    <th key={h} className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {carregandoHistorico ? (
                  <tr><td colSpan={4} className="px-6 py-12 text-center text-sm text-gray-400">Carregando...</td></tr>
                ) : historicoFiltrado.length === 0 ? (
                  <tr><td colSpan={4} className="px-6 py-12 text-center text-sm text-gray-400">Nenhum registro</td></tr>
                ) : historicoFiltrado.map(h => (
                  <tr key={h.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 text-xs font-bold text-gray-500">{new Date(h.created_at).toLocaleDateString('pt-BR')}</td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-black text-gray-900">{h.motorista.nome}</p>
                      <p className="text-[10px] font-bold text-red-600 uppercase">{h.caminhao.placa}</p>
                    </td>
                    <td className="px-6 py-4 text-xs font-bold text-gray-600">{fmtData(h.data_inicio)} → {fmtData(h.data_fim)}</td>
                    <td className="px-6 py-4 text-xs font-black text-red-600">{fmtData(h.data_vencimento)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}