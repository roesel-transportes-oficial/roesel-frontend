'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../services/supabase'
import {
  FileText, Plus, X, AlertCircle, Loader2, CheckCircle2, XCircle,
  Ban, Truck, User
} from 'lucide-react'

interface NotaDiversa {
  id: string
  tipo: 'nfse' | 'devolucao' | 'remessa'
  status: 'rascunho' | 'autorizado' | 'rejeitado' | 'cancelado'
  destinatario_nome: string; destinatario_cnpj: string
  valor: number; data_emissao: string; obs: string
  descricao_servico: string; aliquota_iss: number; iss_retido: boolean
  nota_fiscal_original_chave: string; motivo_devolucao: string
  natureza_remessa: string; produtos_descricao: string
  placa: string; motorista: string; origem: string; destino: string
  chave_acesso: string; numero_nota: string; motivo_rejeicao: string
  created_at: string
}

const FORM_INICIAL = {
  tipo: '' as '' | 'nfse' | 'devolucao' | 'remessa',
  destinatario_nome: '', destinatario_cnpj: '',
  valor: '', data_emissao: new Date().toISOString().split('T')[0], obs: '',
  descricao_servico: '', aliquota_iss: '', iss_retido: false,
  nota_fiscal_original_chave: '', motivo_devolucao: '',
  natureza_remessa: '', produtos_descricao: '',
  placa: '', motorista: '', origem: '', destino: '',
}

const IC = "mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-gray-50"
const LC = "text-xs font-semibold text-gray-500 uppercase tracking-wide"

const TIPO_INFO: Record<string, { label: string; cor: string; desc: string }> = {
  nfse:      { label: 'NFS-e (Serviço)', cor: 'blue',   desc: 'Prestação de serviço (não é transporte) — emitida pela prefeitura.' },
  devolucao: { label: 'Devolução',       cor: 'orange', desc: 'Devolver produto recebido, referenciando a nota fiscal original.' },
  remessa:   { label: 'Remessa',         cor: 'purple', desc: 'Movimentar produto sem venda (conserto, comodato, transferência).' },
}

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
  return 'bg-yellow-100 text-yellow-700'
}

export default function NotasDiversasPage() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [notas, setNotas]               = useState<NotaDiversa[]>([])
  const [loadingLista, setLoadingLista] = useState(false)
  const [filtroTipo, setFiltroTipo]     = useState<'' | 'nfse' | 'devolucao' | 'remessa'>('')
  const [mostraNovo, setMostraNovo]     = useState(false)
  const [motoristas, setMotoristas]     = useState<any[]>([])
  const [caminhoes, setCaminhoes]       = useState<any[]>([])
  const [form, setForm]                 = useState(FORM_INICIAL)
  const [salvando, setSalvando]         = useState(false)
  const [emitindo, setEmitindo]         = useState(false)
  const [erro, setErro]                 = useState('')
  const [msg, setMsg]                   = useState('')
  const [visualizando, setVisualizando] = useState<NotaDiversa | null>(null)
  const [cancelandoId, setCancelandoId] = useState<string | null>(null)

  // ✅ Guarda contra corrida entre chamadas concorrentes — mesmo padrão
  // já usado em Contratos, Contas a Pagar e CT-e.
  const fetchIdRef = useRef(0)

  // ✅ Helper pra pegar o token da sessão atual.
  async function pegarToken(): Promise<string> {
    const { data } = await supabase.auth.getSession()
    const token = data?.session?.access_token
    if (!token) throw new Error('Sessão expirada. Atualize a página e faça login novamente.')
    return token
  }

  async function fetchNotas() {
    const meuId = ++fetchIdRef.current
    setLoadingLista(true)
    try {
      const token = await pegarToken()
      const params = new URLSearchParams()
      if (filtroTipo) params.set('tipo', filtroTipo)
      const res = await fetch(`/api/notas-diversas?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      })
      const data = await res.json()
      if (meuId !== fetchIdRef.current) return
      if (!res.ok) { console.error('Erro ao buscar notas:', data); return }
      setNotas(Array.isArray(data) ? data : [])
    } catch (e) {
      if (meuId === fetchIdRef.current) console.error('Erro ao buscar notas:', e)
    } finally {
      if (meuId === fetchIdRef.current) setLoadingLista(false)
    }
  }

  useEffect(() => {
    fetchNotas()
    supabase.from('motoristas').select('id, nome').order('nome').then(({ data }) => data && setMotoristas(data))
    supabase.from('caminhoes').select('id, placa').order('placa').then(({ data }) => data && setCaminhoes(data))
  }, [filtroTipo])

  // Recarrega quando a aba volta a ficar visível (troca de menu)
  useEffect(() => {
    const container = containerRef.current
    const parent = container?.parentElement
    if (!parent) return
    const observer = new MutationObserver(() => {
      if (parent.style.display !== 'none') fetchNotas()
    })
    observer.observe(parent, { attributes: true, attributeFilter: ['style'] })
    return () => observer.disconnect()
  }, [])

  function showMsg(t: string) { setMsg(t); setTimeout(() => setMsg(''), 4000) }

  function abrirNovo() { setForm(FORM_INICIAL); setErro(''); setMostraNovo(true) }
  function fecharNovo() { setMostraNovo(false); setForm(FORM_INICIAL); setErro('') }

  function handle(e: any) {
    const { name, value, type, checked } = e.target
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
  }

  // ✅ Payload montado uma vez só — usado tanto por "Salvar Rascunho"
  // quanto por "Emitir" (que cria o registro antes de tentar emitir).
  function montarPayload() {
    const payload: any = {
      tipo: form.tipo,
      status: 'rascunho',
      destinatario_nome: form.destinatario_nome,
      destinatario_cnpj: form.destinatario_cnpj.replace(/\D/g, ''),
      valor: parseFloat(form.valor) || 0,
      data_emissao: form.data_emissao,
      obs: form.obs,
    }
    if (form.tipo === 'nfse') {
      payload.descricao_servico = form.descricao_servico
      payload.aliquota_iss = parseFloat(form.aliquota_iss) || 0
      payload.iss_retido = form.iss_retido
    }
    if (form.tipo === 'devolucao') {
      payload.nota_fiscal_original_chave = form.nota_fiscal_original_chave.replace(/\D/g, '')
      payload.motivo_devolucao = form.motivo_devolucao
      payload.placa = form.placa; payload.motorista = form.motorista
      payload.origem = form.origem; payload.destino = form.destino
    }
    if (form.tipo === 'remessa') {
      payload.natureza_remessa = form.natureza_remessa
      payload.produtos_descricao = form.produtos_descricao
      payload.placa = form.placa; payload.motorista = form.motorista
      payload.origem = form.origem; payload.destino = form.destino
    }
    return payload
  }

  async function salvarRascunho() {
    if (!form.tipo) { setErro('Selecione o tipo de nota (NFS-e, Devolução ou Remessa).'); return }
    setSalvando(true); setErro('')
    try {
      const token = await pegarToken()
      const res = await fetch('/api/notas-diversas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(montarPayload()),
      })
      const resultado = await res.json()
      if (!res.ok) throw new Error(resultado?.detail || resultado?.error || 'Erro ao salvar.')

      showMsg('✅ Rascunho salvo!')
      fecharNovo()
      await fetchNotas()
    } catch (e: any) {
      setErro('Erro ao salvar: ' + (e?.message || 'erro desconhecido'))
    } finally {
      setSalvando(false)
    }
  }

  // ⚠️ Emissão real ainda não configurada — mesmo motivo do CT-e: falta
  // o token do provedor. O fluxo já está pronto: cria o registro como
  // rascunho e na sequência chama o endpoint de emissão daquele
  // registro específico — assim que o token existir no backend, isso
  // passa a funcionar sem precisar mexer em mais nada aqui.
  async function emitir() {
    if (!form.tipo) { setErro('Selecione o tipo de nota (NFS-e, Devolução ou Remessa).'); return }
    setEmitindo(true); setErro('')
    try {
      const token = await pegarToken()
      const resCriar = await fetch('/api/notas-diversas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(montarPayload()),
      })
      const criado = await resCriar.json()
      if (!resCriar.ok) throw new Error(criado?.detail || criado?.error || 'Erro ao salvar antes de emitir.')

      const registro = Array.isArray(criado) ? criado[0] : criado
      const resEmitir = await fetch(`/api/notas-diversas/${registro.id}/emitir`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const resultado = await resEmitir.json()
      if (!resEmitir.ok) throw new Error(resultado?.detail || resultado?.error || 'Emissão ainda não configurada.')

      showMsg('✅ Nota emitida com sucesso!')
      fecharNovo()
      await fetchNotas()
    } catch (e: any) {
      setErro(e?.message || 'Emissão ainda não configurada — salve como rascunho por enquanto.')
      await fetchNotas() // o rascunho pode ter sido criado mesmo com a emissão falhando
    } finally {
      setEmitindo(false)
    }
  }

  async function cancelar(id: string) {
    setErro('')
    try {
      const token = await pegarToken()
      const res = await fetch(`/api/notas-diversas/${id}/cancelar`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const resultado = await res.json()
      if (!res.ok) throw new Error(resultado?.detail || resultado?.error || 'Erro ao cancelar.')
      showMsg('✅ Nota cancelada.')
      setCancelandoId(null)
      setVisualizando(null)
      await fetchNotas()
    } catch (e: any) {
      setErro(e?.message || 'Cancelamento ainda não está configurado (depende do token do provedor).')
      setCancelandoId(null)
    }
  }

  const totalAutorizadas = useMemo(() => notas.filter(n => n.status === 'autorizado').length, [notas])
  const totalRascunhos    = useMemo(() => notas.filter(n => n.status === 'rascunho').length, [notas])
  const totalValor        = useMemo(() => notas.filter(n => n.status === 'autorizado').reduce((s, n) => s + (n.valor || 0), 0), [notas])

  return (
    <div ref={containerRef} className="p-6 max-w-6xl mx-auto space-y-6">
      {msg && (
        <div className="fixed top-6 right-6 z-50 p-4 bg-green-600 text-white rounded-2xl shadow-2xl font-bold text-xs uppercase animate-bounce">
          {msg}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notas Fiscais</h1>
          <p className="text-sm text-gray-500">NFS-e, Devolução e Remessa</p>
        </div>
        <button onClick={abrirNovo}
          className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl text-sm font-bold uppercase transition">
          <Plus size={16}/> Nova Nota
        </button>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
        <AlertCircle size={18} className="text-blue-600 shrink-0 mt-0.5"/>
        <p className="text-xs text-blue-700">
          A emissão real ainda não está configurada — falta o token do provedor (Focus NFe ou similar), o mesmo
          usado pro CT-e. Por enquanto, as notas ficam salvas como <strong>rascunho</strong>.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Autorizadas</p>
          <p className="text-2xl font-black text-green-600">{totalAutorizadas}</p>
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

      <div className="flex gap-2">
        {(['', 'nfse', 'devolucao', 'remessa'] as const).map(t => (
          <button key={t} onClick={() => setFiltroTipo(t)}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase transition ${
              filtroTipo === t ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50'
            }`}>
            {t === '' ? 'Todos' : TIPO_INFO[t].label}
          </button>
        ))}
      </div>

      {loadingLista ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={32} className="animate-spin text-red-600"/>
        </div>
      ) : notas.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
          <FileText size={32} className="mx-auto text-gray-200 mb-2"/>
          <p className="text-sm text-gray-400">Nenhuma nota cadastrada ainda.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-5 py-3 text-left text-[10px] font-black text-gray-400 uppercase">Tipo</th>
                <th className="px-5 py-3 text-left text-[10px] font-black text-gray-400 uppercase">Destinatário</th>
                <th className="px-5 py-3 text-left text-[10px] font-black text-gray-400 uppercase">Data</th>
                <th className="px-5 py-3 text-right text-[10px] font-black text-gray-400 uppercase">Valor</th>
                <th className="px-5 py-3 text-right text-[10px] font-black text-gray-400 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {notas.map(n => (
                <tr key={n.id} onClick={() => setVisualizando(n)} className="cursor-pointer hover:bg-gray-50 transition">
                  <td className="px-5 py-3">
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase
                      ${n.tipo === 'nfse' ? 'bg-blue-100 text-blue-700' : n.tipo === 'devolucao' ? 'bg-orange-100 text-orange-700' : 'bg-purple-100 text-purple-700'}`}>
                      {TIPO_INFO[n.tipo]?.label || n.tipo}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <p className="text-sm font-bold text-gray-900 truncate max-w-[220px]">{n.destinatario_nome || '—'}</p>
                  </td>
                  <td className="px-5 py-3 text-xs text-gray-500">{fmtData(n.data_emissao)}</td>
                  <td className="px-5 py-3 text-right text-sm font-black text-gray-900">{fmtValor(n.valor)}</td>
                  <td className="px-5 py-3 text-right">
                    <span className={`text-[9px] font-black px-2 py-1 rounded uppercase ${badgeStatus(n.status)}`}>{n.status}</span>
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
              <h2 className="text-white font-black text-lg">Nova Nota</h2>
              <button onClick={fecharNovo} className="text-white/70 hover:text-white"><X size={22}/></button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4">
              {erro && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm font-bold">
                  <AlertCircle size={16}/> {erro}
                </div>
              )}

              {/* ✅ Seletor de tipo — travado depois de escolhido, define
                  quais campos aparecem no resto do formulário */}
              <div>
                <label className={LC}>Tipo de Nota *</label>
                <div className="grid grid-cols-3 gap-3 mt-1">
                  {(['nfse', 'devolucao', 'remessa'] as const).map(t => (
                    <button key={t} type="button" onClick={() => setForm(prev => ({ ...prev, tipo: t }))}
                      className={`p-3 rounded-xl border-2 text-left transition ${
                        form.tipo === t
                          ? t === 'nfse' ? 'border-blue-500 bg-blue-50' : t === 'devolucao' ? 'border-orange-500 bg-orange-50' : 'border-purple-500 bg-purple-50'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}>
                      <p className="font-black text-xs text-gray-900">{TIPO_INFO[t].label}</p>
                      <p className="text-[10px] text-gray-500 mt-1">{TIPO_INFO[t].desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {form.tipo && (
                <>
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

                  {form.tipo === 'nfse' && (
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-3">
                      <p className="text-xs font-black text-blue-700 uppercase tracking-widest">Dados do Serviço</p>
                      <div>
                        <label className={LC}>Descrição do Serviço</label>
                        <textarea name="descricao_servico" value={form.descricao_servico} onChange={handle} rows={2} className={IC}/>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className={LC}>Alíquota ISS (%)</label>
                          <input name="aliquota_iss" type="number" step="0.01" value={form.aliquota_iss} onChange={handle} className={IC}/>
                        </div>
                        <div className="flex items-center gap-2 pt-6">
                          <input name="iss_retido" type="checkbox" checked={form.iss_retido} onChange={handle} className="w-4 h-4 accent-blue-600"/>
                          <label className="text-sm font-medium text-gray-700">ISS retido na fonte</label>
                        </div>
                      </div>
                    </div>
                  )}

                  {form.tipo === 'devolucao' && (
                    <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 space-y-3">
                      <p className="text-xs font-black text-orange-700 uppercase tracking-widest">Dados da Devolução</p>
                      <div>
                        <label className={LC}>Chave da NF-e Original (44 dígitos)</label>
                        <input name="nota_fiscal_original_chave" value={form.nota_fiscal_original_chave} onChange={handle} maxLength={44} className={IC}/>
                      </div>
                      <div>
                        <label className={LC}>Motivo da Devolução</label>
                        <input name="motivo_devolucao" value={form.motivo_devolucao} onChange={handle} className={IC}/>
                      </div>
                    </div>
                  )}

                  {form.tipo === 'remessa' && (
                    <div className="bg-purple-50 border border-purple-100 rounded-xl p-4 space-y-3">
                      <p className="text-xs font-black text-purple-700 uppercase tracking-widest">Dados da Remessa</p>
                      <div>
                        <label className={LC}>Natureza da Remessa</label>
                        <input name="natureza_remessa" value={form.natureza_remessa} onChange={handle} className={IC} placeholder="Ex: Remessa para conserto"/>
                      </div>
                      <div>
                        <label className={LC}>Descrição dos Produtos</label>
                        <textarea name="produtos_descricao" value={form.produtos_descricao} onChange={handle} rows={2} className={IC}/>
                      </div>
                    </div>
                  )}

                  {(form.tipo === 'devolucao' || form.tipo === 'remessa') && (
                    <>
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
                    </>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={LC}>Valor (R$)</label>
                      <input name="valor" type="number" step="0.01" value={form.valor} onChange={handle} className={IC}/>
                    </div>
                    <div>
                      <label className={LC}>Data de Emissão</label>
                      <input name="data_emissao" type="date" value={form.data_emissao} onChange={handle} className={IC}/>
                    </div>
                  </div>

                  <div>
                    <label className={LC}>Observações</label>
                    <textarea name="obs" value={form.obs} onChange={handle} rows={2} className={IC}/>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button onClick={salvarRascunho} disabled={salvando}
                      className="flex-1 flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-800 text-white py-3 rounded-xl text-sm font-bold uppercase transition disabled:opacity-50">
                      {salvando ? <Loader2 size={16} className="animate-spin"/> : <FileText size={16}/>} Salvar Rascunho
                    </button>
                    <button onClick={emitir} disabled={emitindo}
                      className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl text-sm font-bold uppercase transition disabled:opacity-50">
                      {emitindo ? <Loader2 size={16} className="animate-spin"/> : <CheckCircle2 size={16}/>} Emitir
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
                <h2 className="text-white font-black text-lg">{TIPO_INFO[visualizando.tipo]?.label || visualizando.tipo}</h2>
                <p className="text-white/70 text-xs mt-0.5">{visualizando.numero_nota ? `Nº ${visualizando.numero_nota}` : 'Rascunho — ainda não emitido'}</p>
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
                <div><p className={LC}>Destinatário</p><p className="font-bold">{visualizando.destinatario_nome || '—'}</p></div>
                <div><p className={LC}>Valor</p><p className="font-black text-lg">{fmtValor(visualizando.valor)}</p></div>
                <div><p className={LC}>Data</p><p className="font-bold">{fmtData(visualizando.data_emissao)}</p></div>
              </div>

              {visualizando.tipo === 'nfse' && (
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm">
                  <p className={LC}>Descrição do Serviço</p>
                  <p className="font-bold">{visualizando.descricao_servico || '—'}</p>
                  <p className={LC + ' mt-2'}>ISS</p>
                  <p className="font-bold">{visualizando.aliquota_iss}% {visualizando.iss_retido ? '(retido na fonte)' : ''}</p>
                </div>
              )}
              {visualizando.tipo === 'devolucao' && (
                <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 text-sm">
                  <p className={LC}>Chave NF-e Original</p>
                  <p className="font-mono text-xs break-all">{visualizando.nota_fiscal_original_chave || '—'}</p>
                  <p className={LC + ' mt-2'}>Motivo</p>
                  <p className="font-bold">{visualizando.motivo_devolucao || '—'}</p>
                </div>
              )}
              {visualizando.tipo === 'remessa' && (
                <div className="bg-purple-50 border border-purple-100 rounded-xl p-4 text-sm">
                  <p className={LC}>Natureza</p>
                  <p className="font-bold">{visualizando.natureza_remessa || '—'}</p>
                  <p className={LC + ' mt-2'}>Produtos</p>
                  <p className="font-bold">{visualizando.produtos_descricao || '—'}</p>
                </div>
              )}

              {(visualizando.tipo === 'devolucao' || visualizando.tipo === 'remessa') && (
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><p className={LC}>Origem</p><p className="font-bold">{visualizando.origem || '—'}</p></div>
                  <div><p className={LC}>Destino</p><p className="font-bold">{visualizando.destino || '—'}</p></div>
                  <div><p className={LC}>Placa</p><p className="font-bold">{visualizando.placa || '—'}</p></div>
                  <div><p className={LC}>Motorista</p><p className="font-bold">{visualizando.motorista || '—'}</p></div>
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
                  <Ban size={16}/> Cancelar
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
            <h3 className="text-xl font-black text-gray-900 mb-2">Cancelar Nota?</h3>
            <p className="text-sm text-gray-500 mb-8">Cancelamento é feito junto ao provedor e não pode ser desfeito.</p>
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