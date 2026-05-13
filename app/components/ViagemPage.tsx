'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '../services/auth'
import { Search, Plus, Save, Trash2, MapPin, X, Palmtree } from 'lucide-react'

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

const IC = "mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-gray-50"
const LC = "text-xs font-semibold text-gray-500 uppercase tracking-wide"

function ContratoSelector({ selecionados, todos, onChange, nomeMotorista, setCampos, calcularAdiantamento, aplicarDadosContratos }:
  { selecionados: Contrato[]; todos: Contrato[]; onChange: (c: Contrato[]) => void; nomeMotorista: string; setCampos: (d: any) => void; calcularAdiantamento: (n: string, v: number) => string; aplicarDadosContratos: (l: Contrato[], n: string) => any }
) {
  const [busca, setBusca] = useState('')
  const filtrados = busca.trim()
    ? todos.filter(c => c.contrato?.includes(busca) || c.cliente?.toLowerCase().includes(busca.toLowerCase()))
    : todos

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <div className="p-2 bg-gray-50 border-b border-gray-100">
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar contrato..."
          className="w-full text-xs px-2 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-red-500 bg-white" />
      </div>
      {selecionados.length > 0 && (
        <div className="p-2 flex flex-wrap gap-1 border-b border-gray-100 bg-blue-50">
          {selecionados.map(c => (
            <span key={c.id} className="flex items-center gap-1 text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full">
              #{c.contrato} · {c.cliente}
              <button onClick={() => {
                const nova = selecionados.filter(s => s.id !== c.id)
                onChange(nova)
                const dados = aplicarDadosContratos(nova, nomeMotorista)
                if (dados) setCampos(dados)
                else setCampos({ empresa: '', valorContrato: '', qtdVeiculos: '', origem: '', destino: '', adiantamento: '0' })
              }}><X size={10} /></button>
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
          }} className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 border-b border-gray-50 last:border-0">
            <span className="font-semibold text-gray-700">#{c.contrato}</span>
            <span className="text-gray-500 ml-2">{c.cliente}</span>
            {c.origem && <span className="text-gray-400 ml-1">· {c.origem} → {c.destino}</span>}
            {c.fat_bruto > 0 && <span className="text-green-600 ml-1">· R$ {c.fat_bruto?.toLocaleString('pt-BR')}</span>}
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

  // ✅ Busca caminhão do motorista respeitando férias/substituto
  async function buscarCaminhaoPorMotorista(nomeMotorista: string): Promise<{ id: string; placa: string } | null> {
    try {
      // 1. Busca o motorista pelo nome para pegar o ID
      const resM = await fetch(
        `${SUPABASE_URL}/rest/v1/motoristas?nome=eq.${encodeURIComponent(nomeMotorista)}&limit=1`,
        { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
      )
      const motData = await resM.json()
      if (!Array.isArray(motData) || !motData[0]) return null

      const motId = motData[0].id
      const emFerias = motData[0].ferias === true

      // 2. Busca o caminhão onde motorista_atual = motId
      const resC = await fetch(
        `${SUPABASE_URL}/rest/v1/caminhoes?motorista_atual=eq.${motId}&limit=1`,
        { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
      )
      const camData = await resC.json()
      if (Array.isArray(camData) && camData[0]) return { id: camData[0].id, placa: camData[0].placa }

      // 3. Se está de férias e tem caminhao_temp_id, usa esse
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

  // ✅ Busca caminhão por placa (fallback para viagens migradas)
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

  // ✅ Ao abrir viagem: resolve caminhão + calcula adiantamento automaticamente
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

    // Resolve caminhão: tenta por ID, depois por placa, depois pelo motorista
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

    // Calcula adiantamento se não estiver definido
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

  // ✅ Ao selecionar motorista no formulário: auto-preenche caminhão
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
    for (const c of lista) {
      await fetch(`${SUPABASE_URL}/rest/v1/viagem_contratos`, {
        method: 'POST',
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ viagem_id: viagemId, contrato_id: c.id, contrato_numero: c.contrato })
      })
    }
  }

  function buildPayload(p: any) {
    return {
      motorista:          p.motorista,
      caminhao_id:        p.caminhaoId || null,
      caminhao_placa:     p.caminhaoPlaca,
      status:             p.status,
      obs:                p.obs,
      qtd_veiculos:       parseInt(p.qtdVeiculos) || null,
      empresa:            p.empresa,
      valor_contrato:     parseFloat(p.valorContrato) || null,
      origem:             p.origem,
      destino:            p.destino,
      valor_adiantamento: parseFloat(p.valorAdiantamento) || null,
      valor_chapa:        parseFloat(p.valorChapa) || null,
    }
  }

  async function salvar() {
    if (!sel) return
    setLoading(true)
    if (perm !== 'demo') {
      await fetch(`${SUPABASE_URL}/rest/v1/viagens?id=eq.${sel.id}`, {
        method: 'PATCH',
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify(buildPayload({
          motorista: editMotorista, caminhaoId: editCaminhaoId, caminhaoPlaca: editCaminhaoPlaca,
          status: editStatus, obs: editObs, qtdVeiculos: editQtdVeiculos, empresa: editEmpresa,
          valorContrato: editValorContrato, origem: editOrigem, destino: editDestino,
          valorAdiantamento: editValorAdiantamento, valorChapa: editValorChapa,
        }))
      })
      await salvarContratosViagem(sel.id, editContratos)
    }
    await fetch_(); setLoading(false); voltar(); showMsg('✅ Atualizado!')
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
        body: JSON.stringify(buildPayload({
          motorista: cadMotorista, caminhaoId: cadCaminhaoId, caminhaoPlaca: cadCaminhaoPlaca,
          status: cadStatus, obs: cadObs, qtdVeiculos: cadQtdVeiculos, empresa: cadEmpresa,
          valorContrato: cadValorContrato, origem: cadOrigem, destino: cadDestino,
          valorAdiantamento: cadValorAdiantamento, valorChapa: cadValorChapa,
        }))
      })
      const data = await res.json()
      if (Array.isArray(data) && data[0]?.id) await salvarContratosViagem(data[0].id, cadContratos)
    }
    await fetch_(); setLoading(false)
    setCadMotorista(''); setCadCaminhaoId(''); setCadCaminhaoPlaca('')
    setCadStatus('EM ANDAMENTO'); setCadObs(''); setCadContratos([])
    setCadQtdVeiculos(''); setCadEmpresa(''); setCadValorContrato('')
    setCadOrigem(''); setCadDestino(''); setCadValorAdiantamento(''); setCadValorChapa('')
    setMostraCad(false); showMsg('✅ Viagem registrada!')
    fetchContratos()
  }

  const cadTemAdiantamento  = motoristas.find(m => m.nome === cadMotorista)?.adiantamento
  const editTemAdiantamento = motoristas.find(m => m.nome === editMotorista)?.adiantamento
  const editEmFerias        = motoristas.find(m => m.nome === editMotorista)?.ferias
  const cadEmFerias         = motoristas.find(m => m.nome === cadMotorista)?.ferias

  if (mostraCad) return (
    <div className="p-6 max-w-2xl mx-auto">
      <button onClick={() => setMostraCad(false)} className="flex items-center gap-2 text-gray-500 hover:text-gray-800 mb-4 text-sm transition">
        ← Voltar
      </button>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-bold text-gray-800 mb-4 text-lg">Nova Viagem</h3>
        <div className="space-y-3">

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LC}>Motorista *</label>
              <select value={cadMotorista} onChange={async e => {
                const nome = e.target.value
                setCadMotorista(nome)
                // Auto-preenche caminhão
                await onMotoristaChange(nome, setCadCaminhaoId, setCadCaminhaoPlaca)
                // Recalcula adiantamento
                const totalValor = cadContratos.reduce((s, c) => s + (c.fat_bruto || 0), 0)
                if (totalValor > 0) setCadValorAdiantamento(calcularAdiantamento(nome, totalValor))
              }} className={IC}>
                <option value="">Selecione...</option>
                {motoristas.map(m => (
                  <option key={m.id} value={m.nome}>
                    {m.nome} {m.adiantamento ? '· 💰' : ''}{m.ferias ? ' · 🌴' : ''}
                  </option>
                ))}
              </select>
              {cadMotorista && (
                <div className="flex flex-col gap-0.5 mt-1">
                  {cadTemAdiantamento
                    ? <span className="text-xs text-green-600 font-medium">✅ Com adiantamento (5% do frete)</span>
                    : <span className="text-xs text-gray-400">❌ Sem adiantamento</span>}
                  {cadEmFerias && <span className="text-xs text-orange-500 font-medium">🌴 Motorista em férias</span>}
                </div>
              )}
            </div>
            <div>
              <label className={LC}>Caminhão *</label>
              <select value={cadCaminhaoId} onChange={e => {
                const cam = caminhoes.find(c => c.id === e.target.value)
                setCadCaminhaoId(e.target.value); setCadCaminhaoPlaca(cam?.placa || '')
              }} className={IC}>
                <option value="">Selecione...</option>
                {caminhoes.map(c => <option key={c.id} value={c.id}>{c.placa} {c.modelo && `· ${c.modelo}`}</option>)}
              </select>
              {cadCaminhaoPlaca && (
                <p className="text-xs text-green-600 mt-1">✅ {cadCaminhaoPlaca} vinculado automaticamente</p>
              )}
            </div>
          </div>

          <div>
            <label className={LC}>Status</label>
            <select value={cadStatus} onChange={e => setCadStatus(e.target.value)} className={IC}>
              <option value="EM ANDAMENTO">EM ANDAMENTO</option>
              <option value="FINALIZADA">FINALIZADA</option>
              <option value="CANCELADA">CANCELADA</option>
            </select>
          </div>

          <div>
            <label className={LC}>Contratos vinculados</label>
            <p className="text-xs text-gray-400 mb-1">Apenas contratos sem viagem vinculada aparecem aqui</p>
            <ContratoSelector
              selecionados={cadContratos} todos={contratos} onChange={setCadContratos}
              nomeMotorista={cadMotorista}
              setCampos={(dados) => { setCadEmpresa(dados.empresa); setCadValorContrato(dados.valorContrato); setCadQtdVeiculos(dados.qtdVeiculos); setCadOrigem(dados.origem); setCadDestino(dados.destino); setCadValorAdiantamento(dados.adiantamento) }}
              calcularAdiantamento={calcularAdiantamento}
              aplicarDadosContratos={aplicarDadosContratos}
            />
          </div>

          <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 space-y-3">
            <p className="text-xs font-bold text-gray-500 uppercase">Dados da carga</p>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={LC}>Empresa</label><input value={cadEmpresa} onChange={e => setCadEmpresa(e.target.value)} className={IC} /></div>
              <div><label className={LC}>Qtd Veículos</label><input type="number" value={cadQtdVeiculos} onChange={e => setCadQtdVeiculos(e.target.value)} className={IC} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={LC}>Origem</label><input value={cadOrigem} onChange={e => setCadOrigem(e.target.value)} className={IC} /></div>
              <div><label className={LC}>Destino</label><input value={cadDestino} onChange={e => setCadDestino(e.target.value)} className={IC} /></div>
            </div>
            <div>
              <label className={LC}>Valor do Contrato (R$)</label>
              <input type="number" step="0.01" value={cadValorContrato} onChange={e => {
                setCadValorContrato(e.target.value)
                setCadValorAdiantamento(calcularAdiantamento(cadMotorista, parseFloat(e.target.value) || 0))
              }} className={IC} />
            </div>
          </div>

          <div className="p-3 bg-green-50 rounded-xl border border-green-100 space-y-3">
            <p className="text-xs font-bold text-green-700 uppercase">Valores financeiros</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LC}>Adiantamento (R$)</label>
                <input type="number" step="0.01" value={cadValorAdiantamento} onChange={e => setCadValorAdiantamento(e.target.value)} className={IC} />
                <p className="text-xs text-gray-400 mt-0.5">{cadTemAdiantamento ? '5% do frete — editável' : 'Motorista sem adiantamento'}</p>
              </div>
              <div><label className={LC}>Chapa (R$)</label><input type="number" step="0.01" value={cadValorChapa} onChange={e => setCadValorChapa(e.target.value)} placeholder="250,00" className={IC} /></div>
            </div>
          </div>

          <div><label className={LC}>Observações</label><textarea value={cadObs} onChange={e => setCadObs(e.target.value)} rows={2} className={IC} /></div>
        </div>

        <div className="flex gap-2 pt-4">
          <button onClick={cadastrar} disabled={loading || !cadMotorista || !cadCaminhaoId}
            className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl py-2.5 text-sm font-medium transition">
            Registrar viagem
          </button>
          <button onClick={() => setMostraCad(false)} className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 transition">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {msg && <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-xl text-sm">{msg}</div>}

      {sel ? (
        <div>
          <button onClick={voltar} className="flex items-center gap-2 text-gray-500 hover:text-gray-800 mb-4 text-sm transition">
            ← Voltar
          </button>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-5 bg-gradient-to-r from-red-600 to-red-700">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center text-white">
                  <MapPin size={24} />
                </div>
                <div>
                  <h2 className="text-white font-bold text-xl flex items-center gap-2">
                    {sel.motorista}
                    {editEmFerias && <span className="text-xs bg-orange-400 px-2 py-0.5 rounded-full flex items-center gap-1"><Palmtree size={10} /> Férias</span>}
                  </h2>
                  <p className="text-white/80 text-sm">
                    {editCaminhaoPlaca || sel.caminhao_placa} · {sel.status}{sel.empresa && ` · ${sel.empresa}`}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LC}>Motorista *</label>
                  <select value={editMotorista} onChange={async e => {
                    const nome = e.target.value
                    setEditMotorista(nome)
                    // Auto-preenche caminhão
                    await onMotoristaChange(nome, setEditCaminhaoId, setEditCaminhaoPlaca)
                    // Recalcula adiantamento
                    const totalValor = editContratos.reduce((s, c) => s + (c.fat_bruto || 0), 0)
                    if (totalValor > 0) setEditValorAdiantamento(calcularAdiantamento(nome, totalValor))
                  }} className={IC}>
                    <option value="">Selecione...</option>
                    {motoristas.map(m => (
                      <option key={m.id} value={m.nome}>
                        {m.nome} {m.adiantamento ? '· 💰' : ''}{m.ferias ? ' · 🌴' : ''}
                      </option>
                    ))}
                  </select>
                  {editMotorista && (
                    <div className="flex flex-col gap-0.5 mt-1">
                      {editTemAdiantamento
                        ? <span className="text-xs text-green-600 font-medium">✅ Com adiantamento (5% do frete)</span>
                        : <span className="text-xs text-gray-400">❌ Sem adiantamento</span>}
                      {editEmFerias && <span className="text-xs text-orange-500 font-medium">🌴 Motorista em férias</span>}
                    </div>
                  )}
                </div>
                <div>
                  <label className={LC}>Caminhão *</label>
                  <select value={editCaminhaoId} onChange={e => {
                    const cam = caminhoes.find(c => c.id === e.target.value)
                    setEditCaminhaoId(e.target.value); setEditCaminhaoPlaca(cam?.placa || '')
                  }} className={IC}>
                    <option value="">Selecione...</option>
                    {caminhoes.map(c => <option key={c.id} value={c.id}>{c.placa} {c.modelo && `· ${c.modelo}`}</option>)}
                  </select>
                  {editCaminhaoPlaca && (
                    <p className="text-xs text-green-600 mt-1">✅ {editCaminhaoPlaca}</p>
                  )}
                </div>
              </div>

              <div>
                <label className={LC}>Status</label>
                <select value={editStatus} onChange={e => setEditStatus(e.target.value)} className={IC}>
                  <option value="EM ANDAMENTO">EM ANDAMENTO</option>
                  <option value="FINALIZADA">FINALIZADA</option>
                  <option value="CANCELADA">CANCELADA</option>
                </select>
              </div>

              <div>
                <label className={LC}>Contratos vinculados</label>
                <ContratoSelector
                  selecionados={editContratos}
                  todos={[...contratos, ...editContratos.filter(ec => !contratos.find(c => c.id === ec.id))]}
                  onChange={setEditContratos}
                  nomeMotorista={editMotorista}
                  setCampos={(dados) => { setEditEmpresa(dados.empresa); setEditValorContrato(dados.valorContrato); setEditQtdVeiculos(dados.qtdVeiculos); setEditOrigem(dados.origem); setEditDestino(dados.destino); setEditValorAdiantamento(dados.adiantamento) }}
                  calcularAdiantamento={calcularAdiantamento}
                  aplicarDadosContratos={aplicarDadosContratos}
                />
              </div>

              <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 space-y-3">
                <p className="text-xs font-bold text-gray-500 uppercase">Dados da carga</p>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className={LC}>Empresa</label><input value={editEmpresa} onChange={e => setEditEmpresa(e.target.value)} className={IC} /></div>
                  <div><label className={LC}>Qtd Veículos</label><input type="number" value={editQtdVeiculos} onChange={e => setEditQtdVeiculos(e.target.value)} className={IC} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className={LC}>Origem</label><input value={editOrigem} onChange={e => setEditOrigem(e.target.value)} className={IC} /></div>
                  <div><label className={LC}>Destino</label><input value={editDestino} onChange={e => setEditDestino(e.target.value)} className={IC} /></div>
                </div>
                <div>
                  <label className={LC}>Valor do Contrato (R$)</label>
                  <input type="number" step="0.01" value={editValorContrato} onChange={e => {
                    setEditValorContrato(e.target.value)
                    setEditValorAdiantamento(calcularAdiantamento(editMotorista, parseFloat(e.target.value) || 0))
                  }} className={IC} />
                </div>
              </div>

              <div className="p-3 bg-green-50 rounded-xl border border-green-100 space-y-3">
                <p className="text-xs font-bold text-green-700 uppercase">Valores financeiros</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={LC}>Adiantamento (R$)</label>
                    <input type="number" step="0.01" value={editValorAdiantamento} onChange={e => setEditValorAdiantamento(e.target.value)} className={IC} />
                    <p className="text-xs text-gray-400 mt-0.5">{editTemAdiantamento ? '5% do frete — editável' : 'Motorista sem adiantamento'}</p>
                  </div>
                  <div><label className={LC}>Chapa (R$)</label><input type="number" step="0.01" value={editValorChapa} onChange={e => setEditValorChapa(e.target.value)} placeholder="250,00" className={IC} /></div>
                </div>
              </div>

              <div><label className={LC}>Observações</label><textarea value={editObs} onChange={e => setEditObs(e.target.value)} rows={2} className={IC} /></div>

              <div className="flex gap-2 pt-4">
                <button onClick={salvar} disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white rounded-xl py-2.5 text-sm font-medium transition">
                  <Save size={15} /> Salvar alterações
                </button>
                <button onClick={() => setConfirmExcluir(true)}
                  className="flex items-center gap-2 border border-red-200 text-red-500 hover:bg-red-50 rounded-xl px-4 py-2.5 text-sm transition">
                  <Trash2 size={15} />
                </button>
              </div>

              {confirmExcluir && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl mt-3">
                  <p className="text-sm text-red-700 font-medium mb-3">⚠️ Excluir esta viagem?</p>
                  <div className="flex gap-2">
                    <button onClick={excluir} className="flex-1 bg-red-600 text-white rounded-lg py-2 text-sm font-medium">Confirmar</button>
                    <button onClick={() => setConfirmExcluir(false)} className="flex-1 border border-gray-300 rounded-lg py-2 text-sm">Cancelar</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-5">
            <h1 className="text-2xl font-bold text-gray-900">Viagens</h1>
            {perm !== 'view' && (
              <button onClick={() => setMostraCad(true)}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition shadow-sm">
                <Plus size={16} /> Registrar
              </button>
            )}
          </div>
          <div className="relative mb-4">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={busca} onChange={e => setBusca(e.target.value)}
              placeholder="Buscar por motorista ou placa..."
              className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-white shadow-sm" />
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Viagens</p>
              <p className="text-xs text-gray-400">{filtrados.length} registro(s)</p>
            </div>
            {filtrados.length === 0 ? (
              <div className="p-10 text-center">
                <MapPin size={32} className="mx-auto text-gray-200 mb-2" />
                <p className="text-sm text-gray-400">Nenhuma viagem registrada</p>
              </div>
            ) : filtrados.map(v => {
              const motFerias = motoristas.find(m => m.nome === v.motorista)?.ferias
              return (
                <button key={v.id} onClick={() => selecionar(v)}
                  className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition border-b border-gray-50 last:border-0 text-left">
                  <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 text-red-600">
                    {motFerias ? <Palmtree size={18} /> : <MapPin size={18} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 flex items-center gap-2">
                      {v.motorista}
                      {motFerias && <span className="text-[10px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full font-semibold">Férias</span>}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {v.caminhao_placa}{v.empresa && ` · ${v.empresa}`}
                      {v.origem && ` · ${v.origem} → ${v.destino}`}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {v.valor_contrato > 0 && (
                      <p className="text-xs font-semibold text-gray-700 mb-1">
                        {v.valor_contrato.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </p>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      v.status === 'FINALIZADA' ? 'bg-green-100 text-green-700' :
                      v.status === 'CANCELADA'  ? 'bg-red-100 text-red-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>{v.status}</span>
                  </div>
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}