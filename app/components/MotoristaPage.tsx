'use client'
import { useState, useEffect } from 'react'
import { motoristasAPI, caminhoesAPI } from '../services/api'
import { useAuth } from '../services/auth'
import { Search, Plus, ArrowLeft, Save, Trash2, ChevronRight, User, AlertTriangle, Clock } from 'lucide-react'

interface Motorista {
  id: string; nome: string; cpf: string; rg: string
  tipo: string; ativo: boolean; adiantamento: boolean
  dt_desligamento: string
  vencimento_cnh: string; vencimento_permisso: string; vencimento_toxicologico: string
  vencimento_periodico: string
  caminhao_id: string; caminhao_temp_id: string; de_ferias: boolean
  ferias_inicio: string; ferias_fim: string; substituto_id: string
}

interface Caminhao { id: string; placa: string; modelo: string; motorista_atual: string }

function fmtCpf(v: string) {
  const d = v.replace(/\D/g,'').slice(0,11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0,3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6)}`
  return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`
}

function diasParaVencer(data: string) {
  if (!data) return null
  const hoje = new Date()
  const venc = new Date(data + 'T00:00:00')
  return Math.ceil((venc.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))
}

function vencStatus(data: string) {
  const dias = diasParaVencer(data)
  if (dias === null) return null
  if (dias < 0) return 'vencido'
  if (dias <= 15) return 'critico'
  if (dias <= 30) return 'alerta'
  return 'ok'
}

function AlertasVencimento({ motorista }: { motorista: Motorista }) {
  const campos = [
    { label: 'CNH', data: motorista.vencimento_cnh },
    { label: 'Permisso', data: motorista.vencimento_permisso },
    { label: 'Toxicológico', data: motorista.vencimento_toxicologico },
    { label: 'Periódico', data: motorista.vencimento_periodico },
  ]
  const alertas = campos.filter(c => ['vencido','critico','alerta'].includes(vencStatus(c.data) || ''))
  if (alertas.length === 0) return null
  return (
    <div className="space-y-2 mb-4">
      {alertas.map(c => {
        const dias = diasParaVencer(c.data)
        const s = vencStatus(c.data)
        return (
          <div key={c.label} className={`flex items-center gap-3 p-3 rounded-xl text-sm ${
            s === 'vencido' ? 'bg-red-50 border border-red-200' :
            s === 'critico' ? 'bg-orange-50 border border-orange-200' :
            'bg-yellow-50 border border-yellow-200'
          }`}>
            {s === 'vencido'
              ? <AlertTriangle size={16} className="text-red-500 flex-shrink-0" />
              : <Clock size={16} className={s === 'critico' ? 'text-orange-500 flex-shrink-0' : 'text-yellow-500 flex-shrink-0'} />}
            <span className={s === 'vencido' ? 'text-red-700' : s === 'critico' ? 'text-orange-700' : 'text-yellow-700'}>
              {s === 'vencido'
                ? `⚠️ ${motorista.nome} — ${c.label} vencido há ${Math.abs(dias!)} dia(s)`
                : s === 'critico'
                ? `🔴 ${motorista.nome} — ${c.label} vence em ${dias} dia(s) — renovação urgente`
                : `🟡 ${motorista.nome} — ${c.label} vence em ${dias} dia(s) — iniciar renovação`}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export default function MotoristaPage() {
  const { perm } = useAuth()
  const [motoristas, setMotoristas] = useState<Motorista[]>([])
  const [caminhoes, setCaminhoes] = useState<Caminhao[]>([])
  const [busca, setBusca] = useState('')
  const [sel, setSel] = useState<Motorista | null>(null)
  const [mostraCad, setMostraCad] = useState(false)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [confirmExcluir, setConfirmExcluir] = useState(false)

  const [editNome, setEditNome] = useState('')
  const [editCpf, setEditCpf] = useState('')
  const [editRg, setEditRg] = useState('')
  const [editTipo, setEditTipo] = useState('Com adiantamento')
  const [editAtivo, setEditAtivo] = useState(true)
  const [editAdiantamento, setEditAdiantamento] = useState(true)
  const [editDtDesligamento, setEditDtDesligamento] = useState('')
  const [editCnh, setEditCnh] = useState('')
  const [editPermisso, setEditPermisso] = useState('')
  const [editToxico, setEditToxico] = useState('')
  const [editPeriodico, setEditPeriodico] = useState('')
  const [editCaminhaoId, setEditCaminhaoId] = useState('')
  const [editDeFerias, setEditDeFerias] = useState(false)
  const [editFeriasInicio, setEditFeriasInicio] = useState('')
  const [editFeriasFim, setEditFeriasFim] = useState('')
  const [editSubstitutoId, setEditSubstitutoId] = useState('')

  const [cadNome, setCadNome] = useState('')
  const [cadCpf, setCadCpf] = useState('')
  const [cadRg, setCadRg] = useState('')
  const [cadTipo, setCadTipo] = useState('Com adiantamento')
  const [cadCnh, setCadCnh] = useState('')
  const [cadPermisso, setCadPermisso] = useState('')
  const [cadToxico, setCadToxico] = useState('')
  const [cadPeriodico, setCadPeriodico] = useState('')

  useEffect(() => {
    fetch_()
    caminhoesAPI.listar().then(setCaminhoes).catch(() => {})
  }, [])

  async function fetch_() {
    const data = await motoristasAPI.listar()
    setMotoristas(data)
  }

  const alertasGerais = motoristas.filter(m => m.ativo !== false).filter(m =>
    ['vencido','critico','alerta'].includes(vencStatus(m.vencimento_cnh) || '') ||
    ['vencido','critico','alerta'].includes(vencStatus(m.vencimento_permisso) || '') ||
    ['vencido','critico','alerta'].includes(vencStatus(m.vencimento_toxicologico) || '') ||
    ['vencido','critico','alerta'].includes(vencStatus(m.vencimento_periodico) || '')
  )

  const filtrados = busca.trim()
    ? motoristas.filter(m => m.nome.toLowerCase().includes(busca.toLowerCase()))
    : motoristas

  function selecionar(m: Motorista) {
    setSel(m)
    setEditNome(m.nome)
    setEditCpf(m.cpf || '')
    setEditRg(m.rg || '')
    setEditTipo(m.tipo || 'Com adiantamento')
    setEditAtivo(m.ativo !== false)
    setEditAdiantamento(m.adiantamento !== false)
    setEditDtDesligamento(m.dt_desligamento || '')
    setEditCnh(m.vencimento_cnh || '')
    setEditPermisso(m.vencimento_permisso || '')
    setEditToxico(m.vencimento_toxicologico || '')
    setEditPeriodico(m.vencimento_periodico || '')
    setEditCaminhaoId(m.caminhao_id || '')
    setEditDeFerias(m.de_ferias || false)
    setEditFeriasInicio(m.ferias_inicio || '')
    setEditFeriasFim(m.ferias_fim || '')
    setEditSubstitutoId(m.substituto_id || '')
    setConfirmExcluir(false)
  }

  function voltar() { setSel(null); setBusca(''); setConfirmExcluir(false) }
  function showMsg(t: string) { setMsg(t); setTimeout(() => setMsg(''), 3000) }

  async function salvar() {
    if (!sel) return
    setLoading(true)

    // Vínculo normal de caminhão (sem férias)
    if (editCaminhaoId && editCaminhaoId !== sel.caminhao_id && !editDeFerias) {
      if (sel.caminhao_id) {
        const camAntigo = caminhoes.find(c => c.id === sel.caminhao_id)
        if (camAntigo) await caminhoesAPI.atualizar(sel.caminhao_id, { ...camAntigo, motorista_atual: '' } as any)
      }
      const cam = caminhoes.find(c => c.id === editCaminhaoId)
      if (cam) await caminhoesAPI.atualizar(editCaminhaoId, { ...cam, motorista_atual: editNome.toUpperCase() } as any)
    }

    // Motorista foi para férias — vincula caminhão TEMPORÁRIO ao substituto
    if (editDeFerias && editSubstitutoId && editCaminhaoId) {
      const substituto = motoristas.find(m => m.id === editSubstitutoId)
      if (substituto) {
        await motoristasAPI.atualizar(editSubstitutoId, {
          nome: substituto.nome,
          caminhao_temp_id: editCaminhaoId,
        } as any)
        const cam = caminhoes.find(c => c.id === editCaminhaoId)
        if (cam) await caminhoesAPI.atualizar(editCaminhaoId, { ...cam, motorista_atual: substituto.nome } as any)
      }
    }

    // Motorista voltou de férias — remove caminhão temporário do substituto
    if (!editDeFerias && sel.de_ferias && sel.substituto_id && editCaminhaoId) {
      const substituto = motoristas.find(m => m.id === sel.substituto_id)
      if (substituto) {
        await motoristasAPI.atualizar(sel.substituto_id, {
          nome: substituto.nome,
          caminhao_temp_id: null,
        } as any)
        const cam = caminhoes.find(c => c.id === editCaminhaoId)
        if (cam) await caminhoesAPI.atualizar(editCaminhaoId, { ...cam, motorista_atual: editNome.toUpperCase() } as any)
      }
    }

    if (perm !== 'demo') await motoristasAPI.atualizar(sel.id, {
      nome: editNome.toUpperCase(), cpf: editCpf, rg: editRg,
      tipo: editTipo, ativo: editAtivo, adiantamento: editAdiantamento,
      dt_desligamento: editDtDesligamento || null,
      vencimento_cnh: editCnh || null,
      vencimento_permisso: editPermisso || null,
      vencimento_toxicologico: editToxico || null,
      vencimento_periodico: editPeriodico || null,
      caminhao_id: editCaminhaoId || null,
      de_ferias: editDeFerias,
      ferias_inicio: editDeFerias ? editFeriasInicio || null : null,
      ferias_fim: editDeFerias ? editFeriasFim || null : null,
      substituto_id: editDeFerias ? editSubstitutoId || null : null,
    })
    await fetch_(); setLoading(false); voltar(); showMsg('✅ Atualizado!')
  }

  async function excluir() {
    if (!sel) return
    setLoading(true)
    if (perm !== 'demo') await motoristasAPI.excluir(sel.id)
    await fetch_(); setLoading(false); voltar(); showMsg('Motorista excluído.')
  }

  async function cadastrar() {
    if (!cadNome.trim()) return
    setLoading(true)
    if (perm !== 'demo') await motoristasAPI.criar({
      nome: cadNome.toUpperCase(), cpf: cadCpf, rg: cadRg,
      tipo: cadTipo, ativo: true, adiantamento: true,
      vencimento_cnh: cadCnh || null,
      vencimento_permisso: cadPermisso || null,
      vencimento_toxicologico: cadToxico || null,
      vencimento_periodico: cadPeriodico || null,
    })
    await fetch_(); setLoading(false)
    setCadNome(''); setCadCpf(''); setCadRg(''); setCadTipo('Com adiantamento')
    setCadCnh(''); setCadPermisso(''); setCadToxico(''); setCadPeriodico('')
    setMostraCad(false); showMsg('✅ Motorista cadastrado!')
  }

  const InputClass = "mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-gray-50"
  const LabelClass = "text-xs font-semibold text-gray-500 uppercase tracking-wide"

  function TagVenc({ data, label }: { data: string, label: string }) {
    const s = vencStatus(data)
    const dias = diasParaVencer(data)
    if (!s) return (
      <div className="bg-gray-50 rounded-xl p-3">
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-sm text-gray-300 mt-1">—</p>
      </div>
    )
    return (
      <div className={`rounded-xl p-3 ${
        s === 'vencido' ? 'bg-red-50' : s === 'critico' ? 'bg-orange-50' :
        s === 'alerta' ? 'bg-yellow-50' : 'bg-green-50'
      }`}>
        <p className={`text-xs font-medium ${
          s === 'vencido' ? 'text-red-500' : s === 'critico' ? 'text-orange-500' :
          s === 'alerta' ? 'text-yellow-600' : 'text-green-600'
        }`}>{label}</p>
        <p className={`text-sm font-semibold mt-1 ${
          s === 'vencido' ? 'text-red-700' : s === 'critico' ? 'text-orange-700' :
          s === 'alerta' ? 'text-yellow-700' : 'text-green-700'
        }`}>
          {new Date(data + 'T00:00:00').toLocaleDateString('pt-BR')}
        </p>
        {s !== 'ok' && (
          <p className="text-xs mt-0.5 opacity-70">
            {s === 'vencido' ? `${Math.abs(dias!)}d atrás` : `${dias}d restantes`}
          </p>
        )}
      </div>
    )
  }

  function Toggle({ value, onChange, label }: { value: boolean, onChange: () => void, label: string }) {
    return (
      <div className="flex items-center gap-3">
        <span className={LabelClass}>{label}</span>
        <button onClick={onChange}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${value ? 'bg-red-600' : 'bg-gray-300'}`}>
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${value ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
        <span className="text-xs text-gray-500">{value ? 'Sim' : 'Não'}</span>
      </div>
    )
  }

  function diasFerias(inicio: string, fim: string) {
    if (!inicio || !fim) return null
    const i = new Date(inicio + 'T00:00:00')
    const f = new Date(fim + 'T00:00:00')
    return Math.ceil((f.getTime() - i.getTime()) / (1000 * 60 * 60 * 24))
  }

  if (mostraCad) return (
    <div className="p-6 max-w-2xl mx-auto">
      <button onClick={() => setMostraCad(false)} className="flex items-center gap-2 text-gray-500 hover:text-gray-800 mb-4 text-sm transition">
        <ArrowLeft size={16}/> Voltar
      </button>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-bold text-gray-800 mb-4 text-lg">Novo Motorista</h3>
        <div className="space-y-3">
          <div>
            <label className={LabelClass}>Nome completo *</label>
            <input value={cadNome} onChange={e => setCadNome(e.target.value)} className={InputClass + " uppercase"} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LabelClass}>Tipo</label>
              <select value={cadTipo} onChange={e => setCadTipo(e.target.value)} className={InputClass}>
                <option>Com adiantamento</option>
                <option>Sem adiantamento</option>
              </select>
            </div>
            <div>
              <label className={LabelClass}>RG</label>
              <input value={cadRg} onChange={e => setCadRg(e.target.value)} className={InputClass} />
            </div>
          </div>
          <div>
            <label className={LabelClass}>CPF</label>
            <input value={fmtCpf(cadCpf)} onChange={e => setCadCpf(e.target.value.replace(/\D/g,''))}
              placeholder="000.000.000-00" maxLength={14} className={InputClass} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LabelClass}>Venc. CNH</label>
              <input type="date" value={cadCnh} onChange={e => setCadCnh(e.target.value)} className={InputClass} />
            </div>
            <div>
              <label className={LabelClass}>Venc. Permisso</label>
              <input type="date" value={cadPermisso} onChange={e => setCadPermisso(e.target.value)} className={InputClass} />
            </div>
            <div>
              <label className={LabelClass}>Venc. Toxicológico</label>
              <input type="date" value={cadToxico} onChange={e => setCadToxico(e.target.value)} className={InputClass} />
            </div>
            <div>
              <label className={LabelClass}>Venc. Periódico</label>
              <input type="date" value={cadPeriodico} onChange={e => setCadPeriodico(e.target.value)} className={InputClass} />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={cadastrar} disabled={loading}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-xl py-2.5 text-sm font-medium transition">
              Salvar motorista
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

          <AlertasVencimento motorista={{
            ...sel,
            vencimento_cnh: editCnh,
            vencimento_permisso: editPermisso,
            vencimento_toxicologico: editToxico,
            vencimento_periodico: editPeriodico,
          }} />

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className={`px-6 py-5 bg-gradient-to-r ${editAtivo ? (editDeFerias ? 'from-blue-500 to-blue-600' : 'from-red-600 to-red-700') : 'from-gray-500 to-gray-600'}`}>
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-xl">
                  {sel.nome.charAt(0)}
                </div>
                <div>
                  <h2 className="text-white font-bold text-lg">{sel.nome}</h2>
                  <div className="flex gap-2 mt-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${editAtivo ? 'bg-green-400/30 text-green-100' : 'bg-red-400/30 text-red-100'}`}>
                      {editAtivo ? 'Ativo' : 'Desligado'}
                    </span>
                    {editDeFerias && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-400/30 text-blue-100">
                        🏖️ De férias
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <TagVenc data={editCnh} label="Venc. CNH" />
                <TagVenc data={editPermisso} label="Permisso" />
                <TagVenc data={editToxico} label="Toxicológico" />
                <TagVenc data={editPeriodico} label="Periódico" />
              </div>

              <div>
                <label className={LabelClass}>Nome completo</label>
                <input value={editNome} onChange={e => setEditNome(e.target.value)} className={InputClass + " uppercase"} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LabelClass}>RG</label>
                  <input value={editRg} onChange={e => setEditRg(e.target.value)} className={InputClass} />
                </div>
                <div>
                  <label className={LabelClass}>CPF</label>
                  <input value={fmtCpf(editCpf)} onChange={e => setEditCpf(e.target.value.replace(/\D/g,''))}
                    placeholder="000.000.000-00" maxLength={14} className={InputClass} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LabelClass}>Venc. CNH</label>
                  <input type="date" value={editCnh} onChange={e => setEditCnh(e.target.value)} className={InputClass} />
                </div>
                <div>
                  <label className={LabelClass}>Venc. Permisso</label>
                  <input type="date" value={editPermisso} onChange={e => setEditPermisso(e.target.value)} className={InputClass} />
                </div>
                <div>
                  <label className={LabelClass}>Venc. Toxicológico</label>
                  <input type="date" value={editToxico} onChange={e => setEditToxico(e.target.value)} className={InputClass} />
                </div>
                <div>
                  <label className={LabelClass}>Venc. Periódico</label>
                  <input type="date" value={editPeriodico} onChange={e => setEditPeriodico(e.target.value)} className={InputClass} />
                </div>
              </div>

              <div className="border-t border-gray-100 pt-4">
                <label className={LabelClass}>Caminhão vinculado</label>
                <select value={editCaminhaoId} onChange={e => setEditCaminhaoId(e.target.value)} className={InputClass}>
                  <option value="">Nenhum</option>
                  {caminhoes.map(c => (
                    <option key={c.id} value={c.id}>{c.placa} {c.modelo && `· ${c.modelo}`}</option>
                  ))}
                </select>
                {editCaminhaoId && (
                  <p className="text-xs text-gray-400 mt-1">
                    🚛 {caminhoes.find(c => c.id === editCaminhaoId)?.placa}
                    {editDeFerias && editSubstitutoId && (
                      <span className="text-blue-500"> · Temporariamente com {motoristas.find(m => m.id === editSubstitutoId)?.nome}</span>
                    )}
                  </p>
                )}
              </div>

              {/* Caminhão temporário (somente leitura — atribuído quando outro motorista entrou de férias) */}
              {sel.caminhao_temp_id && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                  <p className="text-xs font-semibold text-blue-700 mb-1">🔄 Caminhão temporário</p>
                  <p className="text-sm text-blue-800 font-medium">
                    🚛 {caminhoes.find(c => c.id === sel.caminhao_temp_id)?.placa || 'Carregando...'}
                  </p>
                  <p className="text-xs text-blue-500 mt-0.5">Atribuído enquanto outro motorista está de férias</p>
                </div>
              )}

              <div className="border-t border-gray-100 pt-4 space-y-3">
                <Toggle value={editDeFerias} onChange={() => {
                  setEditDeFerias(!editDeFerias)
                  if (!editDeFerias && !editFeriasInicio)
                    setEditFeriasInicio(new Date().toISOString().split('T')[0])
                }} label="De férias" />

                {editDeFerias && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={LabelClass}>Início das férias</label>
                        <input type="date" value={editFeriasInicio} onChange={e => setEditFeriasInicio(e.target.value)} className={InputClass} />
                      </div>
                      <div>
                        <label className={LabelClass}>Fim das férias</label>
                        <input type="date" value={editFeriasFim} onChange={e => setEditFeriasFim(e.target.value)} className={InputClass} />
                      </div>
                    </div>
                    {editFeriasInicio && editFeriasFim && (
                      <div className="bg-blue-50 rounded-xl p-3">
                        <p className="text-sm text-blue-700 font-medium">
                          🏖️ {diasFerias(editFeriasInicio, editFeriasFim)} dia(s) de férias
                        </p>
                      </div>
                    )}
                    <div>
                      <label className={LabelClass}>Motorista substituto</label>
                      <select value={editSubstitutoId} onChange={e => setEditSubstitutoId(e.target.value)} className={InputClass}>
                        <option value="">Selecione...</option>
                        {motoristas.filter(m => m.id !== sel.id && m.ativo).map(m => (
                          <option key={m.id} value={m.id}>{m.nome}</option>
                        ))}
                      </select>
                    </div>
                    {editSubstitutoId && editCaminhaoId && (
                      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                        <p className="text-xs text-blue-700">
                          🔄 O caminhão <strong>{caminhoes.find(c => c.id === editCaminhaoId)?.placa}</strong> será vinculado temporariamente a <strong>{motoristas.find(m => m.id === editSubstitutoId)?.nome}</strong> — o caminhão original dele será mantido
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="border-t border-gray-100 pt-4 space-y-3">
                <Toggle value={editAdiantamento} onChange={() => setEditAdiantamento(!editAdiantamento)} label="Adiantamento" />
                <Toggle value={editAtivo} onChange={() => {
                  setEditAtivo(!editAtivo)
                  if (editAtivo) setEditDtDesligamento(new Date().toISOString().split('T')[0])
                  else setEditDtDesligamento('')
                }} label="Ativo na empresa" />
                {!editAtivo && (
                  <div>
                    <label className={LabelClass}>Data de desligamento</label>
                    <input type="date" value={editDtDesligamento} onChange={e => setEditDtDesligamento(e.target.value)} className={InputClass} />
                  </div>
                )}
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
                  <p className="text-sm text-red-700 font-medium mb-3">⚠️ Excluir {sel.nome}?</p>
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
            <h1 className="text-2xl font-bold text-gray-900">Motoristas</h1>
            {perm !== 'view' && (
              <button onClick={() => setMostraCad(true)}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition shadow-sm">
                <Plus size={16}/> Cadastrar
              </button>
            )}
          </div>

          {alertasGerais.length > 0 && (
            <div className="mb-4 bg-amber-50 border border-amber-200 rounded-2xl p-4">
              <p className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-3">⚠️ Alertas de vencimento</p>
              <div className="space-y-2">
                {alertasGerais.map(m => (
                  <AlertasVencimento key={m.id} motorista={m} />
                ))}
              </div>
            </div>
          )}

          <div className="relative mb-4">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={busca} onChange={e => setBusca(e.target.value)}
              placeholder="Buscar motorista..."
              className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-white shadow-sm" />
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-4">
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Motoristas</p>
              <p className="text-xs text-gray-400">{filtrados.length} cadastrado(s)</p>
            </div>
            {filtrados.length === 0 ? (
              <div className="p-10 text-center">
                <User size={32} className="mx-auto text-gray-200 mb-2" />
                <p className="text-sm text-gray-400">Nenhum motorista encontrado</p>
              </div>
            ) : filtrados.map(m => {
              const temAlerta =
                ['vencido','critico','alerta'].includes(vencStatus(m.vencimento_cnh) || '') ||
                ['vencido','critico','alerta'].includes(vencStatus(m.vencimento_permisso) || '') ||
                ['vencido','critico','alerta'].includes(vencStatus(m.vencimento_toxicologico) || '') ||
                ['vencido','critico','alerta'].includes(vencStatus(m.vencimento_periodico) || '')
              const caminhao = caminhoes.find(c => c.id === m.caminhao_id)
              const caminhaoTemp = caminhoes.find(c => c.id === m.caminhao_temp_id)
              return (
                <button key={m.id} onClick={() => selecionar(m)}
                  className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition border-b border-gray-50 last:border-0 text-left">
                  <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-bold text-sm flex-shrink-0">
                    {m.nome.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{m.nome}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {m.tipo} · CPF ***.***.***-**
                      {caminhao && ` · 🚛 ${caminhao.placa}`}
                      {caminhaoTemp && ` · 🚛 ${caminhaoTemp.placa} (temp)`}
                      {m.de_ferias && ` · 🏖️ Férias`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {temAlerta && <AlertTriangle size={14} className="text-amber-500" />}
                    <div className={`w-2 h-2 rounded-full ${m.ativo !== false ? (m.de_ferias ? 'bg-blue-400' : 'bg-green-400') : 'bg-gray-300'}`} />
                    <ChevronRight size={16} className="text-gray-300" />
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