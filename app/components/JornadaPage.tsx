'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../services/supabase'
import { useAuth } from '../services/auth'
import { normalizarPlaca } from '../services/placas'
import * as XLSX from 'xlsx'
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock3,
  Download,
  Edit3,
  History,
  Loader2,
  Plus,
  Save,
  Search,
  Trash2,
  Truck,
  User,
  X,
} from 'lucide-react'

type Motorista = { id: string; nome: string; ativo?: boolean | null }
type Caminhao = { id: string; placa: string; modelo?: string | null }
type Viagem = {
  id: string
  motorista?: string | null
  caminhao_id?: string | null
  caminhao_placa?: string | null
  status?: string | null
}
type JornadaEvento = {
  id: string
  jornada_id: string
  tipo_evento: string
  inicio: string
  fim: string | null
  observacao: string | null
  created_at?: string
}
type JornadaAjuste = {
  id: string
  tipo_ajuste: string
  descricao: string
  usuario_nome: string | null
  usuario_email: string | null
  created_at: string
}
type Jornada = {
  id: string
  motorista_id: string
  caminhao_id: string
  viagem_id: string | null
  data: string
  inicio: string
  fim: string | null
  status: 'aberta' | 'encerrada' | 'ajustada' | string
  observacoes: string | null
  created_at?: string
  eventos: JornadaEvento[]
}

type FormJornada = {
  motoristaId: string
  caminhaoId: string
  viagemId: string
  data: string
  inicio: string
  fim: string
  status: string
  observacoes: string
}

type FormEvento = {
  id: string
  tipo: string
  inicio: string
  fim: string
  observacao: string
}

const EVENTOS = [
  { value: 'direcao', label: 'Direção' },
  { value: 'refeicao', label: 'Refeição' },
  { value: 'descanso', label: 'Descanso' },
  { value: 'espera', label: 'Espera' },
  { value: 'carregamento', label: 'Carregamento' },
  { value: 'descarregamento', label: 'Descarregamento' },
]

const STATUS = [
  { value: 'aberta', label: 'Aberta' },
  { value: 'encerrada', label: 'Encerrada' },
  { value: 'ajustada', label: 'Ajustada' },
]

const INPUT = 'mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-gray-50'
const LABEL = 'text-xs font-semibold text-gray-500 uppercase tracking-wide'

function dataLocalHoje() {
  const agora = new Date()
  const ajuste = new Date(agora.getTime() - agora.getTimezoneOffset() * 60000)
  return ajuste.toISOString().slice(0, 10)
}

function dataHoraLocalAgora() {
  const agora = new Date()
  const ajuste = new Date(agora.getTime() - agora.getTimezoneOffset() * 60000)
  return ajuste.toISOString().slice(0, 16)
}

function paraInputDataHora(valor: string | null | undefined) {
  if (!valor) return ''
  const data = new Date(valor)
  if (Number.isNaN(data.getTime())) return valor.slice(0, 16)
  const ajuste = new Date(data.getTime() - data.getTimezoneOffset() * 60000)
  return ajuste.toISOString().slice(0, 16)
}

function paraIso(valor: string) {
  return valor ? new Date(valor).toISOString() : null
}

function formatarData(valor: string | null | undefined) {
  if (!valor) return '—'
  const partes = valor.slice(0, 10).split('-')
  if (partes.length !== 3) return valor
  return `${partes[2]}/${partes[1]}/${partes[0]}`
}

function formatarDataHora(valor: string | null | undefined) {
  if (!valor) return '—'
  const data = new Date(valor)
  if (Number.isNaN(data.getTime())) return valor
  return data.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

function formatarHora(valor: string | null | undefined) {
  if (!valor) return '—'
  const data = new Date(valor)
  if (Number.isNaN(data.getTime())) return valor
  return data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function nomeEvento(tipo: string) {
  return EVENTOS.find(evento => evento.value === tipo)?.label || tipo
}

function classeStatus(status: string) {
  if (status === 'encerrada') return 'bg-green-100 text-green-700'
  if (status === 'ajustada') return 'bg-blue-100 text-blue-700'
  return 'bg-yellow-100 text-yellow-700'
}

function jornadaVazia(): FormJornada {
  return {
    motoristaId: '',
    caminhaoId: '',
    viagemId: '',
    data: dataLocalHoje(),
    inicio: '',
    fim: '',
    status: 'aberta',
    observacoes: '',
  }
}

function eventoVazio(): FormEvento {
  return { id: '', tipo: 'direcao', inicio: '', fim: '', observacao: '' }
}

export default function JornadaPage() {
  const { perm, user, email } = useAuth()
  const [motoristas, setMotoristas] = useState<Motorista[]>([])
  const [caminhoes, setCaminhoes] = useState<Caminhao[]>([])
  const [viagens, setViagens] = useState<Viagem[]>([])
  const [jornadas, setJornadas] = useState<Jornada[]>([])
  const [selecionada, setSelecionada] = useState<Jornada | null>(null)
  const [ajustes, setAjustes] = useState<JornadaAjuste[]>([])
  const [formJornada, setFormJornada] = useState<FormJornada>(jornadaVazia())
  const [formEvento, setFormEvento] = useState<FormEvento>(eventoVazio())
  const [editandoJornada, setEditandoJornada] = useState(false)
  const [mostraNova, setMostraNova] = useState(false)
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [salvandoEvento, setSalvandoEvento] = useState(false)
  const [msg, setMsg] = useState('')
  const [erro, setErro] = useState('')
  const [busca, setBusca] = useState('')
  const [filtroMotorista, setFiltroMotorista] = useState('')
  const [filtroCaminhao, setFiltroCaminhao] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')
  const [filtroInicio, setFiltroInicio] = useState('')
  const [filtroFim, setFiltroFim] = useState('')

  useEffect(() => {
    if (perm === 'total') void carregarBase()
  }, [perm])

  function mostrarMensagem(texto: string) {
    setMsg(texto)
    window.setTimeout(() => setMsg(''), 4500)
  }

  async function carregarBase() {
    setLoading(true)
    setErro('')
    const [motoristasResult, caminhoesResult, viagensResult] = await Promise.all([
      supabase.from('motoristas').select('id, nome, ativo').eq('ativo', true).order('nome'),
      supabase.from('caminhoes').select('id, placa, modelo').order('placa'),
      supabase.from('viagens').select('id, motorista, caminhao_id, caminhao_placa, status'),
    ])

    if (motoristasResult.error || caminhoesResult.error || viagensResult.error) {
      setErro('Não foi possível carregar motoristas, caminhões ou viagens. Confira se o SQL da Gestão de Jornada já foi executado e tente novamente.')
    }
    setMotoristas(motoristasResult.data || [])
    setCaminhoes((caminhoesResult.data || []).map(caminhao => ({ ...caminhao, placa: normalizarPlaca(caminhao.placa) })))
    setViagens(viagensResult.data || [])
    await carregarJornadas()
    setLoading(false)
  }

  async function carregarJornadas(): Promise<Jornada[]> {
    const { data, error } = await supabase
      .from('jornadas')
      .select('*')
      .order('data', { ascending: true })
      .order('inicio', { ascending: true })

    if (error) {
      setErro('A tabela de jornadas ainda não está disponível. Execute o SQL fornecido antes de usar esta tela.')
      setJornadas([])
      return []
    }

    const registros = (data || []) as Jornada[]
    const ids = registros.map(jornada => jornada.id)
    let eventos: JornadaEvento[] = []
    if (ids.length > 0) {
      const eventosResult = await supabase
        .from('jornada_eventos')
        .select('*')
        .in('jornada_id', ids)
        .order('inicio', { ascending: true })
      if (!eventosResult.error) eventos = (eventosResult.data || []) as JornadaEvento[]
    }

    const jornadasComEventos = registros.map(jornada => ({
      ...jornada,
      eventos: eventos.filter(evento => evento.jornada_id === jornada.id),
    }))
    setJornadas(jornadasComEventos)
    return jornadasComEventos
  }

  async function carregarAjustes(jornadaId: string) {
    const { data } = await supabase
      .from('jornada_ajustes')
      .select('id, tipo_ajuste, descricao, usuario_nome, usuario_email, created_at')
      .eq('jornada_id', jornadaId)
      .order('created_at', { ascending: true })
    setAjustes((data || []) as JornadaAjuste[])
  }

  function abrirNova() {
    setSelecionada(null)
    setAjustes([])
    setFormJornada(jornadaVazia())
    setFormEvento(eventoVazio())
    setEditandoJornada(false)
    setMostraNova(true)
    setErro('')
  }

  function abrirJornada(jornada: Jornada) {
    setSelecionada(jornada)
    setMostraNova(false)
    setEditandoJornada(false)
    setFormEvento(eventoVazio())
    setFormJornada({
      motoristaId: jornada.motorista_id,
      caminhaoId: jornada.caminhao_id,
      viagemId: jornada.viagem_id || '',
      data: jornada.data,
      inicio: paraInputDataHora(jornada.inicio),
      fim: paraInputDataHora(jornada.fim),
      status: jornada.status,
      observacoes: jornada.observacoes || '',
    })
    void carregarAjustes(jornada.id)
  }

  function voltarLista() {
    setSelecionada(null)
    setMostraNova(false)
    setEditandoJornada(false)
    setAjustes([])
    setFormEvento(eventoVazio())
  }

  async function registrarAjuste(jornadaId: string, tipo: string, descricao: string, anterior: unknown, novo: unknown) {
    const { error } = await supabase.from('jornada_ajustes').insert({
      jornada_id: jornadaId,
      tipo_ajuste: tipo,
      descricao,
      usuario_nome: user || null,
      usuario_email: email || null,
      valor_anterior: anterior,
      valor_novo: novo,
    })
    return error
  }

  async function salvarJornada() {
    if (!formJornada.motoristaId || !formJornada.caminhaoId || !formJornada.data || !formJornada.inicio) {
      setErro('Informe motorista, caminhão, data e início da jornada.')
      return
    }

    setSalvando(true)
    setErro('')
    const payload = {
      motorista_id: formJornada.motoristaId,
      caminhao_id: formJornada.caminhaoId,
      viagem_id: formJornada.viagemId || null,
      data: formJornada.data,
      inicio: paraIso(formJornada.inicio),
      fim: paraIso(formJornada.fim),
      status: formJornada.status,
      observacoes: formJornada.observacoes.trim() || null,
    }

    let jornadaId = selecionada?.id || ''
    let erroAjuste = null
    if (selecionada && editandoJornada) {
      const resultado = await supabase.from('jornadas').update(payload).eq('id', selecionada.id).select('*').single()
      if (resultado.error) {
        setErro('Não foi possível atualizar a jornada: ' + resultado.error.message)
        setSalvando(false)
        return
      }
      jornadaId = selecionada.id
      erroAjuste = await registrarAjuste(
        jornadaId,
        'jornada_atualizada',
        'Dados principais da jornada alterados pelo administrador.',
        {
          motorista_id: selecionada.motorista_id,
          caminhao_id: selecionada.caminhao_id,
          viagem_id: selecionada.viagem_id,
          data: selecionada.data,
          inicio: selecionada.inicio,
          fim: selecionada.fim,
          status: selecionada.status,
          observacoes: selecionada.observacoes,
        },
        payload,
      )
    } else {
      const resultado = await supabase.from('jornadas').insert(payload).select('*').single()
      if (resultado.error || !resultado.data) {
        setErro('Não foi possível criar a jornada: ' + (resultado.error?.message || 'resposta vazia'))
        setSalvando(false)
        return
      }
      jornadaId = resultado.data.id
    }

    const jornadasAtualizadas = await carregarJornadas()
    const atualizada = jornadasAtualizadas.find(jornada => jornada.id === jornadaId)
    if (atualizada) abrirJornada(atualizada)
    else setMostraNova(false)
    setEditandoJornada(false)
    mostrarMensagem(erroAjuste ? 'Jornada salva, mas não foi possível registrar o histórico do ajuste.' : selecionada ? 'Jornada atualizada.' : 'Jornada criada.')
    setSalvando(false)
  }

  function editarJornada() {
    if (!selecionada) return
    setEditandoJornada(true)
    setMostraNova(false)
  }

  async function salvarEvento() {
    if (!selecionada || !formEvento.tipo || !formEvento.inicio) {
      setErro('Informe o tipo e o início do evento.')
      return
    }

    setSalvandoEvento(true)
    setErro('')
    const payload = {
      jornada_id: selecionada.id,
      tipo_evento: formEvento.tipo,
      inicio: paraIso(formEvento.inicio),
      fim: paraIso(formEvento.fim),
      observacao: formEvento.observacao.trim() || null,
    }

    if (formEvento.id) {
      const eventoAnterior = selecionada.eventos.find(evento => evento.id === formEvento.id)
      const { error } = await supabase.from('jornada_eventos').update(payload).eq('id', formEvento.id)
      if (error) {
        setErro('Não foi possível atualizar o evento: ' + error.message)
        setSalvandoEvento(false)
        return
      }
      await registrarAjuste(
        selecionada.id,
        'evento_atualizado',
        `Evento ${nomeEvento(formEvento.tipo)} alterado pelo administrador.`,
        eventoAnterior || null,
        payload,
      )
      mostrarMensagem('Evento atualizado.')
    } else {
      const { error } = await supabase.from('jornada_eventos').insert(payload)
      if (error) {
        setErro('Não foi possível adicionar o evento: ' + error.message)
        setSalvandoEvento(false)
        return
      }
      mostrarMensagem('Evento adicionado.')
    }

    setFormEvento(eventoVazio())
    const jornadasAtualizadas = await carregarJornadas()
    const atualizada = jornadasAtualizadas.find(jornada => jornada.id === selecionada.id)
    if (atualizada) {
      setSelecionada(atualizada)
      await carregarAjustes(atualizada.id)
    }
    setSalvandoEvento(false)
  }

  function editarEvento(evento: JornadaEvento) {
    setFormEvento({
      id: evento.id,
      tipo: evento.tipo_evento,
      inicio: paraInputDataHora(evento.inicio),
      fim: paraInputDataHora(evento.fim),
      observacao: evento.observacao || '',
    })
  }

  async function excluirEvento(evento: JornadaEvento) {
    if (!selecionada || !window.confirm(`Excluir o evento ${nomeEvento(evento.tipo_evento)}?`)) return
    const { error } = await supabase.from('jornada_eventos').delete().eq('id', evento.id)
    if (error) {
      setErro('Não foi possível excluir o evento: ' + error.message)
      return
    }
    await registrarAjuste(
      selecionada.id,
      'evento_excluido',
      `Evento ${nomeEvento(evento.tipo_evento)} excluído pelo administrador.`,
      evento,
      null,
    )
    setFormEvento(eventoVazio())
    const jornadasAtualizadas = await carregarJornadas()
    const atualizada = jornadasAtualizadas.find(jornada => jornada.id === selecionada.id)
    if (atualizada) {
      setSelecionada(atualizada)
      await carregarAjustes(atualizada.id)
    }
    mostrarMensagem('Evento excluído.')
  }

  const jornadasFiltradas = useMemo(() => {
    const texto = busca.trim().toLowerCase()
    return [...jornadas]
      .filter(jornada => {
        const motorista = motoristas.find(item => item.id === jornada.motorista_id)
        const caminhao = caminhoes.find(item => item.id === jornada.caminhao_id)
        const correspondeTexto = !texto || motorista?.nome.toLowerCase().includes(texto) || normalizarPlaca(caminhao?.placa || '').toLowerCase().includes(texto)
        const correspondeMotorista = !filtroMotorista || jornada.motorista_id === filtroMotorista
        const correspondeCaminhao = !filtroCaminhao || jornada.caminhao_id === filtroCaminhao
        const correspondeStatus = !filtroStatus || jornada.status === filtroStatus
        const correspondeInicio = !filtroInicio || jornada.data >= filtroInicio
        const correspondeFim = !filtroFim || jornada.data <= filtroFim
        return correspondeTexto && correspondeMotorista && correspondeCaminhao && correspondeStatus && correspondeInicio && correspondeFim
      })
      .sort((a, b) => `${a.data} ${a.inicio}`.localeCompare(`${b.data} ${b.inicio}`))
  }, [busca, caminhoes, filtroCaminhao, filtroFim, filtroInicio, filtroMotorista, filtroStatus, jornadas, motoristas])

  const viagensDisponiveis = useMemo(() => {
    if (!formJornada.motoristaId && !formJornada.caminhaoId) return viagens
    const motorista = motoristas.find(item => item.id === formJornada.motoristaId)
    return viagens.filter(viagem => {
      const porMotorista = !motorista || !viagem.motorista || viagem.motorista === motorista.nome
      const porCaminhao = !formJornada.caminhaoId || !viagem.caminhao_id || viagem.caminhao_id === formJornada.caminhaoId
      return porMotorista && porCaminhao
    })
  }, [formJornada.caminhaoId, formJornada.motoristaId, motoristas, viagens])

  const totalAbertas = jornadasFiltradas.filter(jornada => jornada.status === 'aberta').length
  const totalEncerradas = jornadasFiltradas.filter(jornada => jornada.status === 'encerrada').length
  const totalEventos = jornadasFiltradas.reduce((total, jornada) => total + jornada.eventos.length, 0)

  function exportarExcel() {
    if (jornadasFiltradas.length === 0) {
      mostrarMensagem('Não há jornadas para exportar com os filtros atuais.')
      return
    }
    const linhas = jornadasFiltradas.flatMap(jornada => {
      const motorista = motoristas.find(item => item.id === jornada.motorista_id)
      const caminhao = caminhoes.find(item => item.id === jornada.caminhao_id)
      const viagem = viagens.find(item => item.id === jornada.viagem_id)
      if (jornada.eventos.length === 0) {
        return [{
          Data: jornada.data,
          Motorista: motorista?.nome || '',
          Placa: normalizarPlaca(caminhao?.placa || ''),
          Viagem: viagem?.id || '',
          Status: jornada.status,
          'Início jornada': formatarDataHora(jornada.inicio),
          'Fim jornada': formatarDataHora(jornada.fim),
          Evento: '',
          'Início evento': '',
          'Fim evento': '',
          Observação: jornada.observacoes || '',
        }]
      }
      return jornada.eventos.map(evento => ({
        Data: jornada.data,
        Motorista: motorista?.nome || '',
        Placa: normalizarPlaca(caminhao?.placa || ''),
        Viagem: viagem?.id || '',
        Status: jornada.status,
        'Início jornada': formatarDataHora(jornada.inicio),
        'Fim jornada': formatarDataHora(jornada.fim),
        Evento: nomeEvento(evento.tipo_evento),
        'Início evento': formatarDataHora(evento.inicio),
        'Fim evento': formatarDataHora(evento.fim),
        Observação: evento.observacao || jornada.observacoes || '',
      }))
    })
    const planilha = XLSX.utils.json_to_sheet(linhas)
    planilha['!cols'] = [
      { wch: 12 }, { wch: 30 }, { wch: 12 }, { wch: 38 }, { wch: 14 },
      { wch: 20 }, { wch: 20 }, { wch: 18 }, { wch: 20 }, { wch: 20 }, { wch: 42 },
    ]
    planilha['!autofilter'] = { ref: `A1:K${linhas.length + 1}` }
    const livro = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(livro, planilha, 'Jornadas')
    XLSX.writeFile(livro, `gestao_jornada_${dataLocalHoje()}.xlsx`)
    mostrarMensagem(`Excel exportado com ${linhas.length} linha(s).`)
  }

  function nomeMotorista(id: string) {
    return motoristas.find(item => item.id === id)?.nome || 'Motorista não encontrado'
  }

  function placaCaminhao(id: string) {
    return normalizarPlaca(caminhoes.find(item => item.id === id)?.placa || '—')
  }

  if (perm !== 'total') {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <div className="bg-white border border-red-100 rounded-2xl p-6 text-center">
          <Clock3 className="mx-auto text-red-500 mb-3" size={32} />
          <h1 className="text-xl font-bold text-gray-900">Gestão de Jornada</h1>
          <p className="text-sm text-gray-500 mt-2">Esta área está disponível somente para administradores.</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="text-center text-gray-500">
          <Loader2 className="animate-spin mx-auto mb-3 text-red-600" size={32} />
          <p className="text-sm">Carregando gestão de jornada...</p>
        </div>
      </div>
    )
  }

  const renderFormJornada = (titulo: string) => (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-gray-900">{titulo}</h2>
        <button onClick={() => { setMostraNova(false); setEditandoJornada(false) }} className="text-gray-400 hover:text-gray-700">
          <X size={18} />
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={LABEL}>Motorista *</label>
          <select value={formJornada.motoristaId} onChange={e => setFormJornada(form => ({ ...form, motoristaId: e.target.value, viagemId: '' }))} className={INPUT}>
            <option value="">Selecione...</option>
            {motoristas.map(motorista => <option key={motorista.id} value={motorista.id}>{motorista.nome}</option>)}
          </select>
        </div>
        <div>
          <label className={LABEL}>Caminhão *</label>
          <select value={formJornada.caminhaoId} onChange={e => setFormJornada(form => ({ ...form, caminhaoId: e.target.value, viagemId: '' }))} className={INPUT}>
            <option value="">Selecione...</option>
            {caminhoes.map(caminhao => <option key={caminhao.id} value={caminhao.id}>{normalizarPlaca(caminhao.placa)}{caminhao.modelo ? ` · ${caminhao.modelo}` : ''}</option>)}
          </select>
        </div>
        <div>
          <label className={LABEL}>Data *</label>
          <input type="date" value={formJornada.data} onChange={e => setFormJornada(form => ({ ...form, data: e.target.value }))} className={INPUT} />
        </div>
        <div>
          <label className={LABEL}>Viagem (opcional)</label>
          <select value={formJornada.viagemId} onChange={e => setFormJornada(form => ({ ...form, viagemId: e.target.value }))} className={INPUT}>
            <option value="">Sem viagem vinculada</option>
            {viagensDisponiveis.map(viagem => <option key={viagem.id} value={viagem.id}>#{viagem.id.slice(0, 8)} · {viagem.status || 'sem status'}</option>)}
          </select>
        </div>
        <div>
          <label className={LABEL}>Início *</label>
          <input type="datetime-local" value={formJornada.inicio} onChange={e => setFormJornada(form => ({ ...form, inicio: e.target.value }))} className={INPUT} />
        </div>
        <div>
          <label className={LABEL}>Fim</label>
          <input type="datetime-local" value={formJornada.fim} onChange={e => setFormJornada(form => ({ ...form, fim: e.target.value }))} className={INPUT} />
        </div>
        <div>
          <label className={LABEL}>Status</label>
          <select value={formJornada.status} onChange={e => setFormJornada(form => ({ ...form, status: e.target.value }))} className={INPUT}>
            {STATUS.map(status => <option key={status.value} value={status.value}>{status.label}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className={LABEL}>Observações</label>
        <textarea value={formJornada.observacoes} onChange={e => setFormJornada(form => ({ ...form, observacoes: e.target.value }))} rows={3} className={INPUT} placeholder="Observações administrativas..." />
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={() => { setMostraNova(false); setEditandoJornada(false) }} className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600">Cancelar</button>
        <button onClick={salvarJornada} disabled={salvando} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-semibold">
          {salvando ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Salvar jornada
        </button>
      </div>
    </div>
  )

  if (mostraNova) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <button onClick={voltarLista} className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-5"><ArrowLeft size={16} /> Voltar para jornadas</button>
        {msg && <div className="mb-4 p-3 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm">{msg}</div>}
        {erro && <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{erro}</div>}
        {renderFormJornada('Nova jornada administrativa')}
      </div>
    )
  }

  if (selecionada) {
    const viagem = viagens.find(item => item.id === selecionada.viagem_id)
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <button onClick={voltarLista} className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-5"><ArrowLeft size={16} /> Voltar para jornadas</button>
        {msg && <div className="mb-4 p-3 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm">{msg}</div>}
        {erro && <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{erro}</div>}

        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden mb-5">
          <div className="bg-gradient-to-r from-[#8f1d32] to-[#b52a45] px-6 py-5 text-white flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <p className="text-white/70 text-xs uppercase tracking-wide font-semibold">Gestão de Jornada</p>
              <h1 className="text-2xl font-bold mt-1">{nomeMotorista(selecionada.motorista_id)}</h1>
              <p className="text-sm text-white/80 mt-1">{placaCaminhao(selecionada.caminhao_id)} · {formatarData(selecionada.data)}{viagem ? ` · Viagem #${viagem.id.slice(0, 8)}` : ''}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-3 py-1.5 rounded-full text-xs font-bold ${selecionada.status === 'aberta' ? 'bg-white/20 text-white' : 'bg-white text-[#8f1d32]'}`}>{selecionada.status}</span>
              <button onClick={editarJornada} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-sm"><Edit3 size={15} /> Editar</button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 p-5">
            <div className="bg-gray-50 rounded-xl p-3"><p className="text-xs text-gray-400">Início</p><p className="text-sm font-semibold text-gray-800 mt-1">{formatarDataHora(selecionada.inicio)}</p></div>
            <div className="bg-gray-50 rounded-xl p-3"><p className="text-xs text-gray-400">Fim</p><p className="text-sm font-semibold text-gray-800 mt-1">{formatarDataHora(selecionada.fim)}</p></div>
            <div className="bg-gray-50 rounded-xl p-3"><p className="text-xs text-gray-400">Eventos</p><p className="text-sm font-semibold text-gray-800 mt-1">{selecionada.eventos.length}</p></div>
            <div className="bg-gray-50 rounded-xl p-3"><p className="text-xs text-gray-400">Observações</p><p className="text-sm font-semibold text-gray-800 mt-1 truncate">{selecionada.observacoes || '—'}</p></div>
          </div>
        </div>

        {editandoJornada && <div className="mb-5">{renderFormJornada('Editar jornada')}</div>}

        <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_0.8fr] gap-5">
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <div><h2 className="font-bold text-gray-900">Linha do tempo</h2><p className="text-xs text-gray-400 mt-1">Eventos ordenados do mais antigo para o mais recente.</p></div>
              <Clock3 size={20} className="text-[#8f1d32]" />
            </div>
            {selecionada.eventos.length === 0 ? (
              <div className="border border-dashed border-gray-200 rounded-xl p-8 text-center text-sm text-gray-400">Nenhum evento registrado nesta jornada.</div>
            ) : (
              <div className="space-y-3">
                {selecionada.eventos.map(evento => (
                  <div key={evento.id} className="flex gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50">
                    <div className="mt-1 w-2.5 h-2.5 rounded-full bg-[#8f1d32] shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-semibold text-sm text-gray-800">{nomeEvento(evento.tipo_evento)}</p>
                        <p className="text-xs text-gray-500">{formatarHora(evento.inicio)} — {formatarHora(evento.fim)}</p>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{formatarDataHora(evento.inicio)}{evento.observacao ? ` · ${evento.observacao}` : ''}</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => editarEvento(evento)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-white" title="Editar evento"><Edit3 size={14} /></button>
                      <button onClick={() => void excluirEvento(evento)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-white" title="Excluir evento"><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="border-t border-gray-100 mt-5 pt-5">
              <div className="flex items-center justify-between mb-3"><h3 className="font-semibold text-gray-800">{formEvento.id ? 'Editar evento' : 'Adicionar evento'}</h3>{formEvento.id && <button onClick={() => setFormEvento(eventoVazio())} className="text-xs text-gray-500 hover:text-gray-800">Cancelar edição</button>}</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div><label className={LABEL}>Tipo de evento</label><select value={formEvento.tipo} onChange={e => setFormEvento(form => ({ ...form, tipo: e.target.value }))} className={INPUT}>{EVENTOS.map(evento => <option key={evento.value} value={evento.value}>{evento.label}</option>)}</select></div>
                <div><label className={LABEL}>Início *</label><input type="datetime-local" value={formEvento.inicio} onChange={e => setFormEvento(form => ({ ...form, inicio: e.target.value }))} className={INPUT} /></div>
                <div><label className={LABEL}>Fim</label><input type="datetime-local" value={formEvento.fim} onChange={e => setFormEvento(form => ({ ...form, fim: e.target.value }))} className={INPUT} /></div>
                <div><label className={LABEL}>Observação</label><input value={formEvento.observacao} onChange={e => setFormEvento(form => ({ ...form, observacao: e.target.value }))} className={INPUT} placeholder="Opcional" /></div>
              </div>
              <button onClick={() => void salvarEvento()} disabled={salvandoEvento} className="mt-3 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white text-sm font-semibold"><Plus size={16} /> {salvandoEvento ? 'Salvando...' : formEvento.id ? 'Salvar evento' : 'Adicionar evento'}</button>
            </div>
          </div>

          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5 h-fit">
            <div className="flex items-center gap-2 mb-4"><History size={19} className="text-[#8f1d32]" /><div><h2 className="font-bold text-gray-900">Histórico de ajustes</h2><p className="text-xs text-gray-400">Alterações administrativas registradas.</p></div></div>
            {ajustes.length === 0 ? <p className="text-sm text-gray-400 border border-dashed border-gray-200 rounded-xl p-5 text-center">Nenhum ajuste registrado.</p> : <div className="space-y-3">{ajustes.map(ajuste => <div key={ajuste.id} className="border-l-2 border-[#8f1d32] pl-3"><p className="text-xs font-semibold text-gray-700">{ajuste.descricao}</p><p className="text-[11px] text-gray-400 mt-1">{formatarDataHora(ajuste.created_at)} · {ajuste.usuario_nome || ajuste.usuario_email || 'Administrador'}</p></div>)}</div>}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
        <div><p className="text-xs font-semibold uppercase tracking-wide text-[#8f1d32]">Administração</p><h1 className="text-2xl font-bold text-gray-900 mt-1">Gestão de Jornada</h1><p className="text-sm text-gray-500 mt-1">Controle administrativo de jornadas e eventos dos motoristas.</p></div>
        <div className="flex gap-2"><button onClick={exportarExcel} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-sm font-semibold text-gray-700"><Download size={16} /> Excel</button><button onClick={abrirNova} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold"><Plus size={16} /> Nova jornada</button></div>
      </div>

      {msg && <div className="mb-4 p-3 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm">{msg}</div>}
      {erro && <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{erro}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4"><p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Jornadas filtradas</p><p className="text-2xl font-bold text-gray-900 mt-1">{jornadasFiltradas.length}</p></div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4"><p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Abertas</p><p className="text-2xl font-bold text-yellow-600 mt-1">{totalAbertas}</p></div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4"><p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Eventos registrados</p><p className="text-2xl font-bold text-[#8f1d32] mt-1">{totalEventos}<span className="text-sm font-normal text-gray-400 ml-2">· {totalEncerradas} encerradas</span></p></div>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4 mb-5">
        <div className="flex items-center gap-2 mb-3"><Search size={17} className="text-gray-400" /><h2 className="text-sm font-semibold text-gray-700">Filtros</h2></div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3">
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar motorista ou placa..." className={INPUT.replace('mt-1 ', '')} />
          <select value={filtroMotorista} onChange={e => setFiltroMotorista(e.target.value)} className={INPUT.replace('mt-1 ', '')}><option value="">Todos os motoristas</option>{motoristas.map(motorista => <option key={motorista.id} value={motorista.id}>{motorista.nome}</option>)}</select>
          <select value={filtroCaminhao} onChange={e => setFiltroCaminhao(e.target.value)} className={INPUT.replace('mt-1 ', '')}><option value="">Todos os caminhões</option>{caminhoes.map(caminhao => <option key={caminhao.id} value={caminhao.id}>{normalizarPlaca(caminhao.placa)}</option>)}</select>
          <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)} className={INPUT.replace('mt-1 ', '')}><option value="">Todos os status</option>{STATUS.map(status => <option key={status.value} value={status.value}>{status.label}</option>)}</select>
          <input type="date" value={filtroInicio} onChange={e => setFiltroInicio(e.target.value)} className={INPUT.replace('mt-1 ', '')} title="Data inicial" />
          <input type="date" value={filtroFim} onChange={e => setFiltroFim(e.target.value)} className={INPUT.replace('mt-1 ', '')} title="Data final" />
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between"><div className="flex items-center gap-2"><Calendar size={17} className="text-[#8f1d32]" /><p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Jornadas · da data mais antiga para a mais recente</p></div><button onClick={() => void carregarBase()} className="text-xs text-gray-500 hover:text-gray-800">Atualizar</button></div>
        {jornadasFiltradas.length === 0 ? <div className="p-12 text-center text-sm text-gray-400">Nenhuma jornada encontrada com os filtros atuais.</div> : <div className="divide-y divide-gray-100">{jornadasFiltradas.map(jornada => <button key={jornada.id} onClick={() => abrirJornada(jornada)} className="w-full text-left px-5 py-4 hover:bg-gray-50 transition flex flex-col md:flex-row md:items-center gap-3"><div className="w-28 shrink-0"><p className="text-sm font-bold text-gray-800">{formatarData(jornada.data)}</p><p className="text-xs text-gray-400 mt-1">{formatarHora(jornada.inicio)} — {formatarHora(jornada.fim)}</p></div><div className="flex-1 min-w-0"><div className="flex items-center gap-2"><User size={15} className="text-gray-400" /><p className="text-sm font-semibold text-gray-800 truncate">{nomeMotorista(jornada.motorista_id)}</p></div><div className="flex items-center gap-2 mt-1"><Truck size={14} className="text-gray-400" /><p className="text-xs text-gray-500">{placaCaminhao(jornada.caminhao_id)}</p>{jornada.viagem_id && <span className="text-xs text-gray-400">· viagem vinculada</span>}</div></div><div className="flex items-center gap-3 shrink-0"><span className="text-xs text-gray-500">{jornada.eventos.length} evento(s)</span><span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${classeStatus(jornada.status)}`}>{jornada.status}</span><CheckCircle2 size={17} className={jornada.status === 'encerrada' ? 'text-green-500' : 'text-gray-300'} /></div></button>)}</div>}
      </div>
    </div>
  )
}
