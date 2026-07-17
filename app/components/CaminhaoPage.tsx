'use client'
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../services/supabase'
import { useAuth } from '../services/auth'
import { Search, Plus, ArrowLeft, Save, Trash2, ChevronRight, Truck, Wrench, X } from 'lucide-react'

interface Caminhao {
  id: string; placa: string; placa_carreta: string; modelo: string; ano: string
  status: string; motivo_parado: string; dt_parado: string
  motorista_atual: string; obs_documentos: string; frota: string
  vencimento_cronotacografo?: string; vencimento_permisso?: string
}
interface Carreta { id: string; placa: string; modelo: string; ano: string; status: string; obs: string }
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
const ESTADOS_NOMES: Record<string, string> = {
  AC: 'Acre', AL: 'Alagoas', AP: 'Amapá', AM: 'Amazonas', BA: 'Bahia',
  CE: 'Ceará', DF: 'Distrito Federal', ES: 'Espírito Santo', GO: 'Goiás',
  MA: 'Maranhão', MT: 'Mato Grosso', MS: 'Mato Grosso do Sul', MG: 'Minas Gerais',
  PA: 'Pará', PB: 'Paraíba', PR: 'Paraná', PE: 'Pernambuco', PI: 'Piauí',
  RJ: 'Rio de Janeiro', RN: 'Rio Grande do Norte', RS: 'Rio Grande do Sul',
  RO: 'Rondônia', RR: 'Roraima', SC: 'Santa Catarina', SP: 'São Paulo',
  SE: 'Sergipe', TO: 'Tocantins',
}
const TIPOS_MANUTENCAO = ['Troca de óleo','Revisão geral','Freios','Pneus','Suspensão','Motor','Câmbio','Elétrica','Funilaria/Pintura','Outro']

const IC = "mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-red-500 bg-gray-50"
const LC = "text-[10px] font-black text-gray-400 uppercase tracking-widest"

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

  const [caminhoes, setCaminhoes]   = useState<Caminhao[]>([])
  const [motoristas, setMotoristas] = useState<Motorista[]>([])
  const [frotas, setFrotas]         = useState<Frota[]>([])
  const [carretas, setCarretas]     = useState<Carreta[]>([])
  const [loading, setLoading]       = useState(false)
  const [msg, setMsg]               = useState('')

  const [busca, setBusca]         = useState('')
  const [sel, setSel]             = useState<Caminhao | null>(null)
  const [mostraCad, setMostraCad] = useState(false)
  const [aba, setAba]             = useState<'info' | 'licencas'>('info')
  const [licencas, setLicencas]   = useState<Licenca[]>([])

  const [editPlaca, setEditPlaca]               = useState('')
  const [editPlacaCarreta, setEditPlacaCarreta] = useState('')
  const [editModelo, setEditModelo]             = useState('')
  const [editAno, setEditAno]                   = useState('')
  const [editStatus, setEditStatus]             = useState('rodando')
  const [editMotivo, setEditMotivo]             = useState('')
  const [editDtParado, setEditDtParado]         = useState('')
  const [editMotorista, setEditMotorista]       = useState('')
  const [editFrota, setEditFrota]               = useState('')
  const [editObs, setEditObs]                   = useState('')
  const [editVencCronotacografo, setEditVencCronotacografo] = useState('')
  const [editVencPermisso, setEditVencPermisso]             = useState('')
  const [novaLicEstado, setNovaLicEstado]         = useState('')
  const [novaLicVencimento, setNovaLicVencimento] = useState('')
  const [cadPlaca, setCadPlaca]               = useState('')
  const [cadPlacaCarreta, setCadPlacaCarreta] = useState('')
  const [cadModelo, setCadModelo]             = useState('')
  const [cadAno, setCadAno]                   = useState('')
  const [cadStatus, setCadStatus]             = useState('rodando')
  const [cadMotorista, setCadMotorista]       = useState('')
  const [cadFrota, setCadFrota]               = useState('')
  const [cadObs, setCadObs]                   = useState('')

  const [buscaCarreta, setBuscaCarreta]         = useState('')
  const [selCarreta, setSelCarreta]             = useState<Carreta | null>(null)
  const [mostraCadCarreta, setMostraCadCarreta] = useState(false)
  const [editCPlaca, setEditCPlaca]   = useState('')
  const [editCModelo, setEditCModelo] = useState('')
  const [editCAno, setEditCAno]       = useState('')
  const [editCStatus, setEditCStatus] = useState('disponivel')
  const [editCObs, setEditCObs]       = useState('')
  const [cadCPlaca, setCadCPlaca]   = useState('')
  const [cadCModelo, setCadCModelo] = useState('')
  const [cadCAno, setCadCAno]       = useState('')
  const [cadCStatus, setCadCStatus] = useState('disponivel')
  const [cadCObs, setCadCObs]       = useState('')

  const [buscaMan, setBuscaMan]           = useState('')
  const [historicoMan, setHistoricoMan]   = useState<Manutencao[]>([])
  const [mostraNovaMan, setMostraNovaMan] = useState(false)
  const [editandoMan, setEditandoMan]     = useState<Manutencao | null>(null)
  const [manCamId, setManCamId]               = useState('')
  const [manTipo, setManTipo]                 = useState('')
  const [manDesc, setManDesc]                 = useState('')
  const [manEntrada, setManEntrada]           = useState(new Date().toISOString().split('T')[0])
  const [manSaida, setManSaida]               = useState('')
  const [manValor, setManValor]               = useState('')
  const [manStatus, setManStatus]             = useState('EM ANDAMENTO')
  const [manObs, setManObs]                   = useState('')
  const [manSubstitutoId, setManSubstitutoId] = useState('')

  useEffect(() => {
    Promise.all([
      fetch_(),
      fetchMotoristas(),
      fetchFrotas(),
      fetchCarretas(),
      fetchHistoricoMan()
    ])
  }, [])

  async function fetch_() {
    const { data } = await supabase.from('caminhoes').select('*').order('placa')
    if (data) setCaminhoes(data)
  }

  async function fetchMotoristas() {
    const { data } = await supabase.from('motoristas').select('id, nome, ativo').order('nome')
    if (data) setMotoristas(data)
  }

  async function fetchFrotas() {
    const { data } = await supabase.from('frotas').select('*').order('nome')
    if (data) setFrotas(data)
  }

  async function fetchCarretas() {
    const { data } = await supabase.from('carretas').select('*').order('placa')
    if (data) setCarretas(data)
  }

  async function fetchHistoricoMan() {
    const { data } = await supabase.from('manutencoes').select('*').order('data_entrada', { ascending: false })
    if (data) setHistoricoMan(data)
  }

  async function fetchLicencas(caminhaoId: string) {
    const { data } = await supabase.from('licencas').select('*').eq('caminhao_id', caminhaoId).order('estado')
    if (data) setLicencas(data)
  }

  function showMsg(t: string) { setMsg(t); setTimeout(() => setMsg(''), 3000) }

  const filtrados = useMemo(() => {
    if (!busca.trim()) return caminhoes
    const b = busca.toLowerCase()
    return caminhoes.filter(c =>
      c.placa?.toLowerCase().includes(b) ||
      c.modelo?.toLowerCase().includes(b) ||
      c.frota?.toLowerCase().includes(b)
    )
  }, [caminhoes, busca])

  function selecionar(c: Caminhao) {
    setSel(c)
    setEditPlaca(c.placa || ''); setEditPlacaCarreta(c.placa_carreta || '')
    setEditModelo(c.modelo || ''); setEditAno(c.ano || '')
    setEditStatus(c.status || 'rodando'); setEditMotivo(c.motivo_parado || '')
    setEditDtParado(c.dt_parado || ''); setEditMotorista(c.motorista_atual || '')
    setEditFrota(c.frota || ''); setEditObs(c.obs_documentos || '')
    setEditVencCronotacografo(c.vencimento_cronotacografo || '')
    setEditVencPermisso(c.vencimento_permisso || '')
    setAba('info'); fetchLicencas(c.id)
  }

  async function salvar() {
    if (!sel) return
    setLoading(true)
    await supabase.from('caminhoes').update({
      placa: editPlaca.toUpperCase(), placa_carreta: editPlacaCarreta.toUpperCase(),
      modelo: editModelo, ano: editAno, status: editStatus, frota: editFrota,
      motivo_parado: editStatus !== 'rodando' ? editMotivo : '',
      dt_parado: editStatus !== 'rodando' ? editDtParado : null,
      motorista_atual: editMotorista, obs_documentos: editObs,
      vencimento_cronotacografo: editVencCronotacografo || null,
      vencimento_permisso: editVencPermisso || null,
    }).eq('id', sel.id)
    await fetch_()
    setLoading(false); setSel(null); showMsg('✅ Atualizado!')
  }

  async function cadastrar() {
    if (!cadPlaca.trim()) return
    setLoading(true)
    await supabase.from('caminhoes').insert({
      placa: cadPlaca.toUpperCase(), placa_carreta: cadPlacaCarreta.toUpperCase(),
      modelo: cadModelo, ano: cadAno, status: cadStatus, frota: cadFrota,
      motivo_parado: '', dt_parado: null, motorista_atual: cadMotorista, obs_documentos: cadObs
    })
    await fetch_()
    setLoading(false); setMostraCad(false); showMsg('✅ Cadastrado!')
  }

  async function adicionarLicenca() {
    if (!sel || !novaLicEstado || !novaLicVencimento) return
    setLoading(true)
    await supabase.from('licencas').insert({ caminhao_id: sel.id, estado: novaLicEstado, vencimento: novaLicVencimento })
    fetchLicencas(sel.id); setNovaLicEstado(''); setNovaLicVencimento('')
    setLoading(false); showMsg('✅ Licença adicionada!')
  }

  async function excluirLicenca(id: string) {
    await supabase.from('licencas').delete().eq('id', id)
    if (sel) fetchLicencas(sel.id)
  }

  const filtradasCarretas = useMemo(() => {
    if (!buscaCarreta.trim()) return carretas
    return carretas.filter(c => c.placa?.toLowerCase().includes(buscaCarreta.toLowerCase()))
  }, [carretas, buscaCarreta])

  async function salvarCarreta() {
    if (!selCarreta) return
    setLoading(true)
    await supabase.from('carretas').update({
      placa: editCPlaca.toUpperCase(), modelo: editCModelo, ano: editCAno, status: editCStatus, obs: editCObs
    }).eq('id', selCarreta.id)
    await fetchCarretas()
    setLoading(false); setSelCarreta(null); showMsg('✅ Carreta atualizada!')
  }

  async function cadastrarCarreta() {
    if (!cadCPlaca.trim()) return
    setLoading(true)
    await supabase.from('carretas').insert({
      placa: cadCPlaca.toUpperCase(), modelo: cadCModelo, ano: cadCAno, status: cadCStatus, obs: cadCObs
    })
    await fetchCarretas()
    setLoading(false); setMostraCadCarreta(false); showMsg('✅ Carreta cadastrada!')
  }

  function abrirNovaMan() {
    setEditandoMan(null)
    setManCamId(''); setManTipo(''); setManDesc('')
    setManEntrada(new Date().toISOString().split('T')[0])
    setManSaida(''); setManValor(''); setManStatus('EM ANDAMENTO')
    setManObs(''); setManSubstitutoId('')
    setMostraNovaMan(true)
  }

  function abrirEdicaoMan(m: Manutencao) {
    setEditandoMan(m)
    setManCamId(m.caminhao_id); setManTipo(m.tipo); setManDesc(m.descricao)
    setManEntrada(m.data_entrada); setManSaida(m.data_saida || '')
    setManValor(m.valor ? String(m.valor) : ''); setManStatus(m.status)
    setManObs(m.obs || ''); setManSubstitutoId(m.caminhao_substituto_id || '')
    setMostraNovaMan(true)
  }

  async function salvarManutencao() {
    if (!manCamId || !manTipo) {
      showMsg('❌ Selecione o veículo e o tipo'); return
    }
    setLoading(true)
    try {
      const cam = caminhoes.find(c => c.id === manCamId)
      const sub = caminhoes.find(c => c.id === manSubstitutoId)

      const dadosHistorico = {
        caminhao_id:               manCamId,
        caminhao_placa:            cam?.placa || '',
        tipo:                      manTipo,
        descricao:                 manDesc,
        data_entrada:              manEntrada,
        data_saida:                manSaida || null,
        valor:                     parseFloat(manValor) || null,
        status:                    manStatus,
        obs:                       manObs,
        caminhao_substituto_id:    manSubstitutoId || null,
        caminhao_substituto_placa: sub?.placa || null,
        motorista_nome:            cam?.motorista_atual || null,
      }

      let saveError: any = null
      if (editandoMan) {
        const { error } = await supabase.from('manutencoes').update(dadosHistorico).eq('id', editandoMan.id)
        saveError = error
      } else {
        const { error } = await supabase.from('manutencoes').insert(dadosHistorico)
        saveError = error
      }

      if (saveError) {
        showMsg('❌ ' + (saveError.message || 'Erro ao salvar'))
        setLoading(false); return
      }

      if (manStatus === 'EM ANDAMENTO') {
        await supabase.from('caminhoes')
          .update({ status: 'manutencao', motivo_parado: manTipo, dt_parado: manEntrada })
          .eq('id', manCamId)
        if (manSubstitutoId && cam?.motorista_atual) {
          await supabase.from('caminhoes').update({ motorista_atual: cam.motorista_atual }).eq('id', manSubstitutoId)
          await supabase.from('caminhoes').update({ motorista_atual: '' }).eq('id', manCamId)
        }
      } else if (manStatus === 'CONCLUÍDO') {
        await supabase.from('caminhoes')
          .update({ status: 'rodando', motivo_parado: '', dt_parado: null })
          .eq('id', manCamId)
        if (manSubstitutoId) {
          const motoristaOriginal = editandoMan?.motorista_nome || cam?.motorista_atual
          if (motoristaOriginal) {
            await supabase.from('caminhoes').update({ motorista_atual: motoristaOriginal }).eq('id', manCamId)
            await supabase.from('caminhoes').update({ motorista_atual: '' }).eq('id', manSubstitutoId)
          }
        }
      }

      showMsg(editandoMan ? '✅ Atualizado!' : '✅ Registrado!')
      setMostraNovaMan(false); setEditandoMan(null)
      await fetchHistoricoMan(); await fetch_()
    } catch (e: any) {
      showMsg('❌ Erro: ' + (e.message || 'Erro desconhecido'))
    } finally {
      setLoading(false)
    }
  }

  async function excluirManutencao(id: string) {
    await supabase.from('manutencoes').delete().eq('id', id)
    setMostraNovaMan(false); setEditandoMan(null)
    await fetchHistoricoMan(); showMsg('Manutenção excluída.')
  }

  const filtradosMan = useMemo(() => {
    if (!buscaMan.trim()) return historicoMan
    const b = buscaMan.toLowerCase()
    return historicoMan.filter(m =>
      m.caminhao_placa?.toLowerCase().includes(b) ||
      m.tipo?.toLowerCase().includes(b)
    )
  }, [historicoMan, buscaMan])

  return (
    <div className="p-6 max-w-full bg-gray-50 min-h-screen font-sans">
      {msg && (
        <div className="fixed top-6 right-6 z-50 p-4 bg-gray-900 text-white rounded-2xl shadow-2xl font-black text-xs uppercase tracking-widest">
          {msg}
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-4xl font-black text-gray-900 tracking-tighter uppercase">Gestão de Frota</h1>
          <p className="text-sm text-gray-400 font-bold uppercase tracking-widest mt-1">Controle de veículos, carretas e manutenção</p>
        </div>
        <div className="flex bg-white p-1.5 rounded-2xl shadow-sm border border-gray-100">
          {(['caminhoes', 'carretas', 'manutencao'] as const).map(ab => (
            <button key={ab} onClick={() => setAbaGlobal(ab)}
              className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all
                ${abaGlobal === ab ? 'bg-red-600 text-white shadow-lg shadow-red-100' : 'text-gray-400 hover:text-gray-600'}`}>
              {ab === 'caminhoes' ? 'Caminhões' : ab === 'carretas' ? 'Carretas' : 'Manutenção'}
            </button>
          ))}
        </div>
      </div>

      {/* ── ABA CAMINHÕES ── */}
      {abaGlobal === 'caminhoes' && (
        <div className="space-y-6">
          {!sel && !mostraCad ? (
            <>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="relative flex-1 max-w-md">
                  <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"/>
                  <input value={busca} onChange={e => setBusca(e.target.value)}
                    placeholder="Pesquisar placa, modelo ou frota..."
                    className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-2xl outline-none focus:ring-2 focus:ring-red-500 text-sm font-bold shadow-inner"/>
                </div>
                <button onClick={() => setMostraCad(true)}
                  className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-red-100 flex items-center gap-2">
                  <Plus size={16}/> Novo Caminhão
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filtrados.map(c => {
                  const manAtiva = historicoMan.find(m =>
                    m.caminhao_id === c.id &&
                    m.status === 'EM ANDAMENTO' &&
                    m.caminhao_substituto_placa
                  )
                  return (
                    <div key={c.id} onClick={() => selecionar(c)}
                      className="bg-white p-6 rounded-[2rem] shadow-xl border border-gray-100 hover:border-red-200 transition-all cursor-pointer group">
                      <div className="flex justify-between items-start mb-4">
                        <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-red-50 group-hover:text-red-600 transition-all">
                          <Truck size={24}/>
                        </div>
                        <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest
                          ${c.status === 'rodando' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {c.status}
                        </span>
                      </div>
                      <h3 className="text-xl font-black text-gray-900 tracking-tighter mb-1">{c.placa}</h3>
                      <p className="text-xs font-bold text-gray-400 uppercase mb-3">{c.modelo} • {c.ano}</p>
                      {manAtiva?.caminhao_substituto_placa && (
                        <div className="mb-3 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 flex items-center gap-2">
                          <span className="text-[10px] font-black text-blue-400 uppercase">Substituído por</span>
                          <span className="text-xs font-black text-blue-700">🚛 {manAtiva.caminhao_substituto_placa}</span>
                        </div>
                      )}
                      <div className="pt-3 border-t border-gray-50 flex items-center justify-between">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                          Motorista: <span className="text-gray-900">{c.motorista_atual || '—'}</span>
                        </p>
                        <ChevronRight size={16} className="text-gray-300 group-hover:text-red-600 transition-all"/>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          ) : mostraCad ? (
            <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl border border-gray-100 max-w-4xl mx-auto">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-black text-gray-900 tracking-tighter uppercase">Novo Caminhão</h2>
                <button onClick={() => setMostraCad(false)} className="text-gray-400 hover:text-red-600"><X size={24}/></button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="space-y-1"><label className={LC}>Placa *</label><input value={cadPlaca} onChange={e => setCadPlaca(e.target.value)} className={IC}/></div>
                <div className="space-y-1"><label className={LC}>Placa Carreta</label><input value={cadPlacaCarreta} onChange={e => setCadPlacaCarreta(e.target.value)} className={IC}/></div>
                <div className="space-y-1"><label className={LC}>Modelo</label><input value={cadModelo} onChange={e => setCadModelo(e.target.value)} className={IC}/></div>
                <div className="space-y-1"><label className={LC}>Ano</label><input value={cadAno} onChange={e => setCadAno(e.target.value)} className={IC}/></div>
                <div className="space-y-1"><label className={LC}>Motorista</label>
                  <select value={cadMotorista} onChange={e => setCadMotorista(e.target.value)} className={IC}>
                    <option value="">Sem motorista</option>
                    {motoristas.map(m => <option key={m.id} value={m.nome}>{m.nome}</option>)}
                  </select>
                </div>
                <div className="space-y-1"><label className={LC}>Frota</label>
                  <select value={cadFrota} onChange={e => setCadFrota(e.target.value)} className={IC}>
                    <option value="">Selecione...</option>
                    {frotas.map(f => <option key={f.id} value={f.nome}>{f.nome}</option>)}
                  </select>
                </div>
              </div>
              <button onClick={cadastrar} disabled={loading}
                className="w-full bg-red-600 hover:bg-red-700 text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-red-100 disabled:opacity-50">
                Cadastrar Veículo
              </button>
            </div>
          ) : sel ? (
            <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl border border-gray-100 max-w-5xl mx-auto">
              <div className="flex items-center justify-between mb-8">
                <button onClick={() => setSel(null)} className="flex items-center gap-2 text-gray-400 hover:text-red-600 font-black text-xs uppercase tracking-widest">
                  <ArrowLeft size={16}/> Voltar
                </button>
                <button onClick={salvar} disabled={loading}
                  className="bg-red-600 text-white px-6 py-2 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 disabled:opacity-50">
                  <Save size={16}/> Salvar
                </button>
              </div>

              <div className="flex gap-6 mb-8 border-b border-gray-100">
                <button onClick={() => setAba('info')}
                  className={`pb-4 text-xs font-black uppercase tracking-widest transition-all ${aba === 'info' ? 'text-red-600 border-b-2 border-red-600' : 'text-gray-400'}`}>
                  Informações
                </button>
                <button onClick={() => setAba('licencas')}
                  className={`pb-4 text-xs font-black uppercase tracking-widest transition-all ${aba === 'licencas' ? 'text-red-600 border-b-2 border-red-600' : 'text-gray-400'}`}>
                  Documentos
                </button>
              </div>

              {aba === 'info' ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-1"><label className={LC}>Placa</label><input value={editPlaca} onChange={e => setEditPlaca(e.target.value)} className={IC}/></div>
                  <div className="space-y-1"><label className={LC}>Placa Carreta</label><input value={editPlacaCarreta} onChange={e => setEditPlacaCarreta(e.target.value)} className={IC}/></div>
                  <div className="space-y-1"><label className={LC}>Modelo</label><input value={editModelo} onChange={e => setEditModelo(e.target.value)} className={IC}/></div>
                  <div className="space-y-1"><label className={LC}>Ano</label><input value={editAno} onChange={e => setEditAno(e.target.value)} className={IC}/></div>
                  <div className="space-y-1"><label className={LC}>Status</label>
                    <select value={editStatus} onChange={e => setEditStatus(e.target.value)} className={IC}>
                      <option value="rodando">Rodando</option>
                      <option value="manutencao">Manutenção</option>
                      <option value="parado">Parado</option>
                    </select>
                  </div>
                  <div className="space-y-1"><label className={LC}>Motorista Atual</label>
                    <select value={editMotorista} onChange={e => setEditMotorista(e.target.value)} className={IC}>
                      <option value="">Sem motorista</option>
                      {motoristas.map(m => <option key={m.id} value={m.nome}>{m.nome}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1"><label className={LC}>Frota</label>
                    <select value={editFrota} onChange={e => setEditFrota(e.target.value)} className={IC}>
                      <option value="">Selecione...</option>
                      {frotas.map(f => <option key={f.id} value={f.nome}>{f.nome}</option>)}
                    </select>
                  </div>
                  {editStatus !== 'rodando' && (
                    <>
                      <div className="space-y-1"><label className={LC}>Motivo parado</label><input value={editMotivo} onChange={e => setEditMotivo(e.target.value)} className={IC}/></div>
                      <div className="space-y-1"><label className={LC}>Data parado</label><input type="date" value={editDtParado} onChange={e => setEditDtParado(e.target.value)} className={IC}/></div>
                    </>
                  )}
                  <div className="space-y-1 md:col-span-3"><label className={LC}>Observações</label><textarea value={editObs} onChange={e => setEditObs(e.target.value)} className={IC + " h-20 resize-none"}/></div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* ── Cronotacógrafo e Permisso: vencimento único por caminhão ── */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100 space-y-1">
                      <label className={LC}>Cronotacógrafo — Vencimento</label>
                      <input type="date" value={editVencCronotacografo} onChange={e => setEditVencCronotacografo(e.target.value)} className={IC}/>
                      {editVencCronotacografo && (() => {
                        const dias = diasParaVencer(editVencCronotacografo)
                        return dias !== null && dias < 30 ? (
                          <p className={`text-[10px] font-black uppercase mt-1 ${dias < 0 ? 'text-red-600' : 'text-orange-500'}`}>
                            {dias < 0 ? `Vencido há ${Math.abs(dias)}d` : `Vence em ${dias}d`}
                          </p>
                        ) : null
                      })()}
                    </div>
                    <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100 space-y-1">
                      <label className={LC}>Permisso — Vencimento</label>
                      <input type="date" value={editVencPermisso} onChange={e => setEditVencPermisso(e.target.value)} className={IC}/>
                      {editVencPermisso && (() => {
                        const dias = diasParaVencer(editVencPermisso)
                        return dias !== null && dias < 30 ? (
                          <p className={`text-[10px] font-black uppercase mt-1 ${dias < 0 ? 'text-red-600' : 'text-orange-500'}`}>
                            {dias < 0 ? `Vencido há ${Math.abs(dias)}d` : `Vence em ${dias}d`}
                          </p>
                        ) : null
                      })()}
                    </div>
                  </div>

                  {/* ── Licenças Estaduais: múltiplas por caminhão ── */}
                  <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100">
                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Nova Licença Estadual</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                      <div className="space-y-1"><label className={LC}>Estado</label>
                        <select value={novaLicEstado} onChange={e => setNovaLicEstado(e.target.value)} className={IC}>
                          <option value="">Selecione...</option>
                          {ESTADOS.map(uf => <option key={uf} value={uf}>{ESTADOS_NOMES[uf]}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1"><label className={LC}>Vencimento</label><input type="date" value={novaLicVencimento} onChange={e => setNovaLicVencimento(e.target.value)} className={IC}/></div>
                      <button onClick={adicionarLicenca} className="bg-gray-900 text-white h-[42px] rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-black transition-all">Adicionar</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {licencas.map(l => {
                      const dias = diasParaVencer(l.vencimento)
                      return (
                        <div key={l.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between group">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center text-red-600 font-black text-xs shrink-0">{l.estado}</div>
                            <div>
                              <p className="text-[10px] font-black text-gray-400 uppercase">{ESTADOS_NOMES[l.estado] || l.estado}</p>
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
          ) : null}
        </div>
      )}

      {/* ── ABA CARRETAS ── */}
      {abaGlobal === 'carretas' && (
        <div className="space-y-6">
          {!selCarreta && !mostraCadCarreta ? (
            <>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="relative flex-1 max-w-md">
                  <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"/>
                  <input value={buscaCarreta} onChange={e => setBuscaCarreta(e.target.value)} placeholder="Pesquisar placa..."
                    className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-2xl outline-none focus:ring-2 focus:ring-red-500 text-sm font-bold shadow-inner"/>
                </div>
                <button onClick={() => setMostraCadCarreta(true)}
                  className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-red-100 flex items-center gap-2">
                  <Plus size={16}/> Nova Carreta
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filtradasCarretas.map(c => (
                  <div key={c.id}
                    onClick={() => { setSelCarreta(c); setEditCPlaca(c.placa); setEditCModelo(c.modelo); setEditCAno(c.ano); setEditCStatus(c.status); setEditCObs(c.obs) }}
                    className="bg-white p-6 rounded-[2rem] shadow-xl border border-gray-100 hover:border-red-200 transition-all cursor-pointer group">
                    <div className="flex justify-between items-start mb-4">
                      <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-red-50 group-hover:text-red-600 transition-all">
                        <Truck size={24}/>
                      </div>
                      <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest
                        ${c.status === 'disponivel' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {c.status}
                      </span>
                    </div>
                    <h3 className="text-xl font-black text-gray-900 tracking-tighter mb-1">{c.placa}</h3>
                    <p className="text-xs font-bold text-gray-400 uppercase">{c.modelo} • {c.ano}</p>
                  </div>
                ))}
              </div>
            </>
          ) : mostraCadCarreta ? (
            <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl border border-gray-100 max-w-4xl mx-auto">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-black text-gray-900 tracking-tighter uppercase">Nova Carreta</h2>
                <button onClick={() => setMostraCadCarreta(false)} className="text-gray-400 hover:text-red-600"><X size={24}/></button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="space-y-1"><label className={LC}>Placa *</label><input value={cadCPlaca} onChange={e => setCadCPlaca(e.target.value)} className={IC}/></div>
                <div className="space-y-1"><label className={LC}>Modelo</label><input value={cadCModelo} onChange={e => setCadCModelo(e.target.value)} className={IC}/></div>
                <div className="space-y-1"><label className={LC}>Ano</label><input value={cadCAno} onChange={e => setCadCAno(e.target.value)} className={IC}/></div>
                <div className="space-y-1"><label className={LC}>Status</label>
                  <select value={cadCStatus} onChange={e => setCadCStatus(e.target.value)} className={IC}>
                    <option value="disponivel">Disponível</option>
                    <option value="em uso">Em Uso</option>
                    <option value="manutencao">Manutenção</option>
                  </select>
                </div>
                <div className="space-y-1 md:col-span-2"><label className={LC}>Obs</label><input value={cadCObs} onChange={e => setCadCObs(e.target.value)} className={IC}/></div>
              </div>
              <button onClick={cadastrarCarreta} disabled={loading}
                className="w-full bg-red-600 hover:bg-red-700 text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-red-100 disabled:opacity-50">
                Cadastrar Carreta
              </button>
            </div>
          ) : selCarreta ? (
            <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl border border-gray-100 max-w-4xl mx-auto">
              <div className="flex items-center justify-between mb-8">
                <button onClick={() => setSelCarreta(null)} className="flex items-center gap-2 text-gray-400 hover:text-red-600 font-black text-xs uppercase tracking-widest">
                  <ArrowLeft size={16}/> Voltar
                </button>
                <button onClick={salvarCarreta} disabled={loading}
                  className="bg-red-600 text-white px-6 py-2 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 disabled:opacity-50">
                  <Save size={16}/> Salvar
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-1"><label className={LC}>Placa</label><input value={editCPlaca} onChange={e => setEditCPlaca(e.target.value)} className={IC}/></div>
                <div className="space-y-1"><label className={LC}>Modelo</label><input value={editCModelo} onChange={e => setEditCModelo(e.target.value)} className={IC}/></div>
                <div className="space-y-1"><label className={LC}>Ano</label><input value={editCAno} onChange={e => setEditCAno(e.target.value)} className={IC}/></div>
                <div className="space-y-1"><label className={LC}>Status</label>
                  <select value={editCStatus} onChange={e => setEditCStatus(e.target.value)} className={IC}>
                    <option value="disponivel">Disponível</option>
                    <option value="em uso">Em Uso</option>
                    <option value="manutencao">Manutenção</option>
                  </select>
                </div>
                <div className="space-y-1 md:col-span-2"><label className={LC}>Obs</label><input value={editCObs} onChange={e => setEditCObs(e.target.value)} className={IC}/></div>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* ── ABA MANUTENÇÃO ── */}
      {abaGlobal === 'manutencao' && (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"/>
              <input value={buscaMan} onChange={e => setBuscaMan(e.target.value)} placeholder="Pesquisar placa ou tipo..."
                className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-2xl outline-none focus:ring-2 focus:ring-red-500 text-sm font-bold shadow-inner"/>
            </div>
            <button onClick={abrirNovaMan}
              className="bg-gray-900 hover:bg-black text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg flex items-center gap-2">
              <Wrench size={16}/> Registrar Manutenção
            </button>
          </div>

          <div className="bg-white rounded-[2rem] shadow-xl border border-gray-100 overflow-hidden">
            {filtradosMan.length === 0 ? (
              <div className="p-12 text-center">
                <Wrench size={32} className="mx-auto text-gray-200 mb-2"/>
                <p className="text-sm text-gray-400">Nenhuma manutenção registrada</p>
              </div>
            ) : (
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50/50 border-b border-gray-100">
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Veículo</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Tipo / Descrição</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Entrada / Saída</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Valor</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtradosMan.map(m => (
                    <tr key={m.id} onClick={() => abrirEdicaoMan(m)}
                      className="hover:bg-red-50/30 transition-colors cursor-pointer">
                      <td className="px-6 py-4">
                        <p className="font-black text-gray-900 text-sm">{m.caminhao_placa}</p>
                        {m.motorista_nome && <p className="text-[10px] text-gray-400 font-bold">{m.motorista_nome}</p>}
                        {m.caminhao_substituto_placa && (
                          <p className="text-[10px] text-blue-500 font-bold">🔄 Sub: {m.caminhao_substituto_placa}</p>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-xs font-black text-red-600 uppercase">{m.tipo}</p>
                        <p className="text-[10px] font-bold text-gray-400 truncate max-w-[200px]">{m.descricao}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-xs font-bold text-gray-900">{fmtData(m.data_entrada)}</p>
                        <p className="text-[10px] font-bold text-gray-400">{m.data_saida ? fmtData(m.data_saida) : 'Em aberto'}</p>
                      </td>
                      <td className="px-6 py-4 text-xs font-black text-gray-700">
                        {m.valor ? `R$ ${m.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-widest
                          ${m.status === 'CONCLUÍDO' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                          {m.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── MODAL MANUTENÇÃO ── */}
      {mostraNovaMan && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden">
            <div className="px-8 py-6 bg-gray-900 flex items-center justify-between">
              <h2 className="text-white font-black text-xl uppercase tracking-tighter">
                {editandoMan ? 'Editar Manutenção' : 'Registrar Manutenção'}
              </h2>
              <button onClick={() => { setMostraNovaMan(false); setEditandoMan(null) }} className="text-white/80 hover:text-white">
                <X size={24}/>
              </button>
            </div>
            <div className="p-8 space-y-5 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1">
                  <label className={LC}>Veículo *</label>
                  <select value={manCamId} onChange={e => setManCamId(e.target.value)} className={IC} disabled={!!editandoMan}>
                    <option value="">Selecione...</option>
                    {caminhoes.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.placa}{c.motorista_atual ? ` · ${c.motorista_atual}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className={LC}>Tipo *</label>
                  <select value={manTipo} onChange={e => setManTipo(e.target.value)} className={IC}>
                    <option value="">Selecione...</option>
                    {TIPOS_MANUTENCAO.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className={LC}>Data Entrada</label>
                  <input type="date" value={manEntrada} onChange={e => setManEntrada(e.target.value)} className={IC}/>
                </div>
                <div className="space-y-1">
                  <label className={LC}>Data Saída</label>
                  <input type="date" value={manSaida} onChange={e => setManSaida(e.target.value)} className={IC}/>
                </div>
                <div className="space-y-1">
                  <label className={LC}>Valor (R$)</label>
                  <input type="number" value={manValor} onChange={e => setManValor(e.target.value)} className={IC} placeholder="0,00"/>
                </div>
                <div className="space-y-1">
                  <label className={LC}>Status</label>
                  <select value={manStatus} onChange={e => setManStatus(e.target.value)} className={IC}>
                    <option value="EM ANDAMENTO">Em Andamento</option>
                    <option value="CONCLUÍDO">Concluído</option>
                  </select>
                </div>
                <div className="space-y-1 md:col-span-2">
                  <label className={LC}>Veículo Substituto</label>
                  <select value={manSubstitutoId} onChange={e => setManSubstitutoId(e.target.value)} className={IC}>
                    <option value="">Nenhum</option>
                    {caminhoes.filter(c => c.id !== manCamId).map(c => (
                      <option key={c.id} value={c.id}>{c.placa}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <label className={LC}>Descrição</label>
                <textarea value={manDesc} onChange={e => setManDesc(e.target.value)}
                  className={IC + " h-24 resize-none"} placeholder="Detalhes da manutenção..."/>
              </div>
              <div className="space-y-1">
                <label className={LC}>Observações</label>
                <textarea value={manObs} onChange={e => setManObs(e.target.value)}
                  className={IC + " h-20 resize-none"} placeholder="Notas extras..."/>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={salvarManutencao} disabled={loading || !manCamId || !manTipo}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-red-100 transition-all disabled:opacity-50">
                  {loading ? 'Salvando...' : editandoMan ? 'Salvar Alterações' : 'Confirmar Registro'}
                </button>
                {editandoMan && (
                  <button onClick={() => excluirManutencao(editandoMan.id)}
                    className="px-6 py-4 bg-red-50 text-red-600 border border-red-100 rounded-2xl font-black hover:bg-red-100 transition-all">
                    <Trash2 size={16}/>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}