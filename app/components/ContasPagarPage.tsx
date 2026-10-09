'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '../services/supabase'
import { Plus, ArrowLeft, Save, Trash2, Upload, Loader2, Filter, FileText, AlertCircle, CheckCircle2, XCircle, X, Link } from 'lucide-react'

interface ContaPagar {
  id: string; descricao: string; fornecedor_nome: string; fornecedor_cnpj: string
  valor: number; data_emissao: string; data_vencimento: string; status: string
  nota_fiscal_id: string | null; nota_fiscal_chave: string | null; obs: string; created_at: string
}

interface DadosNFe {
  chave_acesso: string; numero_nf: string; serie: string; data_emissao: string
  emitente_cnpj: string; emitente_nome: string; emitente_fantasia: string
  emitente_cidade: string; emitente_uf: string; valor_total: number
  natureza_operacao: string; cfop: string; produtos: string; info_adicional: string
}

interface AbastecimentoMatch {
  id: string; data: string; posto: string; total: number
  caminhao_placa: string; motorista: string; nota_fiscal_id: string | null
}

interface ResultadoCruzamento {
  status: 'confere' | 'divergencia' | 'nao_encontrado'
  abastecimento: AbastecimentoMatch | null; diferenca: number
}

const IC = "mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-gray-50"
const LC = "text-xs font-semibold text-gray-500 uppercase tracking-wide"
const NFE_NS = 'http://www.portalfiscal.inf.br/nfe'

function fmtData(d: string) {
  if (!d) return '—'
  const [y, m, dia] = d.split('-')
  return `${dia}/${m}/${y}`
}

function fmtCnpj(v: string) {
  if (!v) return '—'
  const d = v.replace(/\D/g, '').slice(0, 14)
  if (d.length < 14) return v
  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`
}

function fmtValor(v: number) {
  return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function parseNFe(xmlContent: string): DadosNFe | null {
  try {
    const parser = new DOMParser()
    const xml = xmlContent.replace(/^\uFEFF/, '')
    const doc = parser.parseFromString(xml, 'text/xml')
    const parseError = doc.getElementsByTagName('parsererror')[0]
    if (parseError) { console.error('Erro parse XML:', parseError.textContent); return null }
    const getNS = (tag: string): string =>
      doc.getElementsByTagNameNS(NFE_NS, tag)[0]?.textContent?.trim() || ''
    const chNFe = getNS('chNFe')
    const infNFe = doc.getElementsByTagNameNS(NFE_NS, 'infNFe')[0]
    const idAttr = infNFe?.getAttribute('Id') || ''
    const chave_acesso = chNFe || idAttr.replace('NFe', '')
    const data_emissao = getNS('dhEmi').split('T')[0]
    const emit = doc.getElementsByTagNameNS(NFE_NS, 'emit')[0]
    const emitente_cnpj     = emit?.getElementsByTagNameNS(NFE_NS, 'CNPJ')[0]?.textContent?.trim() || ''
    const emitente_nome     = emit?.getElementsByTagNameNS(NFE_NS, 'xNome')[0]?.textContent?.trim() || ''
    const emitente_fantasia = emit?.getElementsByTagNameNS(NFE_NS, 'xFant')[0]?.textContent?.trim() || ''
    const enderEmit         = emit?.getElementsByTagNameNS(NFE_NS, 'enderEmit')[0]
    const emitente_cidade   = enderEmit?.getElementsByTagNameNS(NFE_NS, 'xMun')[0]?.textContent?.trim() || ''
    const emitente_uf       = enderEmit?.getElementsByTagNameNS(NFE_NS, 'UF')[0]?.textContent?.trim() || ''
    const valor_total       = parseFloat(getNS('vNF') || '0')
    const dets = doc.getElementsByTagNameNS(NFE_NS, 'det')
    const produtos_lista: string[] = []
    let cfop_principal = ''
    for (let i = 0; i < dets.length; i++) {
      const xProd = dets[i].getElementsByTagNameNS(NFE_NS, 'xProd')[0]?.textContent?.trim() || ''
      const qCom  = dets[i].getElementsByTagNameNS(NFE_NS, 'qCom')[0]?.textContent?.trim() || ''
      const uCom  = dets[i].getElementsByTagNameNS(NFE_NS, 'uCom')[0]?.textContent?.trim() || ''
      const vProd = dets[i].getElementsByTagNameNS(NFE_NS, 'vProd')[0]?.textContent?.trim() || ''
      const cfop  = dets[i].getElementsByTagNameNS(NFE_NS, 'CFOP')[0]?.textContent?.trim() || ''
      if (!cfop_principal) cfop_principal = cfop
      const valorFmt = parseFloat(vProd || '0').toLocaleString('pt-BR', { minimumFractionDigits: 2 })
      produtos_lista.push(`${xProd} — ${qCom}${uCom} — R$ ${valorFmt}`)
    }
    return {
      chave_acesso, numero_nf: getNS('nNF'), serie: getNS('serie'),
      data_emissao, emitente_cnpj, emitente_nome, emitente_fantasia,
      emitente_cidade, emitente_uf, valor_total,
      natureza_operacao: getNS('natOp'), cfop: cfop_principal,
      produtos: produtos_lista.join(' | '), info_adicional: getNS('infCpl'),
    }
  } catch (e) {
    console.error('Erro ao parsear NF-e:', e)
    return null
  }
}

async function cruzarComAbastecimentos(dados: DadosNFe): Promise<ResultadoCruzamento> {
  const cnpjLimpo = dados.emitente_cnpj.replace(/\D/g, '')
  const cnpjBase  = cnpjLimpo.slice(0, 8)
  const { data: abasts } = await supabase
    .from('abastecimentos')
    .select('id, data, posto, total, caminhao_placa, motorista, cnpj_posto, nota_fiscal_id')
    .eq('data', dados.data_emissao).order('total')
  const porCnpj = (abasts || []).filter((a: any) => {
    const cnpjAbast = (a.cnpj_posto || '').replace(/\D/g, '')
    return cnpjAbast.startsWith(cnpjBase) || cnpjAbast === cnpjLimpo
  })
  if (porCnpj.length === 0) return { status: 'nao_encontrado', abastecimento: null, diferenca: 0 }
  const melhor = porCnpj.reduce((prev: any, curr: any) => {
    const diffPrev = Math.abs((prev.total || 0) - dados.valor_total)
    const diffCurr = Math.abs((curr.total || 0) - dados.valor_total)
    return diffCurr < diffPrev ? curr : prev
  })
  const diferenca = Math.abs((melhor.total || 0) - dados.valor_total)
  return {
    status: diferenca < 1.00 ? 'confere' : 'divergencia',
    abastecimento: melhor, diferenca,
  }
}

export default function ContasPagarPage() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [contas, setContas]                       = useState<ContaPagar[]>([])
  const [sel, setSel]                             = useState<ContaPagar | null>(null)
  const [loading, setLoading]                     = useState(false)
  const [loadingLista, setLoadingLista]           = useState(false)
  const [msg, setMsg]                             = useState('')
  const [confirmExcluir, setConfirmExcluir]       = useState(false)
  const [filtroStatus, setFiltroStatus]           = useState('')
  const [filtroInicio, setFiltroInicio]           = useState('')
  const [filtroFim, setFiltroFim]                 = useState('')
  const [mostraImport, setMostraImport]           = useState(false)
  const [dadosNFe, setDadosNFe]                   = useState<DadosNFe | null>(null)
  const [cruzamento, setCruzamento]               = useState<ResultadoCruzamento | null>(null)
  const [carregandoXML, setCarregandoXML]         = useState(false)
  const [erroImport, setErroImport]               = useState('')
  const [vencimento, setVencimento]               = useState('')
  const [obsImport, setObsImport]                 = useState('')
  const [salvandoNFe, setSalvandoNFe]             = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const [mostraNova, setMostraNova]               = useState(false)
  const [novaDesc, setNovaDesc]                   = useState('')
  const [novaFornNome, setNovaFornNome]           = useState('')
  const [novaFornCnpj, setNovaFornCnpj]           = useState('')
  const [novaValor, setNovaValor]                 = useState('')
  const [novaEmissao, setNovaEmissao]             = useState(new Date().toISOString().split('T')[0])
  const [novaVenc, setNovaVenc]                   = useState('')
  const [novaObs, setNovaObs]                     = useState('')
  const [editDesc, setEditDesc]                   = useState('')
  const [editFornNome, setEditFornNome]           = useState('')
  const [editFornCnpj, setEditFornCnpj]           = useState('')
  const [editValor, setEditValor]                 = useState('')
  const [editEmissao, setEditEmissao]             = useState('')
  const [editVenc, setEditVenc]                   = useState('')
  const [editStatus, setEditStatus]               = useState('')
  const [editObs, setEditObs]                     = useState('')
  const [cruzamentoDetalhe, setCruzamentoDetalhe] = useState<ResultadoCruzamento | null>(null)
  const [carregandoCruz, setCarregandoCruz]       = useState(false)

  useEffect(() => { fetch_() }, [filtroStatus, filtroInicio, filtroFim])

  // ✅ MutationObserver com debounce (já existia) — mantido, mas o que
  // realmente resolve a corrida entre esse observer e o efeito de
  // filtro acima é a guarda por ID dentro do fetch_() logo abaixo.
  useEffect(() => {
    const container = containerRef.current
    const parent = container?.parentElement
    if (!parent) return
    let jaCarregou = false
    const observer = new MutationObserver(() => {
      if (parent.style.display !== 'none' && !jaCarregou) {
        jaCarregou = true
        fetch_()
        setTimeout(() => { jaCarregou = false }, 1000)
      }
    })
    observer.observe(parent, { attributes: true, attributeFilter: ['style'] })
    return () => observer.disconnect()
  }, [])

  // ✅ Guarda contra corrida entre chamadas concorrentes de fetch_().
  const fetchIdRef = useRef(0)

  // ✅ Helper pra pegar o token da sessão atual — usado em toda chamada
  // pro backend a partir de agora, já que ele exige login validado.
  async function pegarToken(): Promise<string> {
    const { data } = await supabase.auth.getSession()
    const token = data?.session?.access_token
    if (!token) throw new Error('Sessão expirada. Atualize a página e faça login novamente.')
    return token
  }

  async function fetch_() {
    const meuId = ++fetchIdRef.current
    setLoadingLista(true)
    try {
      const token = await pegarToken()
      const params = new URLSearchParams()
      if (filtroStatus) params.set('status', filtroStatus)
      if (filtroInicio) params.set('venc_inicio', filtroInicio)
      if (filtroFim)    params.set('venc_fim', filtroFim)

      const res = await fetch(`/api/contas-pagar?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      })
      const data = await res.json()

      if (meuId !== fetchIdRef.current) return

      if (!res.ok) { console.error('Erro ao buscar contas:', data); return }
      setContas(Array.isArray(data) ? data : [])
    } catch (e) {
      if (meuId === fetchIdRef.current) console.error('Erro ao buscar contas:', e)
    }
    finally {
      if (meuId === fetchIdRef.current) setLoadingLista(false)
    }
  }

  function showMsg(t: string) { setMsg(t); setTimeout(() => setMsg(''), 4000) }

  function fecharImport() {
    setMostraImport(false); setDadosNFe(null); setCruzamento(null)
    setErroImport(''); setVencimento(''); setObsImport('')
  }

  async function lerXML(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setCarregandoXML(true); setDadosNFe(null); setCruzamento(null); setErroImport('')
    try {
      const text = await file.text()
      const dados = parseNFe(text)
      if (!dados) { setErroImport('Não foi possível ler o XML.'); return }
      const { data: exist } = await supabase
        .from('notas_fiscais').select('id').eq('chave_acesso', dados.chave_acesso).maybeSingle()
      if (exist) { setErroImport('Esta NF-e já foi importada anteriormente.'); return }
      setDadosNFe(dados)
      const result = await cruzarComAbastecimentos(dados)
      setCruzamento(result)
    } catch (err) {
      console.error('Erro lerXML:', err)
      setErroImport('Erro ao processar XML.')
    } finally {
      setCarregandoXML(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function salvarNFe() {
    if (!dadosNFe || !vencimento) return
    setSalvandoNFe(true)
    try {
      const token = await pegarToken()
      const res = await fetch('/api/contas-pagar/importar-nfe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          dados_nfe: dadosNFe,
          vencimento,
          obs: obsImport,
          abastecimento_id: cruzamento?.abastecimento?.id || null,
        }),
      })
      const resultado = await res.json()
      if (!res.ok) throw new Error(resultado?.detail || resultado?.error || 'Erro ao importar NF-e.')

      showMsg('✅ NF-e importada, conta criada e abastecimento vinculado!')
      fecharImport()
      await fetch_()
    } catch (e: any) {
      setErroImport('Erro ao salvar: ' + (e?.message || 'erro desconhecido'))
    } finally { setSalvandoNFe(false) }
  }

  async function salvarNova() {
    if (!novaFornNome || !novaValor || !novaVenc) return
    setLoading(true)
    try {
      const token = await pegarToken()
      const res = await fetch('/api/contas-pagar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          descricao: novaDesc, fornecedor_nome: novaFornNome,
          fornecedor_cnpj: novaFornCnpj.replace(/\D/g, ''),
          valor: parseFloat(novaValor) || 0, data_emissao: novaEmissao,
          data_vencimento: novaVenc, status: 'PENDENTE', obs: novaObs,
        }),
      })
      const resultado = await res.json()
      if (!res.ok) throw new Error(resultado?.detail || resultado?.error || 'Erro ao cadastrar.')

      showMsg('✅ Conta cadastrada!')
      setMostraNova(false)
      setNovaDesc(''); setNovaFornNome(''); setNovaFornCnpj('')
      setNovaValor(''); setNovaVenc(''); setNovaObs('')
      await fetch_()
    } catch (e: any) { showMsg('❌ Erro: ' + (e?.message || 'erro desconhecido')) }
    finally { setLoading(false) }
  }

  async function selecionar(c: ContaPagar) {
    setSel(c); setEditDesc(c.descricao || ''); setEditFornNome(c.fornecedor_nome || '')
    setEditFornCnpj(fmtCnpj(c.fornecedor_cnpj || '')); setEditValor(String(c.valor || ''))
    setEditEmissao(c.data_emissao || ''); setEditVenc(c.data_vencimento || '')
    setEditStatus(c.status || 'PENDENTE'); setEditObs(c.obs || '')
    setConfirmExcluir(false); setCruzamentoDetalhe(null)
    if (c.fornecedor_cnpj && c.data_emissao) {
      setCarregandoCruz(true)
      const result = await cruzarComAbastecimentos({
        emitente_cnpj: c.fornecedor_cnpj, data_emissao: c.data_emissao, valor_total: c.valor,
      } as DadosNFe)
      setCruzamentoDetalhe(result); setCarregandoCruz(false)
    }
  }

  async function salvar() {
    if (!sel) return
    setLoading(true)
    try {
      const token = await pegarToken()
      const res = await fetch(`/api/contas-pagar/${sel.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          descricao: editDesc, fornecedor_nome: editFornNome,
          fornecedor_cnpj: editFornCnpj.replace(/\D/g, ''),
          valor: parseFloat(editValor) || 0, data_emissao: editEmissao,
          data_vencimento: editVenc, status: editStatus, obs: editObs,
        }),
      })
      const resultado = await res.json()
      if (!res.ok) throw new Error(resultado?.detail || resultado?.error || 'Erro ao atualizar.')

      showMsg('✅ Atualizado!'); setSel(null); await fetch_()
    } catch (e: any) { showMsg('❌ Erro: ' + (e?.message || 'erro desconhecido')) }
    finally { setLoading(false) }
  }

  async function excluir() {
    if (!sel) return
    setLoading(true)
    try {
      const token = await pegarToken()
      await fetch(`/api/contas-pagar/${sel.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      showMsg('Conta excluída.'); setSel(null); await fetch_()
    } catch (e: any) { showMsg('❌ Erro: ' + (e?.message || 'erro desconhecido')) }
    finally { setLoading(false) }
  }

  const totalPendente = useMemo(() =>
    contas.filter(c => c.status === 'PENDENTE').reduce((s, c) => s + (c.valor || 0), 0), [contas])
  const totalPago = useMemo(() =>
    contas.filter(c => c.status === 'PAGO').reduce((s, c) => s + (c.valor || 0), 0), [contas])
  const vencidas = useMemo(() => {
    const hoje = new Date().toISOString().split('T')[0]
    return contas.filter(c => c.status === 'PENDENTE' && c.data_vencimento < hoje).length
  }, [contas])

  function badgeStatus(s: string) {
    if (s === 'PAGO')      return 'bg-green-100 text-green-700'
    if (s === 'CANCELADO') return 'bg-gray-100 text-gray-500'
    return 'bg-yellow-100 text-yellow-700'
  }

  function isVencida(c: ContaPagar) {
    const hoje = new Date().toISOString().split('T')[0]
    return c.status === 'PENDENTE' && c.data_vencimento < hoje
  }

  function BadgeCruzamento({ status }: { status: ResultadoCruzamento['status'] }) {
    if (status === 'confere')
      return <span className="flex items-center gap-1 text-xs font-bold text-green-600"><CheckCircle2 size={12}/> Confere</span>
    if (status === 'divergencia')
      return <span className="flex items-center gap-1 text-xs font-bold text-orange-500"><AlertCircle size={12}/> Divergência</span>
    return <span className="flex items-center gap-1 text-xs font-bold text-gray-400"><XCircle size={12}/> Sem abastecimento</span>
  }

  function CardAbastecimento({ a, diferenca }: { a: AbastecimentoMatch; diferenca: number }) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link size={12} className="text-blue-500"/>
            <span className="text-xs font-black text-gray-700">{a.caminhao_placa}</span>
            <span className="text-[10px] text-gray-400">{a.motorista}</span>
          </div>
          <span className="text-sm font-black text-gray-900">{fmtValor(a.total)}</span>
        </div>
        <div className="flex items-center justify-between text-[10px] text-gray-400">
          <span>{a.posto || '—'}</span>
          {diferenca > 0.10 && <span className="text-orange-500 font-bold">Diferença: {fmtValor(diferenca)}</span>}
          {a.nota_fiscal_id && <span className="text-blue-500 font-bold">✓ Já vinculado</span>}
        </div>
      </div>
    )
  }

  if (sel) return (
    <div className="p-6 max-w-3xl mx-auto">
      <button onClick={() => setSel(null)}
        className="flex items-center gap-2 text-gray-500 hover:text-gray-800 mb-4 text-sm transition">
        <ArrowLeft size={16}/> Voltar
      </button>
      {msg && <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-xl text-sm">{msg}</div>}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className={`px-6 py-5 flex items-center justify-between
          ${editStatus === 'PAGO' ? 'bg-green-600' : isVencida(sel) ? 'bg-red-700' : 'bg-gray-900'}`}>
          <div>
            <h2 className="text-white font-black text-xl">{sel.fornecedor_nome}</h2>
            <p className="text-white/60 text-xs mt-0.5">{fmtCnpj(sel.fornecedor_cnpj)}</p>
          </div>
          <div className="text-right">
            <p className="text-white/60 text-xs">Valor</p>
            <p className="text-white font-black text-2xl">{fmtValor(sel.valor)}</p>
          </div>
        </div>
        <div className="p-6 space-y-4">
          {sel.nota_fiscal_id && (
            <div className={`p-4 rounded-xl border ${
              carregandoCruz ? 'bg-gray-50 border-gray-200' :
              cruzamentoDetalhe?.status === 'confere'     ? 'bg-green-50 border-green-200' :
              cruzamentoDetalhe?.status === 'divergencia' ? 'bg-orange-50 border-orange-200' :
              'bg-gray-50 border-gray-200'
            }`}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-black text-gray-600 uppercase tracking-widest">Abastecimento Vinculado</p>
                {carregandoCruz
                  ? <Loader2 size={14} className="animate-spin text-gray-400"/>
                  : cruzamentoDetalhe && <BadgeCruzamento status={cruzamentoDetalhe.status}/>}
              </div>
              {cruzamentoDetalhe && !carregandoCruz && (
                cruzamentoDetalhe.abastecimento
                  ? <CardAbastecimento a={cruzamentoDetalhe.abastecimento} diferenca={cruzamentoDetalhe.diferenca}/>
                  : <p className="text-xs text-gray-400 italic">Nenhum abastecimento encontrado.</p>
              )}
            </div>
          )}
          {sel.nota_fiscal_chave && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
              <p className="text-[10px] font-black text-blue-400 uppercase mb-1">Chave NF-e</p>
              <p className="text-xs font-mono text-blue-700 break-all">{sel.nota_fiscal_chave}</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div><label className={LC}>Descrição</label>
              <input value={editDesc} onChange={e => setEditDesc(e.target.value)} className={IC}/></div>
            <div><label className={LC}>Status</label>
              <select value={editStatus} onChange={e => setEditStatus(e.target.value)} className={IC}>
                <option value="PENDENTE">PENDENTE</option>
                <option value="PAGO">PAGO</option>
                <option value="CANCELADO">CANCELADO</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className={LC}>Fornecedor</label>
              <input value={editFornNome} onChange={e => setEditFornNome(e.target.value)} className={IC}/></div>
            <div><label className={LC}>CNPJ</label>
              <input value={editFornCnpj} onChange={e => setEditFornCnpj(e.target.value)} className={IC}/></div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div><label className={LC}>Valor (R$)</label>
              <input type="number" step="0.01" value={editValor} onChange={e => setEditValor(e.target.value)} className={IC}/></div>
            <div><label className={LC}>Data Emissão</label>
              <input type="date" value={editEmissao} onChange={e => setEditEmissao(e.target.value)} className={IC}/></div>
            <div><label className={LC}>Vencimento</label>
              <input type="date" value={editVenc} onChange={e => setEditVenc(e.target.value)} className={IC}/></div>
          </div>
          <div><label className={LC}>Observações</label>
            <textarea value={editObs} onChange={e => setEditObs(e.target.value)} rows={2} className={IC}/></div>
          <div className="flex gap-3 pt-2">
            <button onClick={salvar} disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 bg-red-600 text-white py-2.5 rounded-xl text-sm font-bold uppercase hover:bg-red-700 transition disabled:opacity-50">
              {loading ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>} Salvar
            </button>
            <button onClick={() => setConfirmExcluir(true)} disabled={loading}
              className="flex items-center justify-center gap-2 bg-gray-100 text-gray-700 px-4 py-2.5 rounded-xl text-sm font-bold uppercase hover:bg-gray-200 transition">
              <Trash2 size={14}/> Excluir
            </button>
          </div>
          {confirmExcluir && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white p-6 rounded-2xl shadow-2xl text-center max-w-sm w-full mx-4">
                <AlertCircle size={32} className="mx-auto text-red-600 mb-3"/>
                <p className="font-bold text-gray-900 mb-2">Excluir esta conta?</p>
                <p className="text-sm text-gray-500 mb-5">Esta ação não pode ser desfeita.</p>
                <div className="flex gap-3">
                  <button onClick={() => setConfirmExcluir(false)}
                    className="flex-1 py-2 rounded-xl text-sm font-bold border border-gray-200 hover:bg-gray-50">Cancelar</button>
                  <button onClick={excluir} disabled={loading}
                    className="flex-1 py-2 rounded-xl text-sm font-bold bg-red-600 text-white hover:bg-red-700">
                    {loading ? 'Excluindo...' : 'Confirmar'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <div ref={containerRef} className="p-6 max-w-5xl mx-auto">
      {msg && (
        <div className="fixed top-6 right-6 z-50 p-4 bg-green-600 text-white rounded-2xl shadow-2xl font-bold text-xs uppercase animate-bounce">
          {msg}
        </div>
      )}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Total Pendente</p>
          <p className="text-2xl font-black text-yellow-600">{fmtValor(totalPendente)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Total Pago</p>
          <p className="text-2xl font-black text-green-600">{fmtValor(totalPago)}</p>
        </div>
        <div className={`rounded-2xl border shadow-sm p-5 ${vencidas > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100'}`}>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Vencidas</p>
          <p className={`text-2xl font-black ${vencidas > 0 ? 'text-red-600' : 'text-gray-400'}`}>{vencidas}</p>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Contas a Pagar</h1>
        <div className="flex gap-2">
          <button onClick={() => { setMostraImport(true); setDadosNFe(null); setCruzamento(null); setErroImport(''); setVencimento('') }}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-bold uppercase transition">
            <FileText size={16}/> Importar NF-e
          </button>
          <button onClick={() => setMostraNova(true)}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl text-sm font-bold uppercase transition">
            <Plus size={16}/> Nova Conta
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4 grid grid-cols-3 gap-3">
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase mb-1 flex items-center gap-1"><Filter size={11}/> Status</label>
          <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-500">
            <option value="">Todos</option>
            <option value="PENDENTE">Pendente</option>
            <option value="PAGO">Pago</option>
            <option value="CANCELADO">Cancelado</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Venc. Início</label>
          <input type="date" value={filtroInicio} onChange={e => setFiltroInicio(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-500"/>
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Venc. Fim</label>
          <input type="date" value={filtroFim} onChange={e => setFiltroFim(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-500"/>
        </div>
        {(filtroStatus || filtroInicio || filtroFim) && (
          <div className="col-span-3 flex justify-end">
            <button onClick={() => { setFiltroStatus(''); setFiltroInicio(''); setFiltroFim('') }}
              className="text-xs text-red-600 hover:underline font-semibold">Limpar filtros</button>
          </div>
        )}
      </div>

      {loadingLista ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={32} className="animate-spin text-red-600"/>
        </div>
      ) : contas.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
          <FileText size={32} className="mx-auto text-gray-200 mb-2"/>
          <p className="text-sm text-gray-400">Nenhuma conta cadastrada.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-5 py-3 text-left text-[10px] font-black text-gray-400 uppercase">Fornecedor</th>
                <th className="px-5 py-3 text-left text-[10px] font-black text-gray-400 uppercase">Emissão</th>
                <th className="px-5 py-3 text-left text-[10px] font-black text-gray-400 uppercase">Vencimento</th>
                <th className="px-5 py-3 text-left text-[10px] font-black text-gray-400 uppercase">NF-e</th>
                <th className="px-5 py-3 text-right text-[10px] font-black text-gray-400 uppercase">Valor</th>
                <th className="px-5 py-3 text-right text-[10px] font-black text-gray-400 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {contas.map(c => {
                const venc = isVencida(c)
                return (
                  <tr key={c.id} onClick={() => selecionar(c)}
                    className={`cursor-pointer transition hover:bg-gray-50 ${venc ? 'bg-red-50/40' : ''}`}>
                    <td className="px-5 py-3">
                      <p className="text-sm font-bold text-gray-900 truncate max-w-[200px]">{c.fornecedor_nome || '—'}</p>
                      <p className="text-[10px] text-gray-400">{fmtCnpj(c.fornecedor_cnpj)}</p>
                    </td>
                    <td className="px-5 py-3 text-xs text-gray-600 whitespace-nowrap">{fmtData(c.data_emissao)}</td>
                    <td className="px-5 py-3 whitespace-nowrap">
                      <p className={`text-xs font-bold ${venc ? 'text-red-600' : 'text-gray-700'}`}>
                        {fmtData(c.data_vencimento)}
                        {venc && <span className="ml-1 text-[9px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded uppercase">Vencida</span>}
                      </p>
                    </td>
                    <td className="px-5 py-3">
                      {c.nota_fiscal_id
                        ? <span className="text-[10px] bg-blue-100 text-blue-700 font-black px-2 py-0.5 rounded uppercase">NF-e</span>
                        : <span className="text-[10px] text-gray-300">—</span>}
                    </td>
                    <td className="px-5 py-3 text-right text-sm font-black text-gray-900 whitespace-nowrap">{fmtValor(c.valor)}</td>
                    <td className="px-5 py-3 text-right">
                      <span className={`text-[9px] font-black px-2 py-1 rounded uppercase ${badgeStatus(c.status)}`}>
                        {c.status}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex justify-between text-xs text-gray-500">
            <span>{contas.length} registro(s)</span>
            <span>Total pendente: <strong className="text-yellow-600">{fmtValor(totalPendente)}</strong></span>
          </div>
        </div>
      )}

      {mostraImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-6 py-5 bg-blue-600 flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-white font-black text-lg">Importar NF-e</h2>
                <p className="text-blue-200 text-xs mt-0.5">Selecione o arquivo XML da nota fiscal</p>
              </div>
              <button onClick={fecharImport} className="text-white/70 hover:text-white"><X size={22}/></button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4">
              <input ref={fileRef} type="file" accept=".xml" className="hidden" onChange={lerXML}/>
              <button onClick={() => fileRef.current?.click()} disabled={carregandoXML}
                className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-blue-200 hover:border-blue-400 bg-blue-50 text-blue-600 rounded-2xl py-4 text-sm font-bold transition disabled:opacity-50">
                {carregandoXML
                  ? <><Loader2 size={16} className="animate-spin"/> Lendo XML...</>
                  : <><Upload size={16}/> Selecionar arquivo XML</>}
              </button>
              {erroImport && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm font-bold">
                  <AlertCircle size={16}/> {erroImport}
                </div>
              )}
              {dadosNFe && (
                <>
                  <div className="bg-gray-50 rounded-2xl p-4 space-y-3">
                    <p className="text-xs font-black text-gray-500 uppercase tracking-widest">Dados da Nota Fiscal</p>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase">Emitente</p>
                        <p className="font-bold text-gray-900">{dadosNFe.emitente_nome}</p>
                        {dadosNFe.emitente_fantasia && <p className="text-[10px] text-gray-500">{dadosNFe.emitente_fantasia}</p>}
                        <p className="text-[10px] text-gray-500">{dadosNFe.emitente_cidade}/{dadosNFe.emitente_uf}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase">CNPJ</p>
                        <p className="font-bold text-gray-900">{fmtCnpj(dadosNFe.emitente_cnpj)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase">Nº / Série</p>
                        <p className="font-bold text-gray-900">{dadosNFe.numero_nf} / {dadosNFe.serie}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase">Data Emissão</p>
                        <p className="font-bold text-gray-900">{fmtData(dadosNFe.data_emissao)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase">Valor Total</p>
                        <p className="font-black text-red-600 text-lg">{fmtValor(dadosNFe.valor_total)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase">CFOP / Natureza</p>
                        <p className="font-bold text-gray-900">{dadosNFe.cfop} — {dadosNFe.natureza_operacao}</p>
                      </div>
                    </div>
                    {dadosNFe.produtos && (
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase mb-1">Produtos</p>
                        <p className="text-xs text-gray-600 bg-white rounded-xl p-3 border border-gray-100">{dadosNFe.produtos}</p>
                      </div>
                    )}
                  </div>
                  {cruzamento && (
                    <div className={`rounded-2xl p-4 border ${
                      cruzamento.status === 'confere'     ? 'bg-green-50 border-green-200' :
                      cruzamento.status === 'divergencia' ? 'bg-orange-50 border-orange-200' :
                      'bg-gray-50 border-gray-200'
                    }`}>
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-black text-gray-600 uppercase tracking-widest">Abastecimento para Vincular</p>
                        <BadgeCruzamento status={cruzamento.status}/>
                      </div>
                      {cruzamento.abastecimento ? (
                        <>
                          <CardAbastecimento a={cruzamento.abastecimento} diferenca={cruzamento.diferenca}/>
                          {cruzamento.abastecimento.nota_fiscal_id && (
                            <p className="text-xs text-orange-500 font-bold mt-2">
                              ⚠️ Este abastecimento já está vinculado a outra NF-e.
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="text-xs text-gray-400 italic">
                          Nenhum abastecimento encontrado para este CNPJ na data {fmtData(dadosNFe.data_emissao)}.
                          A conta será criada sem vínculo.
                        </p>
                      )}
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={LC}>Data de Vencimento *</label>
                      <input type="date" value={vencimento} onChange={e => setVencimento(e.target.value)} className={IC}/>
                    </div>
                    <div>
                      <label className={LC}>Observações</label>
                      <input value={obsImport} onChange={e => setObsImport(e.target.value)} className={IC} placeholder="Opcional"/>
                    </div>
                  </div>
                  <button onClick={salvarNFe} disabled={salvandoNFe || !vencimento}
                    className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-black text-sm uppercase tracking-widest transition disabled:opacity-50">
                    {salvandoNFe
                      ? <><Loader2 size={16} className="animate-spin"/> Salvando...</>
                      : <><FileText size={16}/> Criar Conta a Pagar</>}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {mostraNova && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-5 bg-gray-900 flex items-center justify-between">
              <h2 className="text-white font-black text-lg">Nova Conta a Pagar</h2>
              <button onClick={() => setMostraNova(false)} className="text-white/70 hover:text-white"><X size={22}/></button>
            </div>
            <div className="p-6 space-y-4">
              <div><label className={LC}>Descrição</label>
                <input value={novaDesc} onChange={e => setNovaDesc(e.target.value)} className={IC} placeholder="Ex: Combustível Janeiro"/></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className={LC}>Fornecedor *</label>
                  <input value={novaFornNome} onChange={e => setNovaFornNome(e.target.value)} className={IC}/></div>
                <div><label className={LC}>CNPJ</label>
                  <input value={novaFornCnpj} onChange={e => setNovaFornCnpj(e.target.value)} className={IC}/></div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div><label className={LC}>Valor (R$) *</label>
                  <input type="number" step="0.01" value={novaValor} onChange={e => setNovaValor(e.target.value)} className={IC}/></div>
                <div><label className={LC}>Data Emissão</label>
                  <input type="date" value={novaEmissao} onChange={e => setNovaEmissao(e.target.value)} className={IC}/></div>
                <div><label className={LC}>Vencimento *</label>
                  <input type="date" value={novaVenc} onChange={e => setNovaVenc(e.target.value)} className={IC}/></div>
              </div>
              <div><label className={LC}>Observações</label>
                <textarea value={novaObs} onChange={e => setNovaObs(e.target.value)} rows={2} className={IC}/></div>
              <button onClick={salvarNova} disabled={loading || !novaFornNome || !novaValor || !novaVenc}
                className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl font-black text-sm uppercase tracking-widest transition disabled:opacity-50">
                {loading ? <><Loader2 size={16} className="animate-spin"/> Salvando...</> : <><Save size={16}/> Salvar Conta</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}