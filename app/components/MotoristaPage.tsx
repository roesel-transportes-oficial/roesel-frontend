'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../services/supabase'
import { useAuth } from '../services/auth'
import { Search, Plus, ArrowLeft, Save, Trash2, ChevronRight, User, AlertTriangle, Clock, History } from 'lucide-react'

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

interface HistoricoFerias {
  id: string; motorista_nome: string; substituto_nome: string
  caminhao_placa: string; ferias_inicio: string; ferias_fim: string; created_at: string
}

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

function fmtData(d: string) {
  if (!d) return '—'
  const [y, m, dia] = d.split('-')
  return `${dia}/${m}/${y}`
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
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'ativos' | 'inativos'>('ativos')
  const [sel, setSel] = useState<Motorista | null>(null)
  const [mostraCad, setMostraCad] = useState(false)
  const [mostraHistorico, setMostraHistorico] = useState(false)
  const [historico, setHistorico] = useState<HistoricoFerias[]>([])
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
    Promise.all([fetch_(), fetchCaminhoes()])
  }, [])

  async function fetch_() {
    const { data } = await supabase.from('motoristas').select('*').order('nome')
    if (data) setMotoristas(data)
  }

  async function fetchCaminhoes() {
    const { data } = await supabase.from('caminhoes').select('id, placa, modelo, motorista_atual').order('placa')
    if (data) setCaminhoes(data)
  }

  async function fetchHistorico(motoristaId: string) {
    const { data } = await supabase
      .from('historico_ferias')
      .select('*')
      .eq('motorista_id', motoristaId)
      .order('created_at', { ascending: false })
    setHistorico(data || [])
  }

  async function registrarHistorico(motorista: Motorista, substitutoNome: string, caminhaoPlaca: string) {
    await supabase.from('historico_ferias').insert({
      motorista_id: motorista.id,
      motorista_nome: motorista.nome,
      substituto_id: editSubstitutoId || null,
      substituto_nome: substitutoNome,
      caminhao_placa: caminhaoPlaca,
      ferias_inicio: editFeriasInicio || null,
      ferias_fim: editFeriasFim || null,
    })
  }

  const alertasGerais = motoristas.filter(m => m.ativo !== false).filter(m =>
    ['vencido','critico','alerta'].includes(vencStatus(m.vencimento_cnh) || '') ||
    ['vencido','critico','alerta'].includes(vencStatus(m.vencimento_permisso) || '') ||
    ['vencido','critico','alerta'].includes(vencStatus(m.vencimento_toxicologico) || '') ||
    ['vencido','critico','alerta'].includes(vencStatus(m.vencimento_periodico) || '')
  )

  const filtrados = motoristas
    .filter(m => {
      if (filtroStatus === 'ativos') return m.ativo !== false
      if (filtroStatus === 'inativos') return m.ativo === false
      return true
    })
    .filter(m => busca.trim() ? m.nome.toLowerCase().includes(busca.toLowerCase()) : true)

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
    setMostraHistorico(false)
    fetchHistorico(m.id)
  }

  function voltar() { setSel(null); setBusca(''); setConfirmExcluir(false); setMostraHistorico(false) }
  function showMsg(t: string) { setMsg(t); setTimeout(() => setMsg(''), 4000) }

  async function salvar() {
    if (!sel) return
    setLoading(true)

    try {
      const feriasFoiAtivado = editDeFerias && !sel.de_ferias

      if (editCaminhaoId && editCaminhaoId !== sel.caminhao_id && !editDeFerias) {
        if (sel.caminhao_id) {
          const { error: e1 } = await supabase.from('caminhoes').update({ motorista_atual: '' }).eq('id', sel.caminhao_id)
          if (e1) throw e1
        }
        const { error: e2 } = await supabase.from('caminhoes').update({ motorista_atual: editNome.toUpperCase() }).eq('id', editCaminhaoId)
        if (e2) throw e2
      }

      if (editDeFerias && editSubstitutoId && editCaminhaoId) {
        const substituto = motoristas.find(m => m.id === editSubstitutoId)
        if (substituto) {
          const { error: e3 } = await supabase.from('motoristas').update({ caminhao_temp_id: editCaminhaoId }).eq('id', editSubstitutoId)
          if (e3) throw e3
          const { error: e4 } = await supabase.from('caminhoes').update({ motorista_atual: substituto.nome }).eq('id', editCaminhaoId)
          if (e4) throw e4
          const cam = caminhoes.find(c => c.id === editCaminhaoId)
          if (feriasFoiAtivado) {
            await registrarHistorico(sel, substituto.nome, cam?.placa || '')
          }
        }
      }

      if (!editDeFerias && sel.de_ferias && sel.substituto_id && editCaminhaoId) {
        const substituto = motoristas.find(m => m.id === sel.substituto_id)
        if (substituto) {
          const { error: e5 } = await supabase.from('motoristas').update({ caminhao_temp_id: null }).eq('id', sel.substituto_id)
          if (e5) throw e5
          const { error: e6 } = await supabase.from('caminhoes').update({ motorista_atual: editNome.toUpperCase() }).eq('id', editCaminhaoId)
          if (e6) throw e6
        }
      }

      if (perm !== 'demo') {
        const { error: e7 } = await supabase.from('motoristas').update({
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
        }).eq('id', sel.id)
        if (e7) throw e7
      }

      await fetch_()
      voltar()
      showMsg('✅ Atualizado!')
    } catch (err: any) {
      console.error('Erro ao salvar motorista:', err)
      showMsg('❌ Erro ao salvar: ' + (err?.message || 'erro desconhecido'))
    } finally {
      setLoading(false)
    }
  }

  async function excluir() {
    if (!sel) return
    setLoading(true)
    try {
      if (perm !== 'demo') {
        const { error } = await supabase.from('motoristas').delete().eq('id', sel.id)
        if (error) throw error
      }
      await fetch_()
      voltar()
      showMsg('Motorista excluído.')
    } catch (err: any) {
      console.error('Erro ao excluir motorista:', err)
      showMsg('❌ Erro ao excluir: ' + (err?.message || 'erro desconhecido'))
    } finally {
      setLoading(false)
    }
  }

  async function cadastrar() {
    if (!cadNome.trim()) return
    setLoading(true)
    try {
      if (perm !== 'demo') {
        const { error } = await supabase.from('motoristas').insert({
          nome: cadNome.toUpperCase(), cpf: cadCpf, rg: cadRg,
          tipo: cadTipo, ativo: true, adiantamento: true,
          vencimento_cnh: cadCnh || null,
          vencimento_permisso: cadPermisso || null,
          vencimento_toxicologico: cadToxico || null,
          vencimento_periodico: cadPeriodico || null,
        })
        if (error) throw error
      }
      await fetch_()
      setCadNome(''); setCadCpf(''); setCadRg(''); setCadTipo('Com adiantamento')
      setCadCnh(''); setCadPermisso(''); setCadToxico(''); setCadPeriodico('')
      setMostraCad(false)
      showMsg('✅ Motorista cadastrado!')
    } catch (err: any) {
      console.error('Erro ao cadastrar motorista:', err)
      showMsg('❌ Erro ao cadastrar: ' + (err?.message || 'erro desconhecido'))
    } finally {
      setLoading(false)
    }
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
      {msg && <div className={`mb-4 p-3 rounded-xl text-sm border ${msg.startsWith('❌') ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-700'}`}>{msg}</div>}

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
              <div className="flex items-center justify-between">
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
                <button
                  onClick={() => setMostraHistorico(!mostraHistorico)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${mostraHistorico ? 'bg-white/30 text-white' : 'bg-white/20 text-white/80 hover:bg-white/30'}`}>
                  <History size={14} />
                  Histórico
                </button>
              </div>
            </div>

            {mostraHistorico && (
              <div className="border-b border-gray-100 p-5">
                <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                  <History size={16} className="text-gray-400" />
                  Histórico de Férias
                </h3>
                {historico.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">Nenhum histórico de férias registrado</p>
                ) : (
                  <div className="space-y-2">
                    {historico.map(h => (
                      <div key={h.id} className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs font-bold text-blue-800">🏖️ Período de férias</p>
                          <p className="text-xs text-blue-400">{fmtData(h.created_at?.split('T')[0])}</p>
                        </div>
                        <p className="text-xs text-blue-700">
                          <span className="font-medium">Período:</span> {fmtData(h.ferias_inicio)} → {fmtData(h.ferias_fim)}
                          {h.ferias_inicio && h.ferias_fim && (
                            <span className="ml-1 text-blue-500">
                              ({diasFerias(h.ferias_inicio, h.ferias_fim)} dias)
                            </span>
                          )}
                        </p>
                        {h.substituto_nome && (
                          <p className="text-xs text-blue-700 mt-0.5">
                            <span className="font-medium">Substituto:</span> {h.substituto_nome}
                          </p>
                        )}
                        {h.caminhao_placa && (
                          <p className="text-xs text-blue-700 mt-0.5">
                            <span className="font-medium">Caminhão:</span> 🚛 {h.caminhao_placa}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

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
                          🔄 O caminhão <strong>{caminhoes.find(c => c.id === editCaminhaoId)?.placa}</strong> será vinculado temporariamente a <strong>{motoristas.find(m => m.id === editSubstitutoId)?.nome}</strong>
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
                  className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white rounded-xl py-2.5 text-sm font-medium transition disabled:opacity-60">
                  <Save size={15}/> {loading ? 'Salvando...' : 'Salvar alterações'}
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

          <div className="flex gap-2 mb-4">
            {(['ativos', 'inativos', 'todos'] as const).map(f => (
              <button key={f} onClick={() => setFiltroStatus(f)}
                className={`px-4 py-2 rounded-xl text-xs font-medium transition ${
                  filtroStatus === f
                    ? 'bg-red-600 text-white shadow-sm'
                    : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50'
                }`}>
                {f === 'ativos' ? 'Ativos' : f === 'inativos' ? 'Inativos' : 'Todos'}
              </button>
            ))}
          </div>

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