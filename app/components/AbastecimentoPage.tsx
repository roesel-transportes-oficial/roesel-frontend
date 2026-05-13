
'use client'
import { useState, useEffect, useRef } from 'react'
import { abastecimentosAPI, caminhoesAPI } from '../services/api'
import { useAuth } from '../services/auth'
import { Search, Plus, ArrowLeft, Save, Trash2, ChevronRight, Fuel, Upload, Loader2 } from 'lucide-react'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_KEY!

interface Abastecimento {
  id: string; data: string; caminhao_id: string; caminhao_placa: string
  motorista: string; posto: string; cnpj_posto: string; estado: string; cidade: string
  litros_combustivel: number; valor_litro_combustivel: number
  litros_arla: number; valor_litro_arla: number
  total: number; km: number; obs: string; viagem_id: string; desconto: number;
}

interface Caminhao { id: string; placa: string; modelo: string; motorista_atual: string }
interface Fornecedor { id: string; nome: string; cnpj: string; cidade: string; estado: string }
interface Viagem {
  id: string; motorista: string; caminhao_placa: string
  data_saida: string; status: string; empresa: string; origem: string; destino: string
}

const InputClass = "mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-gray-50"
const LabelClass = "text-xs font-semibold text-gray-500 uppercase tracking-wide"
const ESTADOS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']

export default function AbastecimentoPage() {
  const { perm } = useAuth()
  const [abastecimentos, setAbastecimentos] = useState<Abastecimento[]>([])
  const [caminhoes, setCaminhoes] = useState<Caminhao[]>([])
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])
  const [busca, setBusca] = useState('')
  const [sel, setSel] = useState<Abastecimento | null>(null)
  const [mostraCad, setMostraCad] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingIA, setLoadingIA] = useState(false)
  const [msg, setMsg] = useState('')
  const [confirmExcluir, setConfirmExcluir] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [viagensCaminhao, setViagensCaminhao] = useState<Viagem[]>([])

  const [editData, setEditData] = useState('')
  const [editCaminhaoId, setEditCaminhaoId] = useState('')
  const [editCaminhaoPlaca, setEditCaminhaoPlaca] = useState('')
  const [editMotorista, setEditMotorista] = useState('')
  const [editPosto, setEditPosto] = useState('')
  const [editCnpjPosto, setEditCnpjPosto] = useState('')
  const [editEstado, setEditEstado] = useState('')
  const [editCidade, setEditCidade] = useState('')
  const [editLitrosComb, setEditLitrosComb] = useState('')
  const [editValorLitroComb, setEditValorLitroComb] = useState('')
  const [editLitrosArla, setEditLitrosArla] = useState('')
  const [editValorLitroArla, setEditValorLitroArla] = useState('')
  const [editKm, setEditKm] = useState('')
  const [editObs, setEditObs] = useState('')
  const [editUsaArla, setEditUsaArla] = useState(false)
  const [editViagemId, setEditViagemId] = useState('')
  const [editDesconto, setEditDesconto] = useState('')

  const [cadData, setCadData] = useState(new Date().toISOString().split('T')[0])
  const [cadCaminhaoId, setCadCaminhaoId] = useState('')
  const [cadCaminhaoPlaca, setCadCaminhaoPlaca] = useState('')
  const [cadMotorista, setCadMotorista] = useState('')
  const [cadPosto, setCadPosto] = useState('')
  const [cadCnpjPosto, setCadCnpjPosto] = useState('')
  const [cadEstado, setCadEstado] = useState('')
  const [cadCidade, setCadCidade] = useState('')
  const [cadLitrosComb, setCadLitrosComb] = useState('')
  const [cadValorLitroComb, setCadValorLitroComb] = useState('')
  const [cadLitrosArla, setCadLitrosArla] = useState('')
  const [cadValorLitroArla, setCadValorLitroArla] = useState('')
  const [cadKm, setCadKm] = useState('')
  const [cadObs, setCadObs] = useState('')
  const [usaArla, setUsaArla] = useState(false)
  const [cadViagemId, setCadViagemId] = useState('')
  const [cadDesconto, setCadDesconto] = useState('')

  useEffect(() => {
    fetch_()
    caminhoesAPI.listar().then(setCaminhoes).catch(() => {})
    fetchFornecedores()
  }, [])

  async function fetch_() {
    const data = await abastecimentosAPI.listar()
    setAbastecimentos(data)
  }

  async function fetchFornecedores() {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/fornecedores?order=nome.asc`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
      })
      const data = await res.json()
      setFornecedores(Array.isArray(data) ? data : [])
    } catch {}
  }

  async function fetchViagensCaminhao(caminhaoId: string) {
    if (!caminhaoId) { setViagensCaminhao([]); return }
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/viagens?caminhao_id=eq.${caminhaoId}&order=data_saida.desc&limit=20`,
        { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
      )
      const data = await res.json()
      setViagensCaminhao(Array.isArray(data) ? data : [])
    } catch { setViagensCaminhao([]) }
  }

  function preencherFornecedor(cnpj: string, modo: 'cad' | 'edit') {
    const cnpjLimpo = cnpj.replace(/\D/g, '')
    const found = fornecedores.find(f => f.cnpj?.replace(/\D/g, '') === cnpjLimpo)
    if (!found) return
    if (modo === 'cad') {
      setCadPosto(found.nome); setCadCidade(found.cidade || ''); setCadEstado(found.estado || '')
      setCadCnpjPosto(found.cnpj || '')
    } else {
      setEditPosto(found.nome); setEditCidade(found.cidade || ''); setEditEstado(found.estado || '')
      setEditCnpjPosto(found.cnpj || '')
    }
  }

  // Seleciona fornecedor pelo valor do dropdown (nome||cnpj)
  function selecionarFornecedor(valor: string, modo: 'cad' | 'edit') {
    if (!valor) {
      if (modo === 'cad') { setCadPosto(''); setCadCnpjPosto(''); setCadCidade(''); setCadEstado('') }
      else { setEditPosto(''); setEditCnpjPosto(''); setEditCidade(''); setEditEstado('') }
      return
    }
    const [nome, cnpj] = valor.split('||')
    const f = fornecedores.find(f => f.nome === nome)
    if (modo === 'cad') {
      setCadPosto(nome)
      setCadCnpjPosto(cnpj || f?.cnpj || '')
      setCadCidade(f?.cidade || '')
      setCadEstado(f?.estado || '')
    } else {
      setEditPosto(nome)
      setEditCnpjPosto(cnpj || f?.cnpj || '')
      setEditCidade(f?.cidade || '')
      setEditEstado(f?.estado || '')
    }
  }

  function fornecedorSelectValue(nome: string, cnpj: string) {
    const f = fornecedores.find(f => f.nome === nome)
    if (f) return `${f.nome}||${f.cnpj || ''}`
    return ''
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
        r.onerror = () => rej(new Error('Erro ao ler arquivo'))
        r.readAsDataURL(file)
      })
      const mediaType = file.type === 'application/pdf' ? 'application/pdf'
        : file.type === 'image/png' ? 'image/png' : 'image/jpeg'
      const res = await fetch('/api/ler-cupom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64, mediaType }),
      })
      const json = await res.json()
      if (!json.ok) { showMsg('⚠️ ' + (json.erro || 'Não foi possível extrair os dados.')); return }
      const d = json.dados
      if (d.data_abastecimento) setCadData(d.data_abastecimento)
      if (d.km) setCadKm(String(d.km))
      if (d.litros_combustivel) setCadLitrosComb(String(d.litros_combustivel))
      if (d.valor_litro_combustivel) setCadValorLitroComb(String(d.valor_litro_combustivel))
      if (d.litros_arla && d.litros_arla > 0) {
        setUsaArla(true); setCadLitrosArla(String(d.litros_arla))
        if (d.valor_litro_arla) setCadValorLitroArla(String(d.valor_litro_arla))
      }
      if (d.cnpj_posto) {
        const cnpjLimpo = d.cnpj_posto.replace(/\D/g, '')
        const found = fornecedores.find(f => f.cnpj?.replace(/\D/g, '') === cnpjLimpo)
        if (found) {
          setCadPosto(found.nome); setCadCnpjPosto(found.cnpj || '')
          setCadCidade(found.cidade || ''); setCadEstado(found.estado || '')
        } else {
          setCadCnpjPosto(d.cnpj_posto)
          if (d.cidade) setCadCidade(d.cidade)
          if (d.estado) setCadEstado(d.estado)
          if (d.nome_posto) setCadPosto(d.nome_posto)
        }
      }
      if (d.placa) {
        const cam = caminhoes.find(c => c.placa.replace(/[^A-Z0-9]/gi,'').toLowerCase() === d.placa.replace(/[^A-Z0-9]/gi,'').toLowerCase())
        if (cam) {
          setCadCaminhaoId(cam.id); setCadCaminhaoPlaca(cam.placa)
          setCadMotorista(cam.motorista_atual || '')
          await fetchViagensCaminhao(cam.id)
        }
      }
      showMsg('✅ Dados extraídos do cupom com sucesso!')
    } catch { showMsg('⚠️ Erro ao processar o arquivo.') }
    finally { setLoadingIA(false) }
  }

  function calcTotal(lc: string, vlc: string, la: string, vla: string, desc: string) {
    const totalBruto = (parseFloat(lc)||0)*(parseFloat(vlc)||0) + (parseFloat(la)||0)*(parseFloat(vla)||0)
    return totalBruto - (parseFloat(desc)||0)
  }

  function fmtData(d: string) {
    if (!d) return ''
    const [y, m, dia] = d.split('-')
    return `${dia}/${m}/${y}`
  }

  function labelViagem(v: Viagem) {
    return `${fmtData(v.data_saida)} · ${v.status}${v.empresa ? ` · ${v.empresa}` : ''}${v.origem ? ` · ${v.origem} → ${v.destino}` : ''}`
  }

  const filtrados = busca.trim()
    ? abastecimentos.filter(a =>
        a.caminhao_placa?.toLowerCase().includes(busca.toLowerCase()) ||
        a.motorista?.toLowerCase().includes(busca.toLowerCase()) ||
        a.posto?.toLowerCase().includes(busca.toLowerCase()) ||
        a.cidade?.toLowerCase().includes(busca.toLowerCase())
      )
    : abastecimentos

  async function selecionar(a: Abastecimento) {
    setSel(a)
    setEditData(a.data || ''); setEditCaminhaoId(a.caminhao_id || '')
    setEditCaminhaoPlaca(a.caminhao_placa || ''); setEditMotorista(a.motorista || '')
    setEditPosto(a.posto || ''); setEditCnpjPosto(a.cnpj_posto || '')
    setEditEstado(a.estado || ''); setEditCidade(a.cidade || '')
    setEditLitrosComb(String(a.litros_combustivel || ''))
    setEditValorLitroComb(String(a.valor_litro_combustivel || ''))
    setEditLitrosArla(String(a.litros_arla || ''))
    setEditValorLitroArla(String(a.valor_litro_arla || ''))
    setEditKm(String(a.km || '')); setEditObs(a.obs || '')
    setEditUsaArla((a.litros_arla || 0) > 0)
    setEditViagemId(a.viagem_id || '')
    setEditDesconto(String(a.desconto || ''))
    setConfirmExcluir(false)
    await fetchViagensCaminhao(a.caminhao_id || '')
  }

  function voltar() { setSel(null); setConfirmExcluir(false) }
  function showMsg(t: string) { setMsg(t); setTimeout(() => setMsg(''), 4000) }

  async function salvar() {
    if (!sel) return
    setLoading(true)
    const total = calcTotal(editLitrosComb, editValorLitroComb, editUsaArla ? editLitrosArla : '0', editUsaArla ? editValorLitroArla : '0', editDesconto)
    if (perm !== 'demo') await abastecimentosAPI.atualizar(sel.id, {
      data: editData, caminhao_id: editCaminhaoId, caminhao_placa: editCaminhaoPlaca,
      motorista: editMotorista, posto: editPosto, cnpj_posto: editCnpjPosto,
      estado: editEstado, cidade: editCidade,
      litros_combustivel: parseFloat(editLitrosComb) || 0,
      valor_litro_combustivel: parseFloat(editValorLitroComb) || 0,
      litros_arla: editUsaArla ? parseFloat(editLitrosArla) || 0 : 0,
      valor_litro_arla: editUsaArla ? parseFloat(editValorLitroArla) || 0 : 0,
      km: parseInt(editKm) || null, total, obs: editObs,
      viagem_id: editViagemId || null, desconto: parseFloat(editDesconto) || 0,
    })
    await fetch_(); setLoading(false); voltar(); showMsg('✅ Atualizado!')
  }

  async function excluir() {
    if (!sel) return
    setLoading(true)
    if (perm !== 'demo') await abastecimentosAPI.excluir(sel.id)
    await fetch_(); setLoading(false); voltar(); showMsg('Abastecimento excluído.')
  }

  function resetCad() {
    setCadData(new Date().toISOString().split('T')[0])
    setCadCaminhaoId(''); setCadCaminhaoPlaca(''); setCadMotorista('')
    setCadPosto(''); setCadCnpjPosto(''); setCadEstado(''); setCadCidade('')
    setCadLitrosComb(''); setCadValorLitroComb('')
    setCadLitrosArla(''); setCadValorLitroArla('')
    setCadKm(''); setCadObs(''); setUsaArla(false); setCadViagemId('')
    setCadDesconto('')
    setViagensCaminhao([])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function cadastrar() {
    if (!cadCaminhaoId) return
    setLoading(true)
    const total = calcTotal(cadLitrosComb, cadValorLitroComb, usaArla ? cadLitrosArla : '0', usaArla ? cadValorLitroArla : '0', cadDesconto)
    if (perm !== 'demo') await abastecimentosAPI.criar({
      data: cadData, caminhao_id: cadCaminhaoId, caminhao_placa: cadCaminhaoPlaca,
      motorista: cadMotorista, posto: cadPosto, cnpj_posto: cadCnpjPosto,
      estado: cadEstado, cidade: cadCidade,
      litros_combustivel: parseFloat(cadLitrosComb) || 0,
      valor_litro_combustivel: parseFloat(cadValorLitroComb) || 0,
      litros_arla: usaArla ? parseFloat(cadLitrosArla) || 0 : 0,
      valor_litro_arla: usaArla ? parseFloat(cadValorLitroArla) || 0 : 0,
      km: parseInt(cadKm) || null, total, obs: cadObs,
      viagem_id: cadViagemId || null, desconto: parseFloat(cadDesconto) || 0,
    })
    await fetch_(); setLoading(false)
    resetCad(); setMostraCad(false)
    showMsg('✅ Abastecimento registrado!')
  }

  const totalGeral = filtrados.reduce((s, a) => s + (a.total || 0), 0)

  const Toggle = ({ value, onChange }: { value: boolean, onChange: () => void }) => (
    <button onClick={onChange}
      className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors ${value ? 'bg-red-600' : 'bg-gray-300'}`}>
      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${value ? 'translate-x-5' : 'translate-x-1'}`} />
    </button>
  )

  const ViagemSelector = ({ value, onChange }: { value: string, onChange: (v: string) => void }) => (
    <div>
      <label className={LabelClass}>Viagem vinculada</label>
      <select value={value} onChange={e => onChange(e.target.value)} className={InputClass}>
        <option value="">Nenhuma</option>
        {viagensCaminhao.map(v => (
          <option key={v.id} value={v.id}>{labelViagem(v)}</option>
        ))}
      </select>
      {viagensCaminhao.length === 0 && (
        <p className="text-xs text-gray-400 mt-1">Nenhuma viagem encontrada para este caminhão</p>
      )}
    </div>
  )

  // Opções do dropdown de fornecedor com CNPJ
  const FornecedorOptions = () => (
    <>
      <option value="">Selecione...</option>
      {fornecedores.map(f => (
        <option key={f.id} value={`${f.nome}||${f.cnpj || ''}`}>
          {f.nome}{f.cnpj ? ` · ${fmtCnpj(f.cnpj)}` : ''}
        </option>
      ))}
    </>
  )

  if (mostraCad) return (
    <div className="p-6 max-w-2xl mx-auto">
      <button onClick={() => { setMostraCad(false); resetCad() }} className="flex items-center gap-2 text-gray-500 hover:text-gray-800 mb-4 text-sm transition">
        <ArrowLeft size={16}/> Voltar
      </button>
      {msg && (
        <div className={`mb-4 p-3 rounded-xl text-sm border ${msg.startsWith('⚠️') ? 'bg-yellow-50 border-yellow-200 text-yellow-700' : 'bg-green-50 border-green-200 text-green-700'}`}>
          {msg}
        </div>
      )}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-bold text-gray-800 mb-4 text-lg">Novo Abastecimento</h3>

        <div className="mb-5 p-4 bg-gradient-to-r from-red-50 to-orange-50 border border-red-100 rounded-2xl">
          <p className="text-sm font-semibold text-gray-700">📎 Importar cupom fiscal</p>
          <p className="text-xs text-gray-500 mt-0.5 mb-3">Envie uma imagem ou PDF e a IA preencherá os campos automaticamente</p>
          <input ref={fileInputRef} type="file" accept="image/*,application/pdf" className="hidden"
            onChange={e => { const file = e.target.files?.[0]; if (file) lerCupomComIA(file) }} />
          <button onClick={() => fileInputRef.current?.click()} disabled={loadingIA}
            className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-red-200 hover:border-red-400 bg-white hover:bg-red-50 text-red-600 rounded-xl py-3 text-sm font-medium transition disabled:opacity-60">
            {loadingIA ? <><Loader2 size={16} className="animate-spin" /> Lendo cupom com IA...</> : <><Upload size={16} /> Selecionar imagem ou PDF</>}
          </button>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LabelClass}>Data *</label>
              <input type="date" value={cadData} onChange={e => setCadData(e.target.value)} className={InputClass} />
            </div>
            <div>
              <label className={LabelClass}>KM</label>
              <input type="number" value={cadKm} onChange={e => setCadKm(e.target.value)} placeholder="Ex: 156650" className={InputClass} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LabelClass}>Fornecedor</label>
              <select
                value={fornecedorSelectValue(cadPosto, cadCnpjPosto)}
                onChange={e => selecionarFornecedor(e.target.value, 'cad')}
                className={InputClass}
              >
                <FornecedorOptions />
              </select>
            </div>
            <div>
              <label className={LabelClass}>CNPJ</label>
              <input
                value={fmtCnpj(cadCnpjPosto)}
                onChange={e => {
                  const val = e.target.value.replace(/\D/g,'')
                  setCadCnpjPosto(val)
                  if (val.length === 14) preencherFornecedor(val, 'cad')
                }}
                placeholder="00.000.000/0000-00" maxLength={18} className={InputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LabelClass}>Cidade</label>
              <input value={cadCidade} onChange={e => setCadCidade(e.target.value.toUpperCase())} placeholder="Nome da cidade" className={InputClass} />
            </div>
            <div>
              <label className={LabelClass}>Estado (UF)</label>
              <select value={cadEstado} onChange={e => setCadEstado(e.target.value)} className={InputClass}>
                <option value="">Selecione...</option>
                {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className={LabelClass}>Caminhão *</label>
            <select value={cadCaminhaoId} onChange={async e => {
              const cam = caminhoes.find(c => c.id === e.target.value)
              setCadCaminhaoId(e.target.value)
              setCadCaminhaoPlaca(cam?.placa || '')
              setCadMotorista(cam?.motorista_atual || '')
              setCadViagemId('')
              await fetchViagensCaminhao(e.target.value)
            }} className={InputClass}>
              <option value="">Selecione o caminhão...</option>
              {caminhoes.map(c => <option key={c.id} value={c.id}>{c.placa}{c.modelo && ` · ${c.modelo}`}</option>)}
            </select>
          </div>

          {cadMotorista && (
            <div className="bg-blue-50 rounded-xl p-3">
              <p className="text-xs text-blue-600 font-medium">Motorista: <span className="text-blue-800">{cadMotorista}</span></p>
            </div>
          )}

          {cadCaminhaoId && <ViagemSelector value={cadViagemId} onChange={setCadViagemId} />}

          <div className="border-t border-gray-100 pt-3">
            <p className={LabelClass + " mb-3"}>Combustível</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LabelClass}>Litros</label>
                <input type="number" step="0.01" value={cadLitrosComb} onChange={e => setCadLitrosComb(e.target.value)} className={InputClass} placeholder="0,00" />
              </div>
              <div>
                <label className={LabelClass}>Valor por litro (R$)</label>
                <input type="number" step="0.001" value={cadValorLitroComb} onChange={e => setCadValorLitroComb(e.target.value)} className={InputClass} placeholder="0,000" />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-gray-100 pt-3">
            <p className={LabelClass}>ARLA 32</p>
            <Toggle value={usaArla} onChange={() => setUsaArla(!usaArla)} />
          </div>

          {usaArla && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LabelClass}>Litros ARLA</label>
                <input type="number" step="0.01" value={cadLitrosArla} onChange={e => setCadLitrosArla(e.target.value)} className={InputClass} placeholder="0,00" />
              </div>
              <div>
                <label className={LabelClass}>Valor por litro ARLA (R$)</label>
                <input type="number" step="0.001" value={cadValorLitroArla} onChange={e => setCadValorLitroArla(e.target.value)} className={InputClass} placeholder="0,000" />
              </div>
            </div>
          )}

          <div>
            <label className={LabelClass}>Desconto (R$)</label>
            <input type="number" step="0.01" value={cadDesconto} onChange={e => setCadDesconto(e.target.value)} className={InputClass} placeholder="0,00" />
          </div>

          <div>
            <label className={LabelClass}>Observações</label>
            <textarea value={cadObs} onChange={e => setCadObs(e.target.value)} className={InputClass + " h-20 resize-none"} placeholder="Informações adicionais..."></textarea>
          </div>

          <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100">
            <p className="text-sm font-bold text-gray-700">Total</p>
            <p className="text-xl font-black text-red-600">R$ {calcTotal(cadLitrosComb, cadValorLitroComb, usaArla ? cadLitrosArla : '0', usaArla ? cadValorLitroArla : '0', cadDesconto).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          </div>

          <button onClick={cadastrar} disabled={loading || !cadCaminhaoId}
            className="w-full flex items-center justify-center gap-2 bg-red-600 text-white px-4 py-3 rounded-xl text-sm font-bold uppercase hover:bg-red-700 transition disabled:opacity-60 mt-4">
            {loading ? <><Loader2 size={16} className="animate-spin" /> Salvando...</> : <><Save size={16} /> Salvar Abastecimento</>}
          </button>
        </div>
      </div>
    </div>
  )

  if (sel) return (
    <div className="p-6 max-w-2xl mx-auto">
      <button onClick={voltar} className="flex items-center gap-2 text-gray-500 hover:text-gray-800 mb-4 text-sm transition">
        <ArrowLeft size={16}/> Voltar
      </button>
      {msg && (
        <div className={`mb-4 p-3 rounded-xl text-sm border ${msg.startsWith('⚠️') ? 'bg-yellow-50 border-yellow-200 text-yellow-700' : 'bg-green-50 border-green-200 text-green-700'}`}>
          {msg}
        </div>
      )}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-bold text-gray-800 mb-4 text-lg">Editar Abastecimento</h3>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LabelClass}>Data *</label>
              <input type="date" value={editData} onChange={e => setEditData(e.target.value)} className={InputClass} />
            </div>
            <div>
              <label className={LabelClass}>KM</label>
              <input type="number" value={editKm} onChange={e => setEditKm(e.target.value)} placeholder="Ex: 156650" className={InputClass} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LabelClass}>Fornecedor</label>
              <select
                value={fornecedorSelectValue(editPosto, editCnpjPosto)}
                onChange={e => selecionarFornecedor(e.target.value, 'edit')}
                className={InputClass}
              >
                <FornecedorOptions />
              </select>
            </div>
            <div>
              <label className={LabelClass}>CNPJ</label>
              <input
                value={fmtCnpj(editCnpjPosto)}
                onChange={e => {
                  const val = e.target.value.replace(/\D/g,'')
                  setEditCnpjPosto(val)
                  if (val.length === 14) preencherFornecedor(val, 'edit')
                }}
                placeholder="00.000.000/0000-00" maxLength={18} className={InputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LabelClass}>Cidade</label>
              <input value={editCidade} onChange={e => setEditCidade(e.target.value.toUpperCase())} placeholder="Nome da cidade" className={InputClass} />
            </div>
            <div>
              <label className={LabelClass}>Estado (UF)</label>
              <select value={editEstado} onChange={e => setEditEstado(e.target.value)} className={InputClass}>
                <option value="">Selecione...</option>
                {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className={LabelClass}>Caminhão *</label>
            <select value={editCaminhaoId} onChange={async e => {
              const cam = caminhoes.find(c => c.id === e.target.value)
              setEditCaminhaoId(e.target.value)
              setEditCaminhaoPlaca(cam?.placa || '')
              setEditMotorista(cam?.motorista_atual || '')
              setEditViagemId('')
              await fetchViagensCaminhao(e.target.value)
            }} className={InputClass}>
              <option value="">Selecione o caminhão...</option>
              {caminhoes.map(c => <option key={c.id} value={c.id}>{c.placa}{c.modelo && ` · ${c.modelo}`}</option>)}
            </select>
          </div>

          {editMotorista && (
            <div className="bg-blue-50 rounded-xl p-3">
              <p className="text-xs text-blue-600 font-medium">Motorista: <span className="text-blue-800">{editMotorista}</span></p>
            </div>
          )}

          {editCaminhaoId && <ViagemSelector value={editViagemId} onChange={setEditViagemId} />}

          <div className="border-t border-gray-100 pt-3">
            <p className={LabelClass + " mb-3"}>Combustível</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LabelClass}>Litros</label>
                <input type="number" step="0.01" value={editLitrosComb} onChange={e => setEditLitrosComb(e.target.value)} className={InputClass} placeholder="0,00" />
              </div>
              <div>
                <label className={LabelClass}>Valor por litro (R$)</label>
                <input type="number" step="0.001" value={editValorLitroComb} onChange={e => setEditValorLitroComb(e.target.value)} className={InputClass} placeholder="0,000" />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-gray-100 pt-3">
            <p className={LabelClass}>ARLA 32</p>
            <Toggle value={editUsaArla} onChange={() => setEditUsaArla(!editUsaArla)} />
          </div>

          {editUsaArla && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LabelClass}>Litros ARLA</label>
                <input type="number" step="0.01" value={editLitrosArla} onChange={e => setEditLitrosArla(e.target.value)} className={InputClass} placeholder="0,00" />
              </div>
              <div>
                <label className={LabelClass}>Valor por litro ARLA (R$)</label>
                <input type="number" step="0.001" value={editValorLitroArla} onChange={e => setEditValorLitroArla(e.target.value)} className={InputClass} placeholder="0,000" />
              </div>
            </div>
          )}

          <div>
            <label className={LabelClass}>Desconto (R$)</label>
            <input type="number" step="0.01" value={editDesconto} onChange={e => setEditDesconto(e.target.value)} className={InputClass} placeholder="0,00" />
          </div>

          <div>
            <label className={LabelClass}>Observações</label>
            <textarea value={editObs} onChange={e => setEditObs(e.target.value)} className={InputClass + " h-20 resize-none"} placeholder="Informações adicionais..."></textarea>
          </div>

          <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100">
            <p className="text-sm font-bold text-gray-700">Total</p>
            <p className="text-xl font-black text-red-600">R$ {calcTotal(editLitrosComb, editValorLitroComb, editUsaArla ? editLitrosArla : '0', editUsaArla ? editValorLitroArla : '0', editDesconto).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          </div>

          <div className="flex gap-3 mt-4">
            <button onClick={salvar} disabled={loading || !editCaminhaoId}
              className="w-full flex items-center justify-center gap-2 bg-red-600 text-white px-4 py-3 rounded-xl text-sm font-bold uppercase hover:bg-red-700 transition disabled:opacity-60">
              {loading ? <><Loader2 size={16} className="animate-spin" /> Salvando...</> : <><Save size={16} /> Salvar Alterações</>}
            </button>
            <button onClick={() => setConfirmExcluir(true)} disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-gray-200 text-gray-700 px-4 py-3 rounded-xl text-sm font-bold uppercase hover:bg-gray-300 transition disabled:opacity-60">
              <Trash2 size={16} /> Excluir
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

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Abastecimentos</h1>
        <div className="flex gap-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Buscar..." value={busca} onChange={e => setBusca(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-red-500 transition-all" />
          </div>
          <button onClick={() => setMostraCad(true)} className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-xl text-sm font-bold uppercase hover:bg-red-700 transition">
            <Plus size={16} /> Novo Abastecimento
          </button>
        </div>
      </div>

      {abastecimentos.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
          <Fuel size={32} className="mx-auto text-gray-200 mb-2" />
          <p className="text-sm text-gray-400">Nenhum abastecimento registrado ainda.</p>
          <p className="text-xs text-gray-300 mt-1">Clique em "Novo Abastecimento" para começar.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-black text-gray-500 uppercase tracking-wider">Data</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-black text-gray-500 uppercase tracking-wider">Caminhão</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-black text-gray-500 uppercase tracking-wider">Motorista</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-black text-gray-500 uppercase tracking-wider">Posto</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-black text-gray-500 uppercase tracking-wider">KM</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-black text-gray-500 uppercase tracking-wider">Total</th>
                <th scope="col" className="relative px-6 py-3"><span className="sr-only">Editar</span></th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filtrados.map(a => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{fmtData(a.data)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{a.caminhao_placa}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{a.motorista}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{a.posto}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{a.km || '—'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-red-600">R$ {a.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button onClick={() => selecionar(a)} className="text-red-600 hover:text-red-900">
                      <ChevronRight size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex justify-end p-4 border-t border-gray-200">
            <p className="text-sm font-bold text-gray-700">Total Geral: <span className="text-red-600">R$ {totalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></p>
          </div>
        </div>
      )}
    </div>
  )
}
