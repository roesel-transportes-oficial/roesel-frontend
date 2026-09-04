'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '../services/auth'
import { normalizarPlaca } from '../services/placas'
import { Search, Plus, Save, Trash2, MapPin, X, Palmtree, ArrowLeft, AlertCircle, Loader2, Truck, DollarSign, Users, ChevronRight, Filter, MoreHorizontal } from 'lucide-react'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_KEY!

// Paleta Premium Roesel
const COLORS = {
  brand: '#A41E34',      // Vermelho Bordô (Acento)
  textMain: '#1A1A1A',   // Quase preto para textos
  textSub: '#666666',    // Cinza para subtextos
  border: '#E5E5E5',     // Borda fina e clara
  bg: '#F9FAFB',         // Fundo levemente acinzentado
  white: '#FFFFFF'
}

interface Viagem {
  id: string; motorista: string; caminhao_id: string; caminhao_placa: string
  status: string; obs: string; qtd_veiculos: number; empresa: string
  valor_contrato: number; origem: string; destino: string
  valor_adiantamento: number; valor_chapa: number
}
interface Motorista { id: string; nome: string; adiantamento: boolean; ferias?: boolean; freelancer?: boolean }
interface Caminhao  { id: string; placa: string; modelo: string }
interface Contrato  {
  id: string; contrato: string; cliente: string; origem: string; destino: string
  qtd_veiculos: number; fat_bruto: number
}

function ContratoSelector({ selecionados, todos, onChange, nomeMotorista, setCampos, calcularAdiantamento, aplicarDadosContratos }:
  { selecionados: Contrato[]; todos: Contrato[]; onChange: (c: Contrato[]) => void; nomeMotorista: string; setCampos: (d: any) => void; calcularAdiantamento: (n: string, v: number) => string; aplicarDadosContratos: (l: Contrato[], n: string) => any }
) {
  const [busca, setBusca] = useState('')
  const filtrados = busca.trim()
    ? todos.filter(c => c.contrato?.includes(busca) || c.cliente?.toLowerCase().includes(busca.toLowerCase()))
    : todos

  return (
    <div className="border rounded-xl overflow-hidden bg-white shadow-sm" style={{ borderColor: COLORS.border }}>
      <div className="p-3 border-b bg-gray-50/50" style={{ borderColor: COLORS.border }}>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar contrato..."
            className="w-full text-sm pl-9 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-1 bg-white transition-all"
            style={{ borderColor: COLORS.border, '--tw-ring-color': COLORS.brand } as any} />
        </div>
      </div>
      {selecionados.length > 0 && (
        <div className="p-3 flex flex-wrap gap-2 border-b bg-white" style={{ borderColor: COLORS.border }}>
          {selecionados.map(c => (
            <span key={c.id} className="inline-flex items-center gap-2 text-[11px] text-white px-3 py-1 rounded-md font-bold uppercase tracking-wider" style={{ backgroundColor: COLORS.brand }}>
              #{c.contrato} · {c.cliente}
              <button onClick={() => {
                const nova = selecionados.filter(s => s.id !== c.id)
                onChange(nova)
                const dados = aplicarDadosContratos(nova, nomeMotorista)
                if (dados) setCampos(dados)
                else setCampos({ empresa: '', valorContrato: '', qtdVeiculos: '', origem: '', destino: '', adiantamento: '0' })
              }} className="hover:opacity-75 transition"><X size={12} /></button>
            </span>
          ))}
        </div>
      )}
      <div className="max-h-40 overflow-y-auto">
        {filtrados.filter(c => !selecionados.find(s => s.id === c.id)).map(c => (
          <button key={c.id} onClick={() => {
            const nova = [...selecionados, c]
            onChange(nova)
            const dados = aplicarDadosContratos(nova, nomeMotorista)
            if (dados) setCampos(dados)
          }} className="w-full text-left px-4 py-3 text-xs border-b last:border-0 transition-colors hover:bg-gray-50" style={{ borderColor: COLORS.border }}>
            <div className="flex justify-between items-center">
              <div>
                <span className="font-bold" style={{ color: COLORS.textMain }}>#{c.contrato}</span>
                <span className="ml-2" style={{ color: COLORS.textSub }}>{c.cliente}</span>
              </div>
              {c.fat_bruto > 0 && <span className="font-bold" style={{ color: COLORS.brand }}>R$ {c.fat_bruto?.toLocaleString('pt-BR')}</span>}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

export default function ViagemPage() {
  const { perm } = useAuth()
  const [viagens, setViagens]       = useState<Viagem[]>([])
  const [motoristas, setMotoristas] = useState<Motorista[]>([])
  const [caminhoes, setCaminhoes]   = useState<Caminhao[]>([])
  const [contratos, setContratos]   = useState<Contrato[]>([])
  const [busca, setBusca]           = useState('')
  const [sel, setSel]               = useState<Viagem | null>(null)
  const [mostraCad, setMostraCad]   = useState(false)
  const [loading, setLoading]       = useState(false)
  const [msg, setMsg]               = useState('')
  const [confirmExcluir, setConfirmExcluir] = useState(false)

  const [cadMotorista, setCadMotorista]                 = useState('')
  const [cadCaminhaoId, setCadCaminhaoId]               = useState('')
  const [cadCaminhaoPlaca, setCadCaminhaoPlaca]         = useState('')
  const [cadStatus, setCadStatus]                       = useState('EM ANDAMENTO')
  const [cadObs, setCadObs]                             = useState('')
  const [cadContratos, setCadContratos]                 = useState<Contrato[]>([])
  const [cadQtdVeiculos, setCadQtdVeiculos]             = useState('')
  const [cadEmpresa, setCadEmpresa]                     = useState('')
  const [cadValorContrato, setCadValorContrato]         = useState('')
  const [cadOrigem, setCadOrigem]                       = useState('')
  const [cadDestino, setCadDestino]                     = useState('')
  const [cadValorAdiantamento, setCadValorAdiantamento] = useState('')
  const [cadValorChapa, setCadValorChapa]               = useState('')

  const [editMotorista, setEditMotorista]                 = useState('')
  const [editCaminhaoId, setEditCaminhaoId]               = useState('')
  const [editCaminhaoPlaca, setEditCaminhaoPlaca]         = useState('')
  const [editStatus, setEditStatus]                       = useState('EM ANDAMENTO')
  const [editObs, setEditObs]                             = useState('')
  const [editContratos, setEditContratos]                 = useState<Contrato[]>([])
  const [editQtdVeiculos, setEditQtdVeiculos]             = useState('')
  const [editEmpresa, setEditEmpresa]                     = useState('')
  const [editValorContrato, setEditValorContrato]         = useState('')
  const [editOrigem, setEditOrigem]                       = useState('')
  const [editDestino, setEditDestino]                     = useState('')
  const [editValorAdiantamento, setEditValorAdiantamento] = useState('')
  const [editValorChapa, setEditValorChapa]               = useState('')

  useEffect(() => {
    fetch_(); fetchMotoristas(); fetchCaminhoes(); fetchContratos()
  }, [])

  async function fetch_() {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/viagens?order=created_at.desc`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
      })
      const data = await res.json()
      setViagens(Array.isArray(data) ? data.map(v => ({ ...v, caminhao_placa: normalizarPlaca(v.caminhao_placa) })) : [])
    } catch {}
  }

  async function fetchMotoristas() {
    try {
      const res = await fetch(        `${SUPABASE_URL}/rest/v1/motoristas?ativo=eq.true&order=nome.asc&select=id,nome,adiantamento,ferias,freelancer`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
      })
      setMotoristas(await res.json())
    } catch {}
  }

  async function fetchCaminhoes() {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/caminhoes?order=placa.asc`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
      })
      const data = await res.json()
      setCaminhoes(Array.isArray(data) ? data.map(c => ({ ...c, placa: normalizarPlaca(c.placa) })) : [])
    } catch {}
  }

  async function fetchContratos() {
    try {
      const resVC = await fetch(
        `${SUPABASE_URL}/rest/v1/viagem_contratos?select=contrato_id`,
        { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
      )
      const vcData = await resVC.json()
      const jaVinculados = new Set(
        (Array.isArray(vcData) ? vcData : []).map((v: any) => v.contrato_id)
      )
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/contratos?order=contrato.desc`,
        { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
      )
      const data = await res.json()
      if (Array.isArray(data)) setContratos(data.filter((c: any) => !jaVinculados.has(c.id)))
    } catch {}
  }

  async function fetchContratosViagem(viagemId: string) {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/viagem_contratos?viagem_id=eq.${viagemId}`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
      })
      const data = await res.json()
      if (Array.isArray(data) && data.length > 0) {
        const ids = data.map((d: any) => d.contrato_id)
        const resC = await fetch(
          `${SUPABASE_URL}/rest/v1/contratos?id=in.(${ids.join(',')})`,
          { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
        )
        const contratosDaViagem = await resC.json()
        if (Array.isArray(contratosDaViagem)) setEditContratos(contratosDaViagem)
      } else {
        setEditContratos([])
      }
    } catch {}
  }

  async function buscarCaminhaoPorMotorista(nomeMotorista: string): Promise<{ id: string; placa: string } | null> {
    try {
      const resM = await fetch(
        `${SUPABASE_URL}/rest/v1/motoristas?nome=eq.${encodeURIComponent(nomeMotorista)}&limit=1`,
        { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
      )
      const motData = await resM.json()
      if (!Array.isArray(motData) || !motData[0]) return null

      const motId = motData[0].id
      if (motData[0].freelancer === true) return null
      const emFerias = motData[0].ferias === true

      const resC = await fetch(
        `${SUPABASE_URL}/rest/v1/caminhoes?motorista_atual=eq.${motId}&limit=1`,
        { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
      )
      const camData = await resC.json()
      if (Array.isArray(camData) && camData[0]) return { id: camData[0].id, placa: normalizarPlaca(camData[0].placa) }

      if (emFerias && motData[0].caminhao_temp_id) {
        const resCT = await fetch(
          `${SUPABASE_URL}/rest/v1/caminhoes?id=eq.${motData[0].caminhao_temp_id}&limit=1`,
          { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
        )
        const camTData = await resCT.json()
        if (Array.isArray(camTData) && camTData[0]) return { id: camTData[0].id, placa: normalizarPlaca(camTData[0].placa) }
      }

      return null
    } catch { return null }
  }

  async function buscarCaminhaoPorPlaca(placa: string): Promise<{ id: string; placa: string } | null> {
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/caminhoes?placa=eq.${encodeURIComponent(placa)}&limit=1`,
        { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
      )
      const data = await res.json()
      if (Array.isArray(data) && data[0]) return { id: data[0].id, placa: normalizarPlaca(data[0].placa) }
      return null
    } catch { return null }
  }

  function calcularAdiantamento(nomeMotorista: string, valorContrato: number): string {
    const motorista = motoristas.find(m => m.nome === nomeMotorista)
    if (!motorista?.adiantamento || !valorContrato) return '0'
    return (valorContrato * 0.05).toFixed(2)
  }

  function aplicarDadosContratos(lista: Contrato[], nomeMotorista: string) {
    if (lista.length === 0) return null
    const primeiro      = lista[0]
    const totalValor    = lista.reduce((s, c) => s + (c.fat_bruto || 0), 0)
    const totalVeiculos = lista.reduce((s, c) => s + (c.qtd_veiculos || 0), 0)
    return {
      empresa:       primeiro.cliente || '',
      valorContrato: totalValor > 0 ? String(totalValor) : '',
      qtdVeiculos:   totalVeiculos > 0 ? String(totalVeiculos) : '',
      origem:        primeiro.origem || '',
      destino:       primeiro.destino || '',
      adiantamento:  calcularAdiantamento(nomeMotorista, totalValor),
    }
  }

  function voltar()  { setSel(null); setConfirmExcluir(false) }
  function showMsg(t: string) { setMsg(t); setTimeout(() => setMsg(''), 3000) }

  const filtrados = busca.trim()
    ? viagens.filter(v =>
        v.motorista?.toLowerCase().includes(busca.toLowerCase()) ||
        v.caminhao_placa?.toLowerCase().includes(busca.toLowerCase())
      )
    : viagens

  async function selecionar(v: Viagem) {
    setSel(v)
    setEditMotorista(v.motorista || '')
    setEditStatus(v.status || 'EM ANDAMENTO')
    setEditObs(v.obs || '')
    setEditQtdVeiculos(String(v.qtd_veiculos || ''))
    setEditEmpresa(v.empresa || '')
    setEditValorContrato(String(v.valor_contrato || ''))
    setEditOrigem(v.origem || '')
    setEditDestino(v.destino || '')
    setEditValorChapa(String(v.valor_chapa || ''))
    setConfirmExcluir(false)

    let caminhaoResolvido: { id: string; placa: string } | null = null

    if (v.caminhao_id) {
      caminhaoResolvido = { id: v.caminhao_id, placa: v.caminhao_placa }
    } else if (v.caminhao_placa) {
      caminhaoResolvido = await buscarCaminhaoPorPlaca(v.caminhao_placa)
    }
    if (!caminhaoResolvido && v.motorista) {
      caminhaoResolvido = await buscarCaminhaoPorMotorista(v.motorista)
    }

    setEditCaminhaoId(caminhaoResolvido?.id || '')
    setEditCaminhaoPlaca(normalizarPlaca(caminhaoResolvido?.placa || v.caminhao_placa || ''))

    const valorContrato = v.valor_contrato || 0
    if (v.valor_adiantamento) {
      setEditValorAdiantamento(String(v.valor_adiantamento))
    } else if (valorContrato > 0) {
      setEditValorAdiantamento(calcularAdiantamento(v.motorista || '', valorContrato))
    } else {
      setEditValorAdiantamento('')
    }

    await fetchContratosViagem(v.id)
  }

  async function onMotoristaChange(nome: string, setCaminhaoId: (id: string) => void, setCaminhaoPlaca: (p: string) => void) {
    if (!nome) { setCaminhaoId(''); setCaminhaoPlaca(''); return }
    const motorista = motoristas.find(m => m.nome === nome)
    // Freelancer não possui caminhão fixo: o caminhão será escolhido
    // manualmente no formulário da viagem.
    if (motorista?.freelancer) { setCaminhaoId(''); setCaminhaoPlaca(''); return }
    const cam = await buscarCaminhaoPorMotorista(nome)
    if (cam) { setCaminhaoId(cam.id); setCaminhaoPlaca(cam.placa) }
    else { setCaminhaoId(''); setCaminhaoPlaca('') }
  }

  async function salvarContratosViagem(viagemId: string, lista: Contrato[]) {
    await fetch(`${SUPABASE_URL}/rest/v1/viagem_contratos?viagem_id=eq.${viagemId}`, {
      method: 'DELETE',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
    })
    if (lista.length > 0) {
      await fetch(`${SUPABASE_URL}/rest/v1/viagem_contratos`, {
        method: 'POST',
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify(lista.map(c => ({ viagem_id: viagemId, contrato_id: c.id })))
      })
    }
  }

  async function salvar() {
    if (!sel) return
    setLoading(true)
    if (perm !== 'demo') {
      await fetch(`${SUPABASE_URL}/rest/v1/viagens?id=eq.${sel.id}`, {
        method: 'PATCH',
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({
          motorista: editMotorista, caminhao_id: editCaminhaoId, caminhao_placa: normalizarPlaca(editCaminhaoPlaca),
          status: editStatus, obs: editObs, qtd_veiculos: parseInt(editQtdVeiculos) || 0,
          empresa: editEmpresa, valor_contrato: parseFloat(editValorContrato) || 0,
          origem: editOrigem, destino: editDestino,
          valor_adiantamento: parseFloat(editValorAdiantamento) || 0, valor_chapa: parseFloat(editValorChapa) || 0
        })
      })
      await salvarContratosViagem(sel.id, editContratos)
    }
    await fetch_(); setLoading(false); voltar(); showMsg('✅ Viagem atualizada!')
  }

  async function excluir() {
    if (!sel) return
    setLoading(true)
    if (perm !== 'demo') {
      await fetch(`${SUPABASE_URL}/rest/v1/viagens?id=eq.${sel.id}`, {
        method: 'DELETE',
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
      })
    }
    await fetch_(); setLoading(false); voltar(); showMsg('Viagem excluída.')
  }

  async function cadastrar() {
    if (!cadMotorista || !cadCaminhaoId) return
    setLoading(true)
    if (perm !== 'demo') {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/viagens`, {
        method: 'POST',
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
        body: JSON.stringify({
          motorista: cadMotorista, caminhao_id: cadCaminhaoId, caminhao_placa: normalizarPlaca(cadCaminhaoPlaca),
          status: cadStatus, obs: cadObs, qtd_veiculos: parseInt(cadQtdVeiculos) || 0,
          empresa: cadEmpresa, valor_contrato: parseFloat(cadValorContrato) || 0,
          origem: cadOrigem, destino: cadDestino,
          valor_adiantamento: parseFloat(cadValorAdiantamento) || 0, valor_chapa: parseFloat(cadValorChapa) || 0
        })
      })
      const data = await res.json()
      if (Array.isArray(data) && data[0]) {
        await salvarContratosViagem(data[0].id, cadContratos)
      }
    }
    await fetch_(); setLoading(false); setMostraCad(false)
    setCadMotorista(''); setCadCaminhaoId(''); setCadCaminhaoPlaca(''); setCadStatus('EM ANDAMENTO'); setCadObs('')
    setCadContratos([]); setCadQtdVeiculos(''); setCadEmpresa(''); setCadValorContrato(''); setCadOrigem(''); setCadDestino('')
    setCadValorAdiantamento(''); setCadValorChapa('')
    showMsg('✅ Viagem registrada!')
  }

  // TELA DE CADASTRO OU EDIÇÃO (MINIMALISTA)
  if (mostraCad || sel) {
    const isEdit = !!sel
    return (
      <div className="min-h-screen p-8" style={{ backgroundColor: COLORS.bg }}>
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-10">
            <button onClick={() => { if(isEdit) voltar(); else setMostraCad(false) }} className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest transition-all hover:opacity-70" style={{ color: COLORS.textSub }}>
              <ArrowLeft size={16} /> Voltar
            </button>
            <div className="flex items-center gap-3">
              {isEdit && (
                <button onClick={() => setConfirmExcluir(true)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                  <Trash2 size={18} />
                </button>
              )}
              <button onClick={isEdit ? salvar : cadastrar} disabled={loading}
                className="flex items-center gap-2 text-white px-6 py-2.5 rounded-lg text-sm font-bold shadow-sm transition-all hover:brightness-110 disabled:opacity-50" style={{ backgroundColor: COLORS.brand }}>
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {isEdit ? 'Salvar' : 'Registrar'}
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border shadow-sm overflow-hidden" style={{ borderColor: COLORS.border }}>
            <div className="p-10 border-b" style={{ borderColor: COLORS.border }}>
              <h2 className="text-3xl font-black tracking-tight" style={{ color: COLORS.textMain }}>{isEdit ? 'Detalhes da Viagem' : 'Nova Viagem'}</h2>
              <p className="text-sm mt-2" style={{ color: COLORS.textSub }}>{isEdit ? `ID: ${sel.id}` : 'Preencha as informações necessárias para o registro.'}</p>
            </div>

            <div className="p-10 space-y-12">
              {/* Seção 1: Operacional */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-6">
                  <h3 className="text-[11px] font-black uppercase tracking-[0.2em]" style={{ color: COLORS.brand }}>Operacional</h3>
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold" style={{ color: COLORS.textSub }}>Motorista</label>
                      <select value={isEdit ? editMotorista : cadMotorista} onChange={async e => {
                        const nome = e.target.value
                        if(isEdit) { setEditMotorista(nome); await onMotoristaChange(nome, setEditCaminhaoId, setEditCaminhaoPlaca) }
                        else { setCadMotorista(nome); await onMotoristaChange(nome, setCadCaminhaoId, setCadCaminhaoPlaca) }
                      }} className="w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-1 transition-all text-sm font-medium" style={{ borderColor: COLORS.border, '--tw-ring-color': COLORS.brand } as any}>
                        <option value="">Selecione...</option>
                        {motoristas.map(m => <option key={m.id} value={m.nome}>{m.nome}{m.freelancer ? ' · Freelancer' : ''}</option>)}
                      </select>
                      {(isEdit ? editMotorista : cadMotorista) && motoristas.find(m => m.nome === (isEdit ? editMotorista : cadMotorista))?.freelancer && (
                        <p className="text-[10px] text-purple-600 mt-1">Freelancer — escolha qualquer caminhão para esta viagem.</p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold" style={{ color: COLORS.textSub }}>Caminhão</label>
                      <select value={isEdit ? editCaminhaoId : cadCaminhaoId} onChange={e => {
                        const cam = caminhoes.find(c => c.id === e.target.value)
                        if(isEdit) { setEditCaminhaoId(e.target.value); setEditCaminhaoPlaca(normalizarPlaca(cam?.placa || '')) }
                        else { setCadCaminhaoId(e.target.value); setCadCaminhaoPlaca(normalizarPlaca(cam?.placa || '')) }
                      }} className="w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-1 transition-all text-sm font-medium" style={{ borderColor: COLORS.border, '--tw-ring-color': COLORS.brand } as any}>
                        <option value="">Selecione...</option>
                        {caminhoes.map(c => <option key={c.id} value={c.id}>{c.placa}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <h3 className="text-[11px] font-black uppercase tracking-[0.2em]" style={{ color: COLORS.brand }}>Status & Notas</h3>
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold" style={{ color: COLORS.textSub }}>Status Atual</label>
                      <select value={isEdit ? editStatus : cadStatus} onChange={e => isEdit ? setEditStatus(e.target.value) : setCadStatus(e.target.value)} className="w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-1 transition-all text-sm font-medium" style={{ borderColor: COLORS.border, '--tw-ring-color': COLORS.brand } as any}>
                        <option value="EM ANDAMENTO">EM ANDAMENTO</option>
                        <option value="FINALIZADA">FINALIZADA</option>
                        <option value="CANCELADA">CANCELADA</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold" style={{ color: COLORS.textSub }}>Observações</label>
                      <textarea value={isEdit ? editObs : cadObs} onChange={e => isEdit ? setEditObs(e.target.value) : setCadObs(e.target.value)} rows={1} className="w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-1 transition-all text-sm font-medium resize-none" style={{ borderColor: COLORS.border, '--tw-ring-color': COLORS.brand } as any} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Seção 2: Contratos */}
              <div className="space-y-6">
                <h3 className="text-[11px] font-black uppercase tracking-[0.2em]" style={{ color: COLORS.brand }}>Vínculo de Contratos</h3>
                <ContratoSelector
                  selecionados={isEdit ? editContratos : cadContratos}
                  todos={[...contratos, ...(isEdit ? editContratos.filter(ec => !contratos.find(c => c.id === ec.id)) : cadContratos.filter(ec => !contratos.find(c => c.id === ec.id)))]}
                  onChange={isEdit ? setEditContratos : setCadContratos}
                  nomeMotorista={isEdit ? editMotorista : cadMotorista}
                  setCampos={(dados) => { 
                    if(isEdit) { setEditEmpresa(dados.empresa); setEditValorContrato(dados.valorContrato); setEditQtdVeiculos(dados.qtdVeiculos); setEditOrigem(dados.origem); setEditDestino(dados.destino); setEditValorAdiantamento(dados.adiantamento) }
                    else { setCadEmpresa(dados.empresa); setCadValorContrato(dados.valorContrato); setCadQtdVeiculos(dados.qtdVeiculos); setCadOrigem(dados.origem); setCadDestino(dados.destino); setCadValorAdiantamento(dados.adiantamento) }
                  }}
                  calcularAdiantamento={calcularAdiantamento}
                  aplicarDadosContratos={aplicarDadosContratos}
                />
              </div>

              {/* Seção 3: Financeiro & Carga */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-8 rounded-2xl" style={{ backgroundColor: COLORS.bg }}>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: COLORS.textSub }}>Valor Frete</label>
                  <input type="number" step="0.01" value={isEdit ? editValorContrato : cadValorContrato} onChange={e => isEdit ? setEditValorContrato(e.target.value) : setCadValorContrato(e.target.value)} className="w-full bg-transparent text-xl font-black focus:outline-none" style={{ color: COLORS.textMain }} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: COLORS.textSub }}>Adiantamento</label>
                  <input type="number" step="0.01" value={isEdit ? editValorAdiantamento : cadValorAdiantamento} onChange={e => isEdit ? setEditValorAdiantamento(e.target.value) : setCadValorAdiantamento(e.target.value)} className="w-full bg-transparent text-xl font-black focus:outline-none" style={{ color: COLORS.brand }} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: COLORS.textSub }}>Chapa</label>
                  <input type="number" step="0.01" value={isEdit ? editValorChapa : cadValorChapa} onChange={e => isEdit ? setEditValorChapa(e.target.value) : setCadValorChapa(e.target.value)} className="w-full bg-transparent text-xl font-black focus:outline-none" style={{ color: COLORS.textMain }} />
                </div>
              </div>
            </div>
          </div>

          {confirmExcluir && (
            <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center p-6 z-50">
              <div className="bg-white p-8 rounded-2xl shadow-2xl max-w-sm w-full text-center">
                <AlertCircle size={48} className="mx-auto text-red-500 mb-4" />
                <h3 className="text-xl font-black mb-2">Confirmar Exclusão</h3>
                <p className="text-sm text-gray-500 mb-8">Esta ação não pode ser desfeita. Deseja realmente excluir esta viagem?</p>
                <div className="flex gap-3">
                  <button onClick={excluir} className="flex-1 bg-red-500 text-white py-3 rounded-xl font-bold text-sm">Excluir</button>
                  <button onClick={() => setConfirmExcluir(false)} className="flex-1 bg-gray-100 text-gray-600 py-3 rounded-xl font-bold text-sm">Cancelar</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // TELA DA LISTA (PREMIUM MINIMALISTA)
  return (
    <div className="min-h-screen p-10" style={{ backgroundColor: COLORS.bg }}>
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
          <div>
            <h1 className="text-5xl font-black tracking-tighter mb-3" style={{ color: COLORS.textMain }}>Viagens</h1>
            
          </div>
          <button onClick={() => setMostraCad(true)}
            className="flex items-center gap-2 text-white px-8 py-3.5 rounded-xl text-sm font-black shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98]" style={{ backgroundColor: COLORS.brand }}>
            <Plus size={18} /> Novo Registro
          </button>
        </div>

        <div className="mb-8 flex gap-4">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={busca} onChange={e => setBusca(e.target.value)}
              placeholder="Pesquisar motorista, placa ou empresa..."
              className="w-full pl-12 pr-4 py-4 border rounded-2xl focus:outline-none focus:ring-1 bg-white shadow-sm transition-all text-sm font-medium" style={{ borderColor: COLORS.border, '--tw-ring-color': COLORS.brand } as any} />
          </div>
          <button className="p-4 bg-white border rounded-2xl shadow-sm hover:bg-gray-50 transition-colors" style={{ borderColor: COLORS.border }}>
            <Filter size={18} style={{ color: COLORS.textSub }} />
          </button>
        </div>

        <div className="bg-white rounded-3xl border shadow-sm overflow-hidden" style={{ borderColor: COLORS.border }}>
          <div className="grid grid-cols-12 px-8 py-4 border-b bg-gray-50/50 text-[10px] font-black uppercase tracking-[0.2em]" style={{ borderColor: COLORS.border, color: COLORS.textSub }}>
            <div className="col-span-4">Motorista / Veículo</div>
            <div className="col-span-4">Rota / Empresa</div>
            <div className="col-span-2 text-right">Valor</div>
            <div className="col-span-2 text-right">Status</div>
          </div>

          {filtrados.length === 0 ? (
            <div className="p-20 text-center">
              <Truck size={40} className="mx-auto mb-4 opacity-10" />
              <p className="text-sm font-bold" style={{ color: COLORS.textSub }}>Nenhum registro encontrado</p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: COLORS.border }}>
              {filtrados.map(v => (
                <button key={v.id} onClick={() => selecionar(v)}
                  className="w-full grid grid-cols-12 px-8 py-6 items-center hover:bg-gray-50/50 transition-all text-left group relative">
                  {/* Acento de cor lateral */}
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-full opacity-0 group-hover:opacity-100 transition-all" style={{ backgroundColor: COLORS.brand }}></div>
                  
                  <div className="col-span-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold shadow-sm" style={{ backgroundColor: COLORS.textMain }}>
                      {v.motorista.charAt(0)}
                    </div>
                    <div>
                      <p className="font-black text-sm" style={{ color: COLORS.textMain }}>{v.motorista}</p>
                      <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: COLORS.textSub }}>{v.caminhao_placa}</p>
                    </div>
                  </div>

                  <div className="col-span-4">
                    <p className="text-xs font-bold truncate" style={{ color: COLORS.textMain }}>{v.empresa || '---'}</p>
                    <div className="flex items-center gap-1 text-[10px] font-medium mt-1" style={{ color: COLORS.textSub }}>
                      <MapPin size={10} />
                      <span>{v.origem || '...'} → {v.destino || '...'}</span>
                    </div>
                  </div>

                  <div className="col-span-2 text-right">
                    <p className="text-sm font-black" style={{ color: COLORS.textMain }}>
                      {v.valor_contrato > 0 ? v.valor_contrato.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '---'}
                    </p>
                  </div>

                  <div className="col-span-2 flex items-center justify-end gap-3">
                    <span className="text-[10px] font-black px-3 py-1 rounded-full border uppercase tracking-tighter" 
                      style={{ 
                        borderColor: v.status === 'FINALIZADA' ? '#D1FAE5' : v.status === 'CANCELADA' ? '#FEE2E2' : '#DBEAFE',
                        backgroundColor: v.status === 'FINALIZADA' ? '#ECFDF5' : v.status === 'CANCELADA' ? '#FEF2F2' : '#EFF6FF',
                        color: v.status === 'FINALIZADA' ? '#065F46' : v.status === 'CANCELADA' ? '#991B1B' : '#1E40AF'
                      }}>
                      {v.status}
                    </span>
                    <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-all translate-x-[-4px] group-hover:translate-x-0" style={{ color: COLORS.textSub }} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        
        
      </div>

      {msg && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 px-6 py-3 rounded-2xl shadow-2xl text-white text-xs font-black uppercase tracking-widest animate-in fade-in slide-in-from-bottom-4" style={{ backgroundColor: COLORS.textMain }}>
          {msg}
        </div>
      )}
    </div>
  )
}
