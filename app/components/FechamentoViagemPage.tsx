'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../services/supabase'
import { X, Search, Truck, User, Calendar, MapPin, Fuel, CheckCircle2, CreditCard, Filter, AlertCircle, ArrowRight } from 'lucide-react'

type Motorista     = { id: string; nome: string; caminhao_id?: string }
type Caminhao      = { id: string; placa: string }
type Contrato      = { id: string; contrato: string; fat_bruto: number | null; cliente?: string | null; origem?: string | null; destino?: string | null }
type Abastecimento = { id: string; data: string; posto?: string | null; litros_combustivel?: number | null; litros_arla?: number | null; total?: number | null; km?: number | null }
type Fechamento    = { 
  id: string; 
  created_at: string; 
  motorista: { nome: string }; 
  caminhao: { placa: string }; 
  data_inicio: string; 
  data_fim: string; 
  km_inicial: number; 
  km_final: number; 
  data_vencimento: string;
  contratos?: { contrato: { origem: string; destino: string } }[]
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
  const [sucesso, setSucesso]     = useState(false)
  const [excluindoId, setExcluindoId] = useState<string | null>(null)
  const [visualizando, setVisualizando] = useState<Fechamento | null>(null)

  useEffect(() => {
    supabase.from('motoristas').select('id, nome, caminhao_id').order('nome')
      .then(({ data }) => data && setMotoristas(data))
  }, [])

  useEffect(() => {
    if (abaAtiva === 'historico') {
      fetchHistorico()
    }
  }, [abaAtiva])

  // ✅ Motorista → caminhão + KM inicial automático
  useEffect(() => {
    if (!motoristaId) {
      setCaminhao(null); setContratosDisponiveis([]); setMotoristaNome('')
      setKmInicial(''); setKmFinal(''); return
    }
    const mot = motoristas.find(m => m.id === motoristaId)
    if (!mot) return
    setMotoristaNome(mot.nome)

    async function vincularCaminhao() {
      // 1. Busca caminhão
      let q = supabase.from('caminhoes').select('id, placa').eq('motorista_atual', motoristaId)
      if (mot?.caminhao_id) {
        q = supabase.from('caminhoes').select('id, placa')
          .or(`id.eq.${mot.caminhao_id},motorista_atual.eq.${motoristaId}`)
      }
      const { data: cam } = await q.maybeSingle()
      if (!cam) return
      setCaminhao(cam)

      // KM inicial = km_final do último fechamento deste caminhão (apenas inicialização)
      const { data: ultimoFech } = await supabase
        .from("fechamento_viagens")
        .select("km_final")
        .eq("caminhao_id", cam.id)
        .order("data_fim", { ascending: false })
        .limit(1)
        .maybeSingle()

      if (ultimoFech?.km_final) {
        setKmInicial(String(ultimoFech.km_final))
      }
    }
    vincularCaminhao()

    supabase.from('contratos').select('id, contrato, fat_bruto, cliente, origem, destino')
      .order('created_at', { ascending: false }).limit(100)
      .then(({ data }) => { if (data) setContratosDisponiveis(data) })
  }, [motoristaId, motoristas])

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
      !jaSel.has(c.id) && (c.contrato.includes(buscaContrato) || c.cliente?.toLowerCase().includes(b))
    )
  }, [contratosDisponiveis, selecionados, buscaContrato])

  const abastAtivos = useMemo(
    () => abastecimentos.filter(a => abastSelecionados.has(a.id)),
    [abastecimentos, abastSelecionados]
  )

  // ✅ Atualiza KM Inicial e Final dinamicamente com base nos abastecimentos selecionados
  useEffect(() => {
    if (abastAtivos.length > 0) {
      const kms = abastAtivos.map(a => a.km).filter((k): k is number => !!k && k > 0)
      if (kms.length > 0) {
        // KM Inicial: menor KM entre os selecionados
        setKmInicial(String(Math.min(...kms)))
        // KM Final: maior KM entre os selecionados
        setKmFinal(String(Math.max(...kms)))
      }
    } else {
      // Se nada selecionado, tenta voltar para o KM Inicial do último fechamento (se existir)
      if (caminhao?.id) {
        supabase.from('fechamento_viagens')
          .select('km_final')
          .eq('caminhao_id', caminhao.id)
          .order('data_fim', { ascending: false })
          .limit(1)
          .maybeSingle()
          .then(({ data }) => {
            if (data?.km_final) setKmInicial(String(data.km_final))
            else setKmInicial('')
          })
      }
      setKmFinal('')
    }
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
      const { data, error } = await supabase.from('fechamento_viagens')
        .select(`
          *,
          motorista:motorista_id(nome),
          caminhao:caminhao_id(placa),
          contratos:fechamento_contratos(contrato:contrato_id(origem, destino))
        `)
        .order('created_at', { ascending: false })
      
      if (error) throw error
      
      // Garante que a placa venha corretamente do relacionamento ou fallback
      const formatado = (data || []).map(h => ({
        ...h,
        motorista: h.motorista || { nome: motoristas.find(m => m.id === h.motorista_id)?.nome || 'Motorista' },
        caminhao: h.caminhao || { placa: 'Placa' }
      }))
      
      setHistorico(formatado as any)
    } catch (err) {
      console.error('Erro ao buscar histórico:', err)
      const { data: simple } = await supabase.from('fechamento_viagens')
        .select('*').order('created_at', { ascending: false })
      if (simple) {
        const mapped = simple.map(s => ({
          ...s,
          motorista: { nome: motoristas.find(m => m.id === s.motorista_id)?.nome || 'Motorista' },
          caminhao: { placa: 'Caminhão' }
        }))
        setHistorico(mapped as any)
      }
    } finally {
      setCarregandoHistorico(false)
    }
  }

  async function atualizarVencimento(id: string, novaData: string) {
    const { error } = await supabase.from('fechamento_viagens').update({ data_vencimento: novaData }).eq('id', id)
    if (error) {
      setErro('Erro ao atualizar data: ' + error.message)
    } else {
      setSucesso(true)
      setTimeout(() => setSucesso(false), 3000)
      fetchHistorico()
      setVisualizando(prev => prev ? { ...prev, data_vencimento: novaData } : null)
    }
  }

  async function excluirFechamento(id: string) {
    const { error } = await supabase.from('fechamento_viagens').delete().eq('id', id)
    if (error) {
      setErro('Erro ao excluir: ' + error.message)
    } else {
      setSucesso(true)
      setTimeout(() => setSucesso(false), 3000)
      fetchHistorico()
    }
    setExcluindoId(null)
  }

  async function salvar() {
    setErro('')
    if (!motoristaId || !dataInicio || !dataFim || !kmInicial || !kmFinal || !dataVencimento) {
      setErro('Preencha todos os campos obrigatórios.'); return
    }
    if (selecionados.length === 0) { setErro('Adicione ao menos um contrato.'); return }
    setSalvando(true)

    const { data: fech, error } = await supabase.from('fechamento_viagens').insert({
      motorista_id: motoristaId,
      caminhao_id: caminhao?.id || null,
      data_inicio: dataInicio,
      data_fim: dataFim,
      km_inicial: Number(kmInicial),
      km_final: Number(kmFinal),
      data_vencimento: dataVencimento,
      status_financeiro: 'pendente'
    }).select('id').single()

    if (error || !fech) {
      console.error('Erro Supabase:', error)
      setErro('Erro ao salvar no Supabase: ' + error?.message)
      setSalvando(false)
      return
    }

    await Promise.all([
      supabase.from('fechamento_contratos').insert(
        selecionados.map(c => ({ fechamento_id: fech.id, contrato_id: c.id }))
      ),
      abastAtivos.length > 0 && supabase.from('fechamento_abastecimentos').insert(
        abastAtivos.map(a => ({ fechamento_id: fech.id, abastecimento_id: a.id }))
      )
    ])

    await supabase.from('premios').insert({
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
    })

    setSalvando(false)
    setSucesso(true)
    setTimeout(() => setSucesso(false), 5000)
    
    // Atualiza o histórico imediatamente
    setTimeout(() => fetchHistorico(), 500)

    // Limpa os campos após salvar, mas permanece na página
    setMotoristaId('')
    setSelecionados([])
    setAbastecimentos([])
    setAbastSelecionados(new Set())
    setKmInicial('')
    setKmFinal('')
    setDataInicio('')
    setDataFim('')
    setDataVencimento('')
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 bg-gray-50 min-h-screen relative">
      {/* Modal de Confirmação de Exclusão */}
      {excluindoId && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl border border-gray-100 text-center space-y-6">
            <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle size={32}/>
            </div>
            <div>
              <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight">Excluir Fechamento?</h3>
              <p className="text-sm font-bold text-gray-500 mt-2">Esta ação não pode ser desfeita. Deseja continuar?</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setExcluindoId(null)} className="flex-1 py-4 bg-gray-100 text-gray-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-gray-200 transition-all">Cancelar</button>
              <button onClick={() => excluirFechamento(excluindoId)} className="flex-1 py-4 bg-red-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-red-700 shadow-lg shadow-red-200 transition-all">Sim, Excluir</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Visualização Detalhada */}
      {visualizando && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div>
                <h3 className="text-lg font-black text-gray-900 uppercase tracking-tight">Detalhes do Fechamento</h3>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Lançado em {new Date(visualizando.created_at).toLocaleDateString('pt-BR')}</p>
              </div>
              <button onClick={() => setVisualizando(null)} className="p-2 hover:bg-gray-200 rounded-xl transition-colors text-gray-400"><X size={20}/></button>
            </div>
            <div className="p-8 overflow-y-auto space-y-8">
              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Motorista</p>
                  <p className="text-base font-black text-gray-900">{visualizando.motorista?.nome || '—'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Placa</p>
                  <p className="text-base font-black text-red-600">{visualizando.caminhao?.placa || '—'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Período</p>
                  <p className="text-sm font-bold text-gray-700">{fmtData(visualizando.data_inicio)} → {fmtData(visualizando.data_fim)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">KM Rodado</p>
                  <p className="text-sm font-bold text-gray-700">{(visualizando.km_final - visualizando.km_inicial).toLocaleString('pt-BR')} km (Início: {visualizando.km_inicial} | Fim: {visualizando.km_final})</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest text-red-600">Data de Pagamento (Vencimento)</p>
                  <input 
                    type="date" 
                    value={visualizando.data_vencimento} 
                    onChange={(e) => atualizarVencimento(visualizando.id, e.target.value)}
                    className="w-full bg-red-50 border border-red-100 rounded-xl px-4 py-2 text-sm font-bold text-red-600 focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Contratos / Destinos</p>
                <div className="grid grid-cols-1 gap-2">
                  {visualizando.contratos?.map((c: any, i: number) => (
                    <div key={i} className="bg-gray-50 border border-gray-100 p-3 rounded-xl flex items-center justify-between">
                      <span className="text-xs font-black text-gray-700">Contrato #{i+1}</span>
                      <div className="flex items-center gap-3 text-xs font-bold text-gray-500">
                        <span>{c.contrato?.origem}</span>
                        <ArrowRight size={12} className="text-gray-300"/>
                        <span>{c.contrato?.destino}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-end">
              <button onClick={() => setVisualizando(null)} className="px-8 py-3 bg-gray-900 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-gray-800 transition-all">Concluir</button>
            </div>
          </div>
        </div>
      )}

      {/* Notificação de Sucesso */}
      {sucesso && (
        <div className="fixed top-6 right-6 z-[100] animate-in slide-in-from-right-full duration-500">
          <div className="bg-green-600 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 border border-green-500">
            <CheckCircle2 size={20} className="text-green-100"/>
            <div>
              <p className="font-black text-sm uppercase tracking-widest">Sucesso!</p>
              <p className="text-xs font-bold text-green-50 opacity-90">Operação realizada com sucesso.</p>
            </div>
            <button onClick={() => setSucesso(false)} className="ml-4 hover:bg-white/10 p-1 rounded-lg transition-colors">
              <X size={16}/>
            </button>
          </div>
        </div>
      )}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
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
            <div className="bg-gray-900 text-white rounded-2xl p-6 shadow-2xl border border-gray-800 grid grid-cols-2 md:grid-cols-5 gap-6">
              <div>
                <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">Distância</p>
                <p className="text-2xl font-bold mt-1">{resumo.km > 0 ? `${resumo.km.toLocaleString('pt-BR')} km` : '—'}</p>
              </div>
              <div>
                <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">Combustível</p>
                <p className="text-2xl font-bold text-blue-400 mt-1">{resumo.litros > 0 ? `${fmt(resumo.litros)} L` : '—'}</p>
              </div>
              <div>
                <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">Média KM/L</p>
                <p className="text-2xl font-bold text-green-400 mt-1">{resumo.mediaKmL > 0 ? fmt(resumo.mediaKmL) : '—'}</p>
              </div>
              <div>
                <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">Total Frete</p>
                <p className="text-2xl font-bold text-yellow-400 mt-1">{resumo.frete > 0 ? `R$ ${fmt(resumo.frete)}` : '—'}</p>
              </div>
              <div>
                <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">Comissão (10%)</p>
                <p className="text-2xl font-bold text-green-400 mt-1">{resumo.comissao > 0 ? `R$ ${fmt(resumo.comissao)}` : '—'}</p>
              </div>
            </div>
          </div>

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
                    <div className="w-full bg-red-50 border-2 border-red-100 rounded-xl px-4 py-3 text-sm font-black text-red-700 flex items-center justify-between">
                      {caminhao ? caminhao.placa : 'Aguardando...'}
                      {caminhao && <CheckCircle2 size={16} className="text-red-500"/>}
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
                      className="w-full pl-10 pr-4 py-3 text-sm bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-red-500 transition-all"/>
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
              <input type="text" placeholder="Pesquisar..." value={buscaHistorico}
                onChange={e => setBuscaHistorico(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-red-500 text-sm font-medium"/>
            </div>
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
                            {c.contrato?.origem} → {c.contrato?.destino}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs font-black text-red-600">{fmtData(h.data_vencimento)}</td>
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
    </div>
  )
}