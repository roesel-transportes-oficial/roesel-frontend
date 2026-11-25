'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../services/supabase'
import { useDraftPersistente, limparDraft } from '../services/useDraftPersistente'
import {
  FileText, Plus, Save, X, AlertCircle, Loader2,
  CheckCircle2, XCircle, Ban, Truck, User, Search, Download, RefreshCw, Pencil, Send
} from 'lucide-react'

// ✅ Emissão direta na SEFAZ (sem provedor pago). O backend monta, assina
// e envia o CT-e. Esta tela só coleta os dados e mostra o resultado.
// Os dados que a SEFAZ exige vão no campo `dados_fiscais` (JSON).

interface Endereco {
  logradouro: string; numero: string; complemento?: string; bairro: string
  cod_municipio: string; municipio: string; cep: string; uf: string
}
interface Participante { cnpj: string; ie: string; nome: string; fone?: string; endereco: Endereco }

interface Cte {
  id: string
  tipo: 'normal' | 'redespacho'
  status: 'rascunho' | 'processando' | 'autorizado' | 'rejeitado' | 'cancelado'
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
  protocolo?: string; ambiente?: string
  dados_fiscais?: any
  obs: string; created_at: string
}

const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']

const PARTE_VAZIA = {
  nome: '', cnpj: '', ie: '', fone: '',
  logradouro: '', numero: '', complemento: '', bairro: '',
  uf: 'MG', municipio: '', cod_municipio: '', cep: '',
}
type Parte = typeof PARTE_VAZIA

const FORM_INICIAL = {
  tipo: '' as '' | 'normal' | 'redespacho',
  cfop: '',
  natureza_operacao: 'PRESTACAO DE SERVICO DE TRANSPORTE',
  tomador: '0' as '0' | '3',
  remetente: { ...PARTE_VAZIA },
  destinatario: { ...PARTE_VAZIA },
  valor_prestacao: '',
  icms_cst: '00',
  icms_aliquota: '',
  carga_valor: '',
  carga_produto: '',
  carga_peso: '',
  chaves_nfe: '',
  placa: '', motorista: '',
  cte_anterior_chave: '', redespachante_nome: '', redespachante_cnpj: '',
  obs: '',
}
type Form = typeof FORM_INICIAL

const IC = "mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-gray-50"
const LC = "text-xs font-semibold text-gray-500 uppercase tracking-wide"

const CSTS = [
  { v: '00', t: '00 - Tributado normalmente' },
  { v: '20', t: '20 - Com redução de base' },
  { v: '40', t: '40 - Isento' },
  { v: '41', t: '41 - Não tributado' },
  { v: '51', t: '51 - Diferido' },
  { v: '90', t: '90 - Outros' },
]

const soDigitos = (v: string) => (v || '').replace(/\D/g, '')
const num = (v: string) => parseFloat(String(v || '').replace(',', '.')) || 0

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
  if (s === 'processando') return 'bg-blue-100 text-blue-700'
  return 'bg-yellow-100 text-yellow-700'
}

// ✅ Lista de cidades do IBGE por UF (serviço público e gratuito).
// Escolher a cidade na lista já traz o código IBGE que a SEFAZ exige.
const cacheCidades: Record<string, { id: number; nome: string }[]> = {}
async function carregarCidades(uf: string): Promise<{ id: number; nome: string }[]> {
  if (cacheCidades[uf]) return cacheCidades[uf]
  const r = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios?orderBy=nome`)
  const lista = (await r.json()).map((m: any) => ({ id: m.id, nome: m.nome }))
  cacheCidades[uf] = lista
  return lista
}
function semAcento(s: string) {
  return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim()
}

function CidadeIbge({ uf, codigo, onChange }: {
  uf: string; codigo: string
  onChange: (uf: string, municipio: string, cod: string) => void
}) {
  const [cidades, setCidades] = useState<{ id: number; nome: string }[]>([])
  useEffect(() => {
    if (!uf) return
    let vivo = true
    carregarCidades(uf).then(l => { if (vivo) setCidades(l) }).catch(() => setCidades([]))
    return () => { vivo = false }
  }, [uf])
  return (
    <div className="grid grid-cols-3 gap-2">
      <div>
        <label className={LC}>UF</label>
        <select value={uf} onChange={e => onChange(e.target.value, '', '')} className={IC}>
          {UFS.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
      </div>
      <div className="col-span-2">
        <label className={LC}>Cidade</label>
        <select value={codigo} className={IC}
          onChange={e => {
            const c = cidades.find(x => String(x.id) === e.target.value)
            onChange(uf, c ? semAcento(c.nome) : '', c ? String(c.id) : '')
          }}>
          <option value="">{cidades.length ? 'Selecione...' : 'Carregando...'}</option>
          {cidades.map(c => <option key={c.id} value={String(c.id)}>{c.nome}</option>)}
        </select>
      </div>
    </div>
  )
}

function BlocoParte({ titulo, parte, clientes, onChange }: {
  titulo: string; parte: Parte; clientes: any[]
  onChange: (p: Parte) => void
}) {
  const set = (campo: keyof Parte, valor: string) => onChange({ ...parte, [campo]: valor })

  // Preenche a partir do cadastro de clientes (nome, CNPJ, IE, endereço)
  async function usarCliente(id: string) {
    const c = clientes.find(x => x.id === id)
    if (!c) return
    const uf = (c.estado || 'MG').toUpperCase()
    let cod = ''
    let municipio = semAcento(c.cidade || '')
    try {
      const lista = await carregarCidades(uf)
      const achou = lista.find(m => semAcento(m.nome) === municipio)
      if (achou) { cod = String(achou.id); municipio = semAcento(achou.nome) }
    } catch {}
    onChange({
      ...parte,
      nome: c.nome || '', cnpj: soDigitos(c.cnpj), ie: c.ie || '', fone: soDigitos(c.telefone || ''),
      logradouro: c.endereco || '', cep: soDigitos(c.cep || ''),
      uf, municipio, cod_municipio: cod,
    })
  }

  return (
    <div className="border border-gray-100 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-black text-gray-700 uppercase tracking-widest">{titulo}</p>
        {clientes.length > 0 && (
          <select defaultValue="" onChange={e => { usarCliente(e.target.value); e.target.value = '' }}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white max-w-[220px]">
            <option value="">Puxar do cadastro de clientes...</option>
            {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        )}
      </div>
      <div>
        <label className={LC}>Nome / Razão social *</label>
        <input value={parte.nome} onChange={e => set('nome', e.target.value)} className={IC}/>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={LC}>CNPJ *</label>
          <input value={parte.cnpj} onChange={e => set('cnpj', e.target.value)} className={IC}/>
        </div>
        <div>
          <label className={LC}>Inscrição Estadual</label>
          <input value={parte.ie} onChange={e => set('ie', e.target.value)} className={IC} placeholder="Número ou ISENTO"/>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-3">
        <div className="col-span-3">
          <label className={LC}>Endereço (rua) *</label>
          <input value={parte.logradouro} onChange={e => set('logradouro', e.target.value)} className={IC}/>
        </div>
        <div>
          <label className={LC}>Número</label>
          <input value={parte.numero} onChange={e => set('numero', e.target.value)} className={IC} placeholder="S/N"/>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={LC}>Bairro *</label>
          <input value={parte.bairro} onChange={e => set('bairro', e.target.value)} className={IC}/>
        </div>
        <div>
          <label className={LC}>CEP</label>
          <input value={parte.cep} onChange={e => set('cep', e.target.value)} className={IC}/>
        </div>
      </div>
      <CidadeIbge uf={parte.uf} codigo={parte.cod_municipio}
        onChange={(uf, municipio, cod) => onChange({ ...parte, uf, municipio, cod_municipio: cod })}/>
    </div>
  )
}

function parteParaApi(p: Parte): Participante {
  return {
    nome: p.nome.trim(), cnpj: soDigitos(p.cnpj), ie: p.ie.trim(), fone: soDigitos(p.fone || ''),
    endereco: {
      logradouro: p.logradouro.trim(), numero: p.numero.trim() || 'S/N', complemento: p.complemento || undefined,
      bairro: p.bairro.trim(), cod_municipio: p.cod_municipio, municipio: p.municipio, cep: soDigitos(p.cep), uf: p.uf,
    },
  }
}
function apiParaParte(p: any): Parte {
  if (!p) return { ...PARTE_VAZIA }
  const e = p.endereco || {}
  return {
    nome: p.nome || '', cnpj: p.cnpj || '', ie: p.ie || '', fone: p.fone || '',
    logradouro: e.logradouro || '', numero: e.numero || '', complemento: e.complemento || '', bairro: e.bairro || '',
    uf: e.uf || 'MG', municipio: e.municipio || '', cod_municipio: e.cod_municipio || '', cep: e.cep || '',
  }
}

export default function CtePage() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [ctes, setCtes]                 = useState<Cte[]>([])
  const [loadingLista, setLoadingLista] = useState(false)
  const [mostraNovo, setMostraNovo]     = useState(false)
  const [editandoId, setEditandoId]     = useState<string | null>(null)
  const [motoristas, setMotoristas]     = useState<any[]>([])
  const [caminhoes, setCaminhoes]       = useState<any[]>([])
  const [clientes, setClientes]         = useState<any[]>([])
  const [form, setForm]                 = useDraftPersistente<Form>('cte_novo_v2', FORM_INICIAL)
  const [salvando, setSalvando]         = useState(false)
  const [emitindo, setEmitindo]         = useState(false)
  const [acaoId, setAcaoId]             = useState<string | null>(null)
  const [erro, setErro]                 = useState('')
  const [msg, setMsg]                   = useState('')
  const [visualizando, setVisualizando] = useState<Cte | null>(null)
  const [cancelandoId, setCancelandoId] = useState<string | null>(null)

  const fetchIdRef = useRef(0)

  async function pegarToken(): Promise<string> {
    const { data } = await supabase.auth.getSession()
    const token = data?.session?.access_token
    if (!token) throw new Error('Sessão expirada. Atualize a página e faça login novamente.')
    return token
  }

  async function chamar(url: string, opcoes: RequestInit = {}) {
    const token = await pegarToken()
    const res = await fetch(url, {
      ...opcoes,
      headers: { ...(opcoes.body ? { 'Content-Type': 'application/json' } : {}), Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
    let dados: any = null
    try { dados = await res.json() } catch {}
    if (!res.ok) throw new Error(dados?.detail || dados?.error || `Erro ${res.status}`)
    return dados
  }

  async function fetchCtes() {
    const meuId = ++fetchIdRef.current
    setLoadingLista(true)
    try {
      const data = await chamar('/api/ctes')
      if (meuId !== fetchIdRef.current) return
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
    supabase.from('clientes').select('id, nome, cnpj, ie, endereco, cep, cidade, estado, telefone').order('nome')
      .then(({ data }) => data && setClientes(data))
  }, [])

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

  function showMsg(t: string) { setMsg(t); setTimeout(() => setMsg(''), 5000) }

  function abrirNovo() {
    setForm(FORM_INICIAL)
    setEditandoId(null)
    setErro('')
    setMostraNovo(true)
  }

  // ✅ Abre um CT-e rejeitado ou rascunho para corrigir e emitir de novo
  function abrirEdicao(c: Cte) {
    const d = c.dados_fiscais || {}
    setForm({
      ...FORM_INICIAL,
      tipo: c.tipo,
      cfop: d.cfop || '',
      natureza_operacao: d.natureza_operacao || c.natureza_operacao || FORM_INICIAL.natureza_operacao,
      tomador: String(d.tomador ?? 0) === '3' ? '3' : '0',
      remetente: apiParaParte(d.remetente),
      destinatario: apiParaParte(d.destinatario),
      valor_prestacao: String(d.valor_prestacao ?? c.valor_prestacao ?? ''),
      icms_cst: d.icms?.cst || '00',
      icms_aliquota: d.icms?.aliquota != null ? String(d.icms.aliquota) : '',
      carga_valor: d.carga?.valor != null ? String(d.carga.valor) : '',
      carga_produto: d.carga?.produto_predominante || '',
      carga_peso: d.carga?.quantidades?.[0]?.quantidade != null ? String(d.carga.quantidades[0].quantidade) : '',
      chaves_nfe: (d.chaves_nfe || []).join('\n'),
      placa: c.placa || '', motorista: c.motorista || '',
      cte_anterior_chave: c.cte_anterior_chave || '',
      redespachante_nome: c.redespachante_nome || '', redespachante_cnpj: c.redespachante_cnpj || '',
      obs: d.observacoes || c.obs || '',
    })
    setEditandoId(c.id)
    setVisualizando(null)
    setErro('')
    setMostraNovo(true)
  }

  function fecharNovo() {
    setMostraNovo(false)
    setEditandoId(null)
    setForm(FORM_INICIAL)
    setErro('')
  }

  function handle(e: any) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  // Sugestões automáticas (o usuário pode trocar)
  const interestadual = form.remetente.uf !== form.destinatario.uf
  useEffect(() => {
    if (!mostraNovo || editandoId) return
    setForm(prev => {
      const sugestaoCfop = prev.remetente.uf === prev.destinatario.uf ? '5353' : '6353'
      const cfopAuto = !prev.cfop || prev.cfop === '5353' || prev.cfop === '6353'
      return cfopAuto && prev.cfop !== sugestaoCfop ? { ...prev, cfop: sugestaoCfop } : prev
    })
  }, [form.remetente.uf, form.destinatario.uf, mostraNovo])

  const valorPrest = num(form.valor_prestacao)
  const tributado  = ['00', '20', '90'].includes(form.icms_cst)
  const valorIcms  = tributado ? Math.round(valorPrest * num(form.icms_aliquota)) / 100 : 0

  function validar(): string | null {
    if (!form.tipo) return 'Selecione o tipo de CT-e (Normal ou Redespacho).'
    for (const [nome, p] of [['Remetente', form.remetente], ['Destinatário', form.destinatario]] as const) {
      if (!p.nome.trim()) return `${nome}: preencha o nome.`
      if (soDigitos(p.cnpj).length !== 14) return `${nome}: CNPJ precisa ter 14 dígitos.`
      if (!p.logradouro.trim() || !p.bairro.trim()) return `${nome}: preencha rua e bairro.`
      if (!p.cod_municipio) return `${nome}: escolha a cidade na lista.`
    }
    if (!/^\d{4}$/.test(form.cfop)) return 'CFOP precisa ter 4 dígitos.'
    if (valorPrest <= 0) return 'Informe o valor da prestação.'
    if (tributado && num(form.icms_aliquota) <= 0) return 'Informe a alíquota de ICMS.'
    if (num(form.carga_valor) <= 0) return 'Informe o valor da carga.'
    if (!form.carga_produto.trim()) return 'Informe o produto predominante.'
    if (num(form.carga_peso) <= 0) return 'Informe o peso da carga (kg).'
    const chaves = form.chaves_nfe.split(/\s+/).map(soDigitos).filter(Boolean)
    if (chaves.some(c => c.length !== 44)) return 'Cada chave de NF-e precisa ter 44 dígitos.'
    return null
  }

  function montarPayload() {
    const tomador = form.tomador === '3' ? form.destinatario : form.remetente
    const chaves = form.chaves_nfe.split(/\s+/).map(soDigitos).filter(Boolean)
    const dados_fiscais = {
      cfop: form.cfop,
      natureza_operacao: form.natureza_operacao,
      tomador: Number(form.tomador),
      remetente: parteParaApi(form.remetente),
      destinatario: parteParaApi(form.destinatario),
      inicio: { cod: form.remetente.cod_municipio, nome: form.remetente.municipio, uf: form.remetente.uf },
      fim: { cod: form.destinatario.cod_municipio, nome: form.destinatario.municipio, uf: form.destinatario.uf },
      valor_prestacao: valorPrest,
      componentes: [{ nome: 'FRETE', valor: valorPrest }],
      icms: {
        cst: form.icms_cst,
        base: tributado ? valorPrest : 0,
        aliquota: tributado ? num(form.icms_aliquota) : 0,
        valor: valorIcms,
      },
      ibscbs: {},
      carga: {
        valor: num(form.carga_valor),
        produto_predominante: form.carga_produto.trim(),
        quantidades: [{ unidade: '01', tipo_medida: 'PESO BRUTO', quantidade: num(form.carga_peso) }],
      },
      chaves_nfe: chaves,
      observacoes: form.obs || undefined,
    }
    const payload: any = {
      tipo: form.tipo,
      remetente_nome: form.remetente.nome, remetente_cnpj: soDigitos(form.remetente.cnpj),
      destinatario_nome: form.destinatario.nome, destinatario_cnpj: soDigitos(form.destinatario.cnpj),
      tomador_nome: tomador.nome, tomador_cnpj: soDigitos(tomador.cnpj),
      origem: `${form.remetente.municipio}/${form.remetente.uf}`,
      destino: `${form.destinatario.municipio}/${form.destinatario.uf}`,
      valor_prestacao: valorPrest,
      natureza_operacao: form.natureza_operacao,
      placa: form.placa, motorista: form.motorista,
      obs: form.obs,
      dados_fiscais,
    }
    if (!editandoId) payload.status = 'rascunho'
    if (form.tipo === 'redespacho') {
      payload.cte_anterior_chave = soDigitos(form.cte_anterior_chave)
      payload.redespachante_nome = form.redespachante_nome
      payload.redespachante_cnpj = soDigitos(form.redespachante_cnpj)
    }
    return payload
  }

  // Cria (POST) ou atualiza (PUT) e devolve o id do registro
  async function gravar(): Promise<string> {
    const payload = montarPayload()
    if (editandoId) {
      await chamar(`/api/ctes/${editandoId}`, { method: 'PUT', body: JSON.stringify(payload) })
      return editandoId
    }
    const criado = await chamar('/api/ctes', { method: 'POST', body: JSON.stringify(payload) })
    const registro = Array.isArray(criado) ? criado[0] : criado
    setEditandoId(registro.id) // se a emissão falhar, o próximo clique atualiza em vez de duplicar
    return registro.id
  }

  async function salvarRascunho() {
    if (!form.tipo) { setErro('Selecione o tipo de CT-e (Normal ou Redespacho).'); return }
    setSalvando(true); setErro('')
    try {
      await gravar()
      showMsg('✅ Rascunho de CT-e salvo!')
      limparDraft('cte_novo_v2')
      fecharNovo()
      await fetchCtes()
    } catch (e: any) {
      setErro('Erro ao salvar: ' + (e?.message || 'erro desconhecido'))
    } finally {
      setSalvando(false)
    }
  }

  function mensagemResultado(r: any) {
    if (r?.status === 'autorizado') return `✅ CT-e nº ${r.numero} autorizado! Protocolo ${r.protocolo}`
    return null
  }

  async function emitir() {
    const problema = validar()
    if (problema) { setErro(problema); return }
    if (form.tipo === 'redespacho') {
      setErro('A emissão de redespacho entra na próxima etapa. Salve como rascunho por enquanto.')
      return
    }
    setEmitindo(true); setErro('')
    try {
      const id = await gravar()
      const r = await chamar(`/api/ctes/${id}/emitir`, { method: 'POST' })
      const ok = mensagemResultado(r)
      if (ok) {
        showMsg(ok)
        limparDraft('cte_novo_v2')
        fecharNovo()
      } else {
        setErro(`SEFAZ rejeitou: ${r?.cStat || ''} - ${r?.motivo || 'motivo não informado'}. Corrija e clique em Emitir de novo.`)
      }
    } catch (e: any) {
      setErro(e?.message || 'Erro ao emitir.')
    } finally {
      setEmitindo(false)
      await fetchCtes()
    }
  }

  async function emitirExistente(c: Cte) {
    setAcaoId(c.id); setErro('')
    try {
      const r = await chamar(`/api/ctes/${c.id}/emitir`, { method: 'POST' })
      const ok = mensagemResultado(r)
      if (ok) { showMsg(ok); setVisualizando(null) }
      else setErro(`SEFAZ rejeitou: ${r?.cStat || ''} - ${r?.motivo || ''}`)
    } catch (e: any) {
      setErro(e?.message || 'Erro ao emitir.')
    } finally {
      setAcaoId(null)
      await fetchCtes()
    }
  }

  async function consultar(c: Cte) {
    setAcaoId(c.id); setErro('')
    try {
      const r = await chamar(`/api/ctes/${c.id}/consultar`, { method: 'POST' })
      showMsg(`SEFAZ: ${r?.cStat} - ${r?.motivo}`)
    } catch (e: any) {
      setErro(e?.message || 'Erro ao consultar.')
    } finally {
      setAcaoId(null)
    }
  }

  async function baixarXml(c: Cte) {
    setErro('')
    try {
      const r = await chamar(`/api/ctes/${c.id}/xml`)
      if (r?.url) window.open(r.url, '_blank')
    } catch (e: any) {
      setErro(e?.message || 'Erro ao baixar o XML.')
    }
  }

  async function cancelar(id: string) {
    setErro('')
    try {
      await chamar(`/api/ctes/${id}/cancelar`, { method: 'POST' })
      showMsg('✅ CT-e cancelado.')
      setCancelandoId(null)
      setVisualizando(null)
      await fetchCtes()
    } catch (e: any) {
      setErro(e?.message || 'Cancelamento ainda não está disponível.')
      setCancelandoId(null)
    }
  }

  const totalAutorizados = useMemo(() => ctes.filter(c => c.status === 'autorizado').length, [ctes])
  const totalRascunhos    = useMemo(() => ctes.filter(c => c.status === 'rascunho' || c.status === 'rejeitado').length, [ctes])
  const totalValor        = useMemo(() => ctes.filter(c => c.status === 'autorizado').reduce((s, c) => s + (c.valor_prestacao || 0), 0), [ctes])

  return (
    <div ref={containerRef} className="p-6 max-w-6xl mx-auto space-y-6">
      {msg && (
        <div className="fixed top-6 right-6 z-[70] p-4 bg-green-600 text-white rounded-2xl shadow-2xl font-bold text-xs uppercase">
          {msg}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">CT-e</h1>
        </div>
        <button onClick={abrirNovo}
          className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl text-sm font-bold uppercase transition">
          <Plus size={16}/> Novo CT-e
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Autorizados</p>
          <p className="text-2xl font-black text-green-600">{totalAutorizados}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Rascunhos / Rejeitados</p>
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
                <th className="px-5 py-3 text-left text-[10px] font-black text-gray-400 uppercase">Nº</th>
                <th className="px-5 py-3 text-left text-[10px] font-black text-gray-400 uppercase">Tomador</th>
                <th className="px-5 py-3 text-left text-[10px] font-black text-gray-400 uppercase">Rota</th>
                <th className="px-5 py-3 text-left text-[10px] font-black text-gray-400 uppercase">Data</th>
                <th className="px-5 py-3 text-right text-[10px] font-black text-gray-400 uppercase">Valor</th>
                <th className="px-5 py-3 text-right text-[10px] font-black text-gray-400 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {ctes.map(c => (
                <tr key={c.id} onClick={() => { setErro(''); setVisualizando(c) }} className="cursor-pointer hover:bg-gray-50 transition">
                  <td className="px-5 py-3 text-xs font-bold text-gray-700">
                    {c.numero_cte || '—'}
                    {c.ambiente === '2' && <span className="ml-1 text-[9px] font-black text-orange-600">HOMOLOG.</span>}
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
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden max-h-[92vh] flex flex-col">
            <div className="px-6 py-5 bg-gray-900 flex items-center justify-between shrink-0">
              <h2 className="text-white font-black text-lg">{editandoId ? 'Corrigir CT-e' : 'Novo CT-e'}</h2>
              <button onClick={fecharNovo} className="text-white/70 hover:text-white"><X size={22}/></button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4">
              {erro && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm font-bold">
                  <AlertCircle size={16} className="shrink-0 mt-0.5"/> {erro}
                </div>
              )}

              <div>
                <label className={LC}>Tipo de CT-e *</label>
                <div className="grid grid-cols-2 gap-3 mt-1">
                  <button type="button" onClick={() => setForm(prev => ({ ...prev, tipo: 'normal' }))}
                    className={`p-4 rounded-xl border-2 text-left transition ${form.tipo === 'normal' ? 'border-red-500 bg-red-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                    <p className="font-black text-sm text-gray-900">Normal</p>
                    <p className="text-xs text-gray-500 mt-1">Frete direto, remetente e destinatário reais da carga.</p>
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
                  <BlocoParte titulo="Remetente (onde a carga sai)" parte={form.remetente} clientes={clientes}
                    onChange={p => setForm(prev => ({ ...prev, remetente: p }))}/>
                  <BlocoParte titulo="Destinatário (onde a carga chega)" parte={form.destinatario} clientes={clientes}
                    onChange={p => setForm(prev => ({ ...prev, destinatario: p }))}/>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className={LC}>Quem paga o frete *</label>
                      <select name="tomador" value={form.tomador} onChange={handle} className={IC}>
                        <option value="0">Remetente</option>
                        <option value="3">Destinatário</option>
                      </select>
                    </div>
                    <div>
                      <label className={LC}>CFOP *</label>
                      <input name="cfop" value={form.cfop} onChange={handle} maxLength={4} className={IC}/>
                      <p className="text-[10px] text-gray-400 mt-1">{interestadual ? 'Sugestão: 6353 (outro estado)' : 'Sugestão: 5353 (mesmo estado)'}</p>
                    </div>
                    <div>
                      <label className={LC}>Natureza da Operação</label>
                      <input name="natureza_operacao" value={form.natureza_operacao} onChange={handle} className={IC}/>
                    </div>
                  </div>

                  {form.tipo === 'redespacho' && (
                    <div className="bg-purple-50 border border-purple-100 rounded-xl p-4 space-y-3">
                      <p className="text-xs font-black text-purple-700 uppercase tracking-widest">Dados do Redespacho</p>
                      <div>
                        <label className={LC}>Chave de Acesso do CT-e Anterior (44 dígitos)</label>
                        <input name="cte_anterior_chave" value={form.cte_anterior_chave} onChange={handle} maxLength={54} className={IC}/>
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

                  <div className="border border-gray-100 rounded-xl p-4 space-y-3">
                    <p className="text-xs font-black text-gray-700 uppercase tracking-widest">Valores e ICMS</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={LC}>Valor do Frete (R$) *</label>
                        <input name="valor_prestacao" type="number" step="0.01" value={form.valor_prestacao} onChange={handle} className={IC}/>
                      </div>
                      <div>
                        <label className={LC}>CST do ICMS *</label>
                        <select name="icms_cst" value={form.icms_cst} onChange={handle} className={IC}>
                          {CSTS.map(c => <option key={c.v} value={c.v}>{c.t}</option>)}
                        </select>
                      </div>
                    </div>
                    {tributado && (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className={LC}>Alíquota ICMS (%) *</label>
                          <input name="icms_aliquota" type="number" step="0.01" value={form.icms_aliquota} onChange={handle} className={IC}
                            placeholder={interestadual ? 'Ex.: 12 ou 7' : 'Ex.: 18'}/>
                        </div>
                        <div>
                          <label className={LC}>Valor do ICMS</label>
                          <p className="mt-1 px-3 py-2.5 text-sm font-black text-gray-900">{fmtValor(valorIcms)}</p>
                        </div>
                      </div>
                    )}
                    <p className="text-[10px] text-gray-400">
                      IBS/CBS (Reforma Tributária) é preenchido automaticamente com as alíquotas de teste de 2026. Confirme CST, alíquota e CFOP com o contador.
                    </p>
                  </div>

                  <div className="border border-gray-100 rounded-xl p-4 space-y-3">
                    <p className="text-xs font-black text-gray-700 uppercase tracking-widest">Carga</p>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className={LC}>Valor da Carga (R$) *</label>
                        <input name="carga_valor" type="number" step="0.01" value={form.carga_valor} onChange={handle} className={IC}/>
                      </div>
                      <div>
                        <label className={LC}>Produto *</label>
                        <input name="carga_produto" value={form.carga_produto} onChange={handle} className={IC} placeholder="Ex.: BOBINAS DE ACO"/>
                      </div>
                      <div>
                        <label className={LC}>Peso (kg) *</label>
                        <input name="carga_peso" type="number" step="0.001" value={form.carga_peso} onChange={handle} className={IC}/>
                      </div>
                    </div>
                    <div>
                      <label className={LC}>Chaves das NF-e transportadas (uma por linha)</label>
                      <textarea name="chaves_nfe" value={form.chaves_nfe} onChange={handle} rows={3} className={IC + ' font-mono text-xs'}
                        placeholder="44 dígitos cada"/>
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

                  <div>
                    <label className={LC}>Observações (saem no CT-e)</label>
                    <textarea name="obs" value={form.obs} onChange={handle} rows={2} className={IC}/>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button onClick={salvarRascunho} disabled={salvando || emitindo}
                      className="flex-1 flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-800 text-white py-3 rounded-xl text-sm font-bold uppercase transition disabled:opacity-50">
                      {salvando ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>} Salvar Rascunho
                    </button>
                    <button onClick={emitir} disabled={emitindo || salvando}
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
              ${visualizando.status === 'autorizado' ? 'bg-green-600' : visualizando.status === 'rejeitado' ? 'bg-red-600' : visualizando.status === 'cancelado' ? 'bg-gray-600' : visualizando.status === 'processando' ? 'bg-blue-600' : 'bg-yellow-600'}`}>
              <div>
                <h2 className="text-white font-black text-lg">CT-e {visualizando.tipo === 'redespacho' ? '(Redespacho)' : '(Normal)'}</h2>
                <p className="text-white/80 text-xs mt-0.5">
                  {visualizando.numero_cte ? `Nº ${visualizando.numero_cte}` : 'Rascunho, ainda não emitido'}
                  {visualizando.ambiente === '2' && ' · HOMOLOGAÇÃO (sem valor fiscal)'}
                </p>
              </div>
              <button onClick={() => setVisualizando(null)} className="text-white/70 hover:text-white"><X size={22}/></button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4">
              {erro && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm font-bold">
                  <AlertCircle size={16} className="shrink-0 mt-0.5"/> {erro}
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
              {visualizando.chave_acesso && (
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className={LC}>Chave de Acesso</p>
                  <p className="font-mono text-xs break-all">{visualizando.chave_acesso}</p>
                  {visualizando.protocolo && <p className="text-xs text-gray-500 mt-1">Protocolo {visualizando.protocolo}</p>}
                </div>
              )}
              {visualizando.motivo_rejeicao && visualizando.status !== 'autorizado' && (
                <div className="bg-red-50 border border-red-100 rounded-xl p-4">
                  <p className={LC + ' text-red-500'}>Motivo da Rejeição</p>
                  <p className="text-sm text-red-700 font-bold break-words">{visualizando.motivo_rejeicao}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                {(visualizando.status === 'rascunho' || visualizando.status === 'rejeitado') && (
                  <>
                    <button onClick={() => abrirEdicao(visualizando)}
                      className="flex items-center justify-center gap-2 bg-gray-100 text-gray-700 py-3 rounded-xl text-sm font-bold uppercase hover:bg-gray-200 transition">
                      <Pencil size={16}/> Corrigir
                    </button>
                    <button onClick={() => emitirExistente(visualizando)} disabled={acaoId === visualizando.id || !visualizando.dados_fiscais}
                      title={!visualizando.dados_fiscais ? 'Clique em Corrigir e preencha os dados fiscais' : ''}
                      className="flex items-center justify-center gap-2 bg-red-600 text-white py-3 rounded-xl text-sm font-bold uppercase hover:bg-red-700 transition disabled:opacity-50">
                      {acaoId === visualizando.id ? <Loader2 size={16} className="animate-spin"/> : <Send size={16}/>} Emitir
                    </button>
                  </>
                )}
                {visualizando.status === 'processando' && (
                  <button onClick={() => consultar(visualizando)} disabled={acaoId === visualizando.id}
                    className="col-span-2 flex items-center justify-center gap-2 bg-blue-600 text-white py-3 rounded-xl text-sm font-bold uppercase hover:bg-blue-700 transition disabled:opacity-50">
                    {acaoId === visualizando.id ? <Loader2 size={16} className="animate-spin"/> : <RefreshCw size={16}/>} Consultar na SEFAZ
                  </button>
                )}
                {visualizando.status === 'autorizado' && (
                  <>
                    <button onClick={() => baixarXml(visualizando)}
                      className="flex items-center justify-center gap-2 bg-gray-900 text-white py-3 rounded-xl text-sm font-bold uppercase hover:bg-black transition">
                      <Download size={16}/> Baixar XML
                    </button>
                    <button onClick={() => setCancelandoId(visualizando.id)}
                      className="flex items-center justify-center gap-2 bg-gray-100 text-gray-700 py-3 rounded-xl text-sm font-bold uppercase hover:bg-gray-200 transition">
                      <Ban size={16}/> Cancelar CT-e
                    </button>
                  </>
                )}
              </div>
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
