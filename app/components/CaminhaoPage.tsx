'use client'
import { useState, useEffect, useMemo } from 'react'
import { caminhoesAPI, motoristasAPI } from '../services/api'
import { useAuth } from '../services/auth'
import { supabase } from '../services/supabase'
import { Search, Plus, ArrowLeft, Save, Trash2, ChevronRight, Truck, Wrench, FileText, X, Calendar, User, AlertCircle, CheckCircle2, Clock, Download, ArrowRight } from 'lucide-react'

interface Caminhao {
  id: string; placa: string; placa_carreta: string; modelo: string; ano: string
  status: string; motivo_parado: string; dt_parado: string
  motorista_atual: string; obs_documentos: string; frota: string
}
interface Carreta {
  id: string; placa: string; modelo: string; ano: string; status: string; obs: string
}
interface Motorista { id: string; nome: string; ativo: boolean }
interface Frota { id: string; nome: string }
interface Manutencao {
  id: string; caminhao_id: string; caminhao_placa: string; tipo: string
  descricao: string; data_entrada: string; data_saida: string | null
  valor: number | null; status: string; obs: string
  caminhao_substituto_id?: string | null
  caminhao_substituto_placa?: string | null
  motorista_nome?: string | null
}
interface Licenca { id: string; caminhao_id: string; estado: string; vencimento: string }

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_KEY!
const ESTADOS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']
const TIPOS_MANUTENCAO = ['Troca de óleo','Revisão geral','Freios','Pneus','Suspensão','Motor','Câmbio','Elétrica','Funilaria/Pintura','Outro']

const IC = "mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-red-500 bg-gray-50"
const LC = "text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5"

function diasParado(dt: string) {
  if (!dt) return null
  return Math.ceil((new Date().getTime() - new Date(dt + 'T00:00:00').getTime()) / 86400000)
}
function fmtData(d: string) {
  if (!d) return '—'
  const [y, m, dia] = d.split('-')
  return `${dia}/${m}/${y}`
}
function diasParaVencer(data: string) {
  if (!data) return null
  return Math.ceil((new Date(data + 'T00:00:00').getTime() - new Date().getTime()) / 86400000)
}

export default function CaminhaoPage() {
  const { perm } = useAuth()

  // Aba global: caminhoes, carretas ou manutencao_global
  const [abaGlobal, setAbaGlobal] = useState<'caminhoes' | 'carretas' | 'manutencao_global'>('caminhoes')

  // ── CAMINHÕES ──
  const [caminhoes, setCaminhoes] = useState<Caminhao[]>([])
  const [motoristas, setMotoristas] = useState<Motorista[]>([])
  const [frotas, setFrotas] = useState<Frota[]>([])
  const [busca, setBusca] = useState('')
  const [sel, setSel] = useState<Caminhao | null>(null)
  const [mostraCad, setMostraCad] = useState(false)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [confirmExcluir, setConfirmExcluir] = useState(false)
  const [aba, setAba] = useState<'info' | 'manutencao' | 'licencas'>('info')
  const [manutencoes, setManutencoes] = useState<Manutencao[]>([])
  const [mostraNovaMan, setMostraNovaMan] = useState(false)
  const [manTipo, setManTipo] = useState('')
  const [manDesc, setManDesc] = useState('')
  const [manEntrada, setManEntrada] = useState(new Date().toISOString().split('T')[0])
  const [manSaida, setManSaida] = useState('')
  const [manValor, setManValor] = useState('')
  const [manStatus, setManStatus] = useState('EM ANDAMENTO')
  const [manObs, setManObs] = useState('')
  const [manSubstitutoId, setManSubstitutoId] = useState('')
  const [filtroPlacoRel, setFiltroPlacoRel] = useState('')
  const [licencas, setLicencas] = useState<Licenca[]>([])
  const [mostraNovaLic, setMostraNovaLic] = useState(false)
  const [licEstado, setLicEstado] = useState('')
  const [licVencimento, setLicVencimento] = useState('')
  
  // Estados de Edição
  const [editPlaca, setEditPlaca] = useState('')
  const [editPlacaCarreta, setEditPlacaCarreta] = useState('')
  const [editModelo, setEditModelo] = useState('')
  const [editAno, setEditAno] = useState('')
  const [editStatus, setEditStatus] = useState('rodando')
  const [editMotivo, setEditMotivo] = useState('')
  const [editDtParado, setEditDtParado] = useState('')
  const [editMotorista, setEditMotorista] = useState('')
  const [editFrota, setEditFrota] = useState('')
  const [editObs, setEditObs] = useState('')

  // Estados de Cadastro
  const [cadPlaca, setCadPlaca] = useState('')
  const [cadPlacaCarreta, setCadPlacaCarreta] = useState('')
  const [cadModelo, setCadModelo] = useState('')
  const [cadAno, setCadAno] = useState('')
  const [cadStatus, setCadStatus] = useState('rodando')
  const [cadMotivo, setCadMotivo] = useState('')
  const [cadDtParado, setCadDtParado] = useState('')
  const [cadMotorista, setCadMotorista] = useState('')
  const [cadFrota, setCadFrota] = useState('')
  const [cadObs, setCadObs] = useState('')

  // ── CARRETAS ──
  const [carretas, setCarretas] = useState<Carreta[]>([])
  const [buscaCarreta, setBuscaCarreta] = useState('')
  const [selCarreta, setSelCarreta] = useState<Carreta | null>(null)
  const [mostraCadCarreta, setMostraCadCarreta] = useState(false)
  const [confirmExcluirCarreta, setConfirmExcluirCarreta] = useState(false)
  const [editCPlaca, setEditCPlaca] = useState('')
  const [editCModelo, setEditCModelo] = useState('')
  const [editCAno, setEditCAno] = useState('')
  const [editCStatus, setEditCStatus] = useState('disponivel')
  const [editCObs, setEditCObs] = useState('')
  const [cadCPlaca, setCadCPlaca] = useState('')
  const [cadCModelo, setCadCModelo] = useState('')
  const [cadCAno, setCadCAno] = useState('')
  const [cadCStatus, setCadCStatus] = useState('disponivel')
  const [cadCObs, setCadCObs] = useState('')

  // ── MANUTENÇÃO GLOBAL ──
  const [buscaManGlobal, setBuscaManGlobal] = useState('')
  const [historicoManGlobal, setHistoricoManGlobal] = useState<Manutencao[]>([])

  useEffect(() => {
    fetch_(); motoristasAPI.listar().then(setMotoristas).catch(() => {}); fetchFrotas(); fetchCarretas(); fetchHistoricoManGlobal()
  }, [])

  async function fetch_() { const data = await caminhoesAPI.listar(); setCaminhoes(data) }
  async function fetchFrotas() {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/frotas?order=nome.asc`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } })
      setFrotas(await res.json())
    } catch {}
  }
  async function fetchCarretas() {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/carretas?order=placa.asc`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } })
      const data = await res.json(); setCarretas(Array.isArray(data) ? data : [])
    } catch {}
  }
  async function fetchManutencoes(caminhaoId: string) {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/manutencoes?caminhao_id=eq.${caminhaoId}&order=data_entrada.desc`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } })
      setManutencoes(await res.json())
    } catch {}
  }
  async function fetchHistoricoManGlobal() {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/manutencoes?order=data_entrada.desc`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } })
      setHistoricoManGlobal(await res.json())
    } catch {}
  }
  async function fetchLicencas(caminhaoId: string) {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/licencas?caminhao_id=eq.${caminhaoId}&order=estado.asc`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } })
      setLicencas(await res.json())
    } catch {}
  }

  function showMsg(t: string) { setMsg(t); setTimeout(() => setMsg(''), 3000) }

  // ── CAMINHÕES handlers ──
  const filtrados = busca.trim() ? caminhoes.filter(c => c.placa?.toLowerCase().includes(busca.toLowerCase()) || c.modelo?.toLowerCase().includes(busca.toLowerCase()) || c.frota?.toLowerCase().includes(busca.toLowerCase())) : caminhoes

  function selecionar(c: Caminhao) {
    setSel(c); setEditPlaca(c.placa||''); setEditPlacaCarreta(c.placa_carreta||'')
    setEditModelo(c.modelo||''); setEditAno(c.ano||''); setEditStatus(c.status||'rodando')
    setEditMotivo(c.motivo_parado||''); setEditDtParado(c.dt_parado||'')
    setEditMotorista(c.motorista_atual||''); setEditFrota(c.frota||''); setEditObs(c.obs_documentos||'')
    setConfirmExcluir(false); setAba('info'); fetchManutencoes(c.id); fetchLicencas(c.id)
  }
  function voltar() { setSel(null); setConfirmExcluir(false); setAba('info') }

  async function salvar() {
    if (!sel) return; setLoading(true)
    if (perm !== 'demo') {
      await caminhoesAPI.atualizar(sel.id, {
        placa: editPlaca.toUpperCase(), placa_carreta: editPlacaCarreta.toUpperCase(),
        modelo: editModelo, ano: editAno, status: editStatus, frota: editFrota,
        motivo_parado: editStatus !== 'rodando' ? editMotivo : '',
        dt_parado: editStatus !== 'rodando' ? editDtParado : null,
        motorista_atual: editMotorista, obs_documentos: editObs,
      })
      if (editMotorista !== sel.motorista_atual) {
        if (sel.motorista_atual) { const a = motoristas.find(m => m.nome === sel.motorista_atual); if (a) await motoristasAPI.atualizar(a.id, { nome: a.nome, caminhao_id: null } as any) }
        if (editMotorista) { const n = motoristas.find(m => m.nome === editMotorista); if (n) await motoristasAPI.atualizar(n.id, { nome: n.nome, caminhao_id: sel.id } as any) }
      }
    }
    await fetch_(); setLoading(false); voltar(); showMsg('✅ Atualizado!')
  }
  async function excluir() {
    if (!sel) return; setLoading(true)
    if (perm !== 'demo') await caminhoesAPI.excluir(sel.id)
    await fetch_(); setLoading(false); voltar(); showMsg('Caminhão excluído.')
  }
  async function cadastrar() {
    if (!cadPlaca.trim()) return; setLoading(true)
    if (perm !== 'demo') {
      const novo = await caminhoesAPI.criar({ placa: cadPlaca.toUpperCase(), placa_carreta: cadPlacaCarreta.toUpperCase(), modelo: cadModelo, ano: cadAno, status: cadStatus, frota: cadFrota, motivo_parado: cadStatus !== 'rodando' ? cadMotivo : '', dt_parado: cadStatus !== 'rodando' ? cadDtParado : null, motorista_atual: cadMotorista, obs_documentos: cadObs })
      if (cadMotorista && novo?.[0]?.id) { const m = motoristas.find(m => m.nome === cadMotorista); if (m) await motoristasAPI.atualizar(m.id, { nome: m.nome, caminhao_id: novo[0].id } as any) }
    }
    await fetch_(); setLoading(false)
    setCadPlaca(''); setCadPlacaCarreta(''); setCadModelo(''); setCadAno(''); setCadStatus('rodando'); setCadMotivo(''); setCadDtParado(''); setCadMotorista(''); setCadFrota(''); setCadObs('')
    setMostraCad(false); showMsg('✅ Caminhão cadastrado!')
  }

  async function salvarManutencao() {
    if (!sel || !manTipo) return; setLoading(true)
    const sub = caminhoes.find(c => c.id === manSubstitutoId)
    const payload = { 
      caminhao_id: sel.id, caminhao_placa: editPlaca, tipo: manTipo, descricao: manDesc, 
      data_entrada: manEntrada, data_saida: manSaida || null, valor: parseFloat(manValor) || null, 
      status: manStatus, obs: manObs, caminhao_substituto_id: manSubstitutoId || null,
      caminhao_substituto_placa: sub?.placa || null, motorista_nome: sel.motorista_atual || null
    }
    await fetch(`${SUPABASE_URL}/rest/v1/manutencoes`, { method: 'POST', headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify(payload) })
    
    if (manStatus === 'EM ANDAMENTO') {
      await caminhoesAPI.atualizar(sel.id, { status: 'manutencao', motivo_parado: manTipo, dt_parado: manEntrada })
      if (manSubstitutoId && sel.motorista_atual) await caminhoesAPI.atualizar(manSubstitutoId, { motorista_atual: sel.motorista_atual })
    }

    await fetchManutencoes(sel.id); await fetchHistoricoManGlobal(); await fetch_();
    setManTipo(''); setManDesc(''); setManEntrada(new Date().toISOString().split('T')[0]); setManSaida(''); setManValor(''); setManStatus('EM ANDAMENTO'); setManObs(''); setMostraNovaMan(false); setLoading(false); showMsg('✅ Manutenção registrada!')
  }

  async function excluirManutencao(id: string) {
    if (perm === 'demo') return; setLoading(true)
    await fetch(`${SUPABASE_URL}/rest/v1/manutencoes?id=eq.${id}`, { method: 'DELETE', headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } })
    if (sel) await fetchManutencoes(sel.id); await fetchHistoricoManGlobal(); setLoading(false); showMsg('Manutenção excluída.')
  }

  async function salvarLicenca() {
    if (!sel || !licEstado || !licVencimento) return; setLoading(true)
    await fetch(`${SUPABASE_URL}/rest/v1/licencas`, { method: 'POST', headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify({ caminhao_id: sel.id, estado: licEstado, vencimento: licVencimento }) })
    await fetchLicencas(sel.id); setLicEstado(''); setLicVencimento(''); setMostraNovaLic(false); setLoading(false); showMsg('✅ Licença adicionada!')
  }

  async function excluirLicenca(id: string) {
    if (perm === 'demo') return; setLoading(true)
    await fetch(`${SUPABASE_URL}/rest/v1/licencas?id=eq.${id}`, { method: 'DELETE', headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } })
    if (sel) await fetchLicencas(sel.id); setLoading(false); showMsg('Licença excluída.')
  }

  async function gerarRelatorio() {
    if (!filtroPlacoRel) return; setLoading(true)
    const res = await fetch(`${SUPABASE_URL}/rest/v1/manutencoes?caminhao_placa=eq.${filtroPlacoRel}&order=data_entrada.desc`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } })
    setManutencoes(await res.json()); setLoading(false)
  }

  // ── CARRETAS handlers ──
  const filtradasCarretas = buscaCarreta.trim() ? carretas.filter(c => c.placa?.toLowerCase().includes(buscaCarreta.toLowerCase())) : carretas
  function selecionarCarreta(c: Carreta) { setSelCarreta(c); setEditCPlaca(c.placa); setEditCModelo(c.modelo); setEditCAno(c.ano); setEditCStatus(c.status); setEditCObs(c.obs); setConfirmExcluirCarreta(false) }
  function voltarCarreta() { setSelCarreta(null); setConfirmExcluirCarreta(false) }
  async function salvarCarreta() {
    if (!selCarreta) return; setLoading(true)
    await fetch(`${SUPABASE_URL}/rest/v1/carretas?id=eq.${selCarreta.id}`, { method: 'PATCH', headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify({ placa: editCPlaca.toUpperCase(), modelo: editCModelo, ano: editCAno, status: editCStatus, obs: editCObs }) })
    await fetchCarretas(); setLoading(false); voltarCarreta(); showMsg('✅ Carreta atualizada!')
  }
  async function excluirCarreta() {
    if (!selCarreta) return; setLoading(true)
    await fetch(`${SUPABASE_URL}/rest/v1/carretas?id=eq.${selCarreta.id}`, { method: 'DELETE', headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } })
    await fetchCarretas(); setLoading(false); voltarCarreta(); showMsg('Carreta excluída.')
  }
  async function cadastrarCarreta() {
    if (!cadCPlaca.trim()) return; setLoading(true)
    await fetch(`${SUPABASE_URL}/rest/v1/carretas`, { method: 'POST', headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify({ placa: cadCPlaca.toUpperCase(), modelo: cadCModelo, ano: cadCAno, status: cadCStatus, obs: cadCObs }) })
    await fetchCarretas(); setLoading(false); setMostraCadCarreta(false); setCadCPlaca(''); setCadCModelo(''); setCadCAno(''); setCadCStatus('disponivel'); setCadCObs(''); showMsg('✅ Carreta cadastrada!')
  }

  return (
    <div className="p-6 max-w-full bg-gray-50 min-h-screen font-sans">
      {msg && <div className="fixed top-6 right-6 z-50 p-4 bg-green-600 text-white rounded-2xl shadow-2xl font-black text-xs uppercase tracking-widest animate-bounce"> {msg} </div>}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-4xl font-black text-gray-900 tracking-tighter uppercase">Gestão de Frota</h1>
          <p className="text-sm text-gray-400 font-bold uppercase tracking-widest">Caminhões, Carretas e Manutenção</p>
        </div>
        <div className="flex bg-white p-1.5 rounded-2xl shadow-sm border border-gray-100">
          <button onClick={() => setAbaGlobal('caminhoes')} className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${abaGlobal === 'caminhoes' ? 'bg-red-600 text-white shadow-lg shadow-red-100' : 'text-gray-400 hover:text-gray-600'}`}>Caminhões</button>
          <button onClick={() => setAbaGlobal('carretas')} className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${abaGlobal === 'carretas' ? 'bg-red-600 text-white shadow-lg shadow-red-100' : 'text-gray-400 hover:text-gray-600'}`}>Carretas</button>
          <button onClick={() => setAbaGlobal('manutencao_global')} className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${abaGlobal === 'manutencao_global' ? 'bg-red-600 text-white shadow-lg shadow-red-100' : 'text-gray-400 hover:text-gray-600'}`}>Manutenção</button>
        </div>
      </div>

      {abaGlobal === 'caminhoes' && (
        <div className="space-y-6">
          {!sel && !mostraCad ? (
            <>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="relative flex-1 max-w-md">
                  <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Pesquisar placa, modelo ou frota..." className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-2xl outline-none focus:ring-2 focus:ring-red-500 transition-all text-sm font-bold shadow-inner" />
                </div>
                <button onClick={() => setMostraCad(true)} className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-red-100 flex items-center gap-2"><Plus size={16} /> Novo Caminhão</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filtrados.map(c => (
                  <div key={c.id} onClick={() => selecionar(c)} className="bg-white p-6 rounded-[2rem] shadow-xl border border-gray-100 hover:border-red-200 transition-all cursor-pointer group">
                    <div className="flex justify-between items-start mb-4">
                      <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-red-50 group-hover:text-red-600 transition-all"><Truck size={24} /></div>
                      <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${c.status === 'rodando' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{c.status}</span>
                    </div>
                    <h3 className="text-xl font-black text-gray-900 tracking-tighter mb-1">{c.placa}</h3>
                    <p className="text-xs font-bold text-gray-400 uppercase mb-4">{c.modelo} • {c.ano}</p>
                    <div className="pt-4 border-t border-gray-50 flex items-center justify-between">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Motorista: <span className="text-gray-900">{c.motorista_atual || '—'}</span></p>
                      <ChevronRight size={16} className="text-gray-300 group-hover:text-red-600 transition-all" />
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : mostraCad ? (
            <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl border border-gray-100 max-w-4xl mx-auto">
              <div className="flex items-center justify-between mb-8"><h2 className="text-2xl font-black text-gray-900 tracking-tighter uppercase">Novo Caminhão</h2><button onClick={() => setMostraCad(false)} className="text-gray-400 hover:text-red-600"><X size={24}/></button></div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="space-y-1"><label className={LC}>Placa</label><input value={cadPlaca} onChange={e => setCadPlaca(e.target.value.toUpperCase())} className={IC} /></div>
                <div className="space-y-1"><label className={LC}>Modelo</label><input value={cadModelo} onChange={e => setCadModelo(e.target.value)} className={IC} /></div>
                <div className="space-y-1"><label className={LC}>Ano</label><input value={cadAno} onChange={e => setCadAno(e.target.value)} className={IC} /></div>
              </div>
              <button onClick={cadastrar} className="w-full bg-red-600 hover:bg-red-700 text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-red-100">Cadastrar Veículo</button>
            </div>
          ) : (
            <div className="bg-white rounded-[2.5rem] shadow-2xl border border-gray-100 max-w-5xl mx-auto overflow-hidden">
              <div className={`px-8 py-6 bg-gradient-to-r ${editStatus === 'rodando' ? 'from-green-600 to-green-700' : 'from-red-600 to-red-700'} flex items-center justify-between`}>
                <div className="flex items-center gap-4"><div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center text-white"><Truck size={28} /></div><div><h2 className="text-white font-black text-2xl tracking-tighter">{sel.placa}</h2><p className="text-white/80 text-xs font-bold uppercase tracking-widest">{sel.modelo} {sel.ano}</p></div></div>
                <button onClick={voltar} className="text-white/80 hover:text-white"><X size={24}/></button>
              </div>
              <div className="flex border-b border-gray-100">
                {[{ id: 'info', label: 'Informações', icon: Truck }, { id: 'manutencao', label: 'Manutenção', icon: Wrench }, { id: 'licencas', label: 'Licenças', icon: FileText }].map(t => (
                  <button key={t.id} onClick={() => setAba(t.id as any)} className={`flex-1 flex items-center justify-center gap-2 py-4 text-[10px] font-black uppercase tracking-widest transition border-b-4 ${aba === t.id ? 'border-red-600 text-red-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}><t.icon size={14} /> {t.label}</button>
                ))}
              </div>
              <div className="p-8">
                {aba === 'info' && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-1"><label className={LC}>Placa</label><input value={editPlaca} onChange={e => setEditPlaca(e.target.value.toUpperCase())} className={IC} /></div>
                      <div className="space-y-1"><label className={LC}>Placa Carreta</label><input value={editPlacaCarreta} onChange={e => setEditPlacaCarreta(e.target.value.toUpperCase())} className={IC} /></div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-1"><label className={LC}>Modelo</label><input value={editModelo} onChange={e => setEditModelo(e.target.value)} className={IC} /></div>
                      <div className="space-y-1"><label className={LC}>Ano</label><input value={editAno} onChange={e => setEditAno(e.target.value)} className={IC} /></div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-1"><label className={LC}>Frota</label><select value={editFrota} onChange={e => setEditFrota(e.target.value)} className={IC}><option value="">Selecione...</option>{frotas.map(f => <option key={f.id} value={f.nome}>{f.nome}</option>)}</select></div>
                      <div className="space-y-1"><label className={LC}>Motorista</label><select value={editMotorista} onChange={e => setEditMotorista(e.target.value)} className={IC}><option value="">Selecione...</option>{motoristas.map(m => <option key={m.id} value={m.nome}>{m.nome}</option>)}</select></div>
                    </div>
                    <div className="space-y-1"><label className={LC}>Status</label><select value={editStatus} onChange={e => setEditStatus(e.target.value)} className={IC}><option value="rodando">Rodando</option><option value="manutencao">Manutenção</option><option value="parado">Parado</option></select></div>
                    <div className="flex gap-4 pt-4"><button onClick={salvar} className="flex-1 bg-red-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-red-100">Salvar Alterações</button><button onClick={() => setConfirmExcluir(true)} className="bg-gray-100 text-gray-400 p-4 rounded-2xl hover:bg-red-50 hover:text-red-600 transition-all"><Trash2 size={20}/></button></div>
                    {confirmExcluir && <div className="p-6 bg-red-50 border border-red-100 rounded-2xl flex items-center justify-between"><p className="text-sm font-black text-red-600 uppercase tracking-widest">Confirmar exclusão?</p><div className="flex gap-2"><button onClick={excluir} className="bg-red-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase">Sim</button><button onClick={() => setConfirmExcluir(false)} className="bg-white text-gray-400 px-4 py-2 rounded-xl text-[10px] font-black uppercase border border-gray-200">Não</button></div></div>}
                  </div>
                )}
                {aba === 'manutencao' && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between mb-4"><h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">Histórico de Manutenções</h3><button onClick={() => setMostraNovaMan(true)} className="bg-red-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2"><Plus size={14}/> Nova</button></div>
                    {mostraNovaMan && (
                      <div className="p-6 bg-gray-50 rounded-2xl border border-gray-100 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1"><label className={LC}>Tipo</label><select value={manTipo} onChange={e => setManTipo(e.target.value)} className={IC}><option value="">Selecione...</option>{TIPOS_MANUTENCAO.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                          <div className="space-y-1"><label className={LC}>Status</label><select value={manStatus} onChange={e => setManStatus(e.target.value)} className={IC}><option value="EM ANDAMENTO">EM ANDAMENTO</option><option value="CONCLUIDA">CONCLUÍDA</option></select></div>
                        </div>
                        <div className="space-y-1"><label className={LC}>Descrição</label><input value={manDesc} onChange={e => setManDesc(e.target.value)} className={IC} /></div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1"><label className={LC}>Data Entrada</label><input type="date" value={manEntrada} onChange={e => setManEntrada(e.target.value)} className={IC} /></div>
                          <div className="space-y-1"><label className={LC}>Data Saída</label><input type="date" value={manSaida} onChange={e => setManSaida(e.target.value)} className={IC} /></div>
                        </div>
                        <div className="space-y-1"><label className={LC}>Caminhão Substituto (Opcional)</label><select value={manSubstitutoId} onChange={e => setManSubstitutoId(e.target.value)} className={IC}><option value="">Nenhum...</option>{caminhoes.filter(c => c.id !== sel.id).map(c => <option key={c.id} value={c.id}>{c.placa}</option>)}</select></div>
                        <div className="flex gap-2"><button onClick={salvarManutencao} className="flex-1 bg-red-600 text-white py-3 rounded-xl font-black uppercase text-[10px]">Registrar</button><button onClick={() => setMostraNovaMan(false)} className="bg-white text-gray-400 px-6 py-3 rounded-xl font-black uppercase text-[10px] border border-gray-200">Cancelar</button></div>
                      </div>
                    )}
                    <div className="space-y-3">
                      {manutencoes.map(m => (
                        <div key={m.id} className="p-4 bg-white rounded-2xl border border-gray-100 flex items-center justify-between">
                          <div><p className="text-xs font-black text-gray-900 uppercase">{m.tipo}</p><p className="text-[10px] font-bold text-gray-400 uppercase">{fmtData(m.data_entrada)} {m.data_saida && `→ ${fmtData(m.data_saida)}`}</p></div>
                          <div className="flex items-center gap-4"><span className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase ${m.status === 'CONCLUIDA' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{m.status}</span><button onClick={() => excluirManutencao(m.id)} className="text-gray-300 hover:text-red-600"><Trash2 size={14}/></button></div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {aba === 'licencas' && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between mb-4"><h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">Licenças por Estado</h3><button onClick={() => setMostraNovaLic(true)} className="bg-red-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2"><Plus size={14}/> Adicionar</button></div>
                    {mostraNovaLic && (
                      <div className="p-6 bg-gray-50 rounded-2xl border border-gray-100 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1"><label className={LC}>Estado</label><select value={licEstado} onChange={e => setLicEstado(e.target.value)} className={IC}><option value="">Selecione...</option>{ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}</select></div>
                          <div className="space-y-1"><label className={LC}>Vencimento</label><input type="date" value={licVencimento} onChange={e => setLicVencimento(e.target.value)} className={IC} /></div>
                        </div>
                        <div className="flex gap-2"><button onClick={salvarLicenca} className="flex-1 bg-red-600 text-white py-3 rounded-xl font-black uppercase text-[10px]">Salvar</button><button onClick={() => setMostraNovaLic(false)} className="bg-white text-gray-400 px-6 py-3 rounded-xl font-black uppercase text-[10px] border border-gray-200">Cancelar</button></div>
                      </div>
                    )}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {licencas.map(l => {
                        const dias = diasParaVencer(l.vencimento)
                        return (
                          <div key={l.id} className="p-4 bg-white rounded-2xl border border-gray-100 flex items-center justify-between">
                            <div><p className="text-xs font-black text-gray-900">{l.estado}</p><p className={`text-[10px] font-bold ${dias && dias < 30 ? 'text-red-600' : 'text-gray-400'}`}>{fmtData(l.vencimento)}</p></div>
                            <button onClick={() => excluirLicenca(l.id)} className="text-gray-300 hover:text-red-600"><X size={14}/></button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {abaGlobal === 'carretas' && (
        <div className="space-y-6">
          {!selCarreta && !mostraCadCarreta ? (
            <>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="relative flex-1 max-w-md"><Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" /><input value={buscaCarreta} onChange={e => setBuscaCarreta(e.target.value)} placeholder="Pesquisar placa..." className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-2xl outline-none focus:ring-2 focus:ring-red-500 transition-all text-sm font-bold shadow-inner" /></div>
                <button onClick={() => setMostraCadCarreta(true)} className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-red-100 flex items-center gap-2"><Plus size={16} /> Nova Carreta</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filtradasCarretas.map(c => (
                  <div key={c.id} onClick={() => selecionarCarreta(c)} className="bg-white p-6 rounded-[2rem] shadow-xl border border-gray-100 hover:border-red-200 transition-all cursor-pointer group">
                    <div className="flex justify-between items-start mb-4"><div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-red-50 group-hover:text-red-600 transition-all"><Truck size={24} /></div><span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${c.status === 'disponivel' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{c.status}</span></div>
                    <h3 className="text-xl font-black text-gray-900 tracking-tighter mb-1">{c.placa}</h3>
                    <p className="text-xs font-bold text-gray-400 uppercase">{c.modelo} • {c.ano}</p>
                  </div>
                ))}
              </div>
            </>
          ) : mostraCadCarreta ? (
            <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl border border-gray-100 max-w-4xl mx-auto">
              <div className="flex items-center justify-between mb-8"><h2 className="text-2xl font-black text-gray-900 tracking-tighter uppercase">Nova Carreta</h2><button onClick={() => setMostraCadCarreta(false)} className="text-gray-400 hover:text-red-600"><X size={24}/></button></div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="space-y-1"><label className={LC}>Placa</label><input value={cadCPlaca} onChange={e => setCadCPlaca(e.target.value.toUpperCase())} className={IC} /></div>
                <div className="space-y-1"><label className={LC}>Modelo</label><input value={cadCModelo} onChange={e => setCadCModelo(e.target.value)} className={IC} /></div>
                <div className="space-y-1"><label className={LC}>Ano</label><input value={cadCAno} onChange={e => setCadCAno(e.target.value)} className={IC} /></div>
              </div>
              <button onClick={cadastrarCarreta} className="w-full bg-red-600 hover:bg-red-700 text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-red-100">Cadastrar Carreta</button>
            </div>
          ) : (
            <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl border border-gray-100 max-w-4xl mx-auto">
              <div className="flex items-center justify-between mb-8"><button onClick={voltarCarreta} className="flex items-center gap-2 text-gray-400 hover:text-red-600 font-black text-xs uppercase tracking-widest"><ArrowLeft size={16}/> Voltar</button><button onClick={salvarCarreta} className="bg-red-600 text-white px-6 py-2 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2"><Save size={16}/> Salvar</button></div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-1"><label className={LC}>Placa</label><input value={editCPlaca} onChange={e => setEditCPlaca(e.target.value.toUpperCase())} className={IC} /></div>
                <div className="space-y-1"><label className={LC}>Modelo</label><input value={editCModelo} onChange={e => setEditCModelo(e.target.value)} className={IC} /></div>
                <div className="space-y-1"><label className={LC}>Status</label><select value={editCStatus} onChange={e => setEditCStatus(e.target.value)} className={IC}><option value="disponivel">Disponível</option><option value="manutencao">Manutenção</option><option value="viagem">Em Viagem</option></select></div>
              </div>
            </div>
          )}
        </div>
      )}

      {abaGlobal === 'manutencao_global' && (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md"><Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" /><input value={buscaManGlobal} onChange={e => setBuscaManGlobal(e.target.value)} placeholder="Pesquisar por placa..." className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-2xl outline-none focus:ring-2 focus:ring-red-500 transition-all text-sm font-bold shadow-inner" /></div>
          </div>
          <div className="bg-white rounded-[2.5rem] shadow-xl border border-gray-100 overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead><tr className="bg-gray-50/50"><th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Veículo</th><th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Tipo</th><th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Período</th><th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Substituto</th><th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Status</th></tr></thead>
              <tbody className="divide-y divide-gray-50">
                {historicoManGlobal.filter(m => m.caminhao_placa?.toLowerCase().includes(buscaManGlobal.toLowerCase())).map(m => (
                  <tr key={m.id} className="hover:bg-red-50/30 transition-colors group">
                    <td className="px-8 py-5"><p className="text-sm font-black text-gray-900">{m.caminhao_placa}</p><p className="text-[10px] font-bold text-gray-400 uppercase">{m.motorista_nome || 'Sem motorista'}</p></td>
                    <td className="px-8 py-5 text-xs font-black text-gray-800 uppercase">{m.tipo}</td>
                    <td className="px-8 py-5 text-[10px] font-black text-gray-600 uppercase">{fmtData(m.data_entrada)} → {m.data_saida ? fmtData(m.data_saida) : 'Aberto'}</td>
                    <td className="px-8 py-5">{m.caminhao_substituto_placa ? <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-lg text-[10px] font-black uppercase border border-blue-100">{m.caminhao_substituto_placa}</span> : '—'}</td>
                    <td className="px-8 py-5 text-right"><span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase ${m.status === 'CONCLUIDA' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{m.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
