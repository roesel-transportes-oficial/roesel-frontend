'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '../services/auth'
import { Search, Plus, ArrowLeft, Save, Trash2, ChevronRight, MapPin, X } from 'lucide-react'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_KEY!

interface Viagem {
  id: string; motorista: string; caminhao_id: string; caminhao_placa: string
  data_saida: string; data_retorno: string; km_inicial: number; km_final: number
  status: string; obs: string; qtd_veiculos: number; empresa: string
  valor_contrato: number; origem: string; destino: string
  valor_adiantamento: number; valor_chapa: number
}
interface Motorista { id: string; nome: string; adiantamento: boolean }
interface Caminhao { id: string; placa: string; modelo: string }
interface Contrato {
  id: string; contrato: string; cliente: string; origem: string; destino: string
  qtd_veiculos: number; fat_bruto: number
}

const IC = "mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-gray-50"
const LC = "text-xs font-semibold text-gray-500 uppercase tracking-wide"

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
  const [cadQtdVeiculos, setCadQtdVeiculos] = useState('')
  const [cadEmpresa, setCadEmpresa] = useState('')
  const [cadValorContrato, setCadValorContrato] = useState('')
  const [cadOrigem, setCadOrigem] = useState('')
  const [cadDestino, setCadDestino] = useState('')
  const [cadValorAdiantamento, setCadValorAdiantamento] = useState('')
  const [cadValorChapa, setCadValorChapa] = useState('')

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
  const [editQtdVeiculos, setEditQtdVeiculos] = useState('')
  const [editEmpresa, setEditEmpresa] = useState('')
  const [editValorContrato, setEditValorContrato] = useState('')
  const [editOrigem, setEditOrigem] = useState('')
  const [editDestino, setEditDestino] = useState('')
  const [editValorAdiantamento, setEditValorAdiantamento] = useState('')
  const [editValorChapa, setEditValorChapa] = useState('')

  useEffect(() => {
    fetch_(); fetchMotoristas(); fetchCaminhoes(); fetchContratos()
  }, [])

  async function fetch_() {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/viagens?order=data_saida.desc`, {
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
      const res = await fetch(`${SUPABASE_URL}/rest/v1/contratos?order=contrato.desc`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
      })
      setContratos(await res.json())
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
        setEditContratos(contratos.filter(c => ids.includes(c.id)))
      }
    } catch {}
  }

  async function buscarUltimoKm(caminhaoId: string) {
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/abastecimentos?caminhao_id=eq.${caminhaoId}&km=not.is.null&order=data.desc&limit=1`,
        { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
      )
      const data = await res.json()
      if (Array.isArray(data) && data.length > 0 && data[0].km) return String(data[0].km)
      const res2 = await fetch(
        `${SUPABASE_URL}/rest/v1/viagens?caminhao_id=eq.${caminhaoId}&km_final=not.is.null&order=data_saida.desc&limit=1`,
        { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
      )
      const data2 = await res2.json()
      if (Array.isArray(data2) && data2.length > 0 && data2[0].km_final) return String(data2[0].km_final)
    } catch {}
    return ''
  }

  // Calcula adiantamento: 5% do valor total se motorista tem adiantamento, senão 0
  function calcularAdiantamento(nomeMotorista: string, valorContrato: number): string {
    const motorista = motoristas.find(m => m.nome === nomeMotorista)
    if (!motorista || !motorista.adiantamento || !valorContrato) return '0'
    return (valorContrato * 0.05).toFixed(2)
  }

  // Quando seleciona contratos, preenche campos automaticamente
  function aplicarDadosContratos(lista: Contrato[], nomeMotorista: string) {
    if (lista.length === 0) return null
    const primeiro = lista[0]
    const totalValor = lista.reduce((s, c) => s + (c.fat_bruto || 0), 0)
    const totalVeiculos = lista.reduce((s, c) => s + (c.qtd_veiculos || 0), 0)
    const adiantamento = calcularAdiantamento(nomeMotorista, totalValor)
    return {
      empresa: primeiro.cliente || '',
      valorContrato: totalValor > 0 ? String(totalValor) : '',
      qtdVeiculos: totalVeiculos > 0 ? String(totalVeiculos) : '',
      origem: primeiro.origem || '',
      destino: primeiro.destino || '',
      adiantamento,
    }
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
    setEditQtdVeiculos(String(v.qtd_veiculos || ''))
    setEditEmpresa(v.empresa || '')
    setEditValorContrato(String(v.valor_contrato || ''))
    setEditOrigem(v.origem || '')
    setEditDestino(v.destino || '')
    setEditValorAdiantamento(String(v.valor_adiantamento || ''))
    setEditValorChapa(String(v.valor_chapa || ''))
    setConfirmExcluir(false)
    await fetchContratosViagem(v.id)
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
      motorista: p.motorista, caminhao_id: p.caminhaoId, caminhao_placa: p.caminhaoPlaca,
      data_saida: p.dataSaida, data_retorno: p.dataRetorno || null,
      km_inicial: parseInt(p.kmInicial) || null, km_final: parseInt(p.kmFinal) || null,
      status: p.status, obs: p.obs,
      qtd_veiculos: parseInt(p.qtdVeiculos) || null,
      empresa: p.empresa,
      valor_contrato: parseFloat(p.valorContrato) || null,
      origem: p.origem, destino: p.destino,
      valor_adiantamento: parseFloat(p.valorAdiantamento) || null,
      valor_chapa: parseFloat(p.valorChapa) || null,
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
          dataSaida: editDataSaida, dataRetorno: editDataRetorno,
          kmInicial: editKmInicial, kmFinal: editKmFinal,
          status: editStatus, obs: editObs,
          qtdVeiculos: editQtdVeiculos, empresa: editEmpresa,
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
          dataSaida: cadDataSaida, dataRetorno: cadDataRetorno,
          kmInicial: cadKmInicial, kmFinal: cadKmFinal,
          status: cadStatus, obs: cadObs,
          qtdVeiculos: cadQtdVeiculos, empresa: cadEmpresa,
          valorContrato: cadValorContrato, origem: cadOrigem, destino: cadDestino,
          valorAdiantamento: cadValorAdiantamento, valorChapa: cadValorChapa,
        }))
      })
      const data = await res.json()
      if (Array.isArray(data) && data[0]?.id) await salvarContratosViagem(data[0].id, cadContratos)
    }
    await fetch_(); setLoading(false)
    setCadMotorista(''); setCadCaminhaoId(''); setCadCaminhaoPlaca('')
    setCadDataSaida(new Date().toISOString().split('T')[0]); setCadDataRetorno('')
    setCadKmInicial(''); setCadKmFinal(''); setCadStatus('EM ANDAMENTO'); setCadObs('')
    setCadContratos([]); setCadQtdVeiculos(''); setCadEmpresa('')
    setCadValorContrato(''); setCadOrigem(''); setCadDestino('')
    setCadValorAdiantamento(''); setCadValorChapa('')
    setMostraCad(false); showMsg('✅ Viagem registrada!')
  }

  const ContratoSelector = ({
    selecionados, onChange, nomeMotorista, setCampos
  }: {
    selecionados: Contrato[]
    onChange: (c: Contrato[]) => void
    nomeMotorista: string
    setCampos: (dados: any) => void
  }) => (
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
        {contratosFiltrados.filter(c => !selecionados.find(s => s.id === c.id)).map(c => (
          <button key={c.id} onClick={() => {
            const nova = [...selecionados, c]
            onChange(nova)
            const dados = aplicarDadosContratos(nova, nomeMotorista)
            if (dados) setCampos(dados)
          }}
            className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 border-b border-gray-50 last:border-0">
            <span className="font-semibold text-gray-700">#{c.contrato}</span>
            <span className="text-gray-500 ml-2">{c.cliente}</span>
            {c.origem && <span className="text-gray-400 ml-1">· {c.origem} → {c.destino}</span>}
            {c.fat_bruto > 0 && <span className="text-green-600 ml-1">· R$ {c.fat_bruto?.toLocaleString('pt-BR')}</span>}
          </button>
        ))}
      </div>
    </div>
  )

  // Componente de formulário reutilizável
  const FormCampos = ({ modo }: { modo: 'cad' | 'edit' }) => {
    const isCad = modo === 'cad'
    const motorista = isCad ? cadMotorista : editMotorista
    const caminhaoId = isCad ? cadCaminhaoId : editCaminhaoId
    const dataSaida = isCad ? cadDataSaida : editDataSaida
    const setDataSaida = isCad ? setCadDataSaida : setEditDataSaida
    const dataRetorno = isCad ? cadDataRetorno : editDataRetorno
    const setDataRetorno = isCad ? setCadDataRetorno : setEditDataRetorno
    const kmInicial = isCad ? cadKmInicial : editKmInicial
    const setKmInicial = isCad ? setCadKmInicial : setEditKmInicial
    const kmFinal = isCad ? cadKmFinal : editKmFinal
    const setKmFinal = isCad ? setCadKmFinal : setEditKmFinal
    const status = isCad ? cadStatus : editStatus
    const setStatus = isCad ? setCadStatus : setEditStatus
    const obs = isCad ? cadObs : editObs
    const setObs = isCad ? setCadObs : setEditObs
    const contratosAtivos = isCad ? cadContratos : editContratos
    const setContratosAtivos = isCad ? setCadContratos : setEditContratos
    const qtdVeiculos = isCad ? cadQtdVeiculos : editQtdVeiculos
    const setQtdVeiculos = isCad ? setCadQtdVeiculos : setEditQtdVeiculos
    const empresa = isCad ? cadEmpresa : editEmpresa
    const setEmpresa = isCad ? setCadEmpresa : setEditEmpresa
    const valorContrato = isCad ? cadValorContrato : editValorContrato
    const setValorContrato = isCad ? setCadValorContrato : setEditValorContrato
    const origem = isCad ? cadOrigem : editOrigem
    const setOrigem = isCad ? setCadOrigem : setEditOrigem
    const destino = isCad ? cadDestino : editDestino
    const setDestino = isCad ? setCadDestino : setEditDestino
    const valorAdiantamento = isCad ? cadValorAdiantamento : editValorAdiantamento
    const setValorAdiantamento = isCad ? setCadValorAdiantamento : setEditValorAdiantamento
    const valorChapa = isCad ? cadValorChapa : editValorChapa
    const setValorChapa = isCad ? setCadValorChapa : setEditValorChapa

    const temAdiantamento = motoristas.find(m => m.nome === motorista)?.adiantamento

    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LC}>Motorista *</label>
            <select value={motorista} onChange={e => {
              const nome = e.target.value
              if (isCad) setCadMotorista(nome)
              else setEditMotorista(nome)
              // Recalcula adiantamento ao trocar motorista
              const totalValor = contratosAtivos.reduce((s, c) => s + (c.fat_bruto || 0), 0)
              if (totalValor > 0) setValorAdiantamento(calcularAdiantamento(nome, totalValor))
            }} className={IC}>
              <option value="">Selecione...</option>
              {motoristas.map(m => (
                <option key={m.id} value={m.nome}>
                  {m.nome} {m.adiantamento ? '· 💰' : ''}
                </option>
              ))}
            </select>
            {motorista && (
              <p className="text-xs mt-1 font-medium">
                {temAdiantamento
                  ? <span className="text-green-600">✅ Com adiantamento (5% do frete)</span>
                  : <span className="text-gray-400">❌ Sem adiantamento</span>
                }
              </p>
            )}
          </div>
          <div>
            <label className={LC}>Caminhão *</label>
            <select value={caminhaoId} onChange={async e => {
              const cam = caminhoes.find(c => c.id === e.target.value)
              if (isCad) {
                setCadCaminhaoId(e.target.value)
                setCadCaminhaoPlaca(cam?.placa || '')
                if (e.target.value) setCadKmInicial(await buscarUltimoKm(e.target.value))
              } else {
                setEditCaminhaoId(e.target.value)
                setEditCaminhaoPlaca(cam?.placa || '')
              }
            }} className={IC}>
              <option value="">Selecione...</option>
              {caminhoes.map(c => <option key={c.id} value={c.id}>{c.placa} {c.modelo && `· ${c.modelo}`}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LC}>Data Saída</label>
            <input type="date" value={dataSaida} onChange={e => setDataSaida(e.target.value)} className={IC} />
          </div>
          <div>
            <label className={LC}>Data Retorno</label>
            <input type="date" value={dataRetorno} onChange={e => setDataRetorno(e.target.value)} className={IC} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LC}>KM Inicial</label>
            <input type="number" value={kmInicial} onChange={e => setKmInicial(e.target.value)} placeholder="Automático" className={IC} />
          </div>
          <div>
            <label className={LC}>KM Final</label>
            <input type="number" value={kmFinal} onChange={e => setKmFinal(e.target.value)} placeholder="Automático" className={IC} />
          </div>
        </div>

        {kmInicial && kmFinal && (
          <div className="bg-blue-50 rounded-xl p-3">
            <p className="text-xs text-blue-600 font-medium">
              KM percorrido: <span className="font-bold text-blue-800">{(parseInt(kmFinal) - parseInt(kmInicial)).toLocaleString('pt-BR')} km</span>
            </p>
          </div>
        )}

        <div>
          <label className={LC}>Status</label>
          <select value={status} onChange={e => setStatus(e.target.value)} className={IC}>
            <option value="EM ANDAMENTO">EM ANDAMENTO</option>
            <option value="FINALIZADA">FINALIZADA</option>
            <option value="CANCELADA">CANCELADA</option>
          </select>
        </div>

        <div>
          <label className={LC}>Contratos vinculados</label>
          <p className="text-xs text-gray-400 mb-1">Ao selecionar, os campos abaixo são preenchidos automaticamente</p>
          <ContratoSelector
            selecionados={contratosAtivos}
            onChange={setContratosAtivos}
            nomeMotorista={motorista}
            setCampos={(dados) => {
              setEmpresa(dados.empresa)
              setValorContrato(dados.valorContrato)
              setQtdVeiculos(dados.qtdVeiculos)
              setOrigem(dados.origem)
              setDestino(dados.destino)
              setValorAdiantamento(dados.adiantamento)
            }}
          />
        </div>

        {/* Dados da carga */}
        <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 space-y-3">
          <p className="text-xs font-bold text-gray-500 uppercase">Dados da carga</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LC}>Empresa</label>
              <input value={empresa} onChange={e => setEmpresa(e.target.value)} className={IC} placeholder="Ex: SADA" />
            </div>
            <div>
              <label className={LC}>Qtd Veículos</label>
              <input type="number" value={qtdVeiculos} onChange={e => setQtdVeiculos(e.target.value)} className={IC} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LC}>Origem</label>
              <input value={origem} onChange={e => setOrigem(e.target.value)} className={IC} />
            </div>
            <div>
              <label className={LC}>Destino</label>
              <input value={destino} onChange={e => setDestino(e.target.value)} className={IC} />
            </div>
          </div>
          <div>
            <label className={LC}>Valor do Contrato (R$)</label>
            <input type="number" step="0.01" value={valorContrato} onChange={e => {
              setValorContrato(e.target.value)
              setValorAdiantamento(calcularAdiantamento(motorista, parseFloat(e.target.value) || 0))
            }} className={IC} />
          </div>
        </div>

        {/* Valores financeiros */}
        <div className="p-3 bg-green-50 rounded-xl border border-green-100 space-y-3">
          <p className="text-xs font-bold text-green-700 uppercase">Valores financeiros</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LC}>Adiantamento (R$)</label>
              <input
                type="number" step="0.01"
                value={valorAdiantamento}
                onChange={e => setValorAdiantamento(e.target.value)}
                className={IC}
              />
              <p className="text-xs text-gray-400 mt-0.5">
                {temAdiantamento
                  ? '5% do frete — calculado automaticamente, editável'
                  : 'Motorista sem adiantamento'}
              </p>
            </div>
            <div>
              <label className={LC}>Chapa (R$)</label>
              <input type="number" step="0.01" value={valorChapa} onChange={e => setValorChapa(e.target.value)} placeholder="250,00" className={IC} />
              <p className="text-xs text-gray-400 mt-0.5">Deixe em branco se não houver chapa</p>
            </div>
          </div>
        </div>

        <div>
          <label className={LC}>Observações</label>
          <textarea value={obs} onChange={e => setObs(e.target.value)} rows={2} className={IC} />
        </div>
      </div>
    )
  }

  if (mostraCad) return (
    <div className="p-6 max-w-2xl mx-auto">
      <button onClick={() => setMostraCad(false)} className="flex items-center gap-2 text-gray-500 hover:text-gray-800 mb-4 text-sm transition">
        <ArrowLeft size={16}/> Voltar
      </button>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-bold text-gray-800 mb-4 text-lg">Nova Viagem</h3>
        <FormCampos modo="cad" />
        <div className="flex gap-2 pt-4">
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
                  <p className="text-white/80 text-sm">
                    {sel.caminhao_placa} · {fmtData(sel.data_saida)} · {sel.status}
                    {sel.empresa && ` · ${sel.empresa}`}
                  </p>
                </div>
              </div>
            </div>
            <div className="p-5">
              <FormCampos modo="edit" />
              <div className="flex gap-2 pt-4">
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
                  <p className="text-xs text-gray-500 mt-0.5">
                    {v.caminhao_placa} · {fmtData(v.data_saida)}
                    {v.empresa && ` · ${v.empresa}`}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    KM {v.km_inicial?.toLocaleString('pt-BR') || '-'} → {v.km_final?.toLocaleString('pt-BR') || '-'}
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
                    v.status === 'CANCELADA' ? 'bg-red-100 text-red-700' :
                    'bg-blue-100 text-blue-700'
                  }`}>{v.status}</span>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}