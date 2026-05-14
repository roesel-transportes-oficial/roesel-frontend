'use client'
import { useState, useEffect, useMemo } from 'react'
import { caminhoesAPI, motoristasAPI } from '../services/api'
import { supabase } from '../services/supabase'
import { useAuth } from '../services/auth'
import { Search, Plus, ArrowLeft, Save, Trash2, ChevronRight, Truck, Wrench, FileText, X, Calendar, User, AlertCircle, CheckCircle2, Clock, Download, ArrowRight, MapPin } from 'lucide-react'

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

const ESTADOS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']
const TIPOS_MANUTENCAO = ['Troca de óleo','Revisão geral','Freios','Pneus','Suspensão','Motor','Câmbio','Elétrica','Funilaria/Pintura','Outro']

const IC = "mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-red-500 bg-gray-50"
const LC = "text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5"

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
  const [abaGlobal, setAbaGlobal] = useState<'caminhoes' | 'carretas' | 'manutencao'>('caminhoes')

  // ── ESTADOS GERAIS ──
  const [caminhoes, setCaminhoes] = useState<Caminhao[]>([])
  const [motoristas, setMotoristas] = useState<Motorista[]>([])
  const [frotas, setFrotas] = useState<Frota[]>([])
  const [carretas, setCarretas] = useState<Carreta[]>([])
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  // ── CAMINHÕES ──
  const [busca, setBusca] = useState('')
  const [sel, setSel] = useState<Caminhao | null>(null)
  const [mostraCad, setMostraCad] = useState(false)
  const [aba, setAba] = useState<'info' | 'licencas'>('info')
  const [licencas, setLicencas] = useState<Licenca[]>([])
  
  // Estados de Edição Caminhão
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

  // Estados de Licença
  const [novaLicEstado, setNovaLicEstado] = useState('')
  const [novaLicVencimento, setNovaLicVencimento] = useState('')

  // Estados de Cadastro Caminhão
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
  const [buscaCarreta, setBuscaCarreta] = useState('')
  const [selCarreta, setSelCarreta] = useState<Carreta | null>(null)
  const [mostraCadCarreta, setMostraCadCarreta] = useState(false)
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
  const [buscaMan, setBuscaMan] = useState('')
  const [historicoMan, setHistoricoMan] = useState<Manutencao[]>([])
  const [mostraNovaMan, setMostraNovaMan] = useState(false)
  const [manCamId, setManCamId] = useState('')
  const [manTipo, setManTipo] = useState('')
  const [manDesc, setManDesc] = useState('')
  const [manEntrada, setManEntrada] = useState(new Date().toISOString().split('T')[0])
  const [manSaida, setManSaida] = useState('')
  const [manValor, setManValor] = useState('')
  const [manStatus, setManStatus] = useState('EM ANDAMENTO')
  const [manObs, setManObs] = useState('')
  const [manSubstitutoId, setManSubstitutoId] = useState('')

  useEffect(() => {
    fetch_(); motoristasAPI.listar().then(setMotoristas).catch(() => {}); fetchFrotas(); fetchCarretas(); fetchHistoricoMan()
  }, [])

  async function fetch_() { const data = await caminhoesAPI.listar(); setCaminhoes(data) }
  async function fetchFrotas() { const { data } = await supabase.from('frotas').select('*').order('nome'); if (data) setFrotas(data) }
  async function fetchCarretas() { const { data } = await supabase.from('carretas').select('*').order('placa'); if (data) setCarretas(data) }
  async function fetchHistoricoMan() { const { data } = await supabase.from('manutencoes').select('*').order('data_entrada', { ascending: false }); if (data) setHistoricoMan(data) }
  async function fetchLicencas(caminhaoId: string) { const { data } = await supabase.from('licencas').select('*').eq('caminhao_id', caminhaoId).order('estado', { ascending: true }); if (data) setLicencas(data) }

  function showMsg(t: string) { setMsg(t); setTimeout(() => setMsg(''), 3000) }

  // ── CAMINHÕES handlers ──
  const filtrados = useMemo(() => {
    if (!busca.trim()) return caminhoes
    const b = busca.toLowerCase()
    return caminhoes.filter(c => c.placa?.toLowerCase().includes(b) || c.modelo?.toLowerCase().includes(b) || c.frota?.toLowerCase().includes(b))
  }, [caminhoes, busca])

  function selecionar(c: Caminhao) {
    setSel(c); setEditPlaca(c.placa||''); setEditPlacaCarreta(c.placa_carreta||'')
    setEditModelo(c.modelo||''); setEditAno(c.ano||''); setEditStatus(c.status||'rodando')
    setEditMotivo(c.motivo_parado||''); setEditDtParado(c.dt_parado||'')
    setEditMotorista(c.motorista_atual||''); setEditFrota(c.frota||''); setEditObs(c.obs_documentos||'')
    setAba('info'); fetchLicencas(c.id)
  }

  async function salvar() {
    if (!sel) return; setLoading(true)
    await caminhoesAPI.atualizar(sel.id, {
      placa: editPlaca.toUpperCase(), placa_carreta: editPlacaCarreta.toUpperCase(),
      modelo: editModelo, ano: editAno, status: editStatus, frota: editFrota,
      motivo_parado: editStatus !== 'rodando' ? editMotivo : '',
      dt_parado: editStatus !== 'rodando' ? editDtParado : null,
      motorista_atual: editMotorista, obs_documentos: editObs,
    })
    await fetch_(); setLoading(false); setSel(null); showMsg('✅ Atualizado!')
  }

  async function cadastrar() {
    if (!cadPlaca.trim()) return; setLoading(true)
    await caminhoesAPI.criar({ 
      placa: cadPlaca.toUpperCase(), placa_carreta: cadPlacaCarreta.toUpperCase(), 
      modelo: cadModelo, ano: cadAno, status: cadStatus, frota: cadFrota, 
      motivo_parado: cadStatus !== 'rodando' ? cadMotivo : '', 
      dt_parado: cadStatus !== 'rodando' ? cadDtParado : null, 
      motorista_atual: cadMotorista, obs_documentos: cadObs 
    })
    await fetch_(); setLoading(false); setMostraCad(false); showMsg('✅ Cadastrado!')
  }

  async function adicionarLicenca() {
    if (!sel || !novaLicEstado || !novaLicVencimento) return; setLoading(true)
    const { error } = await supabase.from('licencas').insert({ caminhao_id: sel.id, estado: novaLicEstado, vencimento: novaLicVencimento })
    if (!error) {
      fetchLicencas(sel.id); setNovaLicEstado(''); setNovaLicVencimento(''); showMsg('✅ Licença adicionada!')
    }
    setLoading(false)
  }

  async function excluirLicenca(id: string) {
    const { error } = await supabase.from('licencas').delete().eq('id', id)
    if (!error && sel) fetchLicencas(sel.id)
  }

  // ── CARRETAS handlers ──
  const filtradasCarretas = useMemo(() => {
    if (!buscaCarreta.trim()) return carretas
    return carretas.filter(c => c.placa?.toLowerCase().includes(buscaCarreta.toLowerCase()))
  }, [carretas, buscaCarreta])

  async function salvarCarreta() {
    if (!selCarreta) return; setLoading(true)
    await supabase.from('carretas').update({ placa: editCPlaca.toUpperCase(), modelo: editCModelo, ano: editCAno, status: editCStatus, obs: editCObs }).eq('id', selCarreta.id)
    await fetchCarretas(); setLoading(false); setSelCarreta(null); showMsg('✅ Carreta atualizada!')
  }

  async function cadastrarCarreta() {
    if (!cadCPlaca.trim()) return; setLoading(true)
    await supabase.from('carretas').insert({ placa: cadCPlaca.toUpperCase(), modelo: cadCModelo, ano: cadCAno, status: cadCStatus, obs: cadCObs })
    await fetchCarretas(); setLoading(false); setMostraCadCarreta(false); showMsg('✅ Carreta cadastrada!')
  }

  // ── MANUTENÇÃO handlers ──
  async function salvarManutencao() {
    if (!manCamId || !manTipo) return; setLoading(true)
    try {
      const cam = caminhoes.find(c => c.id === manCamId)
      const sub = caminhoes.find(c => c.id === manSubstitutoId)
      const nova = {
        caminhao_id: manCamId, 
        caminhao_placa: cam?.placa || '', 
        tipo: manTipo, 
        descricao: manDesc,
        data_entrada: manEntrada, 
        data_saida: manSaida || null, 
        valor: parseFloat(manValor) || null,
        status: manStatus, 
        obs: manObs, 
        caminhao_substituto_id: manSubstitutoId || null,
        caminhao_substituto_placa: sub?.placa || null, 
        motorista_nome: cam?.motorista_atual || null
      }
      
      const { error } = await supabase.from('manutencoes').insert(nova)
      if (error) throw error

      if (manStatus === 'EM ANDAMENTO') {
        await supabase.from('caminhoes').update({ 
          status: 'manutencao', 
          motivo_parado: manTipo, 
          dt_parado: manEntrada 
        }).eq('id', manCamId)
        
        if (manSubstitutoId && cam?.motorista_atual) {
          await supabase.from('caminhoes').update({ 
            motorista_atual: cam.motorista_atual 
          }).eq('id', manSubstitutoId)
        }
      }
      
      showMsg('✅ Manutenção registrada!')
      setMostraNovaMan(false)
      // Resetar campos
      setManCamId(''); setManTipo(''); setManDesc(''); setManValor(''); setManObs(''); setManSubstitutoId('')
      fetchHistoricoMan()
      fetch_()
    } catch (e: any) {
      alert('Erro ao salvar manutenção: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  const filtradosMan = useMemo(() => {
    if (!buscaMan.trim()) return historicoMan
    return historicoMan.filter(m => m.caminhao_placa?.toLowerCase().includes(buscaMan.toLowerCase()))
  }, [historicoMan, buscaMan])

  return (
    <div className="p-6 max-w-full bg-gray-50 min-h-screen font-sans">
      {msg && <div className="fixed top-6 right-6 z-50 p-4 bg-green-600 text-white rounded-2xl shadow-2xl font-black text-xs uppercase tracking-widest animate-bounce"> {msg} </div>}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-4xl font-black text-gray-900 tracking-tighter uppercase">Gestão de Frota</h1>
          <p className="text-sm text-gray-400 font-bold uppercase tracking-widest mt-1">Controle de veículos, carretas e manutenção</p>
        </div>
        <div className="flex bg-white p-1.5 rounded-2xl shadow-sm border border-gray-100">
          <button onClick={() => setAbaGlobal('caminhoes')} className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${abaGlobal === 'caminhoes' ? 'bg-red-600 text-white shadow-lg shadow-red-100' : 'text-gray-400 hover:text-gray-600'}`}>Caminhões</button>
          <button onClick={() => setAbaGlobal('carretas')} className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${abaGlobal === 'carretas' ? 'bg-red-600 text-white shadow-lg shadow-red-100' : 'text-gray-400 hover:text-gray-600'}`}>Carretas</button>
          <button onClick={() => setAbaGlobal('manutencao')} className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${abaGlobal === 'manutencao' ? 'bg-red-600 text-white shadow-lg shadow-red-100' : 'text-gray-400 hover:text-gray-600'}`}>Manutenção</button>
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
                <div className="space-y-1"><label className={LC}>Placa</label><input value={cadPlaca} onChange={e => setCadPlaca(e.target.value)} className={IC} /></div>
                <div className="space-y-1"><label className={LC}>Modelo</label><input value={cadModelo} onChange={e => setCadModelo(e.target.value)} className={IC} /></div>
                <div className="space-y-1"><label className={LC}>Ano</label><input value={cadAno} onChange={e => setCadAno(e.target.value)} className={IC} /></div>
              </div>
              <button onClick={cadastrar} className="w-full bg-red-600 hover:bg-red-700 text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-red-100">Cadastrar Veículo</button>
            </div>
          ) : (
            <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl border border-gray-100 max-w-5xl mx-auto">
              <div className="flex items-center justify-between mb-8">
                <button onClick={() => setSel(null)} className="flex items-center gap-2 text-gray-400 hover:text-red-600 font-black text-xs uppercase tracking-widest"><ArrowLeft size={16}/> Voltar</button>
                <div className="flex gap-3">
                  <button onClick={salvar} className="bg-red-600 text-white px-6 py-2 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2"><Save size={16}/> Salvar</button>
                </div>
              </div>
              
              <div className="flex gap-6 mb-8 border-b border-gray-100">
                <button onClick={() => setAba('info')} className={`pb-4 text-xs font-black uppercase tracking-widest transition-all ${aba === 'info' ? 'text-red-600 border-b-2 border-red-600' : 'text-gray-400'}`}>Informações</button>
                <button onClick={() => setAba('licencas')} className={`pb-4 text-xs font-black uppercase tracking-widest transition-all ${aba === 'licencas' ? 'text-red-600 border-b-2 border-red-600' : 'text-gray-400'}`}>Licenças Estaduais</button>
              </div>

              {aba === 'info' ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-1"><label className={LC}>Placa</label><input value={editPlaca} onChange={e => setEditPlaca(e.target.value)} className={IC} /></div>
                  <div className="space-y-1"><label className={LC}>Modelo</label><input value={editModelo} onChange={e => setEditModelo(e.target.value)} className={IC} /></div>
                  <div className="space-y-1"><label className={LC}>Status</label><select value={editStatus} onChange={e => setEditStatus(e.target.value)} className={IC}><option value="rodando">Rodando</option><option value="manutencao">Manutenção</option><option value="parado">Parado</option></select></div>
                  <div className="space-y-1"><label className={LC}>Motorista Atual</label><select value={editMotorista} onChange={e => setEditMotorista(e.target.value)} className={IC}><option value="">Sem motorista</option>{motoristas.map(m => <option key={m.id} value={m.nome}>{m.nome}</option>)}</select></div>
                  <div className="space-y-1"><label className={LC}>Frota</label><select value={editFrota} onChange={e => setEditFrota(e.target.value)} className={IC}><option value="">Selecione...</option>{frotas.map(f => <option key={f.id} value={f.nome}>{f.nome}</option>)}</select></div>
                  <div className="space-y-1"><label className={LC}>Ano</label><input value={editAno} onChange={e => setEditAno(e.target.value)} className={IC} /></div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100">
                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Nova Licença</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                      <div className="space-y-1"><label className={LC}>Estado</label><select value={novaLicEstado} onChange={e => setNovaLicEstado(e.target.value)} className={IC}><option value="">Selecione...</option>{ESTADOS.map(uf => <option key={uf} value={uf}>{uf}</option>)}</select></div>
                      <div className="space-y-1"><label className={LC}>Vencimento</label><input type="date" value={novaLicVencimento} onChange={e => setNovaLicVencimento(e.target.value)} className={IC} /></div>
                      <button onClick={adicionarLicenca} className="bg-gray-900 text-white h-[42px] rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-black transition-all">Adicionar</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {licencas.map(l => {
                      const dias = diasParaVencer(l.vencimento)
                      return (
                        <div key={l.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between group">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center text-red-600 font-black text-xs">{l.estado}</div>
                            <div>
                              <p className="text-[10px] font-black text-gray-400 uppercase">Vencimento</p>
                              <p className={`text-xs font-black ${dias !== null && dias < 30 ? 'text-red-600' : 'text-gray-900'}`}>{fmtData(l.vencimento)}</p>
                            </div>
                          </div>
                          <button onClick={() => excluirLicenca(l.id)} className="text-gray-300 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={16}/></button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {abaGlobal === 'carretas' && (
        <div className="space-y-6">
          {!selCarreta && !mostraCadCarreta ? (
            <>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="relative flex-1 max-w-md">
                  <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input value={buscaCarreta} onChange={e => setBuscaCarreta(e.target.value)} placeholder="Pesquisar placa..." className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-2xl outline-none focus:ring-2 focus:ring-red-500 transition-all text-sm font-bold shadow-inner" />
                </div>
                <button onClick={() => setMostraCadCarreta(true)} className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-red-100 flex items-center gap-2"><Plus size={16} /> Nova Carreta</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filtradasCarretas.map(c => (
                  <div key={c.id} onClick={() => { setSelCarreta(c); setEditCPlaca(c.placa); setEditCModelo(c.modelo); setEditCAno(c.ano); setEditCStatus(c.status); setEditCObs(c.obs) }} className="bg-white p-6 rounded-[2rem] shadow-xl border border-gray-100 hover:border-red-200 transition-all cursor-pointer group">
                    <div className="flex justify-between items-start mb-4">
                      <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-red-50 group-hover:text-red-600 transition-all"><Truck size={24} /></div>
                      <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${c.status === 'disponivel' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{c.status}</span>
                    </div>
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
                <div className="space-y-1"><label className={LC}>Placa</label><input value={cadCPlaca} onChange={e => setCadCPlaca(e.target.value)} className={IC} /></div>
                <div className="space-y-1"><label className={LC}>Modelo</label><input value={cadCModelo} onChange={e => setCadCModelo(e.target.value)} className={IC} /></div>
                <div className="space-y-1"><label className={LC}>Ano</label><input value={cadCAno} onChange={e => setCadCAno(e.target.value)} className={IC} /></div>
              </div>
              <button onClick={cadastrarCarreta} className="w-full bg-red-600 hover:bg-red-700 text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-red-100">Cadastrar Carreta</button>
            </div>
          ) : (
            <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl border border-gray-100 max-w-4xl mx-auto">
              <div className="flex items-center justify-between mb-8"><button onClick={() => setSelCarreta(null)} className="flex items-center gap-2 text-gray-400 hover:text-red-600 font-black text-xs uppercase tracking-widest"><ArrowLeft size={16}/> Voltar</button><button onClick={salvarCarreta} className="bg-red-600 text-white px-6 py-2 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2"><Save size={16}/> Salvar</button></div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-1"><label className={LC}>Placa</label><input value={editCPlaca} onChange={e => setEditCPlaca(e.target.value)} className={IC} /></div>
                <div className="space-y-1"><label className={LC}>Modelo</label><input value={editCModelo} onChange={e => setEditCModelo(e.target.value)} className={IC} /></div>
                <div className="space-y-1"><label className={LC}>Ano</label><input value={editCAno} onChange={e => setEditCAno(e.target.value)} className={IC} /></div>
              </div>
            </div>
          )}
        </div>
      )}

      {abaGlobal === 'manutencao' && (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={buscaMan} onChange={e => setBuscaMan(e.target.value)} placeholder="Pesquisar placa..." className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-2xl outline-none focus:ring-2 focus:ring-red-500 transition-all text-sm font-bold shadow-inner" />
            </div>
            <button onClick={() => setMostraNovaMan(true)} className="bg-gray-900 hover:bg-black text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg flex items-center gap-2"><Wrench size={16} /> Registrar Manutenção</button>
          </div>

          <div className="bg-white rounded-[2rem] shadow-xl border border-gray-100 overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100">
                  <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Veículo</th>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Tipo / Descrição</th>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Entrada / Saída</th>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</th>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Substituto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtradosMan.map(m => (
                  <tr key={m.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 font-black text-gray-900 text-sm">{m.caminhao_placa}</td>
                    <td className="px-6 py-4">
                      <p className="text-xs font-black text-red-600 uppercase">{m.tipo}</p>
                      <p className="text-[10px] font-bold text-gray-400 truncate max-w-[200px]">{m.descricao}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-xs font-bold text-gray-900">{fmtData(m.data_entrada)}</p>
                      <p className="text-[10px] font-bold text-gray-400">{m.data_saida ? fmtData(m.data_saida) : 'Em aberto'}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-widest ${m.status === 'CONCLUÍDO' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{m.status}</span>
                    </td>
                    <td className="px-6 py-4 text-xs font-black text-blue-600">{m.caminhao_substituto_placa || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {mostraNovaMan && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden">
            <div className="px-8 py-6 bg-gray-900 flex items-center justify-between">
              <h2 className="text-white font-black text-xl uppercase tracking-tighter">Registrar Manutenção</h2>
              <button onClick={() => setMostraNovaMan(false)} className="text-white/80 hover:text-white"><X size={24}/></button>
            </div>
            <div className="p-8 space-y-6 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1"><label className={LC}>Veículo</label><select value={manCamId} onChange={e => setManCamId(e.target.value)} className={IC}><option value="">Selecione...</option>{caminhoes.map(c => <option key={c.id} value={c.id}>{c.placa}</option>)}</select></div>
                <div className="space-y-1"><label className={LC}>Tipo</label><select value={manTipo} onChange={e => setManTipo(e.target.value)} className={IC}><option value="">Selecione...</option>{TIPOS_MANUTENCAO.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                <div className="space-y-1"><label className={LC}>Data Entrada</label><input type="date" value={manEntrada} onChange={e => setManEntrada(e.target.value)} className={IC} /></div>
                <div className="space-y-1"><label className={LC}>Veículo Substituto</label><select value={manSubstitutoId} onChange={e => setManSubstitutoId(e.target.value)} className={IC}><option value="">Nenhum</option>{caminhoes.filter(c => c.id !== manCamId).map(c => <option key={c.id} value={c.id}>{c.placa}</option>)}</select></div>
              </div>
              <div className="space-y-1"><label className={LC}>Descrição</label><textarea value={manDesc} onChange={e => setManDesc(e.target.value)} className={`${IC} h-24 resize-none`} placeholder="Detalhes da manutenção..." /></div>
              <button onClick={salvarManutencao} disabled={loading} className="w-full bg-red-600 hover:bg-red-700 text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-red-100 transition-all active:scale-95 disabled:opacity-50">{loading ? 'Salvando...' : 'Confirmar Registro'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
