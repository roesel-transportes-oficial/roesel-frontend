'use client'
import { useState, useEffect } from 'react'
import { caminhoesAPI, motoristasAPI } from '../services/api'
import { useAuth } from '../services/auth'
import { Search, Plus, ArrowLeft, Save, Trash2, ChevronRight, Truck } from 'lucide-react'

interface Caminhao {
  id: string; placa: string; modelo: string; ano: string
  status: string; motivo_parado: string; dt_parado: string
  motorista_atual: string; obs_documentos: string; frota: string
}

interface Motorista { id: string; nome: string; ativo: boolean }
interface Frota { id: string; nome: string }

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_KEY!

function diasParado(dt: string) {
  if (!dt) return null
  const inicio = new Date(dt + 'T00:00:00')
  const hoje = new Date()
  return Math.ceil((hoje.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24))
}

export default function CaminhaoPage() {
  const { perm } = useAuth()
  const [caminhoes, setCaminhoes] = useState<Caminhao[]>([])
  const [motoristas, setMotoristas] = useState<Motorista[]>([])
  const [frotas, setFrotas] = useState<Frota[]>([])
  const [busca, setBusca] = useState('')
  const [sel, setSel] = useState<Caminhao | null>(null)
  const [mostraCad, setMostraCad] = useState(false)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [confirmExcluir, setConfirmExcluir] = useState(false)

  const [editPlaca, setEditPlaca] = useState('')
  const [editModelo, setEditModelo] = useState('')
  const [editAno, setEditAno] = useState('')
  const [editStatus, setEditStatus] = useState('rodando')
  const [editMotivo, setEditMotivo] = useState('')
  const [editDtParado, setEditDtParado] = useState('')
  const [editMotorista, setEditMotorista] = useState('')
  const [editFrota, setEditFrota] = useState('')
  const [editObs, setEditObs] = useState('')

  const [cadPlaca, setCadPlaca] = useState('')
  const [cadModelo, setCadModelo] = useState('')
  const [cadAno, setCadAno] = useState('')
  const [cadStatus, setCadStatus] = useState('rodando')
  const [cadMotivo, setCadMotivo] = useState('')
  const [cadDtParado, setCadDtParado] = useState('')
  const [cadMotorista, setCadMotorista] = useState('')
  const [cadFrota, setCadFrota] = useState('')
  const [cadObs, setCadObs] = useState('')

  useEffect(() => {
    fetch_()
    motoristasAPI.listar().then(setMotoristas).catch(() => {})
    fetchFrotas()
  }, [])

  async function fetch_() {
    const data = await caminhoesAPI.listar()
    setCaminhoes(data)
  }

  async function fetchFrotas() {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/frotas?order=nome.asc`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
      })
      const data = await res.json()
      setFrotas(data)
    } catch {}
  }

  const filtrados = busca.trim()
    ? caminhoes.filter(c =>
        c.placa?.toLowerCase().includes(busca.toLowerCase()) ||
        c.modelo?.toLowerCase().includes(busca.toLowerCase()) ||
        c.frota?.toLowerCase().includes(busca.toLowerCase())
      )
    : caminhoes

  function selecionar(c: Caminhao) {
    setSel(c)
    setEditPlaca(c.placa || '')
    setEditModelo(c.modelo || '')
    setEditAno(c.ano || '')
    setEditStatus(c.status || 'rodando')
    setEditMotivo(c.motivo_parado || '')
    setEditDtParado(c.dt_parado || '')
    setEditMotorista(c.motorista_atual || '')
    setEditFrota(c.frota || '')
    setEditObs(c.obs_documentos || '')
    setConfirmExcluir(false)
  }

  function voltar() { setSel(null); setConfirmExcluir(false) }
  function showMsg(t: string) { setMsg(t); setTimeout(() => setMsg(''), 3000) }

  async function salvar() {
    if (!sel) return
    setLoading(true)
    if (perm !== 'demo') {
      await caminhoesAPI.atualizar(sel.id, {
        placa: editPlaca.toUpperCase(), modelo: editModelo, ano: editAno,
        status: editStatus, frota: editFrota,
        motivo_parado: editStatus !== 'rodando' ? editMotivo : '',
        dt_parado: editStatus !== 'rodando' ? editDtParado : null,
        motorista_atual: editMotorista,
        obs_documentos: editObs,
      })

      if (editMotorista !== sel.motorista_atual) {
        if (sel.motorista_atual) {
          const antigo = motoristas.find(m => m.nome === sel.motorista_atual)
          if (antigo) await motoristasAPI.atualizar(antigo.id, { nome: antigo.nome, caminhao_id: null } as any)
        }
        if (editMotorista) {
          const novo = motoristas.find(m => m.nome === editMotorista)
          if (novo) await motoristasAPI.atualizar(novo.id, { nome: novo.nome, caminhao_id: sel.id } as any)
        }
      }
    }
    await fetch_(); setLoading(false); voltar(); showMsg('✅ Atualizado!')
  }

  async function excluir() {
    if (!sel) return
    setLoading(true)
    if (perm !== 'demo') await caminhoesAPI.excluir(sel.id)
    await fetch_(); setLoading(false); voltar(); showMsg('Caminhão excluído.')
  }

  async function cadastrar() {
    if (!cadPlaca.trim()) return
    setLoading(true)
    if (perm !== 'demo') {
      const novoCaminhao = await caminhoesAPI.criar({
        placa: cadPlaca.toUpperCase(), modelo: cadModelo, ano: cadAno,
        status: cadStatus, frota: cadFrota,
        motivo_parado: cadStatus !== 'rodando' ? cadMotivo : '',
        dt_parado: cadStatus !== 'rodando' ? cadDtParado : null,
        motorista_atual: cadMotorista,
        obs_documentos: cadObs,
      })

      if (cadMotorista && novoCaminhao?.[0]?.id) {
        const motoristaEncontrado = motoristas.find(m => m.nome === cadMotorista)
        if (motoristaEncontrado) {
          await motoristasAPI.atualizar(motoristaEncontrado.id, {
            nome: motoristaEncontrado.nome,
            caminhao_id: novoCaminhao[0].id,
          } as any)
        }
      }
    }
    await fetch_(); setLoading(false)
    setCadPlaca(''); setCadModelo(''); setCadAno(''); setCadStatus('rodando')
    setCadMotivo(''); setCadDtParado(''); setCadMotorista(''); setCadFrota(''); setCadObs('')
    setMostraCad(false); showMsg('✅ Caminhão cadastrado!')
  }

  const InputClass = "mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-gray-50"
  const LabelClass = "text-xs font-semibold text-gray-500 uppercase tracking-wide"
  const rodando = caminhoes.filter(c => c.status === 'rodando').length
  const parados = caminhoes.filter(c => c.status !== 'rodando').length

  const SelectFrota = ({ value, onChange }: { value: string, onChange: (v: string) => void }) => (
    <select value={value} onChange={e => onChange(e.target.value)} className={InputClass}>
      <option value="">Selecione uma frota...</option>
      {frotas.map(f => (
        <option key={f.id} value={f.nome}>{f.nome}</option>
      ))}
    </select>
  )

  if (mostraCad) return (
    <div className="p-6 max-w-2xl mx-auto">
      <button onClick={() => setMostraCad(false)} className="flex items-center gap-2 text-gray-500 hover:text-gray-800 mb-4 text-sm transition">
        <ArrowLeft size={16}/> Voltar
      </button>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-bold text-gray-800 mb-4 text-lg">Novo Caminhão</h3>
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={LabelClass}>Placa *</label>
              <input value={cadPlaca} onChange={e => setCadPlaca(e.target.value.toUpperCase())}
                placeholder="ABC1234" className={InputClass} />
            </div>
            <div>
              <label className={LabelClass}>Modelo</label>
              <input value={cadModelo} onChange={e => setCadModelo(e.target.value)} className={InputClass} />
            </div>
            <div>
              <label className={LabelClass}>Ano</label>
              <input value={cadAno} onChange={e => setCadAno(e.target.value)} className={InputClass} />
            </div>
          </div>
          <div>
            <label className={LabelClass}>Frota</label>
            <SelectFrota value={cadFrota} onChange={setCadFrota} />
          </div>
          <div>
            <label className={LabelClass}>Motorista</label>
            <select value={cadMotorista} onChange={e => setCadMotorista(e.target.value)} className={InputClass}>
              <option value="">Selecione um motorista...</option>
              {motoristas.filter(m => m.ativo !== false).map(m => (
                <option key={m.id} value={m.nome}>{m.nome}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={LabelClass}>Status</label>
            <select value={cadStatus} onChange={e => setCadStatus(e.target.value)} className={InputClass}>
              <option value="rodando">Rodando</option>
              <option value="parado">Parado</option>
              <option value="manutencao">Manutenção</option>
              <option value="vendido">Vendido</option>
            </select>
          </div>
          {cadStatus !== 'rodando' && (
            <>
              <div>
                <label className={LabelClass}>Motivo</label>
                <input value={cadMotivo} onChange={e => setCadMotivo(e.target.value)}
                  placeholder="Descreva o motivo..." className={InputClass} />
              </div>
              <div>
                <label className={LabelClass}>Data de início</label>
                <input type="date" value={cadDtParado} onChange={e => setCadDtParado(e.target.value)} className={InputClass} />
              </div>
            </>
          )}
          <div>
            <label className={LabelClass}>Observações</label>
            <textarea value={cadObs} onChange={e => setCadObs(e.target.value)} rows={2} className={InputClass} />
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={cadastrar} disabled={loading}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-xl py-2.5 text-sm font-medium transition">
              Salvar caminhão
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
            <div className={`px-6 py-5 bg-gradient-to-r ${
              editStatus === 'rodando' ? 'from-green-600 to-green-700' :
              editStatus === 'manutencao' ? 'from-yellow-500 to-yellow-600' :
              'from-gray-500 to-gray-600'}`}>
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center text-white">
                  <Truck size={24} />
                </div>
                <div>
                  <h2 className="text-white font-bold text-xl">{sel.placa}</h2>
                  <p className="text-white/80 text-sm">
                    {sel.modelo} {sel.ano && `· ${sel.ano}`}
                    {sel.frota && ` · Frota ${sel.frota}`}
                  </p>
                </div>
              </div>
            </div>
            <div className="p-5 space-y-4">
              {editStatus !== 'rodando' && editDtParado && (
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                  <p className="text-sm font-semibold text-orange-700">
                    🚫 {editStatus === 'manutencao' ? 'Em manutenção' : editStatus === 'vendido' ? 'Vendido' : 'Parado'} há {diasParado(editDtParado)} dia(s)
                  </p>
                  {editMotivo && <p className="text-xs text-orange-600 mt-1">Motivo: {editMotivo}</p>}
                </div>
              )}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={LabelClass}>Placa</label>
                  <input value={editPlaca} onChange={e => setEditPlaca(e.target.value.toUpperCase())} className={InputClass} />
                </div>
                <div>
                  <label className={LabelClass}>Modelo</label>
                  <input value={editModelo} onChange={e => setEditModelo(e.target.value)} className={InputClass} />
                </div>
                <div>
                  <label className={LabelClass}>Ano</label>
                  <input value={editAno} onChange={e => setEditAno(e.target.value)} className={InputClass} />
                </div>
              </div>
              <div>
                <label className={LabelClass}>Frota</label>
                <SelectFrota value={editFrota} onChange={setEditFrota} />
              </div>
              <div>
                <label className={LabelClass}>Motorista</label>
                <select value={editMotorista} onChange={e => setEditMotorista(e.target.value)} className={InputClass}>
                  <option value="">Selecione um motorista...</option>
                  {motoristas.filter(m => m.ativo !== false).map(m => (
                    <option key={m.id} value={m.nome}>{m.nome}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={LabelClass}>Status</label>
                <select value={editStatus} onChange={e => {
                  setEditStatus(e.target.value)
                  if (e.target.value !== 'rodando' && !editDtParado)
                    setEditDtParado(new Date().toISOString().split('T')[0])
                  if (e.target.value === 'rodando') { setEditMotivo(''); setEditDtParado('') }
                }} className={InputClass}>
                  <option value="rodando">Rodando</option>
                  <option value="parado">Parado</option>
                  <option value="manutencao">Manutenção</option>
                  <option value="vendido">Vendido</option>
                </select>
              </div>
              {editStatus !== 'rodando' && (
                <>
                  <div>
                    <label className={LabelClass}>Motivo</label>
                    <input value={editMotivo} onChange={e => setEditMotivo(e.target.value)}
                      placeholder="Descreva o motivo..." className={InputClass} />
                  </div>
                  <div>
                    <label className={LabelClass}>Data de início</label>
                    <input type="date" value={editDtParado} onChange={e => setEditDtParado(e.target.value)} className={InputClass} />
                  </div>
                </>
              )}
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
                  <p className="text-sm text-red-700 font-medium mb-3">⚠️ Excluir caminhão {sel.placa}?</p>
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
            <h1 className="text-2xl font-bold text-gray-900">Caminhões</h1>
            {perm !== 'view' && (
              <button onClick={() => setMostraCad(true)}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition shadow-sm">
                <Plus size={16}/> Cadastrar
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-green-50 border border-green-100 rounded-2xl p-4">
              <p className="text-xs text-green-600 font-medium">Rodando</p>
              <p className="text-3xl font-bold text-green-700 mt-1">{rodando}</p>
            </div>
            <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4">
              <p className="text-xs text-orange-600 font-medium">Parados / Manutenção</p>
              <p className="text-3xl font-bold text-orange-700 mt-1">{parados}</p>
            </div>
          </div>
          <div className="relative mb-4">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={busca} onChange={e => setBusca(e.target.value)}
              placeholder="Buscar por placa, modelo ou frota..."
              className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-white shadow-sm" />
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Caminhões</p>
              <p className="text-xs text-gray-400">{filtrados.length} cadastrado(s)</p>
            </div>
            {filtrados.length === 0 ? (
              <div className="p-10 text-center">
                <Truck size={32} className="mx-auto text-gray-200 mb-2" />
                <p className="text-sm text-gray-400">Nenhum caminhão encontrado</p>
              </div>
            ) : filtrados.map(c => {
              const dias = diasParado(c.dt_parado)
              return (
                <button key={c.id} onClick={() => selecionar(c)}
                  className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition border-b border-gray-50 last:border-0 text-left">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                    c.status === 'rodando' ? 'bg-green-100 text-green-600' :
                    c.status === 'manutencao' ? 'bg-yellow-100 text-yellow-600' :
                    'bg-gray-100 text-gray-500'}`}>
                    <Truck size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-gray-900">{c.placa}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        c.status === 'rodando' ? 'bg-green-100 text-green-700' :
                        c.status === 'manutencao' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-gray-100 text-gray-600'}`}>{c.status}</span>
                      {c.frota && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">Frota {c.frota}</span>}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {c.modelo} {c.ano && `· ${c.ano}`}
                      {c.motorista_atual && ` · ${c.motorista_atual}`}
                      {c.status !== 'rodando' && dias && ` · ${dias} dia(s) parado`}
                    </p>
                    {c.motivo_parado && <p className="text-xs text-orange-500 mt-0.5">{c.motivo_parado}</p>}
                  </div>
                  <ChevronRight size={16} className="text-gray-300" />
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}