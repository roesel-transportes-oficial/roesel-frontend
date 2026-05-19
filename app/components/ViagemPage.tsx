'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '../services/auth'
import { Search, Plus, Save, Trash2, MapPin, X, Palmtree, ArrowLeft, AlertCircle, Loader2, Truck, DollarSign, Users, Calendar } from 'lucide-react'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_KEY!

interface Viagem {
  id: string; motorista: string; caminhao_id: string; caminhao_placa: string
  status: string; obs: string; qtd_veiculos: number; empresa: string
  valor_contrato: number; origem: string; destino: string
  valor_adiantamento: number; valor_chapa: number
}
interface Motorista { id: string; nome: string; adiantamento: boolean; ferias?: boolean }
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
    <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
      <div className="p-3 bg-slate-50 border-b border-slate-200">
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar contrato..."
          className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white" />
      </div>
      {selecionados.length > 0 && (
        <div className="p-3 flex flex-wrap gap-2 border-b border-slate-200 bg-purple-50">
          {selecionados.map(c => (
            <span key={c.id} className="inline-flex items-center gap-2 text-xs bg-purple-600 text-white px-3 py-1.5 rounded-full font-medium">
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
      <div className="max-h-48 overflow-y-auto">
        {filtrados.filter(c => !selecionados.find(s => s.id === c.id)).map(c => (
          <button key={c.id} onClick={() => {
            const nova = [...selecionados, c]
            onChange(nova)
            const dados = aplicarDadosContratos(nova, nomeMotorista)
            if (dados) setCampos(dados)
          }} className="w-full text-left px-4 py-3 text-xs hover:bg-slate-50 border-b border-slate-100 last:border-0 transition-colors">
            <span className="font-semibold text-slate-900">#{c.contrato}</span>
            <span className="text-slate-600 ml-2">{c.cliente}</span>
            {c.origem && <span className="text-slate-500 ml-2">· {c.origem} → {c.destino}</span>}
            {c.fat_bruto > 0 && <span className="text-emerald-600 ml-2 font-medium">· R$ {c.fat_bruto?.toLocaleString('pt-BR')}</span>}
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
      setViagens(await res.json())
    } catch {}
  }

  async function fetchMotoristas() {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/motoristas?ativo=eq.true&order=nome.asc`, {
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
      setCaminhoes(await res.json())
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
      const emFerias = motData[0].ferias === true

      const resC = await fetch(
        `${SUPABASE_URL}/rest/v1/caminhoes?motorista_atual=eq.${motId}&limit=1`,
        { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
      )
      const camData = await resC.json()
      if (Array.isArray(camData) && camData[0]) return { id: camData[0].id, placa: camData[0].placa }

      if (emFerias && motData[0].caminhao_temp_id) {
        const resCT = await fetch(
          `${SUPABASE_URL}/rest/v1/caminhoes?id=eq.${motData[0].caminhao_temp_id}&limit=1`,
          { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
        )
        const camTData = await resCT.json()
        if (Array.isArray(camTData) && camTData[0]) return { id: camTData[0].id, placa: camTData[0].placa }
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
      if (Array.isArray(data) && data[0]) return { id: data[0].id, placa: data[0].placa }
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
    setEditCaminhaoPlaca(caminhaoResolvido?.placa || v.caminhao_placa || '')

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
          motorista: editMotorista, caminhao_id: editCaminhaoId, caminhao_placa: editCaminhaoPlaca,
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
          motorista: cadMotorista, caminhao_id: cadCaminhaoId, caminhao_placa: cadCaminhaoPlaca,
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

  const cadTemAdiantamento = motoristas.find(m => m.nome === cadMotorista)?.adiantamento
  const editTemAdiantamento = motoristas.find(m => m.nome === editMotorista)?.adiantamento
  const editEmFerias = motoristas.find(m => m.nome === editMotorista)?.ferias

  if (mostraCad) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
        <div className="max-w-3xl mx-auto">
          <button onClick={() => setMostraCad(false)} className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-8 font-medium transition-colors group">
            <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" /> Voltar
          </button>

          {msg && (
            <div className={`mb-6 p-4 rounded-lg text-sm font-semibold border ${msg.startsWith('✅') ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
              {msg}
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
            <div className="bg-gradient-to-r from-purple-600 to-purple-700 px-8 py-8">
              <h2 className="text-white font-black text-3xl tracking-tight">Registrar Viagem</h2>
              <p className="text-purple-100 text-sm font-medium mt-2">Preencha os dados da viagem e selecione os contratos</p>
            </div>

            <div className="p-8 space-y-8">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-2">
                    <Users size={14} /> Motorista *
                  </label>
                  <select value={cadMotorista} onChange={async e => {
                    const nome = e.target.value
                    setCadMotorista(nome)
                    await onMotoristaChange(nome, setCadCaminhaoId, setCadCaminhaoPlaca)
                  }} className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all">
                    <option value="">Selecione...</option>
                    {motoristas.map(m => (
                      <option key={m.id} value={m.nome}>
                        {m.nome} {m.adiantamento ? '💰' : ''}{m.ferias ? ' 🌴' : ''}
                      </option>
                    ))}
                  </select>
                  {cadMotorista && (
                    <div className="flex flex-col gap-1 mt-2 text-xs">
                      {cadTemAdiantamento
                        ? <span className="text-emerald-600 font-medium">✅ Com adiantamento (5% do frete)</span>
                        : <span className="text-slate-500">❌ Sem adiantamento</span>}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-2">
                    <Truck size={14} /> Caminhão *
                  </label>
                  <select value={cadCaminhaoId} onChange={e => {
                    const cam = caminhoes.find(c => c.id === e.target.value)
                    setCadCaminhaoId(e.target.value); setCadCaminhaoPlaca(cam?.placa || '')
                  }} className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all">
                    <option value="">Selecione...</option>
                    {caminhoes.map(c => <option key={c.id} value={c.id}>{c.placa} {c.modelo && `· ${c.modelo}`}</option>)}
                  </select>
                  {cadCaminhaoPlaca && (
                    <p className="text-xs text-emerald-600 mt-2 font-medium">✅ {cadCaminhaoPlaca}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Status</label>
                <select value={cadStatus} onChange={e => setCadStatus(e.target.value)} className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all">
                  <option value="EM ANDAMENTO">EM ANDAMENTO</option>
                  <option value="FINALIZADA">FINALIZADA</option>
                  <option value="CANCELADA">CANCELADA</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Contratos Vinculados</label>
                <ContratoSelector
                  selecionados={cadContratos}
                  todos={[...contratos, ...cadContratos.filter(ec => !contratos.find(c => c.id === ec.id))]}
                  onChange={setCadContratos}
                  nomeMotorista={cadMotorista}
                  setCampos={(dados) => { setCadEmpresa(dados.empresa); setCadValorContrato(dados.valorContrato); setCadQtdVeiculos(dados.qtdVeiculos); setCadOrigem(dados.origem); setCadDestino(dados.destino); setCadValorAdiantamento(dados.adiantamento) }}
                  calcularAdiantamento={calcularAdiantamento}
                  aplicarDadosContratos={aplicarDadosContratos}
                />
              </div>

              <div className="p-6 bg-slate-50 rounded-lg border border-slate-200 space-y-4">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Dados da Carga</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Empresa</label>
                    <input value={cadEmpresa} onChange={e => setCadEmpresa(e.target.value)} className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Qtd. Veículos</label>
                    <input type="number" value={cadQtdVeiculos} onChange={e => setCadQtdVeiculos(e.target.value)} className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-2">
                      <MapPin size={14} /> Origem
                    </label>
                    <input value={cadOrigem} onChange={e => setCadOrigem(e.target.value)} className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-2">
                      <MapPin size={14} /> Destino
                    </label>
                    <input value={cadDestino} onChange={e => setCadDestino(e.target.value)} className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-2">
                    <DollarSign size={14} /> Valor do Contrato (R$)
                  </label>
                  <input type="number" step="0.01" value={cadValorContrato} onChange={e => setCadValorContrato(e.target.value)} className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all" />
                </div>
              </div>

              <div className="p-6 bg-emerald-50 rounded-lg border border-emerald-200 space-y-4">
                <h3 className="text-sm font-bold text-emerald-900 uppercase tracking-wider">Valores Financeiros</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Adiantamento (R$)</label>
                    <input type="number" step="0.01" value={cadValorAdiantamento} onChange={e => setCadValorAdiantamento(e.target.value)} className="w-full px-4 py-3 border border-emerald-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all" />
                    <p className="text-xs text-emerald-600 mt-1">{cadTemAdiantamento ? '5% do frete — editável' : 'Motorista sem adiantamento'}</p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Chapa (R$)</label>
                    <input type="number" step="0.01" value={cadValorChapa} onChange={e => setCadValorChapa(e.target.value)} placeholder="250,00" className="w-full px-4 py-3 border border-emerald-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all" />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Observações</label>
                <textarea value={cadObs} onChange={e => setCadObs(e.target.value)} rows={3} className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all resize-none" />
              </div>

              <div className="flex gap-3 pt-4">
                <button onClick={cadastrar} disabled={loading || !cadMotorista || !cadCaminhaoId}
                  className="flex-1 flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg py-3 text-sm font-semibold transition">
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                  Registrar Viagem
                </button>
                <button onClick={() => setMostraCad(false)} className="flex-1 border border-slate-300 text-slate-700 rounded-lg py-3 text-sm font-semibold hover:bg-slate-50 transition">
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>

        {msg && (
          <div className="fixed bottom-6 right-6 p-4 rounded-lg shadow-lg font-semibold text-sm animate-bounce"
            style={{
              backgroundColor: msg.startsWith('✅') ? '#10b981' : '#f59e0b',
              color: 'white'
            }}>
            {msg}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-2">Viagens</h1>
            <p className="text-slate-600 font-medium">Gerencie todas as viagens registradas</p>
          </div>
          {perm !== 'view' && (
            <button onClick={() => setMostraCad(true)}
              className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors shadow-lg">
              <Plus size={18} /> Registrar Viagem
            </button>
          )}
        </div>

        <div className="mb-8">
          <div className="relative">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={busca} onChange={e => setBusca(e.target.value)}
              placeholder="Buscar por motorista ou placa..."
              className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all text-sm font-medium" />
          </div>
        </div>

        {filtrados.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <MapPin size={48} className="mx-auto text-slate-300 mb-4" />
            <p className="text-slate-600 font-semibold">Nenhuma viagem registrada</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtrados.map(v => {
              const motFerias = motoristas.find(m => m.nome === v.motorista)?.ferias
              const statusColor = v.status === 'FINALIZADA' ? 'from-emerald-600 to-emerald-700' :
                                 v.status === 'CANCELADA' ? 'from-slate-600 to-slate-700' :
                                 'from-blue-600 to-blue-700'
              return (
                <button key={v.id} onClick={() => selecionar(v)}
                  className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-lg hover:border-slate-300 transition-all text-left group">
                  <div className={`bg-gradient-to-r ${statusColor} px-5 py-4 text-white`}>
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-bold text-sm flex items-center gap-2">
                        {v.motorista}
                        {motFerias && <span className="text-[10px] bg-orange-400 px-1.5 py-0.5 rounded-full">🌴</span>}
                      </p>
                      <span className="text-xs font-semibold opacity-90">{v.status}</span>
                    </div>
                    <p className="text-sm opacity-90">{v.caminhao_placa}</p>
                  </div>
                  <div className="p-5 space-y-3">
                    {v.empresa && <p className="text-sm font-semibold text-slate-900">{v.empresa}</p>}
                    {(v.origem || v.destino) && (
                      <div className="flex items-center gap-2 text-xs text-slate-600">
                        <MapPin size={14} />
                        <span>{v.origem} → {v.destino}</span>
                      </div>
                    )}
                    {v.valor_contrato > 0 && (
                      <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                        <span className="text-xs text-slate-600">Contrato:</span>
                        <span className="font-bold text-emerald-600">{v.valor_contrato.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                      </div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {msg && (
        <div className="fixed bottom-6 right-6 p-4 rounded-lg shadow-lg font-semibold text-sm animate-bounce"
          style={{
            backgroundColor: msg.startsWith('✅') ? '#10b981' : '#f59e0b',
            color: 'white'
          }}>
          {msg}
        </div>
      )}
    </div>
  )
}
