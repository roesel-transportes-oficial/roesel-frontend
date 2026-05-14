'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../services/supabase'
import { X, Search, Truck, User, Calendar, MapPin, Fuel, CheckCircle2, CreditCard, Filter, AlertCircle, ArrowRight, Download } from 'lucide-react'

type Motorista     = { id: string; nome: string; caminhao_id?: string }
type Caminhao      = { id: string; placa: string }
type Contrato      = { id: string; contrato: string; fat_bruto: number | null; cliente?: string | null; origem?: string | null; destino?: string | null }
type Abastecimento = { id: string; data: string; posto?: string | null; litros_combustivel?: number | null; litros_arla?: number | null; total?: number | null; km?: number | null }
type Fechamento    = { 
  id: string; 
  created_at: string; 
  motorista_id: string;
  caminhao_id: string;
  motorista: { nome: string }; 
  caminhao: { placa: string }; 
  data_inicio: string; 
  data_fim: string; 
  km_inicial: number; 
  km_final: number; 
  data_vencimento: string;
  total_litros?: number;
  total_abastecimento?: number;
  total_frete?: number;
  comissao_motorista?: number;
  contratos?: { contrato: { contrato: string; origem: string; destino: string } }[]
}

export default function FechamentoViagemPage({ setAba }: { setAba?: (a: string) => void }) {
  const [motoristas, setMotoristas]               = useState<Motorista[]>([])
  const [motoristaId, setMotoristaId]             = useState('')
  const [motoristaNome, setMotoristaNome]         = useState('')
  const [caminhao, setCaminhao]                   = useState<Caminhao | null>(null)
  const [isSubstituto, setIsSubstituto]           = useState(false)
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
  const [sucesso, setSucesso]     = useState(false)
  const [excluindoId, setExcluindoId] = useState<string | null>(null)
  const [visualizando, setVisualizando] = useState<Fechamento | null>(null)
  const [editandoVencimento, setEditandoVencimento] = useState<{id: string, data: string} | null>(null)

  useEffect(() => {
    supabase.from('motoristas').select('id, nome, caminhao_id').order('nome')
      .then(({ data }) => data && setMotoristas(data))
  }, [])

  useEffect(() => {
    if (abaAtiva === 'historico') {
      fetchHistorico()
    }
  }, [abaAtiva])

  // ✅ Motorista → caminhão + KM inicial automático + Detecção de Substituto
  useEffect(() => {
    if (!motoristaId) {
      setCaminhao(null); setContratosDisponiveis([]); setMotoristaNome('')
      setKmInicial(''); setKmFinal(''); setIsSubstituto(false); return
    }
    const motEncontrado = motoristas.find(m => m.id === motoristaId)
    if (!motEncontrado) return
    setMotoristaNome(motEncontrado.nome)
    const mot = motEncontrado // Criando uma constante estável para o escopo assíncrono

    async function vincularCaminhao() {
      // 1. Verifica se há manutenção com substituto para este motorista na data de início
      if (dataInicio) {
        const { data: manutencao } = await supabase
          .from('manutencoes')
          .select('caminhao_substituto_id, caminhao_substituto_placa')
          .eq('motorista_nome', mot.nome)
          .lte('data_entrada', dataInicio)
          .or(`data_saida.is.null,data_saida.gte.${dataInicio}`)
          .not('caminhao_substituto_id', 'is', null)
          .maybeSingle()

        if (manutencao?.caminhao_substituto_id) {
          setCaminhao({ id: manutencao.caminhao_substituto_id, placa: manutencao.caminhao_substituto_placa || '' })
          setIsSubstituto(true)
          buscarKmInicial(manutencao.caminhao_substituto_id)
          return
        }
      }

      // 2. Fallback para o caminhão principal
      setIsSubstituto(false)
      let q = supabase.from('caminhoes').select('id, placa').eq('motorista_atual', motoristaId)
      if (mot.caminhao_id) {
        q = supabase.from('caminhoes').select('id, placa')
          .or(`id.eq.${mot.caminhao_id},motorista_atual.eq.${motoristaId}`)
      }
      const { data: cam } = await q.maybeSingle()
      if (!cam) return
      setCaminhao(cam)
      buscarKmInicial(cam.id)
    }

    async function buscarKmInicial(camId: string) {
      const { data: ultimoFech } = await supabase
        .from("fechamento_viagens")
        .select("km_final")
        .eq("caminhao_id", camId)
        .order("data_fim", { ascending: false })
        .limit(1)
        .maybeSingle()

      if (ultimoFech?.km_final) {
        setKmInicial(String(ultimoFech.km_final))
      }
    }

    vincularCaminhao()

    async function fetchContratos() {
      const { data: todos } = await supabase.from('contratos')
        .select('id, contrato, fat_bruto, cliente, origem, destino')
        .order('created_at', { ascending: false }).limit(200)
      
      if (!todos) return
      const { data: jaUsados } = await supabase.from('fechamento_contratos').select('contrato_id')
      const idsUsados = new Set(jaUsados?.map(u => u.contrato_id) || [])
      setContratosDisponiveis(todos.filter(c => !idsUsados.has(c.id)))
    }
    fetchContratos()
  }, [motoristaId, motoristas, dataInicio])

  useEffect(() => {
    if (!caminhao?.id || !abastDataInicio || !abastDataFim) {
      setAbastecimentos([]); setAbastSelecionados(new Set()); return
    }
    setCarregandoAbast(true); setErro('')
    supabase.from('abastecimentos')
      .select('id, data, posto, litros_combustivel, litros_arla, total, km')
      .eq('caminhao_id', caminhao.id)
      .gte('data', abastDataInicio).lte('data', abastDataFim)
      .order('data')
      .then(({ data, error }) => {
        setCarregandoAbast(false)
        if (error) { setErro('Erro: ' + error.message); return }
        const lista = data || []
        setAbastecimentos(lista)
        setAbastSelecionados(new Set(lista.map(a => a.id)))
      })
  }, [caminhao?.id, abastDataInicio, abastDataFim])

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
      !jaSel.has(c.id) && (c.contrato.toLowerCase().includes(b) || c.cliente?.toLowerCase().includes(b))
    )
  }, [contratosDisponiveis, selecionados, buscaContrato])

  const abastAtivos = useMemo(
    () => abastecimentos.filter(a => abastSelecionados.has(a.id)),
    [abastecimentos, abastSelecionados]
  )

  // ✅ Atualiza KM Inicial e Final dinamicamente
  useEffect(() => {
    async function atualizarKms() {
      if (!caminhao?.id) return
      const { data: ultimoFech } = await supabase
        .from('fechamento_viagens')
        .select('km_final')
        .eq('caminhao_id', caminhao.id)
        .order('data_fim', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (ultimoFech?.km_final) {
        setKmInicial(String(ultimoFech.km_final))
      } else if (abastAtivos.length > 0) {
        const kms = abastAtivos.map(a => a.km).filter((k): k is number => !!k && k > 0)
        if (kms.length > 0) setKmInicial(String(Math.min(...kms)))
      } else {
        setKmInicial('')
      }

      if (abastAtivos.length > 0) {
        const kms = abastAtivos.map(a => a.km).filter((k): k is number => !!k && k > 0)
        if (kms.length > 0) setKmFinal(String(Math.max(...kms)))
      } else {
        setKmFinal('')
      }
    }
    atualizarKms()
  }, [abastAtivos, caminhao?.id])

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
      h.motorista.nome.toLowerCase().includes(b) || h.caminhao.placa.toLowerCase().includes(b)
    )
  }, [historico, buscaHistorico])

  async function fetchHistorico() {
    setCarregandoHistorico(true)
    try {
      const { data: fechamentos, error: errorFech } = await supabase
        .from('fechamento_viagens')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (errorFech) throw errorFech

      const [{ data: mots }, { data: cams }] = await Promise.all([
        supabase.from('motoristas').select('id, nome'),
        supabase.from('caminhoes').select('id, placa')
      ])

      const { data: relContratos } = await supabase
        .from('fechamento_contratos')
        .select('fechamento_id, contrato:contrato_id(contrato, origem, destino)')

      const formatado = (fechamentos || []).map(f => {
        const mot = mots?.find(m => m.id === f.motorista_id)
        const cam = cams?.find(c => c.id === f.caminhao_id)
        const conts = relContratos?.filter(rc => rc.fechamento_id === f.id) || []
        return {
          ...f,
          motorista: { nome: mot?.nome || '—' },
          caminhao: { placa: cam?.placa || '—' },
          contratos: conts
        }
      })
      setHistorico(formatado)
    } catch (e: any) {
      setErro('Erro ao carregar histórico: ' + e.message)
    } finally {
      setCarregandoHistorico(false)
    }
  }

  async function salvar() {
    if (!motoristaId || !caminhao || selecionados.length === 0) {
      setErro('Preencha os dados obrigatórios e selecione ao menos um contrato.'); return
    }
    setSalvando(true); setErro('')
    try {
      const { data: fech, error: errorFech } = await supabase
        .from('fechamento_viagens')
        .insert({
          motorista_id: motoristaId,
          caminhao_id: caminhao.id,
          data_inicio: dataInicio,
          data_fim: dataFim,
          km_inicial: Number(kmInicial),
          km_final: Number(kmFinal),
          data_vencimento: dataVencimento,
          total_litros: resumo.litros,
          total_abastecimento: resumo.valor,
          total_frete: resumo.frete,
          comissao_motorista: resumo.comissao
        })
        .select()
        .single()

      if (errorFech) throw errorFech

      const relContratos = selecionados.map(c => ({ fechamento_id: fech.id, contrato_id: c.id }))
      const { error: errorRel } = await supabase.from('fechamento_contratos').insert(relContratos)
      if (errorRel) throw errorRel

      setSucesso(true)
      setTimeout(() => {
        setSucesso(false)
        setAbaAtiva('historico')
        // Reset
        setMotoristaId(''); setCaminhao(null); setSelecionados([]); setAbastecimentos([]); setAbastSelecionados(new Set())
        setDataInicio(''); setDataFim(''); setKmInicial(''); setKmFinal(''); setDataVencimento('')
      }, 2000)
    } catch (e: any) {
      setErro('Erro ao salvar: ' + e.message)
    } finally {
      setSalvando(false)
    }
  }

  async function excluir(id: string) {
    const { error } = await supabase.from('fechamento_viagens').delete().eq('id', id)
    if (error) setErro('Erro ao excluir: ' + error.message)
    else { setExcluindoId(null); fetchHistorico() }
  }

  async function atualizarVencimento() {
    if (!editandoVencimento) return
    const { error } = await supabase
      .from('fechamento_viagens')
      .update({ data_vencimento: editandoVencimento.data })
      .eq('id', editandoVencimento.id)
    
    if (error) setErro('Erro ao atualizar vencimento: ' + error.message)
    else {
      setEditandoVencimento(null)
      fetchHistorico()
    }
  }

  function exportarCSV() {
    const headers = ['Data Lançamento', 'Motorista', 'Placa', 'Início', 'Fim', 'KM Inicial', 'KM Final', 'KM Rodado', 'Litros', 'Média', 'Vencimento', 'Total Frete', 'Comissão']
    const rows = historicoFiltrado.map(h => {
      const km = (h.km_final || 0) - (h.km_inicial || 0)
      const litros = h.total_litros || 0
      const media = km > 0 && litros > 0 ? (km / litros).toFixed(2) : '0'
      return [
        new Date(h.created_at).toLocaleDateString('pt-BR'),
        h.motorista.nome,
        h.caminhao.placa,
        fmtData(h.data_inicio),
        fmtData(h.data_fim),
        h.km_inicial,
        h.km_final,
        km,
        litros,
        media,
        fmtData(h.data_vencimento),
        h.total_frete || 0,
        h.comissao_motorista || 0
      ]
    })
    const csvContent = [headers, ...rows].map(e => e.join(";")).join("\n")
    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", `fechamentos_${new Date().toISOString().split('T')[0]}.csv`)
    link.click()
  }

  return (
    <div className="p-4 md:p-8 max-w-full bg-gray-50 min-h-screen font-sans pb-32">
      {/* ── BARRA DE RESUMO FIXA ── */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-gray-200 z-50 p-4 shadow-2xl">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex gap-6">
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-gray-400 uppercase">KM Rodado</span>
              <span className="text-lg font-black text-gray-900">{resumo.km.toLocaleString('pt-BR')} km</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-gray-400 uppercase">Combustível</span>
              <span className="text-lg font-black text-red-600">{fmt(resumo.litros)} L</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-gray-400 uppercase">Média</span>
              <span className="text-lg font-black text-blue-600">{fmt(resumo.mediaKmL)} km/L</span>
            </div>
          </div>
          <div className="flex gap-6">
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-black text-gray-400 uppercase">Frete Bruto</span>
              <span className="text-lg font-black text-gray-900">R$ {fmt(resumo.frete)}</span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-black text-gray-400 uppercase">Comissão (10%)</span>
              <span className="text-lg font-black text-green-600">R$ {fmt(resumo.comissao)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── HEADER ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div>
          <h1 className="text-4xl font-black text-gray-900 tracking-tighter uppercase flex items-center gap-3">
            <CheckCircle2 className="text-red-600" size={36}/> Fechamento de Viagem
          </h1>
          <p className="text-sm text-gray-400 font-bold uppercase tracking-widest mt-1">Conciliação de fretes, KM e combustível</p>
        </div>
        <div className="flex bg-white p-1.5 rounded-2xl shadow-sm border border-gray-100">
          <button onClick={() => setAbaAtiva('novo')}
            className={`px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${abaAtiva === 'novo' ? 'bg-red-600 text-white shadow-lg shadow-red-100' : 'text-gray-400 hover:text-gray-600'}`}>
            Novo Fechamento
          </button>
          <button onClick={() => setAbaAtiva('historico')}
            className={`px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${abaAtiva === 'historico' ? 'bg-red-600 text-white shadow-lg shadow-red-100' : 'text-gray-400 hover:text-gray-600'}`}>
            Histórico
          </button>
        </div>
      </div>

      {abaAtiva === 'novo' ? (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 space-y-6">

              {/* ── Motorista + Datas + KM ── */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-xs font-bold text-gray-600 uppercase tracking-wider">
                      <User size={14} className="text-red-600"/> Motorista
                    </label>
                    <select value={motoristaId}
                      onChange={e => {
                        setMotoristaId(e.target.value)
                        setSelecionados([]); setAbastecimentos([]); setAbastSelecionados(new Set())
                        setKmInicial(''); setKmFinal('')
                      }}
                      className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 text-sm font-bold focus:border-red-500 focus:bg-white outline-none transition-all">
                      <option value="">Selecione o motorista</option>
                      {motoristas.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-xs font-bold text-gray-600 uppercase tracking-wider">
                      <Truck size={14} className="text-red-600"/> Placa do Caminhão
                    </label>
                    <div className={`w-full border-2 rounded-xl px-4 py-3 text-sm font-black flex items-center justify-between ${isSubstituto ? 'bg-blue-50 border-blue-100 text-blue-700' : 'bg-red-50 border-red-100 text-red-700'}`}>
                      <div className="flex items-center gap-2">
                        {caminhao ? caminhao.placa : 'Aguardando...'}
                        {isSubstituto && <span className="text-[9px] bg-blue-600 text-white px-1.5 py-0.5 rounded uppercase">Substituto</span>}
                      </div>
                      {caminhao && <CheckCircle2 size={16} className={isSubstituto ? 'text-blue-500' : 'text-red-500'}/>}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 pt-4 border-t border-gray-50">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-gray-500 uppercase">Saída Viagem</label>
                    <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs font-bold outline-none focus:border-red-500"/>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-gray-500 uppercase">Retorno Viagem</label>
                    <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs font-bold outline-none focus:border-red-500"/>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-1">
                      KM Inicial
                      {kmInicial && <span className="text-green-500 text-[9px]">● auto</span>}
                    </label>
                    <input type="number" value={kmInicial} onChange={e => setKmInicial(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs font-bold outline-none focus:border-red-500"/>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-gray-500 uppercase">KM Final</label>
                    <input type="number" value={kmFinal} onChange={e => setKmFinal(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs font-bold outline-none focus:border-red-500"/>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-red-600 uppercase flex items-center gap-1">
                      <CreditCard size={10}/> Vencimento
                    </label>
                    <input type="date" value={dataVencimento} onChange={e => setDataVencimento(e.target.value)}
                      className="w-full bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs font-bold outline-none focus:border-red-600"/>
                  </div>
                </div>
                {kmInicial && kmFinal && Number(kmFinal) > Number(kmInicial) && (
                  <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5 space-y-2">
                    <p className="text-xs text-blue-700">
                      Distância: <strong>{(Number(kmFinal) - Number(kmInicial)).toLocaleString('pt-BR')} km</strong>
                      {resumo.mediaKmL > 0 && <span className="ml-3">Média: <strong>{fmt(resumo.mediaKmL)} km/L</strong></span>}
                    </p>
                    {selecionados.length > 0 && (
                      <div className="pt-2 border-t border-blue-100">
                        <p className="text-[10px] font-black text-blue-400 uppercase mb-1">Rotas dos Contratos Selecionados</p>
                        <div className="space-y-1">
                          {selecionados.map(c => (
                            <div key={c.id} className="flex items-center gap-2 text-[11px] font-bold text-blue-800">
                              <span className="opacity-50">#{c.contrato}:</span>
                              <span>{c.origem || '—'}</span>
                              <ArrowRight size={10} className="opacity-30"/>
                              <span>{c.destino || '—'}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* ── Abastecimentos ── */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-5 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between bg-gray-50/50 gap-4">
                  <div className="flex items-center gap-3">
                    <h2 className="text-xs font-black text-gray-700 uppercase tracking-widest flex items-center gap-2">
                      <Fuel size={16} className="text-red-600"/> Abastecimentos
                    </h2>
                    {caminhao && <span className="bg-red-600 text-white px-2 py-0.5 rounded text-[10px] font-black">{caminhao.placa}</span>}
                  </div>
                  <div className="flex items-center gap-2 bg-white p-1.5 rounded-xl border border-gray-200 shadow-sm">
                    <Filter size={14} className="text-gray-400 ml-2"/>
                    <input type="date" value={abastDataInicio} onChange={e => setAbastDataInicio(e.target.value)}
                      className="text-[10px] font-bold outline-none border-none p-1"/>
                    <span className="text-gray-300">→</span>
                    <input type="date" value={abastDataFim} onChange={e => setAbastDataFim(e.target.value)}
                      className="text-[10px] font-bold outline-none border-none p-1"/>
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
                      <AlertCircle size={16}/> {erro}
                    </div>
                  )}
                  {!caminhao ? (
                    <p className="text-center py-10 text-sm text-gray-400 italic">Selecione o motorista primeiro.</p>
                  ) : !abastDataInicio || !abastDataFim ? (
                    <p className="text-center py-10 text-sm text-gray-400 italic flex items-center justify-center gap-2">
                      <Calendar size={16}/> Informe o período dos abastecimentos.
                    </p>
                  ) : carregandoAbast ? (
                    <div className="flex items-center justify-center py-10 gap-3">
                      <div className="w-5 h-5 border-2 border-red-600 border-t-transparent rounded-full animate-spin"/>
                    </div>
                  ) : abastecimentos.length === 0 ? (
                    <div className="text-center py-10">
                      <Fuel size={28} className="mx-auto text-gray-200 mb-2"/>
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
                                <input type="checkbox" checked={marcado} onChange={() => toggleAbast(a.id)} className="w-5 h-5 accent-red-600"/>
                                <span className="text-sm font-black text-gray-900">{fmtData(a.data)}</span>
                              </div>
                              <span className="text-sm font-black text-red-600">R$ {fmt(a.total || 0)}</span>
                            </div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase flex items-center gap-1.5 mb-2">
                              <MapPin size={10}/> {a.posto || 'POSTO NÃO IDENTIFICADO'}
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
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                    <input type="text" placeholder="Buscar contrato..." value={buscaContrato}
                      onChange={e => setBuscaContrato(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 text-sm bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-red-500 font-bold"/>
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
                          <ArrowRight size={12} className="text-gray-300 shrink-0"/>
                          <div className="flex-1 text-right">
                            <p className="text-[9px] font-black text-gray-400 uppercase">Destino</p>
                            <p className="text-[10px] font-black text-red-600 truncate">{c.destino || '—'}</p>
                          </div>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
                {selecionados.length > 0 && (
                  <div className="p-4 bg-red-600 text-white">
                    <h3 className="text-[10px] font-black uppercase tracking-widest mb-3 opacity-90">
                      Selecionados ({selecionados.length})
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {selecionados.map(c => (
                        <div key={c.id} className="flex items-center gap-2 bg-white/20 border border-white/30 rounded-xl pl-3 pr-2 py-1.5">
                          <span className="text-xs font-black">#{c.contrato}</span>
                          <button onClick={() => removerContrato(c.id)}><X size={12}/></button>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 pt-3 border-t border-white/20 flex justify-between text-xs">
                      <span className="text-white/70 font-bold uppercase">Frete Total</span>
                      <span className="font-black">{resumo.frete > 0 ? `R$ ${fmt(resumo.frete)}` : '—'}</span>
                    </div>
                    <div className="flex justify-between text-xs mt-1">
                      <span className="text-white/70 font-bold uppercase">Comissão 10%</span>
                      <span className="font-black text-green-300">{resumo.comissao > 0 ? `R$ ${fmt(resumo.comissao)}` : '—'}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Salvar ── */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 pt-8 border-t border-gray-200">
            <div className="flex-1 text-sm font-bold">
              {erro && <span className="text-red-600">⚠️ {erro}</span>}
              {sucesso && <span className="text-green-600">✅ Fechamento realizado com sucesso!</span>}
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
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"/>
              <input type="text" placeholder="Pesquisar motorista ou placa..." value={buscaHistorico}
                onChange={e => setBuscaHistorico(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-red-500 text-sm font-medium"/>
            </div>
            <button onClick={exportarCSV} className="flex items-center gap-2 bg-green-600 text-white px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-green-700 transition-all">
              <Download size={16}/> Exportar CSV
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100">
                  {['Data Lançamento', 'Motorista / Placa', 'Período / Destinos', 'Vencimento', ''].map(h => (
                    <th key={h} className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {carregandoHistorico ? (
                  <tr><td colSpan={5} className="px-6 py-12 text-center text-sm text-gray-400">Carregando...</td></tr>
                ) : historicoFiltrado.length === 0 ? (
                  <tr><td colSpan={5} className="px-6 py-12 text-center text-sm text-gray-400">Nenhum registro</td></tr>
                ) : historicoFiltrado.map(h => (
                  <tr key={h.id} className="hover:bg-gray-50/50 transition-colors group cursor-pointer" onClick={() => setVisualizando(h)}>
                    <td className="px-6 py-4 text-xs font-bold text-gray-500">{new Date(h.created_at).toLocaleDateString('pt-BR')}</td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-black text-gray-900">{h.motorista?.nome || '—'}</p>
                      <p className="text-[10px] font-bold text-red-600">{h.caminhao?.placa || '—'}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-xs font-bold text-gray-600">{fmtData(h.data_inicio)} → {fmtData(h.data_fim)}</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {h.contratos?.map((c: any, i: number) => (
                          <span key={i} className="text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded border border-gray-200">
                            {c.contrato?.contrato}: {c.contrato?.origem} → {c.contrato?.destino}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4" onClick={e => e.stopPropagation()}>
                      {editandoVencimento?.id === h.id ? (
                        <div className="flex items-center gap-2">
                          <input type="date" value={editandoVencimento.data} 
                            onChange={e => setEditandoVencimento({...editandoVencimento, data: e.target.value})}
                            className="text-xs border rounded px-1 py-0.5 outline-none focus:ring-1 focus:ring-red-500"/>
                          <button onClick={atualizarVencimento} className="text-green-600"><CheckCircle2 size={14}/></button>
                          <button onClick={() => setEditandoVencimento(null)} className="text-red-600"><X size={14}/></button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 group/edit">
                          <span className="text-xs font-black text-red-600">{fmtData(h.data_vencimento)}</span>
                          <button onClick={() => setEditandoVencimento({id: h.id, data: h.data_vencimento})} 
                            className="opacity-0 group-hover/edit:opacity-100 text-gray-400 hover:text-red-600 transition-all">
                            <Calendar size={12}/>
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right" onClick={e => e.stopPropagation()}>
                      <button onClick={() => setExcluindoId(h.id)} 
                        className="p-2 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100">
                        <X size={16}/>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── MODAL VISUALIZAÇÃO ── */}
      {visualizando && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden">
            <div className="px-8 py-6 bg-red-600 flex items-center justify-between">
              <h2 className="text-white font-black text-xl uppercase tracking-tighter">Detalhes do Fechamento</h2>
              <button onClick={() => setVisualizando(null)} className="text-white/80 hover:text-white"><X size={24}/></button>
            </div>
            <div className="p-8 space-y-6 overflow-y-auto max-h-[80vh]">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase">Motorista</p>
                  <p className="text-lg font-black text-gray-900">{visualizando.motorista.nome}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase">Caminhão</p>
                  <p className="text-lg font-black text-red-600">{visualizando.caminhao.placa}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-6 pt-4 border-t border-gray-100">
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase">Período</p>
                  <p className="text-sm font-bold text-gray-700">{fmtData(visualizando.data_inicio)} → {fmtData(visualizando.data_fim)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase">Vencimento</p>
                  <p className="text-sm font-black text-red-600">{fmtData(visualizando.data_vencimento)}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-100">
                <div className="bg-gray-50 p-3 rounded-xl">
                  <p className="text-[9px] font-black text-gray-400 uppercase">KM Rodado</p>
                  <p className="text-sm font-black">{(visualizando.km_final - visualizando.km_inicial).toLocaleString('pt-BR')} km</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-xl">
                  <p className="text-[9px] font-black text-gray-400 uppercase">Combustível</p>
                  <p className="text-sm font-black">{fmt(visualizando.total_litros || 0)} L</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-xl">
                  <p className="text-[9px] font-black text-gray-400 uppercase">Média</p>
                  <p className="text-sm font-black">
                    {visualizando.total_litros && (visualizando.km_final - visualizando.km_inicial) > 0 
                      ? fmt((visualizando.km_final - visualizando.km_inicial) / visualizando.total_litros) 
                      : '0,00'} km/L
                  </p>
                </div>
              </div>
              <div className="pt-4 border-t border-gray-100">
                <p className="text-[10px] font-black text-gray-400 uppercase mb-3">Contratos Vinculados</p>
                <div className="space-y-2">
                  {visualizando.contratos?.map((c: any, i: number) => (
                    <div key={i} className="flex items-center justify-between bg-gray-50 p-3 rounded-xl border border-gray-100">
                      <span className="text-xs font-black text-gray-900">#{c.contrato?.contrato}</span>
                      <span className="text-xs font-bold text-gray-500">{c.contrato?.origem} → {c.contrato?.destino}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="pt-6 border-t border-gray-100 flex justify-between items-center">
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase">Frete Total</p>
                  <p className="text-xl font-black text-gray-900">R$ {fmt(visualizando.total_frete || 0)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-gray-400 uppercase">Comissão (10%)</p>
                  <p className="text-xl font-black text-green-600">R$ {fmt(visualizando.comissao_motorista || 0)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL EXCLUSÃO ── */}
      {excluindoId && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 text-center">
            <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle size={32}/>
            </div>
            <h3 className="text-xl font-black text-gray-900 uppercase tracking-tighter mb-2">Excluir Fechamento?</h3>
            <p className="text-sm text-gray-500 font-bold mb-8">Esta ação não pode ser desfeita e os contratos voltarão a ficar disponíveis.</p>
            <div className="flex gap-3">
              <button onClick={() => setExcluindoId(null)} className="flex-1 py-3 rounded-xl font-black text-xs uppercase tracking-widest text-gray-400 hover:bg-gray-50 transition-all">Cancelar</button>
              <button onClick={() => excluir(excluindoId)} className="flex-1 py-3 rounded-xl font-black text-xs uppercase tracking-widest bg-red-600 text-white shadow-lg shadow-red-100 hover:bg-red-700 transition-all">Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
