'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../services/supabase'
import { useDraftPersistente, limparDraft } from '../services/useDraftPersistente'
import { X, Search, Truck, User, Calendar, MapPin, Fuel, CheckCircle2, Filter, AlertCircle, ArrowRight, Download, Edit2, RefreshCw } from 'lucide-react'

type Motorista     = { id: string; nome: string; caminhao_id?: string }
type Caminhao      = { id: string; placa: string }
type Contrato      = { id: string; contrato: string; fat_bruto: number | null; cliente?: string | null; origem?: string | null; destino?: string | null }
type Abastecimento = { id: string; data: string; posto?: string | null; litros_combustivel?: number | null; litros_arla?: number | null; total?: number | null; km?: number | null }
type Fechamento    = {
  id: string; created_at: string; motorista_id: string; caminhao_id: string;
  motorista: { nome: string }; caminhao: { placa: string };
  data_inicio: string; data_fim: string; km_inicial: number; km_final: number;
  data_vencimento: string; total_litros?: number; total_abastecimento?: number;
  total_frete?: number; comissao_motorista?: number;
  contratos?: { contrato: { contrato: string; origem: string; destino: string; fat_bruto?: number } }[]
}

const CONSULTA_TIMEOUT_MS = 12_000

async function comTimeout<T>(promessa: PromiseLike<T>, ms = CONSULTA_TIMEOUT_MS): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('CONSULTA_TIMEOUT')), ms)
  })

  try {
    return await Promise.race([Promise.resolve(promessa), timeoutPromise])
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}

export default function FechamentoViagemPage({ setAba }: { setAba?: (a: string) => void }) {
  const [motoristas, setMotoristas]               = useState<Motorista[]>([])
  const [carregandoMotoristas, setCarregandoMotoristas] = useState(true)
  const [erroMotoristas, setErroMotoristas]       = useState('')
  const [motoristaId, setMotoristaId]             = useDraftPersistente('fechamento_motoristaId', '')
  const [motoristaNome, setMotoristaNome]         = useState('')
  const [caminhao, setCaminhao]                   = useState<Caminhao | null>(null)
  const [caminhaoBase, setCaminhaoBase]           = useState<Caminhao | null>(null)
  const [isSubstituto, setIsSubstituto]           = useState(false)
  const [motoristaHistorico, setMotoristaHistorico] = useState<string | null>(null)
  const [dataInicio, setDataInicio]               = useDraftPersistente('fechamento_dataInicio', '')
  const [dataFim, setDataFim]                     = useDraftPersistente('fechamento_dataFim', '')
  const [kmInicial, setKmInicial]                 = useDraftPersistente('fechamento_kmInicial', '')
  const [kmFinal, setKmFinal]                     = useDraftPersistente('fechamento_kmFinal', '')
  const [abastDataInicio, setAbastDataInicio]     = useDraftPersistente('fechamento_abastDataInicio', '')
  const [abastDataFim, setAbastDataFim]           = useDraftPersistente('fechamento_abastDataFim', '')
  const [buscaContrato, setBuscaContrato]         = useState('')
  const [contratosDisponiveis, setContratosDisponiveis] = useState<Contrato[]>([])
  const [selecionados, setSelecionados]           = useDraftPersistente<Contrato[]>('fechamento_selecionados', [])
  const [abastecimentos, setAbastecimentos]       = useState<Abastecimento[]>([])
  const [abastSelecionados, setAbastSelecionados] = useState<Set<string>>(new Set())
  const [carregandoAbast, setCarregandoAbast]     = useState(false)
  const [historico, setHistorico]                 = useState<Fechamento[]>([])
  const [buscaHistorico, setBuscaHistorico]       = useState('')
  const [carregandoHistorico, setCarregandoHistorico] = useState(false)
  const [salvando, setSalvando]       = useState(false)
  const [erro, setErro]               = useState('')
  const [abaAtiva, setAbaAtiva]       = useState<'novo' | 'historico'>('novo')
  const [sucesso, setSucesso]         = useState(false)
  const [excluindoId, setExcluindoId] = useState<string | null>(null)
  const [visualizando, setVisualizando] = useState<Fechamento | null>(null)
  const [editando, setEditando]       = useState<Fechamento | null>(null)
  const motoristaRequestRef = useRef(0)
  const montadoRef = useRef(true)

  // ─── Funções auxiliares ───────────────────────────────────────────────────

  // ✅ Antes esse fetch não tinha .catch() nenhum — se a consulta falhasse
  // por qualquer motivo (rede instável, timeout, etc.), o erro era
  // engolido silenciosamente e a lista de motoristas ficava vazia pra
  // sempre, sem nenhum aviso. Como essa página desmonta e remonta toda
  // vez que você troca de aba, cada volta era uma nova tentativa "no
  // escuro" — se a rede estivesse ruim naquele instante, travava vazio
  // sem chance de recuperar a não ser dar F5 na página inteira. Agora
  // tem tratamento de erro visível e um botão pra tentar de novo sem
  // precisar recarregar tudo.
  async function fetchMotoristas() {
    const requestId = ++motoristaRequestRef.current
    const controller = new AbortController()
    setCarregandoMotoristas(true); setErroMotoristas('')

    try {
      const resultado = await comTimeout(
        supabase
          .from('motoristas')
          .select('id, nome, caminhao_id')
          .order('nome')
          .abortSignal(controller.signal),
      )

      if (!montadoRef.current || requestId !== motoristaRequestRef.current) return
      const { data, error } = resultado
      if (error) throw error
      setMotoristas(data || [])
    } catch (e: any) {
      if (!montadoRef.current || requestId !== motoristaRequestRef.current) return
      console.error('Erro ao carregar motoristas:', e)
      setErroMotoristas(
        e?.message === 'CONSULTA_TIMEOUT'
          ? 'A lista de motoristas demorou para responder.'
          : 'Não foi possível carregar a lista de motoristas.',
      )
    } finally {
      controller.abort()
      if (montadoRef.current && requestId === motoristaRequestRef.current) {
        setCarregandoMotoristas(false)
      }
    }
  }

  async function buscarKmInicial(camId: string) {
    const [{ data: ultimoFech }, { data: abasts }] = await Promise.all([
      supabase.from('fechamento_viagens').select('km_final')
        .eq('caminhao_id', camId)
        .order('data_fim', { ascending: false })
        .limit(1).maybeSingle(),
      supabase.from('abastecimentos').select('km, data')
        .eq('caminhao_id', camId)
        .not('km', 'is', null).gt('km', 0)
        .order('data', { ascending: true })
    ])

    if (ultimoFech?.km_final) {
      setKmInicial(String(ultimoFech.km_final))
      setKmFinal('')
      return
    }
    if (abasts && abasts.length > 0) {
      const validos = abasts.filter(a => a.km && a.km > 0)
      if (validos.length > 0) {
        setKmInicial(String(validos[0].km))
        if (validos.length > 1) setKmFinal(String(validos[validos.length - 1].km))
        else setKmFinal('')
      }
    }
  }

  async function fetchContratos() {
    const [{ data: todos }, { data: jaUsados }] = await Promise.all([
      supabase.from('contratos')
        .select('id, contrato, fat_bruto, cliente, origem, destino')
        .order('created_at', { ascending: false }).limit(200),
      supabase.from('fechamento_contratos').select('contrato_id')
    ])
    if (!todos) return
    const idsUsados = new Set(jaUsados?.map(u => u.contrato_id) || [])
    setContratosDisponiveis(todos.filter(c => !idsUsados.has(c.id)))
  }

  // ─── Effects ─────────────────────────────────────────────────────────────

  useEffect(() => {
    fetchMotoristas()
  }, [])

  // ✅ Refaz a busca de motoristas sempre que a aba volta a ficar
  // visível — não importa se ficou escondida 1 minuto ou várias horas.
  // Motivo: o navegador pode PAUSAR de verdade timers e conexões de
  // rede quando a aba fica muito tempo em segundo plano — inclusive o
  // próprio timeout de segurança que protege essa busca pode ficar
  // pausado junto, então confiar na tentativa antiga não é seguro.
  // Em vez de tentar blindar contra isso, a solução mais confiável é
  // simplesmente iniciar uma tentativa NOVA toda vez que a aba volta,
  // usando o fetchMotoristas() que já trata erro e mostra "Tentar de
  // novo" se precisar — assim nunca fica preso numa tentativa velha e
  // esquecida pelo navegador.
  useEffect(() => {
    function handleVisibilidade() {
      if (!document.hidden) {
        // Ao retornar de uma aba suspensa, deixa o Supabase restaurar ou
        // renovar a sessão antes de refazer a consulta dos motoristas.
        void comTimeout(supabase.auth.getSession(), 8_000)
          .catch(error => console.warn('Não foi possível revalidar a sessão:', error))
          .finally(() => {
            if (montadoRef.current && !document.hidden) void fetchMotoristas()
          })
      }
    }

    function handleOnline() {
      if (montadoRef.current) void fetchMotoristas()
    }

    document.addEventListener('visibilitychange', handleVisibilidade)
    window.addEventListener('online', handleOnline)
    return () => {
      montadoRef.current = false
      document.removeEventListener('visibilitychange', handleVisibilidade)
      window.removeEventListener('online', handleOnline)
    }
  }, [])

  useEffect(() => {
    if (abaAtiva === 'historico') fetchHistorico()
  }, [abaAtiva])

  // Effect 1: quando motorista muda → busca caminhão, KM e contratos
  useEffect(() => {
    if (!motoristaId) {
      setCaminhao(null); setCaminhaoBase(null)
      setContratosDisponiveis([]); setMotoristaNome('')
      setKmInicial(''); setKmFinal(''); setIsSubstituto(false)
      return
    }
    const mot = motoristas.find(m => m.id === motoristaId)
    if (!mot) return
    setMotoristaNome(mot.nome)

    async function init() {
  if (!mot) return  // ← guard extra para o TypeScript

  const orFilter = mot.caminhao_id
    ? `id.eq.${mot.caminhao_id},motorista_atual.eq.${mot.nome}`
    : `motorista_atual.eq.${mot.nome}`

  const { data: cam } = await supabase
    .from('caminhoes')
    .select('id, placa')
    .or(orFilter)
    .maybeSingle()

  if (!cam) return

  setCaminhao(cam)
  setCaminhaoBase(cam)
  setIsSubstituto(false)

  await Promise.all([buscarKmInicial(cam.id), fetchContratos()])
}

    init()
  }, [motoristaId, motoristas])

  // Effect 2: só checa manutenção quando data de início muda
  useEffect(() => {
    if (!caminhaoBase) return
    if (!dataInicio) {
      setCaminhao(caminhaoBase); setIsSubstituto(false); return
    }

    async function checkManutencao() {
      const { data: manut } = await supabase
        .from('manutencoes')
        .select('caminhao_substituto_id, caminhao_substituto_placa, data_saida')
        .eq('caminhao_id', caminhaoBase!.id)
        .eq('status', 'EM ANDAMENTO')
        .lte('data_entrada', dataInicio)
        .not('caminhao_substituto_id', 'is', null)
        .maybeSingle()

      if (manut?.caminhao_substituto_id) {
        setCaminhao({ id: manut.caminhao_substituto_id, placa: manut.caminhao_substituto_placa || '' })
        setIsSubstituto(true)
      } else {
        setCaminhao(caminhaoBase)
        setIsSubstituto(false)
      }
    }

    checkManutencao()
  }, [dataInicio, caminhaoBase])

  // ✅ Effect 2.5: fechamento retroativo — checa se, na data da SAÍDA
  // da viagem, o caminhão estava com um motorista DIFERENTE do que
  // está selecionado agora. Isso resolve o caso de fazer fechamento
  // de meses atrás onde o motorista já trocou de caminhão desde então
  // — sem isso, o sistema silenciosamente assumia que o motorista
  // atual sempre foi quem dirigiu, o que é errado em fechamento
  // retroativo. Só avisa e sugere — não troca sozinho, porque trocar
  // o motorista automaticamente re-dispara toda a cadeia de busca de
  // caminhão/contratos, o que poderia confundir mais do que ajudar.
  useEffect(() => {
    setMotoristaHistorico(null)
    if (!caminhao?.id || !dataInicio || !motoristaNome) return

    async function checkHistorico() {
      const { data } = await supabase
        .from('historico_motorista_caminhao')
        .select('motorista_nome')
        .eq('caminhao_id', caminhao!.id)
        .lte('data_inicio', dataInicio)
        .or(`data_fim.is.null,data_fim.gte.${dataInicio}`)
        .order('data_inicio', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (data?.motorista_nome && data.motorista_nome !== motoristaNome) {
        setMotoristaHistorico(data.motorista_nome)
      }
    }

    checkHistorico()
  }, [caminhao?.id, dataInicio, motoristaNome])

  // Troca o motorista selecionado pelo motorista histórico sugerido
  function usarMotoristaHistorico() {
    if (!motoristaHistorico) return
    const mot = motoristas.find(m => m.nome === motoristaHistorico)
    if (mot) {
      setMotoristaId(mot.id)
      setMotoristaHistorico(null)
    }
  }

 // Effect 3: abastecimentos por período — filtra os já usados em fechamentos anteriores
useEffect(() => {
  if (!caminhao?.id || !abastDataInicio || !abastDataFim) {
    setAbastecimentos([]); setAbastSelecionados(new Set()); return
  }
  setCarregandoAbast(true); setErro('')

  Promise.all([
    supabase.from('abastecimentos')
      .select('id, data, posto, litros_combustivel, litros_arla, total, km')
      .eq('caminhao_id', caminhao.id)
      .gte('data', abastDataInicio)
      .lte('data', abastDataFim)
      .order('data'),
    supabase.from('fechamento_abastecimentos').select('abastecimento_id')
  ])
    .then(([{ data, error }, { data: jaUsados }]) => {
      if (error) { setErro('Erro: ' + error.message); return }
      const idsUsados = new Set(jaUsados?.map(u => u.abastecimento_id) || [])
      const lista = (data || []).filter(a => !idsUsados.has(a.id))
      setAbastecimentos(lista)
      setAbastSelecionados(new Set(lista.map(a => a.id)))
    })
    .catch(e => setErro('Erro ao carregar abastecimentos: ' + e.message))
    .finally(() => setCarregandoAbast(false)) // ← garante que o spinner sempre para
}, [caminhao?.id, abastDataInicio, abastDataFim])

  // Effect 4: KM final automático dos abastecimentos selecionados
  useEffect(() => {
    if (abastAtivos.length > 0) {
      const kms = abastAtivos.map(a => a.km).filter((k): k is number => !!k && k > 0)
      if (kms.length > 0) setKmFinal(String(Math.max(...kms)))
    }
  }, [abastecimentos, abastSelecionados])

  // ─── Handlers ────────────────────────────────────────────────────────────

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
        .from('fechamento_viagens').select('*').order('created_at', { ascending: false })
      if (errorFech) throw errorFech

      const [{ data: mots }, { data: cams }] = await Promise.all([
        supabase.from('motoristas').select('id, nome'),
        supabase.from('caminhoes').select('id, placa')
      ])

      const { data: relContratos } = await supabase
        .from('fechamento_contratos')
        .select('fechamento_id, contrato:contrato_id(contrato, origem, destino, fat_bruto)')

      const fechIds = (fechamentos || []).map(f => f.id)
      const { data: relAbast } = await supabase
        .from('fechamento_abastecimentos')
        .select('fechamento_id, abastecimento:abastecimento_id(litros_combustivel, total)')
        .in('fechamento_id', fechIds)

      const litrosPorFech: Record<string, number> = {}
      const valorPorFech: Record<string, number>  = {}
      relAbast?.forEach((fa: any) => {
        litrosPorFech[fa.fechamento_id] = (litrosPorFech[fa.fechamento_id] || 0) + (fa.abastecimento?.litros_combustivel || 0)
        valorPorFech[fa.fechamento_id]  = (valorPorFech[fa.fechamento_id]  || 0) + (fa.abastecimento?.total || 0)
      })

      const formatado = (fechamentos || []).map(f => {
        const mot   = mots?.find(m => m.id === f.motorista_id)
        const cam   = cams?.find(c => c.id === f.caminhao_id)
        const conts = relContratos?.filter(rc => rc.fechamento_id === f.id) || []
        const totalFreteRecalculado  = f.total_frete || conts.reduce((t, c: any) => t + Number(c.contrato?.fat_bruto || 0), 0)
        const totalLitrosRecalculado = (f.total_litros && f.total_litros > 0) ? f.total_litros : (litrosPorFech[f.id] || 0)
        return {
          ...f,
          total_litros: totalLitrosRecalculado,
          total_abastecimento: (f.total_abastecimento && f.total_abastecimento > 0) ? f.total_abastecimento : (valorPorFech[f.id] || 0),
          total_frete: totalFreteRecalculado,
          comissao_motorista: f.comissao_motorista || totalFreteRecalculado * 0.10,
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
        .from('fechamento_viagens').insert({
          motorista_id: motoristaId, caminhao_id: caminhao.id,
          data_inicio: dataInicio, data_fim: dataFim,
          km_inicial: Number(kmInicial), km_final: Number(kmFinal),
          // ✅ Campo "Vencimento" removido do formulário e do histórico.
          // Mantido aqui só como fallback (usa a data de retorno da
          // viagem) caso a coluna no banco ainda seja obrigatória —
          // não aparece mais em lugar nenhum da interface.
          data_vencimento: dataFim,
          total_litros: resumo.litros, total_abastecimento: resumo.valor,
          total_frete: resumo.frete, comissao_motorista: resumo.comissao
        }).select().single()
      if (errorFech) throw errorFech

      await supabase.from('fechamento_contratos').insert(
        selecionados.map(c => ({ fechamento_id: fech.id, contrato_id: c.id }))
      )

      if (abastAtivos.length > 0) {
        await supabase.from('fechamento_abastecimentos').insert(
          abastAtivos.map(a => ({ fechamento_id: fech.id, abastecimento_id: a.id }))
        )
      }

      setSucesso(true)
      setTimeout(() => {
        setSucesso(false); setAbaAtiva('historico')
        setMotoristaId(''); setCaminhao(null); setCaminhaoBase(null); setSelecionados([])
        setAbastecimentos([]); setAbastSelecionados(new Set())
        setDataInicio(''); setDataFim(''); setKmInicial(''); setKmFinal('')
        // ✅ Fechamento salvo com sucesso — limpa todos os rascunhos
        // guardados, pra próxima vez começar limpo de verdade.
        limparDraft('fechamento_motoristaId')
        limparDraft('fechamento_dataInicio')
        limparDraft('fechamento_dataFim')
        limparDraft('fechamento_kmInicial')
        limparDraft('fechamento_kmFinal')
        limparDraft('fechamento_abastDataInicio')
        limparDraft('fechamento_abastDataFim')
        limparDraft('fechamento_selecionados')
      }, 1500)
    } catch (e: any) {
      setErro('Erro ao salvar: ' + e.message)
    } finally {
      setSalvando(false)
    }
  }

  async function excluir(id: string) {
    await Promise.all([
      supabase.from('fechamento_contratos').delete().eq('fechamento_id', id),
      supabase.from('fechamento_abastecimentos').delete().eq('fechamento_id', id)
    ])
    const { error } = await supabase.from('fechamento_viagens').delete().eq('id', id)
    if (error) setErro('Erro ao excluir: ' + error.message)
    else { setExcluindoId(null); fetchHistorico() }
  }

  async function salvarEdicao() {
    if (!editando) return
    setSalvando(true)
    const { error } = await supabase.from('fechamento_viagens').update({
      data_inicio: editando.data_inicio, data_fim: editando.data_fim,
      km_inicial: Number(editando.km_inicial), km_final: Number(editando.km_final)
    }).eq('id', editando.id)
    if (error) setErro('Erro ao atualizar: ' + error.message)
    else { setEditando(null); fetchHistorico() }
    setSalvando(false)
  }

  function exportarCSV() {
    const headers = ['Data Lançamento','Motorista','Placa','Início','Fim','KM Inicial','KM Final','KM Rodado','Litros','Média','Total Frete','Comissão']
    const rows = historicoFiltrado.map(h => {
      const km = (h.km_final || 0) - (h.km_inicial || 0)
      const litros = h.total_litros || 0
      return [
        new Date(h.created_at).toLocaleDateString('pt-BR'), h.motorista.nome, h.caminhao.placa,
        fmtData(h.data_inicio), fmtData(h.data_fim), h.km_inicial, h.km_final, km, litros,
        km > 0 && litros > 0 ? (km / litros).toFixed(2) : '0',
        h.total_frete || 0, h.comissao_motorista || 0
      ]
    })
    const csv = [headers, ...rows].map(e => e.join(';')).join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `fechamentos_${new Date().toISOString().split('T')[0]}.csv`)
    link.click()
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 bg-gray-50 min-h-screen">

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
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
      </div>

      {abaAtiva === 'novo' ? (
        <>
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
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-xs font-bold text-gray-600 uppercase tracking-wider">
                      <User size={14} className="text-red-600"/> Motorista
                    </label>
                    {erroMotoristas ? (
                      <div className="flex items-center gap-2 bg-red-50 border-2 border-red-100 rounded-xl px-4 py-3">
                        <AlertCircle size={16} className="text-red-500 shrink-0"/>
                        <span className="text-xs font-bold text-red-600 flex-1">{erroMotoristas}</span>
                        <button onClick={fetchMotoristas}
                          className="flex items-center gap-1 text-xs font-black text-red-600 hover:text-red-800 uppercase whitespace-nowrap">
                          <RefreshCw size={12}/> Tentar de novo
                        </button>
                      </div>
                    ) : (
                      <select value={motoristaId} disabled={carregandoMotoristas}
                        onChange={e => {
                          setMotoristaId(e.target.value)
                          setSelecionados([]); setAbastecimentos([]); setAbastSelecionados(new Set())
                          setKmInicial(''); setKmFinal(''); setDataInicio('')
                        }}
                        className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 text-sm font-bold focus:border-red-500 focus:bg-white outline-none transition-all disabled:opacity-50">
                        <option value="">{carregandoMotoristas ? 'Carregando motoristas...' : 'Selecione o motorista'}</option>
                        {motoristas.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
                      </select>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-xs font-bold text-gray-600 uppercase tracking-wider">
                      <Truck size={14} className="text-red-600"/> Placa do Caminhão
                    </label>
                    <div className={`w-full border-2 rounded-xl px-4 py-3 text-sm font-black flex items-center justify-between
                      ${isSubstituto ? 'bg-blue-50 border-blue-100 text-blue-700' : 'bg-red-50 border-red-100 text-red-700'}`}>
                      <div className="flex items-center gap-2">
                        {caminhao ? caminhao.placa : 'Aguardando...'}
                        {isSubstituto && (
                          <span className="text-[9px] bg-blue-600 text-white px-1.5 py-0.5 rounded uppercase">Substituto</span>
                        )}
                      </div>
                      {caminhao && <CheckCircle2 size={16} className={isSubstituto ? 'text-blue-500' : 'text-red-500'}/>}
                    </div>
                    {isSubstituto && (
                      <p className="text-[10px] text-blue-500 font-bold">🔧 Caminhão em manutenção — usando substituto automaticamente</p>
                    )}
                  </div>
                </div>

                {motoristaHistorico && (
                  <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
                    <p className="text-xs text-orange-700 font-bold">
                      🕐 Nessa data ({fmtData(dataInicio)}), esse caminhão estava com <strong>{motoristaHistorico}</strong>, não com {motoristaNome}.
                    </p>
                    <button onClick={usarMotoristaHistorico}
                      className="shrink-0 bg-orange-600 hover:bg-orange-700 text-white text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-lg transition-all">
                      Usar {motoristaHistorico}
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-gray-50">
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
                      KM Inicial {kmInicial && <span className="text-green-500 text-[9px]">● auto</span>}
                    </label>
                    <input type="number" value={kmInicial} onChange={e => setKmInicial(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs font-bold outline-none focus:border-red-500"/>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-gray-500 uppercase">KM Final</label>
                    <input type="number" value={kmFinal} onChange={e => setKmFinal(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs font-bold outline-none focus:border-red-500"/>
                  </div>
                </div>

                {kmInicial && kmFinal && Number(kmFinal) > Number(kmInicial) && (
                  <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5">
                    <p className="text-xs text-blue-700">
                      Distância: <strong>{(Number(kmFinal) - Number(kmInicial)).toLocaleString('pt-BR')} km</strong>
                      {resumo.mediaKmL > 0 && <span className="ml-3">Média: <strong>{fmt(resumo.mediaKmL)} km/L</strong></span>}
                    </p>
                  </div>
                )}
              </div>

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
                    <div className="flex items-center justify-center py-10">
                      <div className="w-5 h-5 border-2 border-red-600 border-t-transparent rounded-full animate-spin"/>
                    </div>
                  ) : abastecimentos.length === 0 ? (
                    <div className="text-center py-10">
                      <Fuel size={28} className="mx-auto text-gray-200 mb-2"/>
                      <p className="text-sm text-gray-400">Nenhum abastecimento disponível no período.</p>
                      <p className="text-xs text-gray-300 mt-1">Abastecimentos já utilizados em fechamentos anteriores não são exibidos.</p>
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
                              {a.km && <span className="bg-gray-50 px-2 py-1 rounded border text-[10px] font-black text-gray-500">KM: {a.km.toLocaleString('pt-BR')}</span>}
                            </div>
                          </label>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

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
                      className="w-full p-4 text-left bg-white border border-gray-100 rounded-2xl hover:border-red-200 hover:bg-red-50/50 transition-all shadow-sm">
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

          <div className="flex flex-col md:flex-row items-center justify-between gap-6 pt-8 border-t border-gray-200">
            <div className="flex-1 text-sm font-bold">
              {erro    && <span className="text-red-600">⚠️ {erro}</span>}
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
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"/>
              <input type="text" placeholder="Pesquisar motorista ou placa..." value={buscaHistorico}
                onChange={e => setBuscaHistorico(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-red-500 text-sm font-medium"/>
            </div>
            <button onClick={exportarCSV}
              className="flex items-center gap-2 bg-green-600 text-white px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-green-700 transition-all">
              <Download size={16}/> Exportar CSV
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100">
                  {['Data Lançamento','Motorista / Placa','Período / KM',''].map(h => (
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
                  <tr key={h.id} className="hover:bg-gray-50/50 transition-colors group cursor-pointer" onClick={() => setVisualizando(h)}>
                    <td className="px-6 py-4 text-xs font-bold text-gray-500">{new Date(h.created_at).toLocaleDateString('pt-BR')}</td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-black text-gray-900">{h.motorista?.nome || '—'}</p>
                      <p className="text-[10px] font-bold text-red-600">{h.caminhao?.placa || '—'}</p>
                    </td>
                    <td className="px-6 py-4">
                      {editando?.id === h.id ? (
                        <div className="flex flex-col gap-2" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center gap-1">
                            <input type="date" value={editando.data_inicio} onChange={e => setEditando({...editando, data_inicio: e.target.value})} className="text-[10px] border rounded p-1"/>
                            <span className="text-gray-400">→</span>
                            <input type="date" value={editando.data_fim} onChange={e => setEditando({...editando, data_fim: e.target.value})} className="text-[10px] border rounded p-1"/>
                          </div>
                          <div className="flex items-center gap-1">
                            <input type="number" placeholder="KM Ini" value={editando.km_inicial} onChange={e => setEditando({...editando, km_inicial: Number(e.target.value)})} className="text-[10px] border rounded p-1 w-20"/>
                            <input type="number" placeholder="KM Fim" value={editando.km_final} onChange={e => setEditando({...editando, km_final: Number(e.target.value)})} className="text-[10px] border rounded p-1 w-20"/>
                          </div>
                          <div className="flex items-center gap-2">
                            <button onClick={salvarEdicao} className="text-green-600"><CheckCircle2 size={14}/></button>
                            <button onClick={() => setEditando(null)} className="text-red-600"><X size={14}/></button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className="text-xs font-bold text-gray-600">{fmtData(h.data_inicio)} → {fmtData(h.data_fim)}</p>
                          <p className="text-[10px] text-gray-400 font-bold">{h.km_inicial?.toLocaleString()} → {h.km_final?.toLocaleString()} km</p>
                        </>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        {editando?.id !== h.id && (
                          <button onClick={() => setEditando(h)}
                            className="p-2 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all">
                            <Edit2 size={16}/>
                          </button>
                        )}
                        <button onClick={() => setExcluindoId(h.id)}
                          className="p-2 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all">
                          <X size={16}/>
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
              <div className="pt-4 border-t border-gray-100">
                <p className="text-[10px] font-black text-gray-400 uppercase">Período</p>
                <p className="text-sm font-bold text-gray-700">{fmtData(visualizando.data_inicio)} → {fmtData(visualizando.data_fim)}</p>
              </div>
              <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-100">
                <div className="bg-gray-50 p-3 rounded-xl">
                  <p className="text-[9px] font-black text-gray-400 uppercase">KM Rodado</p>
                  <p className="text-sm font-black">{((visualizando.km_final || 0) - (visualizando.km_inicial || 0)).toLocaleString('pt-BR')} km</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-xl">
                  <p className="text-[9px] font-black text-gray-400 uppercase">Combustível</p>
                  <p className="text-sm font-black">{fmt(visualizando.total_litros || 0)} L</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-xl">
                  <p className="text-[9px] font-black text-gray-400 uppercase">Média</p>
                  <p className="text-sm font-black">
                    {(visualizando.total_litros || 0) > 0 && ((visualizando.km_final || 0) - (visualizando.km_inicial || 0)) > 0
                      ? fmt(((visualizando.km_final || 0) - (visualizando.km_inicial || 0)) / visualizando.total_litros!)
                      : '—'} km/L
                  </p>
                </div>
              </div>
              <div className="pt-4 border-t border-gray-100">
                <p className="text-[10px] font-black text-gray-400 uppercase mb-3">Contratos Vinculados</p>
                <div className="space-y-2">
                  {visualizando.contratos?.map((c: any, i: number) => (
                    <div key={i} className="flex items-center justify-between bg-gray-50 p-3 rounded-xl border border-gray-100">
                      <span className="text-xs font-black text-gray-900">#{c.contrato?.contrato}</span>
                      <span className="text-xs font-bold text-gray-500">
                        {c.contrato?.origem} → {c.contrato?.destino}
                        <span className="ml-2 text-green-600 font-black">(R$ {fmt(c.contrato?.fat_bruto || 0)})</span>
                      </span>
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

      {excluindoId && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 text-center">
            <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle size={32}/>
            </div>
            <h3 className="text-xl font-black text-gray-900 uppercase tracking-tighter mb-2">Excluir Fechamento?</h3>
            <p className="text-sm text-gray-500 font-bold mb-8">Esta ação não pode ser desfeita.</p>
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
