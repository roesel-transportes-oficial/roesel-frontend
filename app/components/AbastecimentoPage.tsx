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
  total: number; km: number; obs: string
}

interface Caminhao { id: string; placa: string; modelo: string; motorista_atual: string }
interface Posto { id: string; nome: string }

const InputClass = "mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-gray-50"
const LabelClass = "text-xs font-semibold text-gray-500 uppercase tracking-wide"

const ESTADOS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']

export default function AbastecimentoPage() {
  const { perm } = useAuth()
  const [abastecimentos, setAbastecimentos] = useState<Abastecimento[]>([])
  const [caminhoes, setCaminhoes] = useState<Caminhao[]>([])
  const [postos, setPostos] = useState<Posto[]>([])
  const [busca, setBusca] = useState('')
  const [sel, setSel] = useState<Abastecimento | null>(null)
  const [mostraCad, setMostraCad] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingIA, setLoadingIA] = useState(false)
  const [msg, setMsg] = useState('')
  const [confirmExcluir, setConfirmExcluir] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  useEffect(() => {
    fetch_()
    caminhoesAPI.listar().then(setCaminhoes).catch(() => {})
    fetchPostos()
  }, [])

  async function fetch_() {
    const data = await abastecimentosAPI.listar()
    setAbastecimentos(data)
  }

  async function fetchPostos() {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/postos?order=nome.asc`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
      })
      const data = await res.json()
      setPostos(data)
    } catch {}
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
        : file.type === 'image/png' ? 'image/png'
        : 'image/jpeg'

      const res = await fetch('/api/ler-cupom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64, mediaType }),
      })

      const json = await res.json()

      if (!json.ok) {
        showMsg('⚠️ ' + (json.erro || 'Não foi possível extrair os dados.'))
        return
      }

      const d = json.dados

      if (d.data_abastecimento) setCadData(d.data_abastecimento)
      if (d.cnpj_posto) setCadCnpjPosto(d.cnpj_posto)
      if (d.cidade) setCadCidade(d.cidade)
      if (d.estado) setCadEstado(d.estado)
      if (d.litros_combustivel) setCadLitrosComb(String(d.litros_combustivel))
      if (d.valor_litro_combustivel) setCadValorLitroComb(String(d.valor_litro_combustivel))
      if (d.km) setCadKm(String(d.km))

      if (d.litros_arla && d.litros_arla > 0) {
        setUsaArla(true)
        setCadLitrosArla(String(d.litros_arla))
        if (d.valor_litro_arla) setCadValorLitroArla(String(d.valor_litro_arla))
      }

      if (d.nome_posto) {
        const postoEncontrado = postos.find(p =>
          p.nome.toLowerCase().includes(d.nome_posto.toLowerCase().slice(0, 6))
        )
        if (postoEncontrado) setCadPosto(postoEncontrado.nome)
        else setCadPosto(d.nome_posto)
      }

      if (d.placa) {
        const camEncontrado = caminhoes.find(c =>
          c.placa.replace(/[^A-Z0-9]/gi, '').toLowerCase() ===
          d.placa.replace(/[^A-Z0-9]/gi, '').toLowerCase()
        )
        if (camEncontrado) {
          setCadCaminhaoId(camEncontrado.id)
          setCadCaminhaoPlaca(camEncontrado.placa)
          setCadMotorista(camEncontrado.motorista_atual || '')
        }
      }

      showMsg('✅ Dados extraídos do cupom com sucesso!')
    } catch {
      showMsg('⚠️ Erro ao processar o arquivo.')
    } finally {
      setLoadingIA(false)
    }
  }

  function fmtCnpj(v: string) {
    const d = v.replace(/\D/g,'').slice(0,14)
    if (d.length <= 2) return d
    if (d.length <= 5) return `${d.slice(0,2)}.${d.slice(2)}`
    if (d.length <= 8) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5)}`
    if (d.length <= 12) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8)}`
    return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`
  }

  function calcTotal(lc: string, vlc: string, la: string, vla: string) {
    return (parseFloat(lc)||0)*(parseFloat(vlc)||0) + (parseFloat(la)||0)*(parseFloat(vla)||0)
  }

  const filtrados = busca.trim()
    ? abastecimentos.filter(a =>
        a.caminhao_placa?.toLowerCase().includes(busca.toLowerCase()) ||
        a.motorista?.toLowerCase().includes(busca.toLowerCase()) ||
        a.posto?.toLowerCase().includes(busca.toLowerCase()) ||
        a.cidade?.toLowerCase().includes(busca.toLowerCase())
      )
    : abastecimentos

  function selecionar(a: Abastecimento) {
    setSel(a)
    setEditData(a.data || '')
    setEditCaminhaoId(a.caminhao_id || '')
    setEditCaminhaoPlaca(a.caminhao_placa || '')
    setEditMotorista(a.motorista || '')
    setEditPosto(a.posto || '')
    setEditCnpjPosto(a.cnpj_posto || '')
    setEditEstado(a.estado || '')
    setEditCidade(a.cidade || '')
    setEditLitrosComb(String(a.litros_combustivel || ''))
    setEditValorLitroComb(String(a.valor_litro_combustivel || ''))
    setEditLitrosArla(String(a.litros_arla || ''))
    setEditValorLitroArla(String(a.valor_litro_arla || ''))
    setEditKm(String(a.km || ''))
    setEditObs(a.obs || '')
    setEditUsaArla((a.litros_arla || 0) > 0)
    setConfirmExcluir(false)
  }

  function voltar() { setSel(null); setConfirmExcluir(false) }
  function showMsg(t: string) { setMsg(t); setTimeout(() => setMsg(''), 4000) }

  async function salvar() {
    if (!sel) return
    setLoading(true)
    const total = calcTotal(editLitrosComb, editValorLitroComb, editUsaArla ? editLitrosArla : '0', editUsaArla ? editValorLitroArla : '0')
    if (perm !== 'demo') await abastecimentosAPI.atualizar(sel.id, {
      data: editData, caminhao_id: editCaminhaoId, caminhao_placa: editCaminhaoPlaca,
      motorista: editMotorista, posto: editPosto, cnpj_posto: editCnpjPosto,
      estado: editEstado, cidade: editCidade,
      litros_combustivel: parseFloat(editLitrosComb) || 0,
      valor_litro_combustivel: parseFloat(editValorLitroComb) || 0,
      litros_arla: editUsaArla ? parseFloat(editLitrosArla) || 0 : 0,
      valor_litro_arla: editUsaArla ? parseFloat(editValorLitroArla) || 0 : 0,
      km: parseInt(editKm) || null,
      total, obs: editObs,
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
    setCadKm(''); setCadObs(''); setUsaArla(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function cadastrar() {
    if (!cadCaminhaoId) return
    setLoading(true)
    const total = calcTotal(cadLitrosComb, cadValorLitroComb, usaArla ? cadLitrosArla : '0', usaArla ? cadValorLitroArla : '0')
    if (perm !== 'demo') await abastecimentosAPI.criar({
      data: cadData, caminhao_id: cadCaminhaoId, caminhao_placa: cadCaminhaoPlaca,
      motorista: cadMotorista, posto: cadPosto, cnpj_posto: cadCnpjPosto,
      estado: cadEstado, cidade: cadCidade,
      litros_combustivel: parseFloat(cadLitrosComb) || 0,
      valor_litro_combustivel: parseFloat(cadValorLitroComb) || 0,
      litros_arla: usaArla ? parseFloat(cadLitrosArla) || 0 : 0,
      valor_litro_arla: usaArla ? parseFloat(cadValorLitroArla) || 0 : 0,
      km: parseInt(cadKm) || null,
      total, obs: cadObs,
    })
    await fetch_(); setLoading(false)
    resetCad(); setMostraCad(false)
    showMsg('✅ Abastecimento registrado!')
  }

  const totalGeral = filtrados.reduce((s, a) => s + (a.total || 0), 0)

  function fmtData(d: string) {
    if (!d) return ''
    const [y, m, dia] = d.split('-')
    return `${dia}/${m}/${y}`
  }

  const Toggle = ({ value, onChange }: { value: boolean, onChange: () => void }) => (
    <button onClick={onChange}
      className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors ${value ? 'bg-red-600' : 'bg-gray-300'}`}>
      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${value ? 'translate-x-5' : 'translate-x-1'}`} />
    </button>
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
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={e => {
              const file = e.target.files?.[0]
              if (file) lerCupomComIA(file)
            }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={loadingIA}
            className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-red-200 hover:border-red-400 bg-white hover:bg-red-50 text-red-600 rounded-xl py-3 text-sm font-medium transition disabled:opacity-60"
          >
            {loadingIA
              ? <><Loader2 size={16} className="animate-spin" /> Lendo cupom com IA...</>
              : <><Upload size={16} /> Selecionar imagem ou PDF</>
            }
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
              <label className={LabelClass}>Posto</label>
              <select value={cadPosto} onChange={e => setCadPosto(e.target.value)} className={InputClass}>
                <option value="">Selecione...</option>
                {postos.map(p => <option key={p.id} value={p.nome}>{p.nome}</option>)}
              </select>
            </div>
            <div>
              <label className={LabelClass}>CNPJ do Posto</label>
              <input value={fmtCnpj(cadCnpjPosto)} onChange={e => setCadCnpjPosto(e.target.value.replace(/\D/g,''))}
                placeholder="00.000.000/0000-00" maxLength={18} className={InputClass} />
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
            <select value={cadCaminhaoId} onChange={e => {
              const cam = caminhoes.find(c => c.id === e.target.value)
              setCadCaminhaoId(e.target.value)
              setCadCaminhaoPlaca(cam?.placa || '')
              setCadMotorista(cam?.motorista_atual || '')
            }} className={InputClass}>
              <option value="">Selecione o caminhão...</option>
              {caminhoes.map(c => (
                <option key={c.id} value={c.id}>{c.placa} {c.modelo && `· ${c.modelo}`}</option>
              ))}
            </select>
          </div>

          {cadMotorista && (
            <div className="bg-blue-50 rounded-xl p-3">
              <p className="text-xs text-blue-600 font-medium">Motorista: <span className="text-blue-800">{cadMotorista}</span></p>
            </div>
          )}

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
            {cadLitrosComb && cadValorLitroComb && (
              <p className="text-xs text-gray-500 mt-2">
                Subtotal: <span className="font-semibold text-gray-700">
                  {((parseFloat(cadLitrosComb)||0)*(parseFloat(cadValorLitroComb)||0)).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
                </span>
              </p>
            )}
          </div>

          <div className="border-t border-gray-100 pt-3">
            <div className="flex items-center justify-between mb-3">
              <p className={LabelClass}>Arla 32</p>
              <Toggle value={usaArla} onChange={() => setUsaArla(!usaArla)} />
            </div>
            {usaArla && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LabelClass}>Litros</label>
                  <input type="number" step="0.01" value={cadLitrosArla} onChange={e => setCadLitrosArla(e.target.value)} className={InputClass} placeholder="0,00" />
                </div>
                <div>
                  <label className={LabelClass}>Valor por litro (R$)</label>
                  <input type="number" step="0.001" value={cadValorLitroArla} onChange={e => setCadValorLitroArla(e.target.value)} className={InputClass} placeholder="0,000" />
                </div>
              </div>
            )}
          </div>

          <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-700">Total</p>
              <p className="text-xl font-bold text-red-600">
                {calcTotal(cadLitrosComb, cadValorLitroComb, usaArla ? cadLitrosArla : '0', usaArla ? cadValorLitroArla : '0')
                  .toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
              </p>
            </div>
          </div>

          <div>
            <label className={LabelClass}>Observações</label>
            <textarea value={cadObs} onChange={e => setCadObs(e.target.value)} rows={2} className={InputClass} />
          </div>

          <div className="flex gap-2 pt-1">
            <button onClick={cadastrar} disabled={loading || !cadCaminhaoId}
              className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl py-2.5 text-sm font-medium transition">
              Registrar abastecimento
            </button>
            <button onClick={() => { setMostraCad(false); resetCad() }}
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
      {msg && (
        <div className={`mb-4 p-3 rounded-xl text-sm border ${msg.startsWith('⚠️') ? 'bg-yellow-50 border-yellow-200 text-yellow-700' : 'bg-green-50 border-green-200 text-green-700'}`}>
          {msg}
        </div>
      )}

      {sel ? (
        <div>
          <button onClick={voltar} className="flex items-center gap-2 text-gray-500 hover:text-gray-800 mb-4 text-sm transition">
            <ArrowLeft size={16}/> Voltar
          </button>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-5 bg-gradient-to-r from-red-600 to-red-700">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center text-white">
                  <Fuel size={24} />
                </div>
                <div>
                  <h2 className="text-white font-bold text-xl">{sel.caminhao_placa}</h2>
                  <p className="text-white/80 text-sm">{fmtData(sel.data)} · {sel.posto} {sel.cidade && `· ${sel.cidade}`} {sel.estado && `- ${sel.estado}`}</p>
                </div>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LabelClass}>Data</label>
                  <input type="date" value={editData} onChange={e => setEditData(e.target.value)} className={InputClass} />
                </div>
                <div>
                  <label className={LabelClass}>KM</label>
                  <input type="number" value={editKm} onChange={e => setEditKm(e.target.value)} className={InputClass} placeholder="Ex: 156650" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LabelClass}>Posto</label>
                  <select value={editPosto} onChange={e => setEditPosto(e.target.value)} className={InputClass}>
                    <option value="">Selecione...</option>
                    {postos.map(p => <option key={p.id} value={p.nome}>{p.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className={LabelClass}>CNPJ do Posto</label>
                  <input value={fmtCnpj(editCnpjPosto)} onChange={e => setEditCnpjPosto(e.target.value.replace(/\D/g,''))}
                    placeholder="00.000.000/0000-00" maxLength={18} className={InputClass} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LabelClass}>Cidade</label>
                  <input value={editCidade} onChange={e => setEditCidade(e.target.value.toUpperCase())} className={InputClass} />
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
                <label className={LabelClass}>Caminhão</label>
                <select value={editCaminhaoId} onChange={e => {
                  const cam = caminhoes.find(c => c.id === e.target.value)
                  setEditCaminhaoId(e.target.value)
                  setEditCaminhaoPlaca(cam?.placa || '')
                  setEditMotorista(cam?.motorista_atual || '')
                }} className={InputClass}>
                  <option value="">Selecione...</option>
                  {caminhoes.map(c => (
                    <option key={c.id} value={c.id}>{c.placa} {c.modelo && `· ${c.modelo}`}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={LabelClass}>Motorista</label>
                <input value={editMotorista} onChange={e => setEditMotorista(e.target.value)} className={InputClass} />
              </div>

              <div className="border-t border-gray-100 pt-3">
                <p className={LabelClass + " mb-3"}>Combustível</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={LabelClass}>Litros</label>
                    <input type="number" step="0.01" value={editLitrosComb} onChange={e => setEditLitrosComb(e.target.value)} className={InputClass} />
                  </div>
                  <div>
                    <label className={LabelClass}>Valor por litro (R$)</label>
                    <input type="number" step="0.001" value={editValorLitroComb} onChange={e => setEditValorLitroComb(e.target.value)} className={InputClass} />
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-3">
                <div className="flex items-center justify-between mb-3">
                  <p className={LabelClass}>Arla 32</p>
                  <Toggle value={editUsaArla} onChange={() => setEditUsaArla(!editUsaArla)} />
                </div>
                {editUsaArla && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={LabelClass}>Litros</label>
                      <input type="number" step="0.01" value={editLitrosArla} onChange={e => setEditLitrosArla(e.target.value)} className={InputClass} />
                    </div>
                    <div>
                      <label className={LabelClass}>Valor por litro (R$)</label>
                      <input type="number" step="0.001" value={editValorLitroArla} onChange={e => setEditValorLitroArla(e.target.value)} className={InputClass} />
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-700">Total</p>
                  <p className="text-xl font-bold text-red-600">
                    {calcTotal(editLitrosComb, editValorLitroComb, editUsaArla ? editLitrosArla : '0', editUsaArla ? editValorLitroArla : '0')
                      .toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
                  </p>
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
                  <p className="text-sm text-red-700 font-medium mb-3">⚠️ Excluir este abastecimento?</p>
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
            <h1 className="text-2xl font-bold text-gray-900">Abastecimentos</h1>
            {perm !== 'view' && (
              <button onClick={() => setMostraCad(true)}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition shadow-sm">
                <Plus size={16}/> Registrar
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Total registros</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{filtrados.length}</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Total gasto</p>
              <p className="text-xl font-bold text-red-600 mt-1">
                {totalGeral.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
              </p>
            </div>
          </div>

          <div className="relative mb-4">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={busca} onChange={e => setBusca(e.target.value)}
              placeholder="Buscar por placa, motorista, posto ou cidade..."
              className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-white shadow-sm" />
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Registros</p>
              <p className="text-xs text-gray-400">{filtrados.length} registro(s)</p>
            </div>
            {filtrados.length === 0 ? (
              <div className="p-10 text-center">
                <Fuel size={32} className="mx-auto text-gray-200 mb-2" />
                <p className="text-sm text-gray-400">Nenhum abastecimento registrado</p>
              </div>
            ) : filtrados.map(a => (
              <button key={a.id} onClick={() => selecionar(a)}
                className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition border-b border-gray-50 last:border-0 text-left">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 text-red-600">
                  <Fuel size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900">{a.caminhao_placa}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{a.motorista} · {a.posto}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {fmtData(a.data)}
                    {a.cidade && ` · ${a.cidade}`}
                    {a.estado && ` - ${a.estado}`}
                    {` · ${a.litros_combustivel}L`}
                    {a.litros_arla ? ` + ${a.litros_arla}L Arla` : ''}
                    {a.km ? ` · ${a.km.toLocaleString('pt-BR')} km` : ''}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-gray-800">
                    {(a.total||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
                  </p>
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
