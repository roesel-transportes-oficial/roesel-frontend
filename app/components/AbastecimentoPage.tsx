'use client'
import { useState, useEffect, useRef, useMemo } from 'react'
import { caminhoesAPI } from '../services/api'
import { useAuth } from '../services/auth'
import { Plus, ArrowLeft, Save, Trash2, ChevronRight, Fuel, Upload, Loader2, Filter } from 'lucide-react'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_KEY!

interface Abastecimento {
  id: string; data: string; caminhao_id: string; caminhao_placa: string
  motorista: string; posto: string; cnpj_posto: string; estado: string; cidade: string
  litros_combustivel: number; valor_litro_combustivel: number
  litros_arla: number; valor_litro_arla: number
  total: number; km: number; obs: string; viagem_id: string; desconto: number
}
interface Caminhao   { id: string; placa: string; modelo: string; motorista_atual: string }
interface Fornecedor { id: string; nome: string; cnpj: string; cidade: string; estado: string }
interface Viagem     { id: string; motorista: string; caminhao_placa: string; data_saida: string; status: string; empresa: string; origem: string; destino: string }

const IC = "mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-gray-50"
const LC = "text-xs font-semibold text-gray-500 uppercase tracking-wide"
const ESTADOS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']

async function supaFetch(path: string, method = 'GET', body?: any) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: method === 'POST' ? 'return=representation' : 'return=minimal',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(await res.text())
  if (res.status === 204 || method === 'PATCH' || method === 'DELETE') return null
  return res.json()
}

export default function AbastecimentoPage() {
  const { perm } = useAuth()
  const [abastecimentos, setAbastecimentos] = useState<Abastecimento[]>([])
  const [caminhoes, setCaminhoes]           = useState<Caminhao[]>([])
  const [fornecedores, setFornecedores]     = useState<Fornecedor[]>([])
  const [sel, setSel]                       = useState<Abastecimento | null>(null)
  const [mostraCad, setMostraCad]           = useState(false)
  const [loading, setLoading]               = useState(false)
  const [loadingIA, setLoadingIA]           = useState(false)
  const [msg, setMsg]                       = useState('')
  const [confirmExcluir, setConfirmExcluir] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [viagensCaminhao, setViagensCaminhao] = useState<Viagem[]>([])

  // filtros
  const [filtroMotorista, setFiltroMotorista] = useState('')
  const [filtroInicio, setFiltroInicio]       = useState('')
  const [filtroFim, setFiltroFim]             = useState('')

  // edit
  const [editData, setEditData]                   = useState('')
  const [editCaminhaoId, setEditCaminhaoId]       = useState('')
  const [editCaminhaoPlaca, setEditCaminhaoPlaca] = useState('')
  const [editMotorista, setEditMotorista]         = useState('')
  const [editPosto, setEditPosto]                 = useState('')
  const [editCnpjPosto, setEditCnpjPosto]         = useState('')
  const [editEstado, setEditEstado]               = useState('')
  const [editCidade, setEditCidade]               = useState('')
  const [editLitrosComb, setEditLitrosComb]       = useState('')
  const [editValorLitroComb, setEditValorLitroComb] = useState('')
  const [editLitrosArla, setEditLitrosArla]       = useState('')
  const [editValorLitroArla, setEditValorLitroArla] = useState('')
  const [editKm, setEditKm]                       = useState('')
  const [editObs, setEditObs]                     = useState('')
  const [editUsaArla, setEditUsaArla]             = useState(false)
  const [editViagemId, setEditViagemId]           = useState('')
  const [editDesconto, setEditDesconto]           = useState('')

  // cad
  const [cadData, setCadData]                     = useState(new Date().toISOString().split('T')[0])
  const [cadCaminhaoId, setCadCaminhaoId]         = useState('')
  const [cadCaminhaoPlaca, setCadCaminhaoPlaca]   = useState('')
  const [cadMotorista, setCadMotorista]           = useState('')
  const [cadPosto, setCadPosto]                   = useState('')
  const [cadCnpjPosto, setCadCnpjPosto]           = useState('')
  const [cadEstado, setCadEstado]                 = useState('')
  const [cadCidade, setCadCidade]                 = useState('')
  const [cadLitrosComb, setCadLitrosComb]         = useState('')
  const [cadValorLitroComb, setCadValorLitroComb] = useState('')
  const [cadLitrosArla, setCadLitrosArla]         = useState('')
  const [cadValorLitroArla, setCadValorLitroArla] = useState('')
  const [cadKm, setCadKm]                         = useState('')
  const [cadObs, setCadObs]                       = useState('')
  const [usaArla, setUsaArla]                     = useState(false)
  const [cadViagemId, setCadViagemId]             = useState('')
  const [cadDesconto, setCadDesconto]             = useState('')

  useEffect(() => {
    fetch_()
    caminhoesAPI.listar().then(setCaminhoes).catch(() => {})
    fetchFornecedores()
  }, [])

  // ── Direto no Supabase (garante todos os campos incluindo km) ──
  async function fetch_() {
    try {
      const data = await supaFetch('abastecimentos?order=data.desc')
      setAbastecimentos(Array.isArray(data) ? data : [])
    } catch {}
  }

  async function fetchFornecedores() {
    try {
      const data = await supaFetch('fornecedores?order=nome.asc')
      setFornecedores(Array.isArray(data) ? data : [])
    } catch {}
  }

  async function fetchViagensCaminhao(caminhaoId: string) {
    if (!caminhaoId) { setViagensCaminhao([]); return }
    try {
      const data = await supaFetch(`viagens?caminhao_id=eq.${caminhaoId}&order=created_at.desc&limit=20`)
      setViagensCaminhao(Array.isArray(data) ? data : [])
    } catch { setViagensCaminhao([]) }
  }

  function buildPayload(p: {
    data: string; caminhao_id: string; caminhao_placa: string; motorista: string
    posto: string; cnpj_posto: string; estado: string; cidade: string
    litros_combustivel: number; valor_litro_combustivel: number
    litros_arla: number; valor_litro_arla: number
    km: number | null; total: number; obs: string; viagem_id: string | null; desconto: number
  }) { return p }

  function calcTotal(lc: string, vlc: string, la: string, vla: string, desc: string) {
    return (parseFloat(lc)||0)*(parseFloat(vlc)||0) + (parseFloat(la)||0)*(parseFloat(vla)||0) - (parseFloat(desc)||0)
  }

  function fmtData(d: string) {
    if (!d) return ''
    const [y, m, dia] = d.split('-')
    return `${dia}/${m}/${y}`
  }

  function preencherFornecedor(cnpj: string, modo: 'cad' | 'edit') {
    const f = fornecedores.find(f => f.cnpj?.replace(/\D/g,'') === cnpj.replace(/\D/g,''))
    if (!f) return
    if (modo === 'cad') { setCadPosto(f.nome); setCadCidade(f.cidade||''); setCadEstado(f.estado||''); setCadCnpjPosto(f.cnpj||'') }
    else { setEditPosto(f.nome); setEditCidade(f.cidade||''); setEditEstado(f.estado||''); setEditCnpjPosto(f.cnpj||'') }
  }

  function selecionarFornecedor(valor: string, modo: 'cad' | 'edit') {
    if (!valor) {
      if (modo === 'cad') { setCadPosto(''); setCadCnpjPosto(''); setCadCidade(''); setCadEstado('') }
      else { setEditPosto(''); setEditCnpjPosto(''); setEditCidade(''); setEditEstado('') }
      return
    }
    const [nome, cnpj] = valor.split('||')
    const f = fornecedores.find(f => f.nome === nome)
    if (modo === 'cad') { setCadPosto(nome); setCadCnpjPosto(cnpj||f?.cnpj||''); setCadCidade(f?.cidade||''); setCadEstado(f?.estado||'') }
    else { setEditPosto(nome); setEditCnpjPosto(cnpj||f?.cnpj||''); setEditCidade(f?.cidade||''); setEditEstado(f?.estado||'') }
  }

  function fornecedorVal(nome: string) {
    const f = fornecedores.find(f => f.nome === nome)
    return f ? `${f.nome}||${f.cnpj||''}` : ''
  }

  function fmtCnpj(v: string) {
    const d = v.replace(/\D/g,'').slice(0,14)
    if (d.length <= 2) return d
    if (d.length <= 5) return `${d.slice(0,2)}.${d.slice(2)}`
    if (d.length <= 8) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5)}`
    if (d.length <= 12) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8)}`
    return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`
  }

  async function lerCupomComIA(file: File) {
    setLoadingIA(true)
    try {
      const base64 = await new Promise<string>((res, rej) => {
        const r = new FileReader()
        r.onload = () => res((r.result as string).split(',')[1])
        r.onerror = () => rej()
        r.readAsDataURL(file)
      })
      const mediaType = file.type === 'application/pdf' ? 'application/pdf' : file.type === 'image/png' ? 'image/png' : 'image/jpeg'
      const res = await fetch('/api/ler-cupom', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64, mediaType }),
      })
      const json = await res.json()
      if (!json.ok) { showMsg('⚠️ ' + (json.erro || 'Não foi possível extrair os dados.')); return }
      const d = json.dados
      if (d.data_abastecimento) setCadData(d.data_abastecimento)
      if (d.km) setCadKm(String(d.km))
      if (d.litros_combustivel) setCadLitrosComb(String(d.litros_combustivel))
      if (d.valor_litro_combustivel) setCadValorLitroComb(String(d.valor_litro_combustivel))
      if (d.litros_arla && d.litros_arla > 0) { setUsaArla(true); setCadLitrosArla(String(d.litros_arla)); if (d.valor_litro_arla) setCadValorLitroArla(String(d.valor_litro_arla)) }
      if (d.cnpj_posto) {
        const cnpjLimpo = d.cnpj_posto.replace(/\D/g,'')
        const found = fornecedores.find(f => f.cnpj?.replace(/\D/g,'') === cnpjLimpo)
        if (found) { setCadPosto(found.nome); setCadCnpjPosto(found.cnpj||''); setCadCidade(found.cidade||''); setCadEstado(found.estado||'') }
        else { setCadCnpjPosto(d.cnpj_posto); if (d.cidade) setCadCidade(d.cidade); if (d.estado) setCadEstado(d.estado); if (d.nome_posto) setCadPosto(d.nome_posto) }
      }
      if (d.placa) {
        const cam = caminhoes.find(c => c.placa.replace(/[^A-Z0-9]/gi,'').toLowerCase() === d.placa.replace(/[^A-Z0-9]/gi,'').toLowerCase())
        if (cam) { setCadCaminhaoId(cam.id); setCadCaminhaoPlaca(cam.placa); setCadMotorista(cam.motorista_atual||''); await fetchViagensCaminhao(cam.id) }
      }
      showMsg('✅ Dados extraídos do cupom com sucesso!')
    } catch { showMsg('⚠️ Erro ao processar o arquivo.') }
    finally { setLoadingIA(false) }
  }

  function labelViagem(v: Viagem) {
    return `${fmtData(v.data_saida)} · ${v.status}${v.empresa ? ` · ${v.empresa}` : ''}${v.origem ? ` · ${v.origem} → ${v.destino}` : ''}`
  }

  const motoristasUnicos = useMemo(() =>
    [...new Set(abastecimentos.map(a => a.motorista).filter(Boolean))].sort()
  , [abastecimentos])

  const filtrados = useMemo(() => abastecimentos.filter(a => {
    if (filtroMotorista && a.motorista !== filtroMotorista) return false
    if (filtroInicio && a.data < filtroInicio) return false
    if (filtroFim   && a.data > filtroFim)   return false
    return true
  }), [abastecimentos, filtroMotorista, filtroInicio, filtroFim])

  const totalGeral = useMemo(() => filtrados.reduce((s, a) => s + (a.total || 0), 0), [filtrados])

  async function selecionar(a: Abastecimento) {
    setSel(a)
    setEditData(a.data||''); setEditCaminhaoId(a.caminhao_id||''); setEditCaminhaoPlaca(a.caminhao_placa||'')
    setEditMotorista(a.motorista||''); setEditPosto(a.posto||''); setEditCnpjPosto(a.cnpj_posto||'')
    setEditEstado(a.estado||''); setEditCidade(a.cidade||'')
    setEditLitrosComb(String(a.litros_combustivel||'')); setEditValorLitroComb(String(a.valor_litro_combustivel||''))
    setEditLitrosArla(String(a.litros_arla||'')); setEditValorLitroArla(String(a.valor_litro_arla||''))
    setEditKm(a.km ? String(a.km) : ''); setEditObs(a.obs||''); setEditUsaArla((a.litros_arla||0) > 0)
    setEditViagemId(a.viagem_id||''); setEditDesconto(String(a.desconto||''))
    setConfirmExcluir(false)
    await fetchViagensCaminhao(a.caminhao_id||'')
  }

  function voltar() { setSel(null); setConfirmExcluir(false) }
  function showMsg(t: string) { setMsg(t); setTimeout(() => setMsg(''), 4000) }

  // ── SALVAR direto no Supabase ──
  async function salvar() {
    if (!sel) return
    setLoading(true)
    const total = calcTotal(editLitrosComb, editValorLitroComb, editUsaArla ? editLitrosArla : '0', editUsaArla ? editValorLitroArla : '0', editDesconto)
    if (perm !== 'demo') {
      await supaFetch(`abastecimentos?id=eq.${sel.id}`, 'PATCH', {
        data: editData, caminhao_id: editCaminhaoId, caminhao_placa: editCaminhaoPlaca,
        motorista: editMotorista, posto: editPosto, cnpj_posto: editCnpjPosto,
        estado: editEstado, cidade: editCidade,
        litros_combustivel: parseFloat(editLitrosComb)||0,
        valor_litro_combustivel: parseFloat(editValorLitroComb)||0,
        litros_arla: editUsaArla ? parseFloat(editLitrosArla)||0 : 0,
        valor_litro_arla: editUsaArla ? parseFloat(editValorLitroArla)||0 : 0,
        km: editKm !== '' ? Number(editKm) : null,
        total, obs: editObs,
        viagem_id: editViagemId || null,
        desconto: parseFloat(editDesconto)||0,
      })
    }
    await fetch_(); setLoading(false); voltar(); showMsg('✅ Atualizado!')
  }

  async function excluir() {
    if (!sel) return
    setLoading(true)
    if (perm !== 'demo') await supaFetch(`abastecimentos?id=eq.${sel.id}`, 'DELETE')
    await fetch_(); setLoading(false); voltar(); showMsg('Abastecimento excluído.')
  }

  function resetCad() {
    setCadData(new Date().toISOString().split('T')[0]); setCadCaminhaoId(''); setCadCaminhaoPlaca(''); setCadMotorista('')
    setCadPosto(''); setCadCnpjPosto(''); setCadEstado(''); setCadCidade('')
    setCadLitrosComb(''); setCadValorLitroComb(''); setCadLitrosArla(''); setCadValorLitroArla('')
    setCadKm(''); setCadObs(''); setUsaArla(false); setCadViagemId(''); setCadDesconto('')
    setViagensCaminhao([])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ── CRIAR direto no Supabase ──
  async function cadastrar() {
    if (!cadCaminhaoId) return
    setLoading(true)
    const total = calcTotal(cadLitrosComb, cadValorLitroComb, usaArla ? cadLitrosArla : '0', usaArla ? cadValorLitroArla : '0', cadDesconto)
    if (perm !== 'demo') {
      await supaFetch('abastecimentos', 'POST', {
        data: cadData, caminhao_id: cadCaminhaoId, caminhao_placa: cadCaminhaoPlaca,
        motorista: cadMotorista, posto: cadPosto, cnpj_posto: cadCnpjPosto,
        estado: cadEstado, cidade: cadCidade,
        litros_combustivel: parseFloat(cadLitrosComb)||0,
        valor_litro_combustivel: parseFloat(cadValorLitroComb)||0,
        litros_arla: usaArla ? parseFloat(cadLitrosArla)||0 : 0,
        valor_litro_arla: usaArla ? parseFloat(cadValorLitroArla)||0 : 0,
        km: cadKm !== '' ? Number(cadKm) : null,
        total, obs: cadObs,
        viagem_id: cadViagemId || null,
        desconto: parseFloat(cadDesconto)||0,
      })
    }
    await fetch_(); setLoading(false); resetCad(); setMostraCad(false); showMsg('✅ Abastecimento registrado!')
  }

  const Toggle = ({ value, onChange }: { value: boolean; onChange: () => void }) => (
    <button onClick={onChange}
      className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors ${value ? 'bg-red-600' : 'bg-gray-300'}`}>
      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${value ? 'translate-x-5' : 'translate-x-1'}`} />
    </button>
  )

  const ViagemSelector = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <div>
      <label className={LC}>Viagem vinculada</label>
      <select value={value} onChange={e => onChange(e.target.value)} className={IC}>
        <option value="">Nenhuma</option>
        {viagensCaminhao.map(v => <option key={v.id} value={v.id}>{labelViagem(v)}</option>)}
      </select>
      {viagensCaminhao.length === 0 && <p className="text-xs text-gray-400 mt-1">Nenhuma viagem para este caminhão</p>}
    </div>
  )

  const FornecedorOptions = () => (
    <>
      <option value="">Selecione...</option>
      {fornecedores.map(f => <option key={f.id} value={`${f.nome}||${f.cnpj||''}`}>{f.nome}{f.cnpj ? ` · ${fmtCnpj(f.cnpj)}` : ''}</option>)}
    </>
  )

  // ── CADASTRO ──
  if (mostraCad) return (
    <div className="p-6 max-w-2xl mx-auto">
      <button onClick={() => { setMostraCad(false); resetCad() }} className="flex items-center gap-2 text-gray-500 hover:text-gray-800 mb-4 text-sm transition">
        <ArrowLeft size={16}/> Voltar
      </button>
      {msg && <div className={`mb-4 p-3 rounded-xl text-sm border ${msg.startsWith('⚠️') ? 'bg-yellow-50 border-yellow-200 text-yellow-700' : 'bg-green-50 border-green-200 text-green-700'}`}>{msg}</div>}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-bold text-gray-800 mb-4 text-lg">Novo Abastecimento</h3>
        <div className="mb-5 p-4 bg-gradient-to-r from-red-50 to-orange-50 border border-red-100 rounded-2xl">
          <p className="text-sm font-semibold text-gray-700">📎 Importar cupom fiscal</p>
          <p className="text-xs text-gray-500 mt-0.5 mb-3">Envie uma imagem ou PDF e a IA preencherá os campos automaticamente</p>
          <input ref={fileInputRef} type="file" accept="image/*,application/pdf" className="hidden"
            onChange={e => { const file = e.target.files?.[0]; if (file) lerCupomComIA(file) }} />
          <button onClick={() => fileInputRef.current?.click()} disabled={loadingIA}
            className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-red-200 hover:border-red-400 bg-white text-red-600 rounded-xl py-3 text-sm font-medium transition disabled:opacity-60">
            {loadingIA ? <><Loader2 size={16} className="animate-spin"/> Lendo com IA...</> : <><Upload size={16}/> Selecionar imagem ou PDF</>}
          </button>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className={LC}>Data *</label><input type="date" value={cadData} onChange={e => setCadData(e.target.value)} className={IC}/></div>
            <div><label className={LC}>KM</label><input type="number" value={cadKm} onChange={e => setCadKm(e.target.value)} placeholder="Ex: 156650" className={IC}/></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LC}>Fornecedor</label>
              <select value={fornecedorVal(cadPosto)} onChange={e => selecionarFornecedor(e.target.value, 'cad')} className={IC}><FornecedorOptions/></select>
            </div>
            <div>
              <label className={LC}>CNPJ</label>
              <input value={fmtCnpj(cadCnpjPosto)} onChange={e => { const v = e.target.value.replace(/\D/g,''); setCadCnpjPosto(v); if (v.length === 14) preencherFornecedor(v, 'cad') }} maxLength={18} className={IC}/>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={LC}>Cidade</label><input value={cadCidade} onChange={e => setCadCidade(e.target.value.toUpperCase())} className={IC}/></div>
            <div>
              <label className={LC}>Estado (UF)</label>
              <select value={cadEstado} onChange={e => setCadEstado(e.target.value)} className={IC}>
                <option value="">Selecione...</option>
                {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={LC}>Caminhão *</label>
            <select value={cadCaminhaoId} onChange={async e => {
              const cam = caminhoes.find(c => c.id === e.target.value)
              setCadCaminhaoId(e.target.value); setCadCaminhaoPlaca(cam?.placa||'')
              setCadMotorista(cam?.motorista_atual||''); setCadViagemId('')
              await fetchViagensCaminhao(e.target.value)
            }} className={IC}>
              <option value="">Selecione o caminhão...</option>
              {caminhoes.map(c => <option key={c.id} value={c.id}>{c.placa}{c.modelo && ` · ${c.modelo}`}</option>)}
            </select>
          </div>
          {cadMotorista && <div className="bg-blue-50 rounded-xl p-3"><p className="text-xs text-blue-600 font-medium">Motorista: <span className="text-blue-800">{cadMotorista}</span></p></div>}
          {cadCaminhaoId && <ViagemSelector value={cadViagemId} onChange={setCadViagemId}/>}
          <div className="border-t border-gray-100 pt-3">
            <p className={LC + " mb-3"}>Combustível</p>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={LC}>Litros</label><input type="number" step="0.01" value={cadLitrosComb} onChange={e => setCadLitrosComb(e.target.value)} className={IC} placeholder="0,00"/></div>
              <div><label className={LC}>Valor por litro (R$)</label><input type="number" step="0.001" value={cadValorLitroComb} onChange={e => setCadValorLitroComb(e.target.value)} className={IC} placeholder="0,000"/></div>
            </div>
          </div>
          <div className="flex items-center justify-between border-t border-gray-100 pt-3">
            <p className={LC}>ARLA 32</p><Toggle value={usaArla} onChange={() => setUsaArla(!usaArla)}/>
          </div>
          {usaArla && (
            <div className="grid grid-cols-2 gap-3">
              <div><label className={LC}>Litros ARLA</label><input type="number" step="0.01" value={cadLitrosArla} onChange={e => setCadLitrosArla(e.target.value)} className={IC}/></div>
              <div><label className={LC}>Valor por litro ARLA</label><input type="number" step="0.001" value={cadValorLitroArla} onChange={e => setCadValorLitroArla(e.target.value)} className={IC}/></div>
            </div>
          )}
          <div><label className={LC}>Desconto (R$)</label><input type="number" step="0.01" value={cadDesconto} onChange={e => setCadDesconto(e.target.value)} className={IC} placeholder="0,00"/></div>
          <div><label className={LC}>Observações</label><textarea value={cadObs} onChange={e => setCadObs(e.target.value)} className={IC + " h-20 resize-none"}/></div>
          <div className="flex items-center justify-between pt-4 border-t border-gray-100">
            <p className="text-sm font-bold text-gray-700">Total</p>
            <p className="text-xl font-black text-red-600">R$ {calcTotal(cadLitrosComb, cadValorLitroComb, usaArla ? cadLitrosArla : '0', usaArla ? cadValorLitroArla : '0', cadDesconto).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          </div>
          <button onClick={cadastrar} disabled={loading || !cadCaminhaoId}
            className="w-full flex items-center justify-center gap-2 bg-red-600 text-white px-4 py-3 rounded-xl text-sm font-bold uppercase hover:bg-red-700 transition disabled:opacity-60 mt-2">
            {loading ? <><Loader2 size={16} className="animate-spin"/> Salvando...</> : <><Save size={16}/> Salvar Abastecimento</>}
          </button>
        </div>
      </div>
    </div>
  )

  // ── EDIÇÃO ──
  if (sel) return (
    <div className="p-6 max-w-2xl mx-auto">
      <button onClick={voltar} className="flex items-center gap-2 text-gray-500 hover:text-gray-800 mb-4 text-sm transition"><ArrowLeft size={16}/> Voltar</button>
      {msg && <div className={`mb-4 p-3 rounded-xl text-sm border ${msg.startsWith('⚠️') ? 'bg-yellow-50 border-yellow-200 text-yellow-700' : 'bg-green-50 border-green-200 text-green-700'}`}>{msg}</div>}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-bold text-gray-800 mb-4 text-lg">Editar Abastecimento</h3>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className={LC}>Data *</label><input type="date" value={editData} onChange={e => setEditData(e.target.value)} className={IC}/></div>
            <div><label className={LC}>KM</label><input type="number" value={editKm} onChange={e => setEditKm(e.target.value)} placeholder="Ex: 156650" className={IC}/></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LC}>Fornecedor</label>
              <select value={fornecedorVal(editPosto)} onChange={e => selecionarFornecedor(e.target.value, 'edit')} className={IC}><FornecedorOptions/></select>
            </div>
            <div>
              <label className={LC}>CNPJ</label>
              <input value={fmtCnpj(editCnpjPosto)} onChange={e => { const v = e.target.value.replace(/\D/g,''); setEditCnpjPosto(v); if (v.length === 14) preencherFornecedor(v, 'edit') }} maxLength={18} className={IC}/>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={LC}>Cidade</label><input value={editCidade} onChange={e => setEditCidade(e.target.value.toUpperCase())} className={IC}/></div>
            <div>
              <label className={LC}>Estado (UF)</label>
              <select value={editEstado} onChange={e => setEditEstado(e.target.value)} className={IC}>
                <option value="">Selecione...</option>
                {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={LC}>Caminhão *</label>
            <select value={editCaminhaoId} onChange={async e => {
              const cam = caminhoes.find(c => c.id === e.target.value)
              setEditCaminhaoId(e.target.value); setEditCaminhaoPlaca(cam?.placa||'')
              setEditMotorista(cam?.motorista_atual||''); setEditViagemId('')
              await fetchViagensCaminhao(e.target.value)
            }} className={IC}>
              <option value="">Selecione o caminhão...</option>
              {caminhoes.map(c => <option key={c.id} value={c.id}>{c.placa}{c.modelo && ` · ${c.modelo}`}</option>)}
            </select>
          </div>
          {editMotorista && <div className="bg-blue-50 rounded-xl p-3"><p className="text-xs text-blue-600 font-medium">Motorista: <span className="text-blue-800">{editMotorista}</span></p></div>}
          {editCaminhaoId && <ViagemSelector value={editViagemId} onChange={setEditViagemId}/>}
          <div className="border-t border-gray-100 pt-3">
            <p className={LC + " mb-3"}>Combustível</p>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={LC}>Litros</label><input type="number" step="0.01" value={editLitrosComb} onChange={e => setEditLitrosComb(e.target.value)} className={IC}/></div>
              <div><label className={LC}>Valor por litro (R$)</label><input type="number" step="0.001" value={editValorLitroComb} onChange={e => setEditValorLitroComb(e.target.value)} className={IC}/></div>
            </div>
          </div>
          <div className="flex items-center justify-between border-t border-gray-100 pt-3">
            <p className={LC}>ARLA 32</p><Toggle value={editUsaArla} onChange={() => setEditUsaArla(!editUsaArla)}/>
          </div>
          {editUsaArla && (
            <div className="grid grid-cols-2 gap-3">
              <div><label className={LC}>Litros ARLA</label><input type="number" step="0.01" value={editLitrosArla} onChange={e => setEditLitrosArla(e.target.value)} className={IC}/></div>
              <div><label className={LC}>Valor por litro ARLA</label><input type="number" step="0.001" value={editValorLitroArla} onChange={e => setEditValorLitroArla(e.target.value)} className={IC}/></div>
            </div>
          )}
          <div><label className={LC}>Desconto (R$)</label><input type="number" step="0.01" value={editDesconto} onChange={e => setEditDesconto(e.target.value)} className={IC} placeholder="0,00"/></div>
          <div><label className={LC}>Observações</label><textarea value={editObs} onChange={e => setEditObs(e.target.value)} className={IC + " h-20 resize-none"}/></div>
          <div className="flex items-center justify-between pt-4 border-t border-gray-100">
            <p className="text-sm font-bold text-gray-700">Total</p>
            <p className="text-xl font-black text-red-600">R$ {calcTotal(editLitrosComb, editValorLitroComb, editUsaArla ? editLitrosArla : '0', editUsaArla ? editValorLitroArla : '0', editDesconto).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={salvar} disabled={loading || !editCaminhaoId}
              className="w-full flex items-center justify-center gap-2 bg-red-600 text-white px-4 py-3 rounded-xl text-sm font-bold uppercase hover:bg-red-700 transition disabled:opacity-60">
              {loading ? <><Loader2 size={16} className="animate-spin"/> Salvando...</> : <><Save size={16}/> Salvar Alterações</>}
            </button>
            <button onClick={() => setConfirmExcluir(true)} disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-gray-200 text-gray-700 px-4 py-3 rounded-xl text-sm font-bold uppercase hover:bg-gray-300 transition disabled:opacity-60">
              <Trash2 size={16}/> Excluir
            </button>
          </div>
          {confirmExcluir && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white p-6 rounded-xl shadow-lg text-center">
                <p className="text-lg font-bold mb-4">Confirmar Exclusão</p>
                <p className="mb-6">Tem certeza que deseja excluir este abastecimento?</p>
                <div className="flex justify-center gap-4">
                  <button onClick={excluir} className="bg-red-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-red-700">Sim, Excluir</button>
                  <button onClick={() => setConfirmExcluir(false)} className="bg-gray-300 text-gray-800 px-4 py-2 rounded-lg font-bold hover:bg-gray-400">Cancelar</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )

  // ── LISTAGEM ──
  return (
    <div className="p-6 max-w-4xl mx-auto">
      {msg && <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-xl text-sm">{msg}</div>}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Abastecimentos</h1>
        <button onClick={() => setMostraCad(true)}
          className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-xl text-sm font-bold uppercase hover:bg-red-700 transition">
          <Plus size={16}/> Novo Abastecimento
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1 mb-1">
            <Filter size={11}/> Motorista
          </label>
          <select value={filtroMotorista} onChange={e => setFiltroMotorista(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-gray-50">
            <option value="">Todos</option>
            {motoristasUnicos.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Data Início</label>
          <input type="date" value={filtroInicio} onChange={e => setFiltroInicio(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-gray-50"/>
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Data Fim</label>
          <input type="date" value={filtroFim} onChange={e => setFiltroFim(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-gray-50"/>
        </div>
        {(filtroMotorista || filtroInicio || filtroFim) && (
          <div className="md:col-span-3 flex justify-end">
            <button onClick={() => { setFiltroMotorista(''); setFiltroInicio(''); setFiltroFim('') }}
              className="text-xs text-red-600 hover:underline font-semibold">Limpar filtros</button>
          </div>
        )}
      </div>

      {/* Tabela sem scroll horizontal */}
      {abastecimentos.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
          <Fuel size={32} className="mx-auto text-gray-200 mb-2"/>
          <p className="text-sm text-gray-400">Nenhum abastecimento registrado ainda.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full table-fixed">
            <thead className="bg-gray-50">
              <tr>
                <th className="w-24 px-4 py-3 text-left text-xs font-black text-gray-500 uppercase">Data</th>
                <th className="w-24 px-4 py-3 text-left text-xs font-black text-gray-500 uppercase">Caminhão</th>
                <th className="w-40 px-4 py-3 text-left text-xs font-black text-gray-500 uppercase">Motorista</th>
                <th className="px-4 py-3 text-left text-xs font-black text-gray-500 uppercase">Posto</th>
                <th className="w-24 px-4 py-3 text-left text-xs font-black text-gray-500 uppercase">KM</th>
                <th className="w-28 px-4 py-3 text-right text-xs font-black text-gray-500 uppercase">Total</th>
                <th className="w-10 px-2 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtrados.map(a => (
                <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{fmtData(a.data)}</td>
                  <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{a.caminhao_placa}</td>
                  <td className="px-4 py-3 text-sm text-gray-900 truncate max-w-0">{a.motorista}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 truncate max-w-0">{a.posto}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{a.km ? a.km.toLocaleString('pt-BR') : '—'}</td>
                  <td className="px-4 py-3 text-sm font-bold text-red-600 text-right whitespace-nowrap">
                    R$ {(a.total||0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-2 py-3 text-right">
                    <button onClick={() => selecionar(a)} className="text-gray-400 hover:text-red-600 transition-colors">
                      <ChevronRight size={18}/>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50">
            <p className="text-xs text-gray-400">{filtrados.length} registro(s)</p>
            <p className="text-sm font-bold text-gray-700">
              Total: <span className="text-red-600">R$ {totalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            </p>
          </div>
        </div>
      )}
    </div>
  )
}