'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../services/supabase'
import { X, Search, List, Truck, User, Calendar, Gauge, MapPin, Fuel, ArrowRight } from 'lucide-react'

type Motorista = {
  id: string
  nome: string
  caminhao_id?: string
}

type Caminhao = {
  id: string
  placa: string
}

type Contrato = {
  id: string
  contrato: string
  fat_bruto: number | null
  cliente?: string | null
  origem?: string | null
  destino?: string | null
}

type Abastecimento = {
  id: string
  data: string
  posto?: string | null
  litros_combustivel?: number | null
  valor_combustivel?: number | null
  litros_arla?: number | null
  valor_arla?: number | null
}

export default function FechamentoViagemPage() {
  const [motoristas, setMotoristas] = useState<Motorista[]>([])
  const [motoristaId, setMotoristaId] = useState('')
  const [caminhao, setCaminhao] = useState<Caminhao | null>(null)

  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [kmInicial, setKmInicial] = useState('')
  const [kmFinal, setKmFinal] = useState('')

  const [busca, setBusca] = useState('')
  const [contratosDisponiveis, setContratosDisponiveis] = useState<Contrato[]>([])
  const [carregandoContratos, setCarregandoContratos] = useState(false)
  const [selecionados, setSelecionados] = useState<Contrato[]>([])

  const [abastecimentos, setAbastecimentos] = useState<Abastecimento[]>([])
  const [abastSelecionados, setAbastSelecionados] = useState<Set<string>>(new Set())

  const [carregandoAbastecimentos, setCarregandoAbastecimentos] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState(false)

  useEffect(() => {
    supabase
      .from('motoristas')
      .select('id, nome, caminhao_id')
      .order('nome')
      .then(({ data, error }) => {
        if (error) {
          setErro('Erro ao carregar motoristas: ' + error.message)
          return
        }
        if (data) setMotoristas(data)
      })
  }, [])

  useEffect(() => {
    setErro('')
    setCaminhao(null)
    setContratosDisponiveis([])
    setSelecionados([])
    setAbastecimentos([])
    setAbastSelecionados(new Set())

    if (!motoristaId) return

    const motoristaSel = motoristas.find(m => m.id === motoristaId)

    async function buscarCaminhao() {
      if (motoristaSel?.caminhao_id) {
        const { data } = await supabase
          .from('caminhoes')
          .select('id, placa')
          .eq('id', motoristaSel.caminhao_id)
          .maybeSingle()
        
        if (data) {
          setCaminhao(data)
          return
        }
      }

      const { data: dataAtual } = await supabase
        .from('caminhoes')
        .select('id, placa')
        .eq('motorista_atual', motoristaId)
        .maybeSingle()

      if (dataAtual) {
        setCaminhao(dataAtual)
        return
      }

      const { data: dataId } = await supabase
        .from('caminhoes')
        .select('id, placa')
        .eq('motorista_id', motoristaId)
        .maybeSingle()

      if (dataId) {
        setCaminhao(dataId)
      }
    }

    buscarCaminhao()

    setCarregandoContratos(true)
    supabase
      .from('contratos')
      .select('id, contrato, fat_bruto, cliente, origem, destino')
      .order('created_at', { ascending: false })
      .limit(40)
      .then(({ data, error }) => {
        setCarregandoContratos(false)
        if (data) setContratosDisponiveis(data)
      })

  }, [motoristaId, motoristas])

  useEffect(() => {
    if (!caminhao?.id || !dataInicio || !dataFim) {
      setAbastecimentos([])
      setAbastSelecionados(new Set())
      return
    }

    setCarregandoAbastecimentos(true)
    supabase
      .from('abastecimentos')
      .select('id, data, posto, litros_combustivel, valor_combustivel, litros_arla, valor_arla')
      .eq('caminhao_id', caminhao.id)
      .gte('data', dataInicio)
      .lte('data', dataFim)
      .order('data', { ascending: true })
      .then(({ data, error }) => {
        setCarregandoAbastecimentos(false)
        if (error) {
          setErro('Erro nos abastecimentos: ' + error.message)
          return
        }
        const lista = data || []
        setAbastecimentos(lista)
        setAbastSelecionados(new Set(lista.map(a => a.id)))
      })
  }, [caminhao?.id, dataInicio, dataFim])

  const contratosFiltrados = useMemo(() => {
    const jaSelecionados = new Set(selecionados.map(s => s.id))
    let lista = contratosDisponiveis.filter(c => !jaSelecionados.has(c.id))
    if (busca.trim()) {
      const b = busca.toLowerCase()
      lista = lista.filter(c => c.contrato.toLowerCase().includes(b) || (c.cliente && c.cliente.toLowerCase().includes(b)))
    }
    return lista
  }, [contratosDisponiveis, selecionados, busca])

  const abastAtivos = useMemo(() => abastecimentos.filter(a => abastSelecionados.has(a.id)), [abastecimentos, abastSelecionados])

  const resumo = useMemo(() => {
    const km = kmFinal && kmInicial ? Number(kmFinal) - Number(kmInicial) : 0
    const litros = abastAtivos.reduce((t, a) => t + Number(a.litros_combustivel || 0), 0)
    const valor = abastAtivos.reduce((t, a) => t + Number(a.valor_combustivel || 0) + Number(a.valor_arla || 0), 0)
    return {
      km,
      litros,
      valor,
      mediaKmL: km > 0 && litros > 0 ? km / litros : 0,
      mediaLitros: abastAtivos.length > 0 ? litros / abastAtivos.length : 0
    }
  }, [abastAtivos, kmInicial, kmFinal])

  function adicionarContrato(contrato: Contrato) {
    setSelecionados(prev => [...prev, contrato])
    setBusca('')
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

  const fmt = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const fmtData = (d: string) => (d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—')

  async function salvar() {
    if (!motoristaId || !dataInicio || !dataFim || !kmInicial || !kmFinal || selecionados.length === 0) {
      setErro('Preencha todos os campos e selecione ao menos um contrato.'); return
    }
    setSalvando(true); setErro(''); setSucesso(false)
    
    const { data: fech, error } = await supabase.from('fechamento_viagens').insert({
      motorista_id: motoristaId,
      caminhao_id: caminhao?.id || null,
      data_inicio: dataInicio,
      data_fim: dataFim,
      km_inicial: Number(kmInicial),
      km_final: Number(kmFinal),
    }).select().single()

    if (error || !fech) {
      setErro('Erro ao salvar: ' + (error?.message || 'tente novamente.')); setSalvando(false); return
    }

    await Promise.all([
      supabase.from('fechamento_contratos').insert(selecionados.map(c => ({ fechamento_id: fech.id, contrato_id: c.id }))),
      abastAtivos.length > 0 && supabase.from('fechamento_abastecimentos').insert(abastAtivos.map(a => ({ fechamento_id: fech.id, abastecimento_id: a.id })))
    ])

    setSucesso(true); setSalvando(false)
    setTimeout(() => window.location.reload(), 2000)
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 bg-gray-50 min-h-screen">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-black text-gray-900 tracking-tight">FECHAMENTO DE VIAGEM</h1>
        <p className="text-sm text-gray-500 font-medium">Gestão de viagens, contratos e abastecimentos</p>
      </header>

      {/* Barra de Resumo Fixa */}
      <div className="sticky top-4 z-40">
        <div className="bg-gray-900 text-white rounded-2xl p-6 shadow-2xl border border-gray-800 grid grid-cols-2 md:grid-cols-5 gap-8">
          <div className="space-y-1">
            <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">Distância</p>
            <p className="text-2xl font-bold">{resumo.km > 0 ? `${resumo.km.toLocaleString('pt-BR')} km` : '—'}</p>
          </div>
          <div className="space-y-1">
            <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">Combustível</p>
            <p className="text-2xl font-bold text-blue-400">{resumo.litros > 0 ? `${fmt(resumo.litros)} L` : '—'}</p>
          </div>
          <div className="space-y-1">
            <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">Média KM/L</p>
            <p className="text-2xl font-bold text-green-400">{resumo.mediaKmL > 0 ? `${fmt(resumo.mediaKmL)}` : '—'}</p>
          </div>
          <div className="space-y-1">
            <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">Média L/Abast</p>
            <p className="text-2xl font-bold text-cyan-400">{resumo.mediaLitros > 0 ? `${fmt(resumo.mediaLitros)}` : '—'}</p>
          </div>
          <div className="space-y-1">
            <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">Custo Total</p>
            <p className="text-2xl font-bold text-red-400">{resumo.valor > 0 ? `R$ ${fmt(resumo.valor)}` : '—'}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Coluna da Esquerda: Dados e Abastecimentos (8 colunas) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Identificação e Período */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs font-bold text-gray-600 uppercase tracking-wider">
                  <User size={14} className="text-red-600" /> Motorista
                </label>
                <select value={motoristaId} onChange={e => setMotoristaId(e.target.value)}
                  className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 text-sm font-bold focus:border-red-500 focus:bg-white outline-none transition-all">
                  <option value="">Selecione o motorista</option>
                  {motoristas.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs font-bold text-gray-600 uppercase tracking-wider">
                  <Truck size={14} className="text-red-600" /> Caminhão Vinculado
                </label>
                <div className={`w-full border-2 rounded-xl px-4 py-3 text-sm font-black flex items-center justify-between ${caminhao ? 'bg-red-50 border-red-100 text-red-700' : 'bg-gray-50 border-gray-100 text-gray-400'}`}>
                  {caminhao ? caminhao.placa : 'Aguardando motorista...'}
                  {caminhao && <div className="w-2 h-2 bg-red-500 rounded-full"></div>}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-gray-50">
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-[10px] font-bold text-gray-500 uppercase"><Calendar size={12} /> Saída</label>
                <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs font-bold outline-none focus:border-red-500" />
              </div>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-[10px] font-bold text-gray-500 uppercase"><Calendar size={12} /> Retorno</label>
                <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs font-bold outline-none focus:border-red-500" />
              </div>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-[10px] font-bold text-gray-500 uppercase"><Gauge size={12} /> KM Inicial</label>
                <input type="number" value={kmInicial} onChange={e => setKmInicial(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs font-bold outline-none focus:border-red-500" />
              </div>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-[10px] font-bold text-gray-500 uppercase"><Gauge size={12} /> KM Final</label>
                <input type="number" value={kmFinal} onChange={e => setKmFinal(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs font-bold outline-none focus:border-red-500" />
              </div>
            </div>
          </div>

          {/* Abastecimentos (Agora em formato de Cards) */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <h2 className="text-xs font-black text-gray-700 uppercase tracking-widest flex items-center gap-2">
                <Fuel size={16} className="text-red-600" /> Abastecimentos no Período
              </h2>
              <div className="flex gap-4">
                <button onClick={() => setAbastSelecionados(new Set(abastecimentos.map(a => a.id)))} className="text-[10px] font-black text-red-600 hover:text-red-700 uppercase">Selecionar Todos</button>
                <button onClick={() => setAbastSelecionados(new Set())} className="text-[10px] font-black text-gray-400 hover:text-gray-600 uppercase">Limpar</button>
              </div>
            </div>
            <div className="p-6">
              {!caminhao || !dataInicio || !dataFim ? (
                <div className="text-center py-12 space-y-3">
                  <Fuel size={40} className="mx-auto text-gray-200" />
                  <p className="text-sm text-gray-400 font-medium italic">Selecione o motorista e o período para carregar os abastecimentos.</p>
                </div>
              ) : carregandoAbastecimentos ? (
                <div className="flex items-center justify-center py-12 gap-3">
                  <div className="w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-sm text-gray-500 font-bold">Buscando dados...</span>
                </div>
              ) : abastecimentos.length === 0 ? (
                <p className="text-center py-12 text-sm text-gray-400 font-medium">Nenhum abastecimento encontrado para este período.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {abastecimentos.map(a => {
                    const marcado = abastSelecionados.has(a.id)
                    return (
                      <label key={a.id} className={`relative flex flex-col p-4 rounded-2xl border-2 cursor-pointer transition-all ${marcado ? 'border-red-100 bg-red-50/30 ring-1 ring-red-100' : 'border-gray-100 bg-white opacity-60 hover:opacity-100'}`}>
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex items-center gap-3">
                            <input type="checkbox" checked={marcado} onChange={() => toggleAbastecimento(a.id)} className="w-5 h-5 rounded-lg accent-red-600" />
                            <span className="text-sm font-black text-gray-900">{fmtData(a.data)}</span>
                          </div>
                          <span className="text-sm font-black text-red-600">R$ {fmt((a.valor_combustivel || 0) + (a.valor_arla || 0))}</span>
                        </div>
                        <div className="space-y-2">
                          <p className="text-[10px] font-bold text-gray-400 uppercase flex items-center gap-1.5">
                            <MapPin size={10} /> {a.posto || 'POSTO NÃO IDENTIFICADO'}
                          </p>
                          <div className="flex items-center gap-4">
                            <div className="bg-white px-2 py-1 rounded-md border border-gray-100 shadow-sm">
                              <p className="text-[9px] font-black text-gray-400 uppercase">Diesel</p>
                              <p className="text-xs font-black text-gray-700">{a.litros_combustivel ? `${fmt(a.litros_combustivel)} L` : '—'}</p>
                            </div>
                            {a.litros_arla && (
                              <div className="bg-white px-2 py-1 rounded-md border border-gray-100 shadow-sm">
                                <p className="text-[9px] font-black text-gray-400 uppercase">Arla</p>
                                <p className="text-xs font-black text-gray-700">{fmt(a.litros_arla)} L</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </label>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Coluna da Direita: Contratos (4 colunas) */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-full max-h-[900px]">
            <div className="p-5 border-b border-gray-100 bg-gray-50/50 space-y-4">
              <h2 className="text-xs font-black text-gray-700 uppercase tracking-widest">Contratos Disponíveis</h2>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="text" placeholder="Buscar contrato..." value={busca} onChange={e => setBusca(e.target.value)} className="w-full pl-10 pr-4 py-3 text-sm bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-red-500 transition-all" />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
              {!motoristaId ? (
                <div className="text-center py-12 space-y-2">
                  <List size={32} className="mx-auto text-gray-200" />
                  <p className="text-xs text-gray-400 font-bold uppercase tracking-tighter">Selecione um motorista</p>
                </div>
              ) : carregandoContratos ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-5 h-5 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : contratosFiltrados.length === 0 ? (
                <p className="text-center py-12 text-xs text-gray-400 font-bold uppercase tracking-tighter">Nenhum contrato livre</p>
              ) : (
                contratosFiltrados.map(c => (
                  <button key={c.id} onClick={() => adicionarContrato(c)} className="w-full p-5 text-left bg-white border border-gray-100 rounded-2xl hover:border-red-200 hover:bg-red-50/50 transition-all shadow-sm group relative overflow-hidden">
                    <div className="flex justify-between items-start mb-3">
                      <span className="font-black text-gray-900 text-base">#{c.contrato}</span>
                      <span className="text-green-600 font-black text-sm">R$ {fmt(c.fat_bruto || 0)}</span>
                    </div>
                    <p className="text-[11px] font-bold text-gray-500 truncate mb-4 uppercase tracking-tight">{c.cliente || 'CLIENTE NÃO INFORMADO'}</p>
                    
                    {/* Trajeto em Destaque */}
                    <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 group-hover:bg-white transition-colors">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex-1">
                          <p className="text-[9px] font-black text-gray-400 uppercase mb-0.5">Origem</p>
                          <p className="text-[11px] font-black text-red-600 truncate">{c.origem || '—'}</p>
                        </div>
                        <ArrowRight size={14} className="text-gray-300 shrink-0" />
                        <div className="flex-1 text-right">
                          <p className="text-[9px] font-black text-gray-400 uppercase mb-0.5">Destino</p>
                          <p className="text-[11px] font-black text-red-600 truncate">{c.destino || '—'}</p>
                        </div>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>

            {selecionados.length > 0 && (
              <div className="p-5 bg-red-600 text-white shadow-inner">
                <h3 className="text-[10px] font-black uppercase tracking-widest mb-4 opacity-90">Selecionados ({selecionados.length})</h3>
                <div className="flex flex-wrap gap-2">
                  {selecionados.map(c => (
                    <div key={c.id} className="flex items-center gap-2 bg-white/20 backdrop-blur-md border border-white/30 rounded-xl pl-3 pr-2 py-2">
                      <span className="text-xs font-black">#{c.contrato}</span>
                      <button onClick={() => removerContrato(c.id)} className="hover:bg-white/20 rounded-lg p-0.5 transition-colors">
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Rodapé de Ações */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-6 pt-8 border-t border-gray-200">
        <div className="flex-1">
          {erro && <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 flex items-center gap-3 text-red-700 text-sm font-black uppercase tracking-tighter"><span>⚠️</span> {erro}</div>}
          {sucesso && <div className="bg-green-50 border border-green-100 rounded-xl px-4 py-3 flex items-center gap-3 text-green-700 text-sm font-black uppercase tracking-tighter"><span>✓</span> Fechamento realizado com sucesso!</div>}
        </div>
        <button onClick={salvar} disabled={!motoristaId || selecionados.length === 0 || salvando} className="w-full md:w-auto bg-red-600 text-white px-16 py-5 rounded-2xl font-black text-base uppercase tracking-widest hover:bg-red-700 disabled:opacity-50 shadow-2xl shadow-red-200 transition-all transform active:scale-95">
          {salvando ? 'Processando...' : 'Finalizar Fechamento'}
        </button>
      </div>
    </div>
  )
}
