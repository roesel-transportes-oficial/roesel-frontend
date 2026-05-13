'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../services/supabase'
import { X, Search, Truck, User, Calendar, MapPin, Fuel, Download, CheckCircle2, CreditCard, Filter, AlertCircle, ArrowRight, Edit2, Plus } from 'lucide-react'

type Motorista     = { id: string; nome: string; caminhao_id?: string }
type Caminhao      = { id: string; placa: string }
type Contrato      = { id: string; contrato: string; fat_bruto: number | null; cliente?: string | null; origem?: string | null; destino?: string | null }
type Abastecimento = { id: string; data: string; posto?: string | null; litros_combustivel?: number | null; litros_arla?: number | null; total?: number | null }
type Fechamento    = { 
  id: string; 
  created_at: string; 
  motorista_id: string;
  motorista: { nome: string }; 
  caminhao_id: string;
  caminhao: { placa: string }; 
  data_inicio: string; 
  data_fim: string; 
  km_inicial: number; 
  km_final: number; 
  data_vencimento: string;
  status_financeiro: string;
}

export default function FechamentoViagemPage({ setAba }: { setAba?: (a: string) => void }) {
  const [motoristas, setMotoristas]               = useState<Motorista[]>([])
  const [motoristaId, setMotoristaId]             = useState('')
  const [motoristaNome, setMotoristaNome]         = useState('')
  const [caminhao, setCaminhao]                   = useState<Caminhao | null>(null)
  const [dataInicio, setDataInicio]               = useState('')
  const [dataFim, setDataFim]                     = useState('')
  const [kmInicial, setKmInicial]                 = useState('')
  const [kmFinal, setKmFinal]                     = useState('')
  const [dataVencimento, setDataVencimento]       = useState('')
  const [abastDataInicio, setAbastDataInicio]     = useState('')
  const [abastDataFim, setAbastDataFim]           = useState('')
  const [buscaContrato, setBuscaContrato]         = useState('')
  const [contratosDisponiveis, setContratosDisponiveis] = useState<Contrato[]>([])
  const [selecionados, setSelecionados]           = useState<Contrato[]>([])
  const [abastecimentos, setAbastecimentos]       = useState<Abastecimento[]>([])
  const [abastSelecionados, setAbastSelecionados] = useState<Set<string>>(new Set())
  const [carregandoAbast, setCarregandoAbast]     = useState(false)
  const [historico, setHistorico]                 = useState<Fechamento[]>([])
  const [buscaHistorico, setBuscaHistorico]       = useState('')
  const [carregandoHistorico, setCarregandoHistorico] = useState(false)
  const [salvando, setSalvando]   = useState(false)
  const [erro, setErro]           = useState('')
  const [abaAtiva, setAbaAtiva]   = useState<'novo' | 'historico'>('novo')
  const [editandoId, setEditandoId] = useState<string | null>(null)

  // Carregar motoristas
  useEffect(() => {
    supabase.from('motoristas').select('id, nome, caminhao_id').order('nome')
      .then(({ data }) => data && setMotoristas(data))
  }, [])

  // Carregar histórico
  const carregarHistorico = async () => {
    setCarregandoHistorico(true)
    const { data, error } = await supabase.from('fechamento_viagens')
      .select(`
        id, created_at, data_inicio, data_fim, km_inicial, km_final, data_vencimento, motorista_id, caminhao_id, status_financeiro,
        motorista:motoristas(nome), 
        caminhao:caminhoes(placa)
      `)
      .order('created_at', { ascending: false })
    
    setCarregandoHistorico(false)
    if (data) setHistorico(data as any)
    if (error) console.error('Erro ao carregar histórico:', error)
  }

  useEffect(() => {
    if (abaAtiva === 'historico') {
      carregarHistorico()
    }
  }, [abaAtiva])

  // Vincular caminhão e carregar contratos ao selecionar motorista
  useEffect(() => {
    if (!motoristaId) { 
      if (!editandoId) {
        setCaminhao(null); 
        setContratosDisponiveis([]); 
        setMotoristaNome(''); 
      }
      return 
    }
    const mot = motoristas.find(m => m.id === motoristaId)
    if (mot) setMotoristaNome(mot.nome)

    async function vincularCaminhao() {
      let q = supabase.from('caminhoes').select('id, placa').eq('motorista_atual', motoristaId)
      if (mot?.caminhao_id) {
        q = supabase.from('caminhoes').select('id, placa')
          .or(`id.eq.${mot.caminhao_id},motorista_atual.eq.${motoristaId}`)
      }
      const { data } = await q.maybeSingle()
      if (data) setCaminhao(data)
    }
    vincularCaminhao()

    supabase.from('contratos').select('id, contrato, fat_bruto, cliente, origem, destino')
      .order('created_at', { ascending: false }).limit(100)
      .then(({ data }) => { if (data) setContratosDisponiveis(data) })
  }, [motoristaId, motoristas, editandoId])

  // Carregar abastecimentos do caminhão no período
  useEffect(() => {
    if (!caminhao?.id || !abastDataInicio || !abastDataFim) {
      setAbastecimentos([]); setAbastSelecionados(new Set()); return
    }
    setCarregandoAbast(true); setErro('')
    supabase.from('abastecimentos')
      .select('id, data, posto, litros_combustivel, litros_arla, total')
      .eq('caminhao_id', caminhao.id)
      .gte('data', abastDataInicio).lte('data', abastDataFim)
      .order('data')
      .then(({ data, error }) => {
        setCarregandoAbast(false)
        if (error) { setErro('Erro: ' + error.message); return }
        const lista = data || []
        setAbastecimentos(lista)
        // Se não estiver editando, seleciona todos por padrão
        if (!editandoId) {
          setAbastSelecionados(new Set(lista.map(a => a.id)))
        }
      })
  }, [caminhao?.id, abastDataInicio, abastDataFim, editandoId])

  function limparFormulario() {
    setEditandoId(null)
    setMotoristaId('')
    setMotoristaNome('')
    setCaminhao(null)
    setDataInicio('')
    setDataFim('')
    setKmInicial('')
    setKmFinal('')
    setDataVencimento('')
    setSelecionados([])
    setAbastecimentos([])
    setAbastSelecionados(new Set())
    setErro('')
  }

  async function prepararEdicao(f: Fechamento) {
    setEditandoId(f.id)
    setMotoristaId(f.motorista_id)
    setDataInicio(f.data_inicio)
    setDataFim(f.data_fim)
    setKmInicial(f.km_inicial.toString())
    setKmFinal(f.km_final.toString())
    setDataVencimento(f.data_vencimento)
    
    // Carregar contratos já vinculados
    const { data: cVinculados } = await supabase
      .from('fechamento_contratos')
      .select('contrato_id, contratos(*)')
      .eq('fechamento_id', f.id)
    
    if (cVinculados) {
      setSelecionados(cVinculados.map(cv => cv.contratos as any))
    }

    // Carregar abastecimentos já vinculados
    const { data: aVinculados } = await supabase
      .from('fechamento_abastecimentos')
      .select('abastecimento_id')
      .eq('fechamento_id', f.id)
    
    if (aVinculados) {
      setAbastSelecionados(new Set(aVinculados.map(av => av.abastecimento_id)))
      // Ajustar datas de busca para englobar os abastecimentos vinculados
      setAbastDataInicio(f.data_inicio)
      setAbastDataFim(f.data_fim)
    }

    setAbaAtiva('novo')
  }

  function adicionarContrato(c: Contrato) { setSelecionados(prev => [...prev, c]); setBuscaContrato('') }
  function removerContrato(id: string) { setSelecionados(prev => prev.filter(c => c.id !== id)) }
  function toggleAbast(id: string) {
    setAbastSelecionados(prev => {
      const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next
    })
  }

  const contratosFiltrados = useMemo(() => {
    const jaSel = new Set(selecionados.map(s => s.id))
    if (!buscaContrato.trim()) return contratosDisponiveis.filter(c => !jaSel.has(c.id))
    const b = buscaContrato.toLowerCase()
    return contratosDisponiveis.filter(c =>
      !jaSel.has(c.id) && (c.contrato.includes(buscaContrato) || c.cliente?.toLowerCase().includes(b))
    )
  }, [contratosDisponiveis, selecionados, buscaContrato])

  const abastAtivos = useMemo(
    () => abastecimentos.filter(a => abastSelecionados.has(a.id)),
    [abastecimentos, abastSelecionados]
  )

  const resumo = useMemo(() => {
    const km      = (Number(kmFinal) || 0) - (Number(kmInicial) || 0)
    const litros  = abastAtivos.reduce((t, a) => t + Number(a.litros_combustivel || 0), 0)
    const valor   = abastAtivos.reduce((t, a) => t + Number(a.total || 0), 0)
    const frete   = selecionados.reduce((t, c) => t + Number(c.fat_bruto || 0), 0)
    const comissao = frete * 0.10
    return { km, litros, valor, frete, comissao, mediaKmL: km > 0 && litros > 0 ? km / litros : 0 }
  }, [abastAtivos, kmInicial, kmFinal, selecionados])

  const fmt     = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const fmtData = (d: string) => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—'

  const historicoFiltrado = useMemo(() => {
    if (!buscaHistorico) return historico
    const b = buscaHistorico.toLowerCase()
    return historico.filter(h =>
      h.motorista?.nome?.toLowerCase().includes(b) || h.caminhao?.placa?.toLowerCase().includes(b)
    )
  }, [historico, buscaHistorico])

  async function salvar() {
    setErro('')
    if (!motoristaId || !dataInicio || !dataFim || !kmInicial || !kmFinal || !dataVencimento) {
      setErro('Preencha todos os campos obrigatórios.'); return
    }
    if (selecionados.length === 0) { setErro('Adicione ao menos um contrato.'); return }
    setSalvando(true)

    const dadosFechamento = {
      motorista_id: motoristaId,
      caminhao_id: caminhao?.id || null,
      data_inicio: dataInicio, 
      data_fim: dataFim,
      km_inicial: Number(kmInicial), 
      km_final: Number(kmFinal),
      data_vencimento: dataVencimento,
      status_financeiro: 'pendente'
    }

    let fechId = editandoId
    let errorFech = null

    if (editandoId) {
      const { error } = await supabase.from('fechamento_viagens').update(dadosFechamento).eq('id', editandoId)
      errorFech = error
    } else {
      const { data, error } = await supabase.from('fechamento_viagens').insert(dadosFechamento).select().single()
      if (data) fechId = data.id
      errorFech = error
    }

    if (errorFech || !fechId) { 
      setErro('Erro ao salvar: ' + errorFech?.message); 
      setSalvando(false); 
      return 
    }

    // Se for edição, limpar vínculos antigos antes de inserir novos
    if (editandoId) {
      await Promise.all([
        supabase.from('fechamento_contratos').delete().eq('fechamento_id', fechId),
        supabase.from('fechamento_abastecimentos').delete().eq('fechamento_id', fechId)
      ])
    }

    await Promise.all([
      supabase.from('fechamento_contratos').insert(
        selecionados.map(c => ({ fechamento_id: fechId, contrato_id: c.id }))
      ),
      abastAtivos.length > 0 && supabase.from('fechamento_abastecimentos').insert(
        abastAtivos.map(a => ({ fechamento_id: fechId, abastecimento_id: a.id }))
      )
    ])

    // Atualizar ou Criar Prêmio
    const dadosPremio = {
      motorista: motoristaNome,
      status: 'pendente',
      valor: resumo.comissao,
      obs: [
        `Período: ${fmtData(dataInicio)} → ${fmtData(dataFim)}`,
        `Vencimento: ${fmtData(dataVencimento)}`,
        `Placa: ${caminhao?.placa || '—'}`,
        `KM Rodado: ${resumo.km.toLocaleString('pt-BR')} km`,
        `Contratos: ${selecionados.length} (Frete R$ ${fmt(resumo.frete)})`,
        `Abastecimento: R$ ${fmt(resumo.valor)} (${fmt(resumo.litros)} L)`,
        `Média: ${resumo.mediaKmL > 0 ? fmt(resumo.mediaKmL) + ' km/L' : '—'}`,
        `Comissão 10%: R$ ${fmt(resumo.comissao)}`,
      ].join(' | ')
    }

    await supabase.from('premios').insert(dadosPremio)

    setSalvando(false)
    limparFormulario()
    if (setAba) setAba('premios')
    else setAbaAtiva('historico')
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 bg-gray-50 min-h-screen">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fechamento de Viagem</h1>
          <p className="text-sm text-gray-500">Gestão de viagens, contratos e abastecimentos</p>
        </div>
        <div className="flex bg-white p-1 rounded-xl shadow-sm border border-gray-200">
          <button onClick={() => { setAbaAtiva('novo'); if (!editandoId) limparFormulario(); }}
            className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all
              ${abaAtiva === 'novo' ? 'bg-red-600 text-white shadow-md' : 'text-gray-400 hover:text-gray-600'}`}>
            {editandoId ? 'Editando Fechamento' : 'Novo Fechamento'}
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
            <div className="bg-gray-900 text-white rounded-2xl p-6 shadow-2xl border border-gray-800 grid grid-cols-2 md:grid-cols-5 gap-6">
              <div><p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">Distância</p><p className="text-2xl font-bold mt-1">{resumo.km > 0 ? `${resumo.km.toLocaleString('pt-BR')} km` : '—'}</p></div>
              <div><p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">Combustível</p><p className="text-2xl font-bold text-blue-400 mt-1">{resumo.litros > 0 ? `${fmt(resumo.litros)} L` : '—'}</p></div>
              <div><p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">Média</p><p className="text-2xl font-bold text-green-400 mt-1">{resumo.mediaKmL > 0 ? `${fmt(resumo.mediaKmL)} km/L` : '—'}</p></div>
              <div><p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">Frete Total</p><p className="text-2xl font-bold mt-1">R$ {fmt(resumo.frete)}</p></div>
              <div className="bg-red-600/20 p-3 rounded-xl border border-red-600/30">
                <p className="text-red-400 text-[10px] font-black uppercase tracking-widest">Comissão 10%</p>
                <p className="text-2xl font-black text-red-500 mt-1">R$ {fmt(resumo.comissao)}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 space-y-6">

              {/* ── Motorista + Datas + KM ── */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-6">
                <div className="flex justify-between items-center">
                   <h2 className="text-sm font-black text-gray-700 uppercase tracking-widest">Dados da Viagem</h2>
                   {editandoId && (
                     <button onClick={limparFormulario} className="text-xs font-bold text-red-600 flex items-center gap-1 hover:underline">
                       <Plus size={14} /> Criar Novo em vez de editar
                     </button>
                   )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-xs font-bold text-gray-600 uppercase tracking-wider">
                      <User size={14} className="text-red-600" /> Motorista
                    </label>
                    <select value={motoristaId}
                      onChange={e => { setMotoristaId(e.target.value); setSelecionados([]); setAbastecimentos([]); setAbastSelecionados(new Set()) }}
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
                    <div className="mb-4 bg-red-50 border border-red-100 p-4 rounded-xl flex items-center gap-3 text-red-700 text-xs font-bold">
                      <AlertCircle size={16} /> {erro}
                    </div>
                  )}
                  {!caminhao ? (
                    <p className="text-center py-10 text-sm text-gray-400 italic">Selecione o motorista primeiro.</p>
                  ) : !abastDataInicio || !abastDataFim ? (
                    <p className="text-center py-10 text-sm text-gray-400 italic flex items-center justify-center gap-2">
                      <Calendar size={16} /> Informe o período dos abastecimentos.
                    </p>
                  ) : carregandoAbast ? (
                    <div className="flex items-center justify-center py-10 gap-3">
                      <div className="w-5 h-5 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : abastecimentos.length === 0 ? (
                    <div className="text-center py-10">
                      <Fuel size={28} className="mx-auto text-gray-200 mb-2" />
                      <p className="text-sm text-gray-400">Nenhum abastecimento no período.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {abastecimentos.map(a => {
                        const marcado = abastSelecionados.has(a.id)
                        return (
                          <label key={a.id}
                            className={`flex flex-col p-4 rounded-2xl border-2 cursor-pointer transition-all
                              ${marcado ? 'border-red-100 bg-red-50/30' : 'border-gray-100 bg-white opacity-60'}`}>
                            <div className="flex justify-between items-start mb-3">
                              <div className="flex items-center gap-3">
                                <input type="checkbox" checked={marcado} onChange={() => toggleAbast(a.id)}
                                  className="w-5 h-5 accent-red-600" />
                                <span className="text-sm font-black text-gray-900">{fmtData(a.data)}</span>
                              </div>
                              <span className="text-sm font-black text-red-600">R$ {fmt(a.total || 0)}</span>
                            </div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase flex items-center gap-1.5 mb-2">
                              <MapPin size={10} /> {a.posto || 'POSTO NÃO IDENTIFICADO'}
                            </p>
                            <div className="flex gap-2 flex-wrap">
                              <span className="bg-white px-2 py-1 rounded border text-[10px] font-black text-gray-600 uppercase">
                                Diesel: {a.litros_combustivel ? `${fmt(a.litros_combustivel)} L` : '—'}
                              </span>
                              {(a.litros_arla || 0) > 0 && (
                                <span className="bg-blue-50 px-2 py-1 rounded border border-blue-100 text-[10px] font-black text-blue-600 uppercase">
                                  Arla: {fmt(a.litros_arla!)} L
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
            <div className="lg:col-span-4">
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
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {!motoristaId ? (
                    <p className="text-center py-10 text-sm text-gray-400 italic">Selecione o motorista.</p>
                  ) : contratosFiltrados.length === 0 ? (
                    <p className="text-center py-10 text-sm text-gray-400 italic">Nenhum contrato encontrado.</p>
                  ) : contratosFiltrados.map(c => (
                    <button key={c.id} onClick={() => adicionarContrato(c)}
                      className="w-full p-4 text-left bg-white border border-gray-100 rounded-2xl hover:border-red-200 hover:bg-red-50/50 transition-all shadow-sm group">
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-black text-gray-900">#{c.contrato}</span>
                        <span className="text-green-600 font-black text-sm">R$ {fmt(c.fat_bruto || 0)}</span>
                      </div>
                      <p className="text-[11px] font-bold text-gray-500 truncate mb-2 uppercase">{c.cliente || '—'}</p>
                      {(c.origem || c.destino) && (
                        <div className="bg-gray-50 rounded-xl p-2.5 border border-gray-100 flex items-center justify-between gap-2">
                          <div className="flex-1">
                            <p className="text-[9px] font-black text-gray-400 uppercase">Origem</p>
                            <p className="text-[10px] font-black text-red-600 truncate">{c.origem || '—'}</p>
                          </div>
                          <ArrowRight size={12} className="text-gray-300 shrink-0" />
                          <div className="flex-1 text-right">
                            <p className="text-[9px] font-black text-gray-400 uppercase">Destino</p>
                            <p className="text-[10px] font-black text-red-600 truncate">{c.destino || '—'}</p>
                          </div>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
                
                {/* Selecionados */}
                <div className="p-5 bg-gray-900 border-t border-gray-800">
                  <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-4">Selecionados ({selecionados.length})</h3>
                  <div className="space-y-2 mb-6">
                    {selecionados.map(s => (
                      <div key={s.id} className="flex items-center justify-between bg-gray-800/50 p-2 rounded-lg border border-gray-700">
                        <span className="text-xs font-bold text-white">#{s.contrato}</span>
                        <button onClick={() => removerContrato(s.id)} className="text-gray-500 hover:text-red-500"><X size={14} /></button>
                      </div>
                    ))}
                  </div>
                  <button onClick={salvar} disabled={salvando}
                    className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-700 text-white py-4 rounded-2xl font-black uppercase tracking-widest transition-all shadow-lg flex items-center justify-center gap-3">
                    {salvando ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Finalizar Fechamento'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        /* ── Histórico ── */
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" placeholder="Buscar no histórico..." value={buscaHistorico}
                onChange={e => setBuscaHistorico(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-red-500 transition-all" />
            </div>
            <button onClick={carregarHistorico} className="text-xs font-bold text-red-600 hover:underline">Atualizar Lista</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50">
                  <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b">Data</th>
                  <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b">Motorista / Placa</th>
                  <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b">Período</th>
                  <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b">KM Rodado</th>
                  <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b">Status</th>
                  <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {carregandoHistorico ? (
                  <tr><td colSpan={6} className="p-10 text-center"><div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto" /></td></tr>
                ) : historicoFiltrado.length === 0 ? (
                  <tr><td colSpan={6} className="p-10 text-center text-gray-400 italic">Nenhum fechamento encontrado.</td></tr>
                ) : historicoFiltrado.map(h => (
                  <tr key={h.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="p-4">
                      <p className="text-xs font-black text-gray-900">{new Date(h.created_at).toLocaleDateString('pt-BR')}</p>
                      <p className="text-[10px] text-gray-400">{new Date(h.created_at).toLocaleTimeString('pt-BR', { hour: '2-2-digit', minute: '2-2-digit' })}</p>
                    </td>
                    <td className="p-4">
                      <p className="text-xs font-black text-gray-900 uppercase">{h.motorista?.nome || '—'}</p>
                      <p className="text-[10px] font-bold text-red-600 uppercase">{h.caminhao?.placa || '—'}</p>
                    </td>
                    <td className="p-4">
                      <p className="text-[10px] font-bold text-gray-600 uppercase">{fmtData(h.data_inicio)} → {fmtData(h.data_fim)}</p>
                    </td>
                    <td className="p-4">
                      <p className="text-xs font-black text-gray-900">{(h.km_final - h.km_inicial).toLocaleString('pt-BR')} km</p>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-widest
                        ${h.status_financeiro === 'pago' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {h.status_financeiro}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex gap-2">
                        <button onClick={() => prepararEdicao(h)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all">
                          <Edit2 size={16} />
                        </button>
                        <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all">
                          <Download size={16} />
                        </button>
                      </div>
                    </td>
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
