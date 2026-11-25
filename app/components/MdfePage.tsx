'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../services/supabase'
import {
  Plus, Save, X, AlertCircle, Loader2, CheckCircle2, Ban, Truck, User,
  Download, RefreshCw, Pencil, Send, Trash2, Flag, Search, FileText,
} from 'lucide-react'

// ---------------------------------------------------------------- tipos
interface CteResumo {
  id: string; numero_cte: string; status: string; chave_acesso: string
  origem: string; destino: string; remetente_nome: string; destinatario_nome: string
  placa: string; motorista: string; valor_prestacao: number; dados_fiscais: any; created_at: string
}
interface Mdfe {
  id: string; status: string; numero: string; chave_acesso: string; protocolo: string
  motivo_rejeicao: string; placa: string; motorista: string; uf_ini: string; uf_fim: string
  cte_ids: string[]; dados_fiscais: any; obs: string; created_at: string; encerrado_em: string
}
interface Reboque { placa: string; renavam: string; tara: string; cap_kg: string; tp_car: string; uf: string }
interface Condutor { nome: string; cpf: string }

const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']
const CNPJ_ROESEL = '66330549000152'

const TP_ROD = [
  { v: '01', t: 'Truck' }, { v: '02', t: 'Toco' }, { v: '03', t: 'Cavalo mecânico' },
  { v: '04', t: 'VAN' }, { v: '05', t: 'Utilitário' }, { v: '06', t: 'Outros' },
]
const TP_CAR = [
  { v: '00', t: 'Não aplicável' }, { v: '01', t: 'Aberta' }, { v: '02', t: 'Fechada / baú' },
  { v: '03', t: 'Granelera' }, { v: '04', t: 'Porta container' }, { v: '05', t: 'Sider' },
]
const TP_CARGA = [
  { v: '05', t: 'Carga geral' }, { v: '01', t: 'Granel sólido' }, { v: '02', t: 'Granel líquido' },
  { v: '03', t: 'Frigorificada' }, { v: '04', t: 'Conteinerizada' }, { v: '06', t: 'Neogranel' },
  { v: '07', t: 'Perigosa (granel sólido)' }, { v: '08', t: 'Perigosa (granel líquido)' },
  { v: '09', t: 'Perigosa (frigorificada)' }, { v: '10', t: 'Perigosa (conteinerizada)' },
  { v: '11', t: 'Perigosa (carga geral)' }, { v: '12', t: 'Granel pressurizada' },
]

const REBOQUE_VAZIO: Reboque = { placa: '', renavam: '', tara: '', cap_kg: '', tp_car: '01', uf: 'MG' }

const FORM_INICIAL = {
  cte_ids: [] as string[],
  placa: '', renavam: '', tara: '', cap_kg: '', tp_rod: '03', tp_car: '00', uf_veiculo: 'MG',
  reboques: [] as Reboque[],
  condutores: [{ nome: '', cpf: '' }] as Condutor[],
  percurso: '',
  ciot: '', ciot_cnpj: CNPJ_ROESEL,
  tipo_carga: '05',
  obs: '',
}
type Form = typeof FORM_INICIAL

const IC = "mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-gray-50"
const LC = "text-xs font-semibold text-gray-500 uppercase tracking-wide"

const soDigitos = (v: string) => (v || '').replace(/\D/g, '')
const soPlaca = (v: string) => (v || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
const num = (v: any) => { const n = parseFloat(String(v ?? '').replace(',', '.')); return isNaN(n) ? 0 : n }
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const STATUS: Record<string, { t: string; c: string }> = {
  rascunho:    { t: 'Rascunho',    c: 'bg-gray-100 text-gray-600' },
  processando: { t: 'Enviando',    c: 'bg-yellow-100 text-yellow-700' },
  autorizado:  { t: 'Autorizado',  c: 'bg-green-100 text-green-700' },
  rejeitado:   { t: 'Rejeitado',   c: 'bg-red-100 text-red-700' },
  encerrado:   { t: 'Encerrado',   c: 'bg-blue-100 text-blue-700' },
  cancelado:   { t: 'Cancelado',   c: 'bg-gray-200 text-gray-500' },
}

// Peso em kg do CT-e (soma as quantidades em KG e TON)
function pesoCte(c: CteResumo): number {
  const q = c.dados_fiscais?.carga?.quantidades || []
  return q.reduce((s: number, x: any) => s + (x.unidade === '02' ? num(x.quantidade) * 1000 : x.unidade === '01' ? num(x.quantidade) : 0), 0)
}

export default function MdfePage() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [mdfes, setMdfes]             = useState<Mdfe[]>([])
  const [ctes, setCtes]               = useState<CteResumo[]>([])
  const [motoristas, setMotoristas]   = useState<any[]>([])
  const [caminhoes, setCaminhoes]     = useState<any[]>([])
  const [carregando, setCarregando]   = useState(false)
  const [mostraForm, setMostraForm]   = useState(false)
  const [editandoId, setEditandoId]   = useState<string | null>(null)
  const [form, setForm]               = useState<Form>(FORM_INICIAL)
  const [salvando, setSalvando]       = useState(false)
  const [acaoId, setAcaoId]           = useState<string | null>(null)
  const [erro, setErro]               = useState('')
  const [msg, setMsg]                 = useState('')
  const [cancelando, setCancelando]   = useState<Mdfe | null>(null)
  const [justificativa, setJustificativa] = useState('')
  const [abertos, setAbertos]         = useState<any>(null)

  async function chamar(url: string, opcoes: RequestInit = {}) {
    const { data } = await supabase.auth.getSession()
    const token = data?.session?.access_token
    if (!token) throw new Error('Sessão expirada. Atualize a página e faça login novamente.')
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

  function showMsg(t: string) { setMsg(t); setTimeout(() => setMsg(''), 6000) }

  async function carregar() {
    setCarregando(true)
    try {
      const [m, c] = await Promise.all([chamar('/api/mdfes'), chamar('/api/ctes')])
      setMdfes(Array.isArray(m) ? m : [])
      setCtes(Array.isArray(c) ? c : [])
    } catch (e: any) {
      setErro(e?.message || 'Erro ao carregar.')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregar()
    supabase.from('motoristas').select('id, nome, cpf').eq('ativo', true).order('nome').then(({ data }) => data && setMotoristas(data))
    supabase.from('caminhoes').select('id, placa, placa_carreta, motorista_atual').order('placa').then(({ data }) => data && setCaminhoes(data))
    // Recarrega quando a aba volta a aparecer
    const el = containerRef.current?.parentElement
    if (!el) return
    const obs = new MutationObserver(() => { if (el.style.display !== 'none') carregar() })
    obs.observe(el, { attributes: true, attributeFilter: ['style'] })
    return () => obs.disconnect()
  }, [])

  // CT-es autorizados que ainda não estão em outro MDF-e ativo
  const ctesDisponiveis = useMemo(() => {
    const ocupados = new Set<string>()
    for (const m of mdfes) {
      if (m.id === editandoId) continue
      if (['rascunho', 'rejeitado', 'cancelado'].includes(m.status)) continue
      for (const id of m.cte_ids || []) ocupados.add(id)
    }
    return ctes.filter(c => c.status === 'autorizado' && !ocupados.has(c.id))
  }, [ctes, mdfes, editandoId])

  const escolhidos = useMemo(() => form.cte_ids.map(id => ctes.find(c => c.id === id)).filter(Boolean) as CteResumo[], [form.cte_ids, ctes])
  const ufIni = escolhidos[0]?.dados_fiscais?.inicio?.uf || ''
  const ufFim = escolhidos[0]?.dados_fiscais?.fim?.uf || ''
  const totalCarga = escolhidos.reduce((s, c) => s + num(c.dados_fiscais?.carga?.valor), 0)
  const totalPeso = escolhidos.reduce((s, c) => s + pesoCte(c), 0)

  // ---------------------------------------------------------------- veículo
  async function carregarVeiculo(placa: string): Promise<any> {
    const p = soPlaca(placa)
    if (p.length < 7) return {}
    try { return await chamar(`/api/mdfes/fiscal/veiculos/${p}`) } catch { return {} }
  }

  async function escolherCaminhao(placa: string) {
    const cam = caminhoes.find(c => c.placa === placa)
    const v = await carregarVeiculo(placa)
    let reboques: Reboque[] = form.reboques
    if (cam?.placa_carreta) {
      const r = await carregarVeiculo(cam.placa_carreta)
      reboques = [{
        placa: soPlaca(cam.placa_carreta), renavam: r.renavam || '', tara: r.tara ? String(r.tara) : '',
        cap_kg: r.cap_kg ? String(r.cap_kg) : '', tp_car: r.tp_car || '01', uf: r.uf || 'MG',
      }]
    }
    const mot = cam?.motorista_atual ? motoristas.find(m => m.nome === cam.motorista_atual) : null
    setForm(prev => ({
      ...prev,
      placa: soPlaca(placa),
      renavam: v.renavam || '', tara: v.tara ? String(v.tara) : '', cap_kg: v.cap_kg ? String(v.cap_kg) : '',
      tp_rod: v.tp_rod || prev.tp_rod, tp_car: v.tp_car || prev.tp_car, uf_veiculo: v.uf || 'MG',
      reboques,
      condutores: mot && !prev.condutores.some(c => c.nome) ? [{ nome: mot.nome, cpf: mot.cpf || '' }] : prev.condutores,
    }))
  }

  // Ao marcar o primeiro CT-e, puxa caminhão e motorista dele
  function alternarCte(c: CteResumo) {
    const marcado = form.cte_ids.includes(c.id)
    setForm(prev => ({ ...prev, cte_ids: marcado ? prev.cte_ids.filter(i => i !== c.id) : [...prev.cte_ids, c.id] }))
    if (!marcado && form.cte_ids.length === 0) {
      if (c.placa && !form.placa) escolherCaminhao(c.placa)
      if (c.motorista && !form.condutores.some(x => x.nome)) {
        const m = motoristas.find(x => x.nome === c.motorista)
        if (m) setForm(prev => ({ ...prev, condutores: [{ nome: m.nome, cpf: m.cpf || '' }] }))
      }
    }
  }

  // ---------------------------------------------------------------- form
  function abrirNovo() {
    setForm(FORM_INICIAL); setEditandoId(null); setErro(''); setMostraForm(true)
  }

  function abrirEdicao(m: Mdfe) {
    const d = m.dados_fiscais || {}
    const v = d.veiculo || {}
    setForm({
      ...FORM_INICIAL,
      cte_ids: m.cte_ids || [],
      placa: v.placa || m.placa || '', renavam: v.renavam || '', tara: v.tara ? String(v.tara) : '',
      cap_kg: v.cap_kg ? String(v.cap_kg) : '', tp_rod: v.tp_rod || '03', tp_car: v.tp_car || '00', uf_veiculo: v.uf || 'MG',
      reboques: (d.reboques || []).map((r: any) => ({
        placa: r.placa || '', renavam: r.renavam || '', tara: String(r.tara ?? ''), cap_kg: String(r.cap_kg ?? ''),
        tp_car: r.tp_car || '01', uf: r.uf || 'MG',
      })),
      condutores: (d.condutores?.length ? d.condutores : [{ nome: m.motorista || '', cpf: '' }]).map((c: any) => ({ nome: c.nome || '', cpf: c.cpf || '' })),
      percurso: (d.percurso || []).join(', '),
      ciot: d.ciots?.[0]?.numero || '', ciot_cnpj: d.ciots?.[0]?.cnpj_cpf || CNPJ_ROESEL,
      tipo_carga: d.tipo_carga || '05',
      obs: d.observacoes || m.obs || '',
    })
    setEditandoId(m.id); setErro(''); setMostraForm(true)
  }

  function fechar() { setMostraForm(false); setEditandoId(null); setErro('') }

  function handle(e: any) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  const percursoLista = form.percurso.toUpperCase().split(/[\s,;/]+/).filter(Boolean)

  function validar(): string | null {
    if (escolhidos.length === 0) return 'Marque pelo menos um CT-e autorizado.'
    if (new Set(escolhidos.map(c => c.dados_fiscais?.inicio?.uf)).size > 1) return 'Os CT-es começam em estados diferentes. Faça um MDF-e para cada estado de carregamento.'
    if (new Set(escolhidos.map(c => c.dados_fiscais?.fim?.uf)).size > 1) return 'Os CT-es terminam em estados diferentes. Faça um MDF-e para cada estado de descarga.'
    if (soPlaca(form.placa).length !== 7) return 'Placa do caminhão inválida.'
    if (num(form.tara) <= 0) return 'Informe a tara do caminhão (kg).'
    for (const r of form.reboques) {
      if (soPlaca(r.placa).length !== 7) return 'Placa da carreta inválida.'
      if (num(r.tara) <= 0 || num(r.cap_kg) <= 0) return `Carreta ${r.placa}: informe tara e capacidade (kg).`
    }
    if (form.condutores.length === 0 || form.condutores.some(c => !c.nome.trim())) return 'Informe o motorista.'
    if (form.condutores.some(c => soDigitos(c.cpf).length !== 11)) return 'CPF do motorista precisa ter 11 dígitos (confira o cadastro do motorista).'
    if (percursoLista.some(u => !UFS.includes(u))) return 'Percurso: use as siglas dos estados separadas por vírgula (ex.: SP, PR).'
    if (form.ciot && soDigitos(form.ciot).length !== 12) return 'O CIOT precisa ter 12 dígitos.'
    if (form.ciot && ![11, 14].includes(soDigitos(form.ciot_cnpj).length)) return 'Informe o CNPJ de quem gerou o CIOT.'
    return null
  }

  function montarPayload() {
    const dados_fiscais = {
      veiculo: {
        placa: soPlaca(form.placa), renavam: soDigitos(form.renavam) || undefined, tara: Math.round(num(form.tara)),
        cap_kg: num(form.cap_kg) ? Math.round(num(form.cap_kg)) : undefined, tp_rod: form.tp_rod, tp_car: form.tp_car, uf: form.uf_veiculo,
      },
      reboques: form.reboques.map(r => ({
        placa: soPlaca(r.placa), renavam: soDigitos(r.renavam) || undefined, tara: Math.round(num(r.tara)),
        cap_kg: Math.round(num(r.cap_kg)), tp_car: r.tp_car, uf: r.uf,
      })),
      condutores: form.condutores.map(c => ({ nome: c.nome.trim(), cpf: soDigitos(c.cpf) })),
      percurso: percursoLista.filter(u => u !== ufIni && u !== ufFim),
      ciots: form.ciot ? [{ numero: soDigitos(form.ciot), cnpj_cpf: soDigitos(form.ciot_cnpj) }] : [],
      tipo_carga: form.tipo_carga,
      observacoes: form.obs || undefined,
    }
    return {
      placa: soPlaca(form.placa), motorista: form.condutores[0]?.nome || '',
      cte_ids: form.cte_ids, uf_ini: ufIni, uf_fim: ufFim, obs: form.obs, dados_fiscais,
    }
  }

  // Guarda tara/RENAVAM por placa, para a próxima viagem vir preenchido
  async function lembrarVeiculos() {
    const salvar = (placa: string, v: any) => chamar(`/api/mdfes/fiscal/veiculos/${placa}`, { method: 'PUT', body: JSON.stringify(v) }).catch(() => {})
    await Promise.all([
      salvar(soPlaca(form.placa), {
        renavam: soDigitos(form.renavam) || null, tara: Math.round(num(form.tara)) || null,
        cap_kg: Math.round(num(form.cap_kg)) || null, tp_rod: form.tp_rod, tp_car: form.tp_car, uf: form.uf_veiculo,
      }),
      ...form.reboques.map(r => salvar(soPlaca(r.placa), {
        renavam: soDigitos(r.renavam) || null, tara: Math.round(num(r.tara)) || null,
        cap_kg: Math.round(num(r.cap_kg)) || null, tp_car: r.tp_car, uf: r.uf,
      })),
    ])
  }

  async function gravar(): Promise<string> {
    const payload = montarPayload()
    await lembrarVeiculos()
    if (editandoId) {
      await chamar(`/api/mdfes/${editandoId}`, { method: 'PUT', body: JSON.stringify(payload) })
      return editandoId
    }
    const r = await chamar('/api/mdfes', { method: 'POST', body: JSON.stringify(payload) })
    const id = Array.isArray(r) ? r[0]?.id : r?.id
    if (!id) throw new Error('O backend não devolveu o id do MDF-e.')
    setEditandoId(id)
    return id
  }

  async function salvarRascunho() {
    const e = validar(); if (e) { setErro(e); return }
    setSalvando(true); setErro('')
    try { await gravar(); showMsg('Rascunho salvo.'); fechar(); carregar() }
    catch (e: any) { setErro(e?.message || 'Erro ao salvar.') }
    finally { setSalvando(false) }
  }

  async function emitir() {
    const e = validar(); if (e) { setErro(e); return }
    setSalvando(true); setErro('')
    try {
      const id = await gravar()
      const r = await chamar(`/api/mdfes/${id}/emitir`, { method: 'POST' })
      if (r?.status === 'autorizado') { showMsg(`MDF-e ${r.numero} autorizado.`); fechar() }
      else setErro(`SEFAZ recusou: ${r?.cStat} - ${r?.motivo}`)
      carregar()
    } catch (e: any) {
      setErro(e?.message || 'Erro ao emitir.'); carregar()
    } finally { setSalvando(false) }
  }

  // ---------------------------------------------------------------- ações da lista
  async function acao(m: Mdfe, tipo: 'emitir' | 'consultar' | 'encerrar' | 'xml' | 'pdf' | 'excluir') {
    if (tipo === 'encerrar' && !confirm(`Encerrar o MDF-e ${m.numero}? Faça isso quando a carga já foi entregue.`)) return
    if (tipo === 'excluir' && !confirm('Apagar este MDF-e?')) return
    setAcaoId(m.id); setErro('')
    try {
      if (tipo === 'xml' || tipo === 'pdf') {
        const r = await chamar(`/api/mdfes/${m.id}/${tipo === 'pdf' ? 'damdfe' : 'xml'}`)
        if (r?.url) window.open(r.url, '_blank')
      } else if (tipo === 'excluir') {
        await chamar(`/api/mdfes/${m.id}`, { method: 'DELETE' })
        showMsg('MDF-e apagado.')
      } else {
        const r = await chamar(`/api/mdfes/${m.id}/${tipo}`, { method: 'POST' })
        if (tipo === 'emitir') r?.status === 'autorizado' ? showMsg(`MDF-e ${r.numero} autorizado.`) : setErro(`SEFAZ recusou: ${r?.cStat} - ${r?.motivo}`)
        if (tipo === 'consultar') showMsg(`SEFAZ: ${r?.cStat} - ${r?.motivo}`)
        if (tipo === 'encerrar') r?.ok ? showMsg('MDF-e encerrado.') : setErro(`SEFAZ recusou o encerramento: ${r?.cStat} - ${r?.motivo}`)
      }
      carregar()
    } catch (e: any) {
      setErro(e?.message || 'Erro.')
    } finally { setAcaoId(null) }
  }

  async function confirmarCancelamento() {
    if (!cancelando) return
    if (justificativa.trim().length < 15) { setErro('A justificativa precisa ter pelo menos 15 letras.'); return }
    setAcaoId(cancelando.id); setErro('')
    try {
      const r = await chamar(`/api/mdfes/${cancelando.id}/cancelar`, { method: 'POST', body: JSON.stringify({ justificativa }) })
      r?.ok ? showMsg('MDF-e cancelado.') : setErro(`SEFAZ recusou o cancelamento: ${r?.cStat} - ${r?.motivo}`)
      setCancelando(null); setJustificativa(''); carregar()
    } catch (e: any) {
      setErro(e?.message || 'Erro ao cancelar.')
    } finally { setAcaoId(null) }
  }

  async function verAbertos() {
    setAcaoId('abertos'); setErro('')
    try { setAbertos(await chamar('/api/mdfes/fiscal/nao-encerrados')) }
    catch (e: any) { setErro(e?.message || 'Erro ao consultar.') }
    finally { setAcaoId(null) }
  }

  const contagem = (s: string) => mdfes.filter(m => m.status === s).length

  // ---------------------------------------------------------------- tela
  return (
    <div ref={containerRef} className="p-6 space-y-6">
      {msg && (
        <div className="fixed top-6 right-6 z-[70] p-4 bg-green-600 text-white rounded-2xl shadow-2xl font-bold text-xs uppercase">{msg}</div>
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">MDF-e</h1>
        <div className="flex gap-2">
          <button onClick={verAbertos} disabled={acaoId === 'abertos'}
            className="flex items-center gap-2 bg-gray-700 hover:bg-gray-800 text-white px-4 py-2 rounded-xl text-sm font-bold uppercase transition disabled:opacity-50">
            {acaoId === 'abertos' ? <Loader2 size={16} className="animate-spin"/> : <Search size={16}/>} Abertos na SEFAZ
          </button>
          <button onClick={abrirNovo}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl text-sm font-bold uppercase transition">
            <Plus size={16}/> Novo MDF-e
          </button>
        </div>
      </div>

      {erro && !mostraForm && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <AlertCircle size={16} className="mt-0.5 shrink-0"/> <span>{erro}</span>
        </div>
      )}

      {abertos && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-sm">
          <div className="flex justify-between items-center mb-2">
            <b>MDF-e abertos na SEFAZ ({abertos.abertos?.length || 0})</b>
            <button onClick={() => setAbertos(null)}><X size={16}/></button>
          </div>
          {abertos.abertos?.length
            ? abertos.abertos.map((a: any) => <p key={a.chave} className="font-mono text-xs">{a.chave} · protocolo {a.protocolo}</p>)
            : <p className="text-gray-500">{abertos.cStat} - {abertos.motivo}</p>}
          <p className="text-xs text-gray-400 mt-2">Um MDF-e aberto para o mesmo caminhão e estado impede emitir outro. Encerre o antigo antes.</p>
        </div>
      )}

      <div className="grid grid-cols-4 gap-4">
        {[['autorizado', 'Em viagem (autorizados)'], ['rascunho', 'Rascunhos'], ['rejeitado', 'Rejeitados'], ['encerrado', 'Encerrados']].map(([s, t]) => (
          <div key={s} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <p className="text-xs text-gray-500 uppercase font-semibold">{t}</p>
            <p className="text-2xl font-black text-gray-900 mt-1">{contagem(s)}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {carregando && mdfes.length === 0 ? (
          <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-gray-400"/></div>
        ) : mdfes.length === 0 ? (
          <p className="p-10 text-center text-sm text-gray-400">Nenhum MDF-e ainda.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="text-left p-3">Nº</th><th className="text-left p-3">Status</th>
                <th className="text-left p-3">Caminhão</th><th className="text-left p-3">Motorista</th>
                <th className="text-left p-3">Trajeto</th><th className="text-left p-3">CT-es</th>
                <th className="text-left p-3">Data</th><th className="text-right p-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {mdfes.map(m => {
                const st = STATUS[m.status] || STATUS.rascunho
                const ocupado = acaoId === m.id
                const editavel = ['rascunho', 'rejeitado'].includes(m.status)
                return (
                  <tr key={m.id} className="border-t border-gray-100 align-top">
                    <td className="p-3 font-bold">{m.numero || '—'}</td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded-lg text-xs font-bold ${st.c}`}>{st.t}</span>
                      {m.status === 'rejeitado' && m.motivo_rejeicao && <p className="text-xs text-red-600 mt-1 max-w-xs">{m.motivo_rejeicao}</p>}
                    </td>
                    <td className="p-3">{m.placa}</td>
                    <td className="p-3">{m.motorista}</td>
                    <td className="p-3">{m.uf_ini} → {m.uf_fim}</td>
                    <td className="p-3">{m.cte_ids?.length || 0}</td>
                    <td className="p-3 text-gray-500">{new Date(m.created_at).toLocaleDateString('pt-BR')}</td>
                    <td className="p-3">
                      <div className="flex justify-end gap-1 flex-wrap">
                        {ocupado && <Loader2 size={16} className="animate-spin text-gray-400"/>}
                        {editavel && <>
                          <BotaoIcone t="Corrigir" onClick={() => abrirEdicao(m)} icon={<Pencil size={14}/>}/>
                          <BotaoIcone t="Emitir" onClick={() => acao(m, 'emitir')} icon={<Send size={14}/>} cor="text-red-600"/>
                          <BotaoIcone t="Apagar" onClick={() => acao(m, 'excluir')} icon={<Trash2 size={14}/>}/>
                        </>}
                        {['processando', 'autorizado'].includes(m.status) &&
                          <BotaoIcone t="Consultar na SEFAZ" onClick={() => acao(m, 'consultar')} icon={<RefreshCw size={14}/>}/>}
                        {m.status === 'autorizado' && <>
                          <BotaoIcone t="Encerrar (carga entregue)" onClick={() => acao(m, 'encerrar')} icon={<Flag size={14}/>} cor="text-blue-600"/>
                          <BotaoIcone t="Cancelar" onClick={() => { setCancelando(m); setJustificativa('') }} icon={<Ban size={14}/>}/>
                        </>}
                        {['autorizado', 'encerrado', 'cancelado'].includes(m.status) &&
                          <>
                            <BotaoIcone t="PDF (DAMDFE)" onClick={() => acao(m, 'pdf')} icon={<FileText size={14}/>} cor="text-red-600"/>
                            <BotaoIcone t="Baixar XML" onClick={() => acao(m, 'xml')} icon={<Download size={14}/>}/>
                          </>}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ------------------------------------------------ cancelamento */}
      {cancelando && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-3">
            <h3 className="font-bold text-lg">Cancelar MDF-e {cancelando.numero}</h3>
            <p className="text-xs text-gray-500">Só dá para cancelar até 24 horas depois da autorização e antes de o caminhão sair. Depois disso, encerre o MDF-e.</p>
            <label className={LC}>Motivo (mínimo 15 letras)</label>
            <textarea value={justificativa} onChange={e => setJustificativa(e.target.value)} rows={3} className={IC}/>
            {erro && <p className="text-sm text-red-600">{erro}</p>}
            <div className="flex gap-2">
              <button onClick={() => { setCancelando(null); setErro('') }} className="flex-1 py-2.5 rounded-xl bg-gray-100 font-bold text-sm">Voltar</button>
              <button onClick={confirmarCancelamento} disabled={acaoId === cancelando.id}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white font-bold text-sm disabled:opacity-50">Cancelar MDF-e</button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------ formulário */}
      {mostraForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-4xl my-6 overflow-hidden">
            <div className="bg-gray-900 px-6 py-4 flex justify-between items-center">
              <h2 className="text-white font-black text-lg">{editandoId ? 'Corrigir MDF-e' : 'Novo MDF-e'}</h2>
              <button onClick={fechar} className="text-white"><X size={20}/></button>
            </div>

            <div className="p-6 space-y-6">
              {/* 1. CT-es */}
              <section className="space-y-2">
                <p className="font-bold text-gray-800">1. CT-es da viagem</p>
                <p className="text-xs text-gray-500">Só aparecem CT-es autorizados que ainda não estão em outro MDF-e. Cidades, carga, NCM, seguro e contratante vêm deles.</p>
                <div className="border border-gray-200 rounded-2xl max-h-64 overflow-y-auto divide-y divide-gray-100">
                  {ctesDisponiveis.length === 0 && <p className="p-4 text-sm text-gray-400">Nenhum CT-e autorizado disponível.</p>}
                  {ctesDisponiveis.map(c => (
                    <label key={c.id} className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer text-sm">
                      <input type="checkbox" checked={form.cte_ids.includes(c.id)} onChange={() => alternarCte(c)}/>
                      <span className="font-bold w-16">{c.numero_cte}</span>
                      <span className="flex-1">{c.origem} → {c.destino}<br/><span className="text-xs text-gray-500">{c.remetente_nome} → {c.destinatario_nome}</span></span>
                      <span className="text-xs text-gray-500 text-right">{c.placa}<br/>{brl(num(c.dados_fiscais?.carga?.valor))}</span>
                    </label>
                  ))}
                </div>
                {escolhidos.length > 0 && (
                  <p className="text-sm text-gray-700">
                    <b>{escolhidos.length}</b> CT-e(s) · <b>{ufIni} → {ufFim}</b> · carga {brl(totalCarga)} · {totalPeso.toLocaleString('pt-BR')} kg
                  </p>
                )}
              </section>

              {/* 2. Veículo */}
              <section className="space-y-3">
                <p className="font-bold text-gray-800"><Truck size={14} className="inline mb-0.5 mr-1"/>2. Caminhão</p>
                <div className="grid grid-cols-4 gap-3">
                  <div>
                    <label className={LC}>Placa</label>
                    <select value={caminhoes.some(c => c.placa === form.placa) ? form.placa : ''} onChange={e => e.target.value && escolherCaminhao(e.target.value)} className={IC}>
                      <option value="">Escolher da frota...</option>
                      {caminhoes.map(c => <option key={c.id} value={c.placa}>{c.placa}</option>)}
                    </select>
                    <input name="placa" value={form.placa} onChange={handle} onBlur={() => form.placa && !form.tara && escolherCaminhao(form.placa)} className={IC} placeholder="ou digite"/>
                  </div>
                  <div><label className={LC}>RENAVAM</label><input name="renavam" value={form.renavam} onChange={handle} className={IC}/></div>
                  <div><label className={LC}>Tara (kg)</label><input name="tara" value={form.tara} onChange={handle} className={IC} inputMode="numeric"/></div>
                  <div><label className={LC}>Capacidade (kg)</label><input name="cap_kg" value={form.cap_kg} onChange={handle} className={IC} inputMode="numeric"/></div>
                  <div>
                    <label className={LC}>Tipo de rodado</label>
                    <select name="tp_rod" value={form.tp_rod} onChange={handle} className={IC}>{TP_ROD.map(o => <option key={o.v} value={o.v}>{o.t}</option>)}</select>
                  </div>
                  <div>
                    <label className={LC}>Carroceria</label>
                    <select name="tp_car" value={form.tp_car} onChange={handle} className={IC}>{TP_CAR.map(o => <option key={o.v} value={o.v}>{o.t}</option>)}</select>
                  </div>
                  <div>
                    <label className={LC}>UF da placa</label>
                    <select name="uf_veiculo" value={form.uf_veiculo} onChange={handle} className={IC}>{UFS.map(u => <option key={u}>{u}</option>)}</select>
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <p className="text-sm font-semibold text-gray-700">Carretas</p>
                  <button type="button" onClick={() => setForm(prev => ({ ...prev, reboques: [...prev.reboques, { ...REBOQUE_VAZIO }] }))}
                    className="text-xs font-bold text-red-600">+ Adicionar carreta</button>
                </div>
                {form.reboques.map((r, i) => {
                  const mudar = (campo: keyof Reboque, valor: string) =>
                    setForm(prev => ({ ...prev, reboques: prev.reboques.map((x, j) => j === i ? { ...x, [campo]: valor } : x) }))
                  return (
                    <div key={i} className="grid grid-cols-7 gap-2 items-end">
                      <div><label className={LC}>Placa</label><input value={r.placa} onChange={e => mudar('placa', e.target.value)} className={IC}/></div>
                      <div><label className={LC}>RENAVAM</label><input value={r.renavam} onChange={e => mudar('renavam', e.target.value)} className={IC}/></div>
                      <div><label className={LC}>Tara (kg)</label><input value={r.tara} onChange={e => mudar('tara', e.target.value)} className={IC}/></div>
                      <div><label className={LC}>Capac. (kg)</label><input value={r.cap_kg} onChange={e => mudar('cap_kg', e.target.value)} className={IC}/></div>
                      <div>
                        <label className={LC}>Carroceria</label>
                        <select value={r.tp_car} onChange={e => mudar('tp_car', e.target.value)} className={IC}>{TP_CAR.map(o => <option key={o.v} value={o.v}>{o.t}</option>)}</select>
                      </div>
                      <div>
                        <label className={LC}>UF</label>
                        <select value={r.uf} onChange={e => mudar('uf', e.target.value)} className={IC}>{UFS.map(u => <option key={u}>{u}</option>)}</select>
                      </div>
                      <button type="button" onClick={() => setForm(prev => ({ ...prev, reboques: prev.reboques.filter((_, j) => j !== i) }))}
                        className="mb-2 text-gray-400 hover:text-red-600"><Trash2 size={16}/></button>
                    </div>
                  )
                })}
                <p className="text-xs text-gray-400">Tara, RENAVAM e capacidade ficam guardados por placa e aparecem sozinhos na próxima viagem.</p>
              </section>

              {/* 3. Motorista */}
              <section className="space-y-3">
                <div className="flex justify-between items-center">
                  <p className="font-bold text-gray-800"><User size={14} className="inline mb-0.5 mr-1"/>3. Motorista</p>
                  <button type="button" onClick={() => setForm(prev => ({ ...prev, condutores: [...prev.condutores, { nome: '', cpf: '' }] }))}
                    className="text-xs font-bold text-red-600">+ Segundo motorista</button>
                </div>
                {form.condutores.map((c, i) => (
                  <div key={i} className="grid grid-cols-3 gap-3 items-end">
                    <div className="col-span-2">
                      <label className={LC}>Nome</label>
                      <select value={motoristas.some(m => m.nome === c.nome) ? c.nome : ''} className={IC}
                        onChange={e => {
                          const m = motoristas.find(x => x.nome === e.target.value)
                          setForm(prev => ({ ...prev, condutores: prev.condutores.map((x, j) => j === i ? { nome: m?.nome || '', cpf: m?.cpf || '' } : x) }))
                        }}>
                        <option value="">Selecione...</option>
                        {motoristas.map(m => <option key={m.id} value={m.nome}>{m.nome}</option>)}
                      </select>
                    </div>
                    <div className="flex gap-2 items-end">
                      <div className="flex-1">
                        <label className={LC}>CPF</label>
                        <input value={c.cpf} className={IC}
                          onChange={e => setForm(prev => ({ ...prev, condutores: prev.condutores.map((x, j) => j === i ? { ...x, cpf: e.target.value } : x) }))}/>
                      </div>
                      {i > 0 && (
                        <button type="button" onClick={() => setForm(prev => ({ ...prev, condutores: prev.condutores.filter((_, j) => j !== i) }))}
                          className="mb-2 text-gray-400 hover:text-red-600"><Trash2 size={16}/></button>
                      )}
                    </div>
                  </div>
                ))}
              </section>

              {/* 4. Viagem */}
              <section className="space-y-3">
                <p className="font-bold text-gray-800">4. Viagem</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={LC}>Estados no caminho (percurso)</label>
                    <input name="percurso" value={form.percurso} onChange={handle} className={IC} placeholder="Ex.: SP, PR (sem o de saída e o de chegada)"/>
                  </div>
                  <div>
                    <label className={LC}>Tipo de carga</label>
                    <select name="tipo_carga" value={form.tipo_carga} onChange={handle} className={IC}>{TP_CARGA.map(o => <option key={o.v} value={o.v}>{o.t}</option>)}</select>
                  </div>
                  <div>
                    <label className={LC}>CIOT (se tiver)</label>
                    <input name="ciot" value={form.ciot} onChange={handle} className={IC} placeholder="12 dígitos, do e-Frete"/>
                  </div>
                  <div>
                    <label className={LC}>CNPJ de quem gerou o CIOT</label>
                    <input name="ciot_cnpj" value={form.ciot_cnpj} onChange={handle} className={IC}/>
                  </div>
                </div>
                <div>
                  <label className={LC}>Observações</label>
                  <textarea name="obs" value={form.obs} onChange={handle} rows={2} className={IC}/>
                </div>
              </section>

              {erro && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                  <AlertCircle size={16} className="mt-0.5 shrink-0"/> <span>{erro}</span>
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={salvarRascunho} disabled={salvando}
                  className="flex-1 flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-800 text-white py-3 rounded-xl text-sm font-bold uppercase transition disabled:opacity-50">
                  {salvando ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>} Salvar rascunho
                </button>
                <button onClick={emitir} disabled={salvando}
                  className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl text-sm font-bold uppercase transition disabled:opacity-50">
                  {salvando ? <Loader2 size={16} className="animate-spin"/> : <CheckCircle2 size={16}/>} Emitir MDF-e
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function BotaoIcone({ t, onClick, icon, cor = 'text-gray-600' }: { t: string; onClick: () => void; icon: React.ReactNode; cor?: string }) {
  return (
    <button title={t} onClick={onClick} className={`p-2 rounded-lg hover:bg-gray-100 ${cor}`}>{icon}</button>
  )
}
