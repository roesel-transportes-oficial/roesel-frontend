'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../services/supabase'
import {
  FileText, Plus, ArrowLeft, Save, X, AlertCircle, Loader2,
  CheckCircle2, XCircle, Ban, Truck, User
} from 'lucide-react'

interface Cte {
  id: string
  tipo: 'normal' | 'redespacho'
  status: 'rascunho' | 'autorizado' | 'rejeitado' | 'cancelado'
  remetente_nome: string; remetente_cnpj: string
  destinatario_nome: string; destinatario_cnpj: string
  tomador_nome: string; tomador_cnpj: string
  origem: string; destino: string
  valor_prestacao: number
  natureza_operacao: string
  placa: string; motorista: string
  cte_anterior_chave: string
  redespachante_nome: string; redespachante_cnpj: string
  chave_acesso: string; numero_cte: string
  xml_url: string; dacte_url: string; motivo_rejeicao: string
  obs: string; created_at: string
}

const FORM_INICIAL = {
  tipo: '' as '' | 'normal' | 'redespacho',
  remetente_nome: '', remetente_cnpj: '',
  destinatario_nome: '', destinatario_cnpj: '',
  tomador_nome: '', tomador_cnpj: '',
  origem: '', destino: '',
  valor_prestacao: '', natureza_operacao: '',
  placa: '', motorista: '',
  cte_anterior_chave: '', redespachante_nome: '', redespachante_cnpj: '',
  obs: '',
}

const IC = "mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-gray-50"
const LC = "text-xs font-semibold text-gray-500 uppercase tracking-wide"

function fmtValor(v: number) {
  return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtData(d: string) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-BR')
}

function badgeStatus(s: string) {
  if (s === 'autorizado') return 'bg-green-100 text-green-700'
  if (s === 'rejeitado')  return 'bg-red-100 text-red-700'
  if (s === 'cancelado')  return 'bg-gray-100 text-gray-500'
  return 'bg-yellow-100 text-yellow-700' // rascunho
}

export default function CtePage() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [ctes, setCtes]                 = useState<Cte[]>([])
  const [loadingLista, setLoadingLista] = useState(false)
  const [mostraNovo, setMostraNovo]     = useState(false)
  const [motoristas, setMotoristas]     = useState<any[]>([])
  const [caminhoes, setCaminhoes]       = useState<any[]>([])
  const [form, setForm]                 = useState(FORM_INICIAL)
  const [salvando, setSalvando]         = useState(false)
  const [emitindo, setEmitindo]         = useState(false)
  const [erro, setErro]                 = useState('')
  const [msg, setMsg]                   = useState('')
  const [visualizando, setVisualizando] = useState<Cte | null>(null)
  const [cancelandoId, setCancelandoId] = useState<string | null>(null)

  // ✅ Guarda contra corrida entre chamadas concorrentes de fetch_(),
  // mesmo padrão já usado em ContratosPage e ContasPagarPage — aplicado
  // desde o início aqui pra não repetir o mesmo bug.
  const fetchIdRef = useRef(0)

  // ✅ Helper pra pegar o token da sessão atual — usado em toda chamada
  // pro backend, que agora exige login validado.
  async function pegarToken(): Promise<string> {
    const { data } = await supabase.auth.getSession()
    const token = data?.session?.access_token
    if (!token) throw new Error('Sessão expirada. Atualize a página e faça login novamente.')
    return token
  }

  async function fetchCtes() {
    const meuId = ++fetchIdRef.current
    setLoadingLista(true)
    try {
      const token = await pegarToken()
      const res = await fetch('/api/ctes', { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (meuId !== fetchIdRef.current) return
      if (!res.ok) { console.error('Erro ao buscar CT-e:', data); return }
      setCtes(Array.isArray(data) ? data : [])
    } catch (e) {
      if (meuId === fetchIdRef.current) console.error('Erro ao buscar CT-e:', e)
    } finally {
      if (meuId === fetchIdRef.current) setLoadingLista(false)
    }
  }

  useEffect(() => {
    fetchCtes()
    supabase.from('motoristas').select('id, nome').order('nome').then(({ data }) => data && setMotoristas(data))
    supabase.from('caminhoes').select('id, placa').order('placa').then(({ data }) => data && setCaminhoes(data))
  }, [])

  // Recarrega a lista quando a aba volta a ficar visível (troca de menu)
  useEffect(() => {
    const container = containerRef.current
    const parent = container?.parentElement
    if (!parent) return
    const observer = new MutationObserver(() => {
      if (parent.style.display !== 'none') fetchCtes()
    })
    observer.observe(parent, { attributes: true, attributeFilter: ['style'] })
    return () => observer.disconnect()
  }, [])

  function showMsg(t: string) { setMsg(t); setTimeout(() => setMsg(''), 4000) }

  function abrirNovo() {
    setForm(FORM_INICIAL)
    setErro('')
    setMostraNovo(true)
  }

  function fecharNovo() {
    setMostraNovo(false)
    setForm(FORM_INICIAL)
    setErro('')
  }

  function handle(e: any) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  // ✅ Monta o payload uma vez só — usado tanto por "Salvar Rascunho"
  // quanto por "Emitir" (que precisa criar o registro antes de emitir).
  function montarPayload() {
    const payload: any = {
      tipo: form.tipo,
      status: 'rascunho',
      remetente_nome: form.remetente_nome, remetente_cnpj: form.remetente_cnpj.replace(/\D/g, ''),
      destinatario_nome: form.destinatario_nome, destinatario_cnpj: form.destinatario_cnpj.replace(/\D/g, ''),
      tomador_nome: form.tomador_nome, tomador_cnpj: form.tomador_cnpj.replace(/\D/g, ''),
      origem: form.origem, destino: form.destino,
      valor_prestacao: parseFloat(form.valor_prestacao) || 0,
      natureza_operacao: form.natureza_operacao,
      placa: form.placa, motorista: form.motorista,
      obs: form.obs,
    }
    if (form.tipo === 'redespacho') {
      payload.cte_anterior_chave = form.cte_anterior_chave.replace(/\D/g, '')
      payload.redespachante_nome = form.redespachante_nome
      payload.redespachante_cnpj = form.redespachante_cnpj.replace(/\D/g, '')
    }
    return payload
  }

  async function salvarRascunho() {
    if (!form.tipo) { setErro('Selecione o tipo de CT-e (Normal ou Redespacho).'); return }
    setSalvando(true); setErro('')
    try {
      const token = await pegarToken()
      const res = await fetch('/api/ctes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(montarPayload()),
      })
      const resultado = await res.json()
      if (!res.ok) throw new Error(resultado?.detail || resultado?.error || 'Erro ao salvar.')

      showMsg('✅ Rascunho de CT-e salvo!')
      fecharNovo()
      await fetchCtes()
    } catch (e: any) {
      setErro('Erro ao salvar: ' + (e?.message || 'erro desconhecido'))
    } finally {
      setSalvando(false)
    }
  }

  // ⚠️ A emissão real ainda não está ativa — falta configurar o token
  // do provedor (Focus NFe ou similar) nas variáveis de ambiente da
  // Vercel. O fluxo já está pronto: cria o CT-e como rascunho e na
  // sequência chama o endpoint de emissão daquele registro específico
  // — assim que o token existir no backend, isso passa a funcionar de
  // verdade sem precisar mexer em mais nada aqui no frontend.
  async function emitir() {
    if (!form.tipo) { setErro('Selecione o tipo de CT-e (Normal ou Redespacho).'); return }
    setEmitindo(true); setErro('')
    try {
      const token = await pegarToken()
      const resCriar = await fetch('/api/ctes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(montarPayload()),
      })
      const criado = await resCriar.json()
      if (!resCriar.ok) throw new Error(criado?.detail || criado?.error || 'Erro ao salvar antes de emitir.')

      const registro = Array.isArray(criado) ? criado[0] : criado
      const resEmitir = await fetch(`/api/ctes/${registro.id}/emitir`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const resultado = await resEmitir.json()
      if (!resEmitir.ok) throw new Error(resultado?.detail || resultado?.error || 'Emissão de CT-e ainda não configurada.')

      showMsg('✅ CT-e emitido com sucesso!')
      fecharNovo()
      await fetchCtes()
    } catch (e: any) {
      setErro(e?.message || 'Emissão de CT-e ainda não configurada — salve como rascunho por enquanto.')
      await fetchCtes() // o rascunho pode ter sido criado mesmo com a emissão falhando
    } finally {
      setEmitindo(false)
    }
  }

  async function cancelar(id: string) {
    setErro('')
    try {
      const token = await pegarToken()
      const res = await fetch(`/api/ctes/${id}/cancelar`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const resultado = await res.json()
      if (!res.ok) throw new Error(resultado?.detail || resultado?.error || 'Erro ao cancelar.')
      showMsg('✅ CT-e cancelado.')
      setCancelandoId(null)
      setVisualizando(null)
      await fetchCtes()
    } catch (e: any) {
      setErro(e?.message || 'Cancelamento ainda não está configurado (depende do token do provedor).')
      setCancelandoId(null)
    }
  }

  const totalAutorizados = useMemo(() => ctes.filter(c => c.status === 'autorizado').length, [ctes])
  const totalRascunhos    = useMemo(() => ctes.filter(c => c.status === 'rascunho').length, [ctes])
  const totalValor        = useMemo(() => ctes.filter(c => c.status === 'autorizado').reduce((s, c) => s + (c.valor_prestacao || 0), 0), [ctes])

  return (
    <div ref={containerRef} className="p-6 max-w-6xl mx-auto space-y-6">
      {msg && (
        <div className="fixed top-6 right-6 z-50 p-4 bg-green-600 text-white rounded-2xl shadow-2xl font-bold text-xs uppercase animate-bounce">
          {msg}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">CT-e</h1>
          <p className="text-sm text-gray-500">Conhecimento de Transporte Eletrônico — Normal e Redespacho</p>
        </div>
        <button onClick={abrirNovo}
          className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl text-sm font-bold uppercase transition">
          <Plus size={16}/> Novo CT-e
        </button>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
        <AlertCircle size={18} className="text-blue-600 shrink-0 mt-0.5"/>
        <p className="text-xs text-blue-700">
          A emissão real (integração com a SEFAZ) ainda não está configurada — falta o token de homologação/produção
          do provedor (Focus NFe ou similar). Por enquanto, os CT-e ficam salvos como <strong>rascunho</strong>.
          Assim que o token for configurado, o botão "Emitir" passa a validar de verdade com a SEFAZ.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Autorizados</p>
          <p className="text-2xl font-black text-green-600">{totalAutorizados}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Rascunhos</p>
          <p className="text-2xl font-black text-yellow-600">{totalRascunhos}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Valor Total Autorizado</p>
          <p className="text-2xl font-black text-gray-900">{fmtValor(totalValor)}</p>
        </div>
      </div>

      {loadingLista ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={32} className="animate-spin text-red-600"/>
        </div>
      ) : ctes.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
          <FileText size={32} className="mx-auto text-gray-200 mb-2"/>
          <p className="text-sm text-gray-400">Nenhum CT-e cadastrado ainda.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-5 py-3 text-left text-[10px] font-black text-gray-400 uppercase">Tipo</th>
                <th className="px-5 py-3 text-left text-[10px] font-black text-gray-400 uppercase">Tomador</th>
                <th className="px-5 py-3 text-left text-[10px] font-black text-gray-400 uppercase">Rota</th>
                <th className="px-5 py-3 text-left text-[10px] font-black text-gray-400 uppercase">Data</th>
                <th className="px-5 py-3 text-right text-[10px] font-black text-gray-400 uppercase">Valor</th>
                <th className="px-5 py-3 text-right text-[10px] font-black text-gray-400 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {ctes.map(c => (
                <tr key={c.id} onClick={() => setVisualizando(c)} className="cursor-pointer hover:bg-gray-50 transition">
                  <td className="px-5 py-3">
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase ${c.tipo === 'redespacho' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                      {c.tipo === 'redespacho' ? 'Redespacho' : 'Normal'}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <p className="text-sm font-bold text-gray-900 truncate max-w-[200px]">{c.tomador_nome || '—'}</p>
                  </td>
                  <td className="px-5 py-3 text-xs text-gray-600">{c.origem || '—'} → {c.destino || '—'}</td>
                  <td className="px-5 py-3 text-xs text-gray-500">{fmtData(c.created_at)}</td>
                  <td className="px-5 py-3 text-right text-sm font-black text-gray-900">{fmtValor(c.valor_prestacao)}</td>
                  <td className="px-5 py-3 text-right">
                    <span className={`text-[9px] font-black px-2 py-1 rounded uppercase ${badgeStatus(c.status)}`}>{c.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {mostraNovo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-6 py-5 bg-gray-900 flex items-center justify-between shrink-0">
              <h2 className="text-white font-black text-lg">Novo CT-e</h2>
              <button onClick={fecharNovo} className="text-white/70 hover:text-white"><X size={22}/></button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4">
              {erro && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm font-bold">
                  <AlertCircle size={16}/> {erro}
                </div>
              )}

              {/* ✅ Seletor de tipo — travado depois de escolhido, decide
                  quais campos aparecem no resto do formulário */}
              <div>
                <label className={LC}>Tipo de CT-e *</label>
                <div className="grid grid-cols-2 gap-3 mt-1">
                  <button type="button" onClick={() => setForm(prev => ({ ...prev, tipo: 'normal' }))}
                    className={`p-4 rounded-xl border-2 text-left transition ${form.tipo === 'normal' ? 'border-red-500 bg-red-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                    <p className="font-black text-sm text-gray-900">Normal</p>
                    <p className="text-xs text-gray-500 mt-1">Frete direto — remetente e destinatário reais da carga.</p>
                  </button>
                  <button type="button" onClick={() => setForm(prev => ({ ...prev, tipo: 'redespacho' }))}
                    className={`p-4 rounded-xl border-2 text-left transition ${form.tipo === 'redespacho' ? 'border-purple-500 bg-purple-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                    <p className="font-black text-sm text-gray-900">Redespacho</p>
                    <p className="text-xs text-gray-500 mt-1">Carga com CT-e anterior de outra transportadora.</p>
                  </button>
                </div>
              </div>

              {form.tipo && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={LC}>Remetente</label>
                      <input name="remetente_nome" value={form.remetente_nome} onChange={handle} className={IC}/>
                    </div>
                    <div>
                      <label className={LC}>CNPJ Remetente</label>
                      <input name="remetente_cnpj" value={form.remetente_cnpj} onChange={handle} className={IC}/>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={LC}>Destinatário</label>
                      <input name="destinatario_nome" value={form.destinatario_nome} onChange={handle} className={IC}/>
                    </div>
                    <div>
                      <label className={LC}>CNPJ Destinatário</label>
                      <input name="destinatario_cnpj" value={form.destinatario_cnpj} onChange={handle} className={IC}/>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={LC}>Tomador do Serviço</label>
                      <input name="tomador_nome" value={form.tomador_nome} onChange={handle} className={IC}/>
                    </div>
                    <div>
                      <label className={LC}>CNPJ Tomador</label>
                      <input name="tomador_cnpj" value={form.tomador_cnpj} onChange={handle} className={IC}/>
                    </div>
                  </div>

                  {form.tipo === 'redespacho' && (
                    <div className="bg-purple-50 border border-purple-100 rounded-xl p-4 space-y-3">
                      <p className="text-xs font-black text-purple-700 uppercase tracking-widest">Dados do Redespacho</p>
                      <div>
                        <label className={LC}>Chave de Acesso do CT-e Anterior (44 dígitos)</label>
                        <input name="cte_anterior_chave" value={form.cte_anterior_chave} onChange={handle}
                          maxLength={44} className={IC} placeholder="0000 0000 0000 0000 0000 0000 0000 0000 0000 0000 0000"/>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className={LC}>Redespachante</label>
                          <input name="redespachante_nome" value={form.redespachante_nome} onChange={handle} className={IC}/>
                        </div>
                        <div>
                          <label className={LC}>CNPJ Redespachante</label>
                          <input name="redespachante_cnpj" value={form.redespachante_cnpj} onChange={handle} className={IC}/>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={LC}>Origem</label>
                      <input name="origem" value={form.origem} onChange={handle} className={IC}/>
                    </div>
                    <div>
                      <label className={LC}>Destino</label>
                      <input name="destino" value={form.destino} onChange={handle} className={IC}/>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={LC}><Truck size={11} className="inline mb-0.5 mr-1"/>Placa</label>
                      <select name="placa" value={form.placa} onChange={handle} className={IC}>
                        <option value="">Selecione...</option>
                        {caminhoes.map((c: any) => <option key={c.id} value={c.placa}>{c.placa}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={LC}><User size={11} className="inline mb-0.5 mr-1"/>Motorista</label>
                      <select name="motorista" value={form.motorista} onChange={handle} className={IC}>
                        <option value="">Selecione...</option>
                        {motoristas.map((m: any) => <option key={m.id} value={m.nome}>{m.nome}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={LC}>Valor da Prestação (R$)</label>
                      <input name="valor_prestacao" type="number" step="0.01" value={form.valor_prestacao} onChange={handle} className={IC}/>
                    </div>
                    <div>
                      <label className={LC}>Natureza da Operação</label>
                      <input name="natureza_operacao" value={form.natureza_operacao} onChange={handle} className={IC} placeholder="Ex: Prestação de serviço de transporte"/>
                    </div>
                  </div>

                  <div>
                    <label className={LC}>Observações</label>
                    <textarea name="obs" value={form.obs} onChange={handle} rows={2} className={IC}/>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button onClick={salvarRascunho} disabled={salvando}
                      className="flex-1 flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-800 text-white py-3 rounded-xl text-sm font-bold uppercase transition disabled:opacity-50">
                      {salvando ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>} Salvar Rascunho
                    </button>
                    <button onClick={emitir} disabled={emitindo}
                      className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl text-sm font-bold uppercase transition disabled:opacity-50">
                      {emitindo ? <Loader2 size={16} className="animate-spin"/> : <CheckCircle2 size={16}/>} Emitir CT-e
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {visualizando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className={`px-6 py-5 flex items-center justify-between shrink-0
              ${visualizando.status === 'autorizado' ? 'bg-green-600' : visualizando.status === 'rejeitado' ? 'bg-red-600' : visualizando.status === 'cancelado' ? 'bg-gray-600' : 'bg-yellow-600'}`}>
              <div>
                <h2 className="text-white font-black text-lg">CT-e {visualizando.tipo === 'redespacho' ? '(Redespacho)' : '(Normal)'}</h2>
                <p className="text-white/70 text-xs mt-0.5">{visualizando.numero_cte ? `Nº ${visualizando.numero_cte}` : 'Rascunho — ainda não emitido'}</p>
              </div>
              <button onClick={() => setVisualizando(null)} className="text-white/70 hover:text-white"><X size={22}/></button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4">
              {erro && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm font-bold">
                  <AlertCircle size={16}/> {erro}
                </div>
              )}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><p className={LC}>Remetente</p><p className="font-bold">{visualizando.remetente_nome || '—'}</p></div>
                <div><p className={LC}>Destinatário</p><p className="font-bold">{visualizando.destinatario_nome || '—'}</p></div>
                <div><p className={LC}>Tomador</p><p className="font-bold">{visualizando.tomador_nome || '—'}</p></div>
                <div><p className={LC}>Valor</p><p className="font-black text-lg">{fmtValor(visualizando.valor_prestacao)}</p></div>
                <div><p className={LC}>Origem</p><p className="font-bold">{visualizando.origem || '—'}</p></div>
                <div><p className={LC}>Destino</p><p className="font-bold">{visualizando.destino || '—'}</p></div>
                <div><p className={LC}>Placa</p><p className="font-bold">{visualizando.placa || '—'}</p></div>
                <div><p className={LC}>Motorista</p><p className="font-bold">{visualizando.motorista || '—'}</p></div>
              </div>
              {visualizando.tipo === 'redespacho' && (
                <div className="bg-purple-50 border border-purple-100 rounded-xl p-4 text-sm">
                  <p className={LC}>Chave CT-e Anterior</p>
                  <p className="font-mono text-xs break-all">{visualizando.cte_anterior_chave || '—'}</p>
                  <p className={LC + ' mt-2'}>Redespachante</p>
                  <p className="font-bold">{visualizando.redespachante_nome || '—'}</p>
                </div>
              )}
              {visualizando.chave_acesso && (
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className={LC}>Chave de Acesso</p>
                  <p className="font-mono text-xs break-all">{visualizando.chave_acesso}</p>
                </div>
              )}
              {visualizando.motivo_rejeicao && (
                <div className="bg-red-50 border border-red-100 rounded-xl p-4">
                  <p className={LC + ' text-red-500'}>Motivo da Rejeição</p>
                  <p className="text-sm text-red-700 font-bold">{visualizando.motivo_rejeicao}</p>
                </div>
              )}
              {visualizando.status === 'autorizado' && (
                <button onClick={() => setCancelandoId(visualizando.id)}
                  className="w-full flex items-center justify-center gap-2 bg-gray-100 text-gray-700 py-3 rounded-xl text-sm font-bold uppercase hover:bg-gray-200 transition">
                  <Ban size={16}/> Cancelar CT-e
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {cancelandoId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 text-center">
            <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <XCircle size={32}/>
            </div>
            <h3 className="text-xl font-black text-gray-900 mb-2">Cancelar CT-e?</h3>
            <p className="text-sm text-gray-500 mb-8">Cancelamento é feito junto à SEFAZ e não pode ser desfeito.</p>
            <div className="flex gap-3">
              <button onClick={() => setCancelandoId(null)} className="flex-1 py-3 rounded-xl font-black text-xs uppercase text-gray-400 hover:bg-gray-50">Voltar</button>
              <button onClick={() => cancelar(cancelandoId)} className="flex-1 py-3 rounded-xl font-black text-xs uppercase bg-red-600 text-white hover:bg-red-700">Confirmar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}