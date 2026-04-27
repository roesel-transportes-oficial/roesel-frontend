'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '../services/auth'
import { Search, Plus, ArrowLeft, Save, Trash2, ChevronRight, MapPin, X } from 'lucide-react'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_KEY!

interface Viagem {
  id: string; motorista: string; caminhao_id: string; caminhao_placa: string
  data_saida: string; data_retorno: string; km_inicial: number; km_final: number
  status: string; obs: string
}
interface Motorista { id: string; nome: string }
interface Caminhao { id: string; placa: string; modelo: string }
interface Contrato { id: string; contrato: string; cliente: string; origem: string; destino: string }

const InputClass = "mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-gray-50"
const LabelClass = "text-xs font-semibold text-gray-500 uppercase tracking-wide"

export default function ViagemPage() {
  const { perm } = useAuth()
  const [viagens, setViagens] = useState<Viagem[]>([])
  const [motoristas, setMotoristas] = useState<Motorista[]>([])
  const [caminhoes, setCaminhoes] = useState<Caminhao[]>([])
  const [contratos, setContratos] = useState<Contrato[]>([])
  const [busca, setBusca] = useState('')
  const [sel, setSel] = useState<Viagem | null>(null)
  const [mostraCad, setMostraCad] = useState(false)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [confirmExcluir, setConfirmExcluir] = useState(false)

  // Contratos vinculados
  const [contratosViagem, setContratosViagem] = useState<Contrato[]>([])
  const [contratosBusca, setContratosBusca] = useState('')

  // Campos cadastro
  const [cadMotorista, setCadMotorista] = useState('')
  const [cadCaminhaoId, setCadCaminhaoId] = useState('')
  const [cadCaminhaoPlaca, setCadCaminhaoPlaca] = useState('')
  const [cadDataSaida, setCadDataSaida] = useState(new Date().toISOString().split('T')[0])
  const [cadDataRetorno, setCadDataRetorno] = useState('')
  const [cadKmInicial, setCadKmInicial] = useState('')
  const [cadKmFinal, setCadKmFinal] = useState('')
  const [cadStatus, setCadStatus] = useState('EM ANDAMENTO')
  const [cadObs, setCadObs] = useState('')
  const [cadContratos, setCadContratos] = useState<Contrato[]>([])

  // Campos edição
  const [editMotorista, setEditMotorista] = useState('')
  const [editCaminhaoId, setEditCaminhaoId] = useState('')
  const [editCaminhaoPlaca, setEditCaminhaoPlaca] = useState('')
  const [editDataSaida, setEditDataSaida] = useState('')
  const [editDataRetorno, setEditDataRetorno] = useState('')
  const [editKmInicial, setEditKmInicial] = useState('')
  const [editKmFinal, setEditKmFinal] = useState('')
  const [editStatus, setEditStatus] = useState('EM ANDAMENTO')
  const [editObs, setEditObs] = useState('')
  const [editContratos, setEditContratos] = useState<Contrato[]>([])

  useEffect(() => {
    fetch_()
    fetchMotoristas()
    fetchCaminhoes()
    fetchContratos()
  }, [])

  async function fetch_() {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/viagens?order=data_saida.desc`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
      })
      const data = await res.json()
      setViagens(Array.isArray(data) ? data : [])
    } catch {}
  }

  async function fetchMotoristas() {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/motoristas?ativo=eq.true&order=nome.asc`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
      })
      const data = await res.json()
      setMotoristas(Array.isArray(data) ? data : [])
    } catch {}
  }

  async function fetchCaminhoes() {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/caminhoes?order=placa.asc`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
      })
      const data = await res.json()
      setCaminhoes(Array.isArray(data) ? data : [])
    } catch {}
  }

  async function fetchContratos() {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/contratos?order=contrato.desc`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
      })
      const data = await res.json()
      setContratos(Array.isArray(data) ? data : [])
    } catch {}
  }

  async function fetchContratosViagem(viagemId: string) {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/viagem_contratos?viagem_id=eq.${viagemId}`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
      })
      const data = await res.json()
      if (Array.isArray(data)) {
        const ids = data.map((d: any) => d.contrato_id)
        const found = contratos.filter(c => ids.includes(c.id))
        setEditContratos(found)
      }
    } catch {}
  }

  async function buscarUltimoKm(caminhaoId: string) {
    try {
      // Busca último km de abastecimento
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/abastecimentos?caminhao_id=eq.${caminhaoId}&km=not.is.null&order=data.desc&limit=1`,
        { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
      )
      const data = await res.json()
      if (Array.isArray(data) && data.length > 0 && data[0].km) {
        return String(data[0].km)
      }
      // Busca último km de viagem
      const res2 = await fetch(
        `${SUPABASE_URL}/rest/v1/viagens?caminhao_id=eq.${caminhaoId}&km_final=not.is.null&order=data_saida.desc&limit=1`,
        { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
      )
      const data2 = await res2.json()
      if (Array.isArray(data2) && data2.length > 0 && data2[0].km_final) {
        return String(data2[0].km_final)
      }
    } catch {}
    return ''
  }

  async function buscarUltimoKmFinal(caminhaoId: string) {
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/abastecimentos?caminhao_id=eq.${caminhaoId}&km=not.is.null&order=data.desc&limit=1`,
        { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
      )
      const data = await res.json()
      if (Array.isArray(data) && data.length > 0 && data[0].km) {
        return String(data[0].km)
      }
    } catch {}
    return ''
  }

  function fmtData(d: string) {
    if (!d) return ''
    const [y, m, dia] = d.split('-')
    return `${dia}/${m}/${y}`
  }

  function voltar() { setSel(null); setConfirmExcluir(false) }
  function showMsg(t: string) { setMsg(t); setTimeout(() => setMsg(''), 3000) }

  const filtrados = busca.trim()
    ? viagens.filter(v =>
        v.motorista?.toLowerCase().includes(busca.toLowerCase()) ||
        v.caminhao_placa?.toLowerCase().includes(busca.toLowerCase())
      )
    : viagens

  const contratosFiltrados = contratosBusca.trim()
    ? contratos.filter(c =>
        c.contrato?.includes(contratosBusca) ||
        c.cliente?.toLowerCase().includes(contratosBusca.toLowerCase())
      )
    : contratos

  async function selecionar(v: Viagem) {
    setSel(v)
    setEditMotorista(v.motorista || '')
    setEditCaminhaoId(v.caminhao_id || '')
    setEditCaminhaoPlaca(v.caminhao_placa || '')
    setEditDataSaida(v.data_saida || '')
    setEditDataRetorno(v.data_retorno || '')
    setEditKmInicial(String(v.km_inicial || ''))
    setEditKmFinal(String(v.km_final || ''))
    setEditStatus(v.status || 'EM ANDAMENTO')
    setEditObs(v.obs || '')
    setConfirmExcluir(false)
    await fetchContratosViagem(v.id)
  }

  async function salvarContratosViagem(viagemId: string, contratosLista: Contrato[]) {
    // Remove todos os contratos antigos
    await fetch(`${SUPABASE_URL}/rest/v1/viagem_contratos?viagem_id=eq.${viagemId}`, {
      method: 'DELETE',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
    })
    // Insere os novos
    for (const c of contratosLista) {
      await fetch(`${SUPABASE_URL}/rest/v1/viagem_contratos`, {
        method: 'POST',
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ viagem_id: viagemId, contrato_id: c.id, contrato_numero: c.contrato })
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
          data_saida: editDataSaida, data_retorno: editDataRetorno || null,
          km_inicial: parseInt(editKmInicial) || null, km_final: parseInt(editKmFinal) || null,
          status: editStatus, obs: editObs
        })
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
        body: JSON.stringify({
          motorista: cadMotorista, caminhao_id: cadCaminhaoId, caminhao_placa: cadCaminhaoPlaca,
          data_saida: cadDataSaida, data_retorno: cadDataRetorno || null,
          km_inicial: parseInt(cadKmInicial) || null, km_final: parseInt(cadKmFinal) || null,
          status: cadStatus, obs: cadObs
        })
      })
      const data = await res.json()
      if (Array.isArray(data) && data[0]?.id) {
        await salvarContratosViagem(data[0].id, cadContratos)
      }
    }
    await fetch_(); setLoading(false)
    setCadMotorista(''); setCadCaminhaoId(''); setCadCaminhaoPlaca('')
    setCadDataSaida(new Date().toISOString().split('T')[0]); setCadDataRetorno('')
    setCadKmInicial(''); setCadKmFinal(''); setCadStatus('EM ANDAMENTO'); setCadObs('')
    setCadContratos([])
    setMostraCad(false); showMsg('✅ Viagem registrada!')
  }

  const ContratoSelector = ({ selecionados, onChange }: { selecionados: Contrato[], onChange: (c: Contrato[]) => void }) => (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <div className="p-2 bg-gray-50 border-b border-gray-100">
        <input
          value={contratosBusca}
          onChange={e => setContratosBusca(e.target.value)}
          placeholder="Buscar contrato..."
          className="w-full text-xs px-2 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-red-500 bg-white"
        />
      </div>
      {selecionados.length > 0 && (
        <div className="p-2 flex flex-wrap gap-1 border-b border-gray-100 bg-blue-50">
          {selecionados.map(c => (
            <span key={c.id} className="flex items-center gap-1 text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full">
              #{c.contrato}
              <button onClick={() => onChange(selecionados.filter(s => s.id !== c.id))}>
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="max-h-40 overflow-y-auto">
        {contratosFiltrados.filter(c => !selecionados.find(s => s.id === c.id)).map(c => (
          <button key={c.id} onClick={() => onChange([...selecionados, c])}
            className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 border-b border-gray-50 last:border-0">
            <span className="font-semibold text-gray-700">#{c.contrato}</span>
            <span className="text-gray-500 ml-2">{c.cliente}</span>
            {c.origem && <span className="text-gray-400 ml-1">· {c.origem} → {c.destino}</span>}
          </button>
        ))}
      </div>
    </div>
  )

  if (mostraCad) return (
    <div className="p-6 max-w-2xl mx-auto">
      <button onClick={() => setMostraCad(false)} className="flex items-center gap-2 text-gray-500 hover:text-gray-800 mb-4 text-sm transition">
        <ArrowLeft size={16}/> Voltar
      </button>
      {msg && <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-xl text-sm">{msg}</div>}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-bold text-gray-800 mb-4 text-lg">Nova Viagem</h3>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LabelClass}>Motorista *</label>
              <select value={cadMotorista} onChange={e => setCadMotorista(e.target.value)} className={InputClass}>
                <option value="">Selecione...</option>
                {motoristas.map(m => <option key={m.id} value={m.nome}>{m.nome}</option>)}
              </select>
            </div>
            <div>
              <label className={LabelClass}>Caminhão *</label>
              <select value={cadCaminhaoId} onChange={async e => {
                const cam = caminhoes.find(c => c.id === e.target.value)
                setCadCaminhaoId(e.target.value)
                setCadCaminhaoPlaca(cam?.placa || '')
                if (e.target.value) {
                  const km = await buscarUltimoKm(e.target.value)
                  setCadKmInicial(km)
                  const kmF = await buscarUltimoKmFinal(e.target.value)
                  setCadKmFinal(kmF)
                }
              }} className={InputClass}>
                <option value="">Selecione...</option>
                {caminhoes.map(c => <option key={c.id} value={c.id}>{c.placa} {c.modelo && `· ${c.modelo}`}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LabelClass}>Data Saída</label>
              <input type="date" value={cadDataSaida} onChange={e => setCadDataSaida(e.target.value)} className={InputClass} />
            </div>
            <div>
              <label className={LabelClass}>Data Retorno</label>
              <input type="date" value={cadDataRetorno} onChange={e => setCadDataRetorno(e.target.value)} className={InputClass} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LabelClass}>KM Inicial</label>
              <input type="number" value={cadKmInicial} onChange={e => setCadKmInicial(e.target.value)}
                placeholder="Automático" className={InputClass} />
            </div>
            <div>
              <label className={LabelClass}>KM Final</label>
              <input type="number" value={cadKmFinal} onChange={e => setCadKmFinal(e.target.value)}
                placeholder="Automático" className={InputClass} />
            </div>
          </div>

          <div>
            <label className={LabelClass}>Status</label>
            <select value={cadStatus} onChange={e => setCadStatus(e.target.value)} className={InputClass}>
              <option value="EM ANDAMENTO">EM ANDAMENTO</option>
              <option value="FINALIZADA">FINALIZADA</option>
              <option value="CANCELADA">CANCELADA</option>
            </select>
          </div>

          <div>
            <label className={LabelClass}>Contratos vinculados</label>
            <div className="mt-1">
              <ContratoSelector selecionados={cadContratos} onChange={setCadContratos} />
            </div>
          </div>

          <div>
            <label className={LabelClass}>Observações</label>
            <textarea value={cadObs} onChange={e => setCadObs(e.target.value)} rows={2} className={InputClass} />
          </div>

          <div className="flex gap-2 pt-1">
            <button onClick={cadastrar} disabled={loading || !cadMotorista || !cadCaminhaoId}
              className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl py-2.5 text-sm font-medium transition">
              Registrar viagem
            </button>
            <button onClick={() => setMostraCad(false)}
              className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 transition">
              Cancelar
            </button>
          </div>
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
            <ArrowLeft size={16}/> Voltar
          </button>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-5 bg-gradient-to-r from-red-600 to-red-700">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center text-white">
                  <MapPin size={24} />
                </div>
                <div>
                  <h2 className="text-white font-bold text-xl">{sel.motorista}</h2>
                  <p className="text-white/80 text-sm">{sel.caminhao_placa} · {fmtData(sel.data_saida)} · {sel.status}</p>
                </div>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LabelClass}>Motorista</label>
                  <select value={editMotorista} onChange={e => setEditMotorista(e.target.value)} className={InputClass}>
                    <option value="">Selecione...</option>
                    {motoristas.map(m => <option key={m.id} value={m.nome}>{m.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className={LabelClass}>Caminhão</label>
                  <select value={editCaminhaoId} onChange={e => {
                    const cam = caminhoes.find(c => c.id === e.target.value)
                    setEditCaminhaoId(e.target.value)
                    setEditCaminhaoPlaca(cam?.placa || '')
                  }} className={InputClass}>
                    <option value="">Selecione...</option>
                    {caminhoes.map(c => <option key={c.id} value={c.id}>{c.placa} {c.modelo && `· ${c.modelo}`}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LabelClass}>Data Saída</label>
                  <input type="date" value={editDataSaida} onChange={e => setEditDataSaida(e.target.value)} className={InputClass} />
                </div>
                <div>
                  <label className={LabelClass}>Data Retorno</label>
                  <input type="date" value={editDataRetorno} onChange={e => setEditDataRetorno(e.target.value)} className={InputClass} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LabelClass}>KM Inicial</label>
                  <input type="number" value={editKmInicial} onChange={e => setEditKmInicial(e.target.value)} className={InputClass} />
                </div>
                <div>
                  <label className={LabelClass}>KM Final</label>
                  <input type="number" value={editKmFinal} onChange={e => setEditKmFinal(e.target.value)} className={InputClass} />
                </div>
              </div>

              {editKmInicial && editKmFinal && (
                <div className="bg-blue-50 rounded-xl p-3">
                  <p className="text-xs text-blue-600 font-medium">
                    KM percorrido: <span className="text-blue-800 font-bold">
                      {(parseInt(editKmFinal) - parseInt(editKmInicial)).toLocaleString('pt-BR')} km
                    </span>
                  </p>
                </div>
              )}

              <div>
                <label className={LabelClass}>Status</label>
                <select value={editStatus} onChange={e => setEditStatus(e.target.value)} className={InputClass}>
                  <option value="EM ANDAMENTO">EM ANDAMENTO</option>
                  <option value="FINALIZADA">FINALIZADA</option>
                  <option value="CANCELADA">CANCELADA</option>
                </select>
              </div>

              <div>
                <label className={LabelClass}>Contratos vinculados</label>
                <div className="mt-1">
                  <ContratoSelector selecionados={editContratos} onChange={setEditContratos} />
                </div>
              </div>

              <div>
                <label className={LabelClass}>Observações</label>
                <textarea value={editObs} onChange={e => setEditObs(e.target.value)} rows={2} className={InputClass} />
              </div>

              <div className="flex gap-2 pt-2">
                <button onClick={salvar} disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white rounded-xl py-2.5 text-sm font-medium transition">
                  <Save size={15}/> Salvar alterações
                </button>
                <button onClick={() => setConfirmExcluir(true)}
                  className="flex items-center gap-2 border border-red-200 text-red-500 hover:bg-red-50 rounded-xl px-4 py-2.5 text-sm transition">
                  <Trash2 size={15}/>
                </button>
              </div>

              {confirmExcluir && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
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
                <Plus size={16}/> Registrar
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
            ) : filtrados.map(v => (
              <button key={v.id} onClick={() => selecionar(v)}
                className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition border-b border-gray-50 last:border-0 text-left">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 text-red-600">
                  <MapPin size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900">{v.motorista}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{v.caminhao_placa} · {fmtData(v.data_saida)}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    KM {v.km_inicial?.toLocaleString('pt-BR') || '-'} → {v.km_final?.toLocaleString('pt-BR') || '-'}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    v.status === 'FINALIZADA' ? 'bg-green-100 text-green-700' :
                    v.status === 'CANCELADA' ? 'bg-red-100 text-red-700' :
                    'bg-blue-100 text-blue-700'
                  }`}>
                    {v.status}
                  </span>
                  <ChevronRight size={16} className="text-gray-300 ml-auto mt-1" />
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}