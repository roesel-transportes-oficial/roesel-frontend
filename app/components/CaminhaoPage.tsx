'use client'
import { useState, useEffect } from 'react'
import { caminhoesAPI, motoristasAPI } from '../services/api'
import { useAuth } from '../services/auth'
import { Search, Plus, ArrowLeft, Save, Trash2, ChevronRight, Truck, Wrench, FileText, X } from 'lucide-react'

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
  descricao: string; data_entrada: string; data_saida: string
  valor: number; status: string; obs: string
}
interface Licenca { id: string; caminhao_id: string; estado: string; vencimento: string }

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_KEY!
const ESTADOS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']
const TIPOS_MANUTENCAO = ['Troca de óleo','Revisão geral','Freios','Pneus','Suspensão','Motor','Câmbio','Elétrica','Funilaria/Pintura','Outro']

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

  // Aba global: caminhoes ou carretas
  const [abaGlobal, setAbaGlobal] = useState<'caminhoes' | 'carretas'>('caminhoes')

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
  const [filtroPlacoRel, setFiltroPlacoRel] = useState('')
  const [licencas, setLicencas] = useState<Licenca[]>([])
  const [mostraNovaLic, setMostraNovaLic] = useState(false)
  const [licEstado, setLicEstado] = useState('')
  const [licVencimento, setLicVencimento] = useState('')
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

  useEffect(() => {
    fetch_(); motoristasAPI.listar().then(setMotoristas).catch(() => {}); fetchFrotas(); fetchCarretas()
  }, [])

  async function fetch_() {
    const data = await caminhoesAPI.listar(); setCaminhoes(data)
  }
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
    await fetch(`${SUPABASE_URL}/rest/v1/manutencoes`, { method: 'POST', headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify({ caminhao_id: sel.id, caminhao_placa: editPlaca, tipo: manTipo, descricao: manDesc, data_entrada: manEntrada, data_saida: manSaida || null, valor: parseFloat(manValor) || null, status: manStatus, obs: manObs }) })
    await fetchManutencoes(sel.id); setManTipo(''); setManDesc(''); setManEntrada(new Date().toISOString().split('T')[0]); setManSaida(''); setManValor(''); setManStatus('EM ANDAMENTO'); setManObs(''); setMostraNovaMan(false); setLoading(false); showMsg('✅ Manutenção registrada!')
  }
  async function excluirManutencao(id: string) {
    await fetch(`${SUPABASE_URL}/rest/v1/manutencoes?id=eq.${id}`, { method: 'DELETE', headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } })
    if (sel) await fetchManutencoes(sel.id)
  }
  async function salvarLicenca() {
    if (!sel || !licEstado || !licVencimento) return; setLoading(true)
    const existe = licencas.find(l => l.estado === licEstado)
    if (existe) { await fetch(`${SUPABASE_URL}/rest/v1/licencas?id=eq.${existe.id}`, { method: 'PATCH', headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify({ vencimento: licVencimento }) }) }
    else { await fetch(`${SUPABASE_URL}/rest/v1/licencas`, { method: 'POST', headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify({ caminhao_id: sel.id, caminhao_placa: editPlaca, estado: licEstado, vencimento: licVencimento }) }) }
    await fetchLicencas(sel.id); setLicEstado(''); setLicVencimento(''); setMostraNovaLic(false); setLoading(false); showMsg('✅ Licença salva!')
  }
  async function excluirLicenca(id: string) {
    await fetch(`${SUPABASE_URL}/rest/v1/licencas?id=eq.${id}`, { method: 'DELETE', headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } })
    if (sel) await fetchLicencas(sel.id)
  }
  async function gerarRelatorio() {
    if (!filtroPlacoRel) return
    const res = await fetch(`${SUPABASE_URL}/rest/v1/manutencoes?caminhao_placa=eq.${filtroPlacoRel}&order=data_entrada.desc`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } })
    setManutencoes(Array.isArray(await res.json()) ? await res.clone().json() : [])
  }

  // ── CARRETAS handlers ──
  const filtradosCarretas = buscaCarreta.trim() ? carretas.filter(c => c.placa?.toLowerCase().includes(buscaCarreta.toLowerCase()) || c.modelo?.toLowerCase().includes(buscaCarreta.toLowerCase())) : carretas

  function selecionarCarreta(c: Carreta) {
    setSelCarreta(c); setEditCPlaca(c.placa||''); setEditCModelo(c.modelo||'')
    setEditCAno(c.ano||''); setEditCStatus(c.status||'disponivel'); setEditCObs(c.obs||'')
    setConfirmExcluirCarreta(false)
  }
  function voltarCarreta() { setSelCarreta(null); setConfirmExcluirCarreta(false) }

  async function salvarCarreta() {
    if (!selCarreta) return; setLoading(true)
    if (perm !== 'demo') {
      await fetch(`${SUPABASE_URL}/rest/v1/carretas?id=eq.${selCarreta.id}`, {
        method: 'PATCH',
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ placa: editCPlaca.toUpperCase(), modelo: editCModelo, ano: editCAno, status: editCStatus, obs: editCObs })
      })
    }
    await fetchCarretas(); setLoading(false); voltarCarreta(); showMsg('✅ Carreta atualizada!')
  }
  async function excluirCarreta() {
    if (!selCarreta) return; setLoading(true)
    if (perm !== 'demo') await fetch(`${SUPABASE_URL}/rest/v1/carretas?id=eq.${selCarreta.id}`, { method: 'DELETE', headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } })
    await fetchCarretas(); setLoading(false); voltarCarreta(); showMsg('Carreta excluída.')
  }
  async function cadastrarCarreta() {
    if (!cadCPlaca.trim()) return; setLoading(true)
    if (perm !== 'demo') {
      await fetch(`${SUPABASE_URL}/rest/v1/carretas`, {
        method: 'POST',
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ placa: cadCPlaca.toUpperCase(), modelo: cadCModelo, ano: cadCAno, status: cadCStatus, obs: cadCObs })
      })
    }
    await fetchCarretas(); setLoading(false)
    setCadCPlaca(''); setCadCModelo(''); setCadCAno(''); setCadCStatus('disponivel'); setCadCObs('')
    setMostraCadCarreta(false); showMsg('✅ Carreta cadastrada!')
  }

  const IC = "mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-gray-50"
  const LC = "text-xs font-semibold text-gray-500 uppercase tracking-wide"
  const rodando = caminhoes.filter(c => c.status === 'rodando').length
  const parados = caminhoes.filter(c => c.status !== 'rodando').length

  // ════════════════════════════════════════
  // RENDER CARRETAS
  // ════════════════════════════════════════
  if (abaGlobal === 'carretas') {
    if (mostraCadCarreta) return (
      <div className="p-6 max-w-2xl mx-auto">
        <button onClick={() => setMostraCadCarreta(false)} className="flex items-center gap-2 text-gray-500 hover:text-gray-800 mb-4 text-sm transition">
          <ArrowLeft size={16}/> Voltar
        </button>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-bold text-gray-800 mb-4 text-lg">Nova Carreta</h3>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LC}>Placa *</label>
                <input value={cadCPlaca} onChange={e => setCadCPlaca(e.target.value.toUpperCase())} placeholder="ABC1D23" className={IC} />
              </div>
              <div>
                <label className={LC}>Modelo</label>
                <input value={cadCModelo} onChange={e => setCadCModelo(e.target.value)} className={IC} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LC}>Ano</label>
                <input value={cadCAno} onChange={e => setCadCAno(e.target.value)} className={IC} />
              </div>
              <div>
                <label className={LC}>Status</label>
                <select value={cadCStatus} onChange={e => setCadCStatus(e.target.value)} className={IC}>
                  <option value="disponivel">Disponível</option>
                  <option value="em_uso">Em uso</option>
                  <option value="manutencao">Manutenção</option>
                  <option value="vendida">Vendida</option>
                </select>
              </div>
            </div>
            <div>
              <label className={LC}>Observações</label>
              <textarea value={cadCObs} onChange={e => setCadCObs(e.target.value)} rows={2} className={IC} />
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={cadastrarCarreta} disabled={loading || !cadCPlaca.trim()}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl py-2.5 text-sm font-medium transition">
                Salvar carreta
              </button>
              <button onClick={() => setMostraCadCarreta(false)}
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

        {/* Abas globais */}
        <div className="flex gap-1 mb-5 bg-gray-100 rounded-2xl p-1">
          <button onClick={() => setAbaGlobal('caminhoes')} className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-xl transition text-gray-500 hover:text-gray-800">
            <Truck size={15}/> Caminhões
          </button>
          <button className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-xl transition bg-white shadow-sm text-red-600">
            🚛 Carretas
          </button>
        </div>

        {selCarreta ? (
          <div>
            <button onClick={voltarCarreta} className="flex items-center gap-2 text-gray-500 hover:text-gray-800 mb-4 text-sm transition">
              <ArrowLeft size={16}/> Voltar
            </button>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className={`px-6 py-5 bg-gradient-to-r ${editCStatus === 'disponivel' ? 'from-green-600 to-green-700' : editCStatus === 'manutencao' ? 'from-yellow-500 to-yellow-600' : 'from-gray-500 to-gray-600'}`}>
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center text-white text-2xl">🚛</div>
                  <div>
                    <h2 className="text-white font-bold text-xl">{selCarreta.placa}</h2>
                    <p className="text-white/80 text-sm">{selCarreta.modelo} {selCarreta.ano && `· ${selCarreta.ano}`}</p>
                  </div>
                </div>
              </div>
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={LC}>Placa</label>
                    <input value={editCPlaca} onChange={e => setEditCPlaca(e.target.value.toUpperCase())} className={IC} />
                  </div>
                  <div>
                    <label className={LC}>Modelo</label>
                    <input value={editCModelo} onChange={e => setEditCModelo(e.target.value)} className={IC} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={LC}>Ano</label>
                    <input value={editCAno} onChange={e => setEditCAno(e.target.value)} className={IC} />
                  </div>
                  <div>
                    <label className={LC}>Status</label>
                    <select value={editCStatus} onChange={e => setEditCStatus(e.target.value)} className={IC}>
                      <option value="disponivel">Disponível</option>
                      <option value="em_uso">Em uso</option>
                      <option value="manutencao">Manutenção</option>
                      <option value="vendida">Vendida</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className={LC}>Observações</label>
                  <textarea value={editCObs} onChange={e => setEditCObs(e.target.value)} rows={2} className={IC} />
                </div>
                <div className="flex gap-2 pt-2">
                  <button onClick={salvarCarreta} disabled={loading}
                    className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white rounded-xl py-2.5 text-sm font-medium transition">
                    <Save size={15}/> Salvar alterações
                  </button>
                  <button onClick={() => setConfirmExcluirCarreta(true)}
                    className="flex items-center gap-2 border border-red-200 text-red-500 hover:bg-red-50 rounded-xl px-4 py-2.5 text-sm transition">
                    <Trash2 size={15}/>
                  </button>
                </div>
                {confirmExcluirCarreta && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                    <p className="text-sm text-red-700 font-medium mb-3">⚠️ Excluir carreta {selCarreta.placa}?</p>
                    <div className="flex gap-2">
                      <button onClick={excluirCarreta} className="flex-1 bg-red-600 text-white rounded-lg py-2 text-sm font-medium">Confirmar</button>
                      <button onClick={() => setConfirmExcluirCarreta(false)} className="flex-1 border border-gray-300 rounded-lg py-2 text-sm">Cancelar</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-5">
              <h1 className="text-2xl font-bold text-gray-900">Carretas</h1>
              {perm !== 'view' && (
                <button onClick={() => setMostraCadCarreta(true)}
                  className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition shadow-sm">
                  <Plus size={16}/> Cadastrar
                </button>
              )}
            </div>
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                { label: 'Total', val: carretas.length, color: 'blue' },
                { label: 'Disponíveis', val: carretas.filter(c => c.status === 'disponivel').length, color: 'green' },
                { label: 'Em uso', val: carretas.filter(c => c.status === 'em_uso').length, color: 'orange' },
              ].map(({ label, val, color }) => (
                <div key={label} className={`bg-${color}-50 border border-${color}-100 rounded-2xl p-4`}>
                  <p className={`text-xs text-${color}-600 font-medium`}>{label}</p>
                  <p className={`text-3xl font-bold text-${color}-700 mt-1`}>{val}</p>
                </div>
              ))}
            </div>
            <div className="relative mb-4">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={buscaCarreta} onChange={e => setBuscaCarreta(e.target.value)}
                placeholder="Buscar por placa ou modelo..."
                className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-white shadow-sm" />
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Carretas</p>
                <p className="text-xs text-gray-400">{filtradosCarretas.length} cadastrada(s)</p>
              </div>
              {filtradosCarretas.length === 0 ? (
                <div className="p-10 text-center">
                  <span className="text-4xl block mb-2">🚛</span>
                  <p className="text-sm text-gray-400">Nenhuma carreta cadastrada</p>
                </div>
              ) : filtradosCarretas.map(c => (
                <button key={c.id} onClick={() => selecionarCarreta(c)}
                  className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition border-b border-gray-50 last:border-0 text-left">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-lg ${
                    c.status === 'disponivel' ? 'bg-green-100' : c.status === 'em_uso' ? 'bg-blue-100' : c.status === 'manutencao' ? 'bg-yellow-100' : 'bg-gray-100'
                  }`}>🚛</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-gray-900">{c.placa}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        c.status === 'disponivel' ? 'bg-green-100 text-green-700' :
                        c.status === 'em_uso' ? 'bg-blue-100 text-blue-700' :
                        c.status === 'manutencao' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>{c.status.replace('_', ' ')}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{c.modelo}{c.ano && ` · ${c.ano}`}</p>
                  </div>
                  <ChevronRight size={16} className="text-gray-300" />
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    )
  }

  // ════════════════════════════════════════
  // RENDER CAMINHÕES (código original com abas globais adicionadas)
  // ════════════════════════════════════════
  if (mostraCad) return (
    <div className="p-6 max-w-2xl mx-auto">
      <button onClick={() => setMostraCad(false)} className="flex items-center gap-2 text-gray-500 hover:text-gray-800 mb-4 text-sm transition">
        <ArrowLeft size={16}/> Voltar
      </button>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-bold text-gray-800 mb-4 text-lg">Novo Caminhão</h3>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className={LC}>Placa do Caminhão *</label><input value={cadPlaca} onChange={e => setCadPlaca(e.target.value.toUpperCase())} placeholder="ABC1234" className={IC} /></div>
            <div><label className={LC}>Placa da Carreta</label><input value={cadPlacaCarreta} onChange={e => setCadPlacaCarreta(e.target.value.toUpperCase())} placeholder="XYZ5678" className={IC} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={LC}>Modelo</label><input value={cadModelo} onChange={e => setCadModelo(e.target.value)} className={IC} /></div>
            <div><label className={LC}>Ano</label><input value={cadAno} onChange={e => setCadAno(e.target.value)} className={IC} /></div>
          </div>
          <div><label className={LC}>Frota</label><select value={cadFrota} onChange={e => setCadFrota(e.target.value)} className={IC}><option value="">Selecione...</option>{frotas.map(f => <option key={f.id} value={f.nome}>{f.nome}</option>)}</select></div>
          <div><label className={LC}>Motorista</label><select value={cadMotorista} onChange={e => setCadMotorista(e.target.value)} className={IC}><option value="">Selecione...</option>{motoristas.filter(m => m.ativo !== false).map(m => <option key={m.id} value={m.nome}>{m.nome}</option>)}</select></div>
          <div><label className={LC}>Status</label><select value={cadStatus} onChange={e => setCadStatus(e.target.value)} className={IC}><option value="rodando">Rodando</option><option value="parado">Parado</option><option value="manutencao">Manutenção</option><option value="vendido">Vendido</option></select></div>
          {cadStatus !== 'rodando' && (<><div><label className={LC}>Motivo</label><input value={cadMotivo} onChange={e => setCadMotivo(e.target.value)} className={IC} /></div><div><label className={LC}>Data de início</label><input type="date" value={cadDtParado} onChange={e => setCadDtParado(e.target.value)} className={IC} /></div></>)}
          <div><label className={LC}>Observações</label><textarea value={cadObs} onChange={e => setCadObs(e.target.value)} rows={2} className={IC} /></div>
          <div className="flex gap-2 pt-1">
            <button onClick={cadastrar} disabled={loading} className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-xl py-2.5 text-sm font-medium transition">Salvar caminhão</button>
            <button onClick={() => setMostraCad(false)} className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 transition">Cancelar</button>
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
          <button onClick={voltar} className="flex items-center gap-2 text-gray-500 hover:text-gray-800 mb-4 text-sm transition"><ArrowLeft size={16}/> Voltar</button>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className={`px-6 py-5 bg-gradient-to-r ${editStatus === 'rodando' ? 'from-green-600 to-green-700' : editStatus === 'manutencao' ? 'from-yellow-500 to-yellow-600' : 'from-gray-500 to-gray-600'}`}>
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center text-white"><Truck size={24} /></div>
                <div>
                  <h2 className="text-white font-bold text-xl">{sel.placa}</h2>
                  <p className="text-white/80 text-sm">{sel.modelo} {sel.ano && `· ${sel.ano}`}{sel.frota && ` · Frota ${sel.frota}`}{sel.placa_carreta && ` · Carreta: ${sel.placa_carreta}`}</p>
                </div>
              </div>
            </div>
            <div className="flex border-b border-gray-100">
              {[{ id: 'info', label: 'Informações', icon: Truck }, { id: 'manutencao', label: 'Manutenção', icon: Wrench }, { id: 'licencas', label: 'Licenças', icon: FileText }].map(t => (
                <button key={t.id} onClick={() => setAba(t.id as any)} className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-semibold transition border-b-2 ${aba === t.id ? 'border-red-600 text-red-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
                  <t.icon size={14} /> {t.label}
                </button>
              ))}
            </div>

            {aba === 'info' && (
              <div className="p-5 space-y-4">
                {editStatus !== 'rodando' && editDtParado && (
                  <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                    <p className="text-sm font-semibold text-orange-700">🚫 {editStatus === 'manutencao' ? 'Em manutenção' : editStatus === 'vendido' ? 'Vendido' : 'Parado'} há {diasParado(editDtParado)} dia(s)</p>
                    {editMotivo && <p className="text-xs text-orange-600 mt-1">Motivo: {editMotivo}</p>}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div><label className={LC}>Placa do Caminhão</label><input value={editPlaca} onChange={e => setEditPlaca(e.target.value.toUpperCase())} className={IC} /></div>
                  <div><label className={LC}>Placa da Carreta</label><input value={editPlacaCarreta} onChange={e => setEditPlacaCarreta(e.target.value.toUpperCase())} className={IC} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className={LC}>Modelo</label><input value={editModelo} onChange={e => setEditModelo(e.target.value)} className={IC} /></div>
                  <div><label className={LC}>Ano</label><input value={editAno} onChange={e => setEditAno(e.target.value)} className={IC} /></div>
                </div>
                <div><label className={LC}>Frota</label><select value={editFrota} onChange={e => setEditFrota(e.target.value)} className={IC}><option value="">Selecione...</option>{frotas.map(f => <option key={f.id} value={f.nome}>{f.nome}</option>)}</select></div>
                <div><label className={LC}>Motorista</label><select value={editMotorista} onChange={e => setEditMotorista(e.target.value)} className={IC}><option value="">Selecione...</option>{motoristas.filter(m => m.ativo !== false).map(m => <option key={m.id} value={m.nome}>{m.nome}</option>)}</select></div>
                <div><label className={LC}>Status</label><select value={editStatus} onChange={e => { setEditStatus(e.target.value); if (e.target.value !== 'rodando' && !editDtParado) setEditDtParado(new Date().toISOString().split('T')[0]); if (e.target.value === 'rodando') { setEditMotivo(''); setEditDtParado('') } }} className={IC}><option value="rodando">Rodando</option><option value="parado">Parado</option><option value="manutencao">Manutenção</option><option value="vendido">Vendido</option></select></div>
                {editStatus !== 'rodando' && (<><div><label className={LC}>Motivo</label><input value={editMotivo} onChange={e => setEditMotivo(e.target.value)} className={IC} /></div><div><label className={LC}>Data de início</label><input type="date" value={editDtParado} onChange={e => setEditDtParado(e.target.value)} className={IC} /></div></>)}
                <div><label className={LC}>Observações</label><textarea value={editObs} onChange={e => setEditObs(e.target.value)} rows={2} className={IC} /></div>
                <div className="flex gap-2 pt-2">
                  <button onClick={salvar} disabled={loading} className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white rounded-xl py-2.5 text-sm font-medium transition"><Save size={15}/> Salvar alterações</button>
                  <button onClick={() => setConfirmExcluir(true)} className="flex items-center gap-2 border border-red-200 text-red-500 hover:bg-red-50 rounded-xl px-4 py-2.5 text-sm transition"><Trash2 size={15}/></button>
                </div>
                {confirmExcluir && (<div className="p-4 bg-red-50 border border-red-200 rounded-xl"><p className="text-sm text-red-700 font-medium mb-3">⚠️ Excluir caminhão {sel.placa}?</p><div className="flex gap-2"><button onClick={excluir} className="flex-1 bg-red-600 text-white rounded-lg py-2 text-sm font-medium">Confirmar</button><button onClick={() => setConfirmExcluir(false)} className="flex-1 border border-gray-300 rounded-lg py-2 text-sm">Cancelar</button></div></div>)}
              </div>
            )}

            {aba === 'manutencao' && (
              <div className="p-5">
                <div className="mb-4 p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <p className="text-xs font-bold text-gray-500 uppercase mb-2">📊 Relatório por placa</p>
                  <div className="flex gap-2">
                    <select value={filtroPlacoRel} onChange={e => setFiltroPlacoRel(e.target.value)} className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500"><option value="">Selecione a placa...</option>{caminhoes.map(c => <option key={c.id} value={c.placa}>{c.placa}</option>)}</select>
                    <button onClick={gerarRelatorio} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition">Buscar</button>
                  </div>
                </div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-bold text-gray-700">Histórico de manutenções</p>
                  <button onClick={() => setMostraNovaMan(!mostraNovaMan)} className="flex items-center gap-1 bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition"><Plus size={12}/> Nova</button>
                </div>
                {mostraNovaMan && (
                  <div className="mb-4 p-4 bg-blue-50 border border-blue-100 rounded-xl space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div><label className={LC}>Tipo *</label><select value={manTipo} onChange={e => setManTipo(e.target.value)} className={IC}><option value="">Selecione...</option>{TIPOS_MANUTENCAO.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                      <div><label className={LC}>Status</label><select value={manStatus} onChange={e => setManStatus(e.target.value)} className={IC}><option value="EM ANDAMENTO">EM ANDAMENTO</option><option value="CONCLUIDA">CONCLUÍDA</option></select></div>
                    </div>
                    <div><label className={LC}>Descrição</label><input value={manDesc} onChange={e => setManDesc(e.target.value)} className={IC} /></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><label className={LC}>Data Entrada</label><input type="date" value={manEntrada} onChange={e => setManEntrada(e.target.value)} className={IC} /></div>
                      <div><label className={LC}>Data Saída</label><input type="date" value={manSaida} onChange={e => setManSaida(e.target.value)} className={IC} /></div>
                    </div>
                    <div><label className={LC}>Valor (R$)</label><input type="number" step="0.01" value={manValor} onChange={e => setManValor(e.target.value)} className={IC} /></div>
                    <div><label className={LC}>Observações</label><textarea value={manObs} onChange={e => setManObs(e.target.value)} rows={2} className={IC} /></div>
                    <div className="flex gap-2">
                      <button onClick={salvarManutencao} disabled={loading || !manTipo} className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl py-2 text-sm font-medium transition">Registrar</button>
                      <button onClick={() => setMostraNovaMan(false)} className="border border-gray-200 rounded-xl px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition">Cancelar</button>
                    </div>
                  </div>
                )}
                {manutencoes.length === 0 ? (<div className="text-center py-8"><Wrench size={28} className="mx-auto text-gray-200 mb-2" /><p className="text-sm text-gray-400">Nenhuma manutenção registrada</p></div>) : (
                  <div className="space-y-2">
                    {manutencoes.map(m => (
                      <div key={m.id} className={`rounded-xl p-3 border ${m.status === 'EM ANDAMENTO' ? 'bg-yellow-50 border-yellow-100' : 'bg-gray-50 border-gray-100'}`}>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-xs font-bold text-gray-800">{m.tipo}</p>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${m.status === 'EM ANDAMENTO' ? 'bg-yellow-200 text-yellow-800' : 'bg-green-100 text-green-700'}`}>{m.status}</span>
                              {m.caminhao_placa !== editPlaca && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{m.caminhao_placa}</span>}
                            </div>
                            {m.descricao && <p className="text-xs text-gray-600">{m.descricao}</p>}
                            <p className="text-xs text-gray-400 mt-1">Entrada: {fmtData(m.data_entrada)}{m.data_saida && ` · Saída: ${fmtData(m.data_saida)}`}{m.valor && ` · ${m.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`}</p>
                          </div>
                          <button onClick={() => excluirManutencao(m.id)} className="text-gray-300 hover:text-red-500 transition ml-2"><X size={14} /></button>
                        </div>
                      </div>
                    ))}
                    <p className="text-xs text-gray-400 text-right pt-1">Total: {manutencoes.filter(m => m.valor).reduce((s, m) => s + (m.valor || 0), 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                  </div>
                )}
              </div>
            )}

            {aba === 'licencas' && (
              <div className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-bold text-gray-700">Licenças por estado</p>
                  <button onClick={() => setMostraNovaLic(!mostraNovaLic)} className="flex items-center gap-1 bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition"><Plus size={12}/> Adicionar</button>
                </div>
                {mostraNovaLic && (
                  <div className="mb-4 p-4 bg-blue-50 border border-blue-100 rounded-xl space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div><label className={LC}>Estado *</label><select value={licEstado} onChange={e => setLicEstado(e.target.value)} className={IC}><option value="">Selecione...</option>{ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}</select></div>
                      <div><label className={LC}>Vencimento *</label><input type="date" value={licVencimento} onChange={e => setLicVencimento(e.target.value)} className={IC} /></div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={salvarLicenca} disabled={loading || !licEstado || !licVencimento} className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl py-2 text-sm font-medium transition">Salvar</button>
                      <button onClick={() => setMostraNovaLic(false)} className="border border-gray-200 rounded-xl px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition">Cancelar</button>
                    </div>
                  </div>
                )}
                {licencas.length === 0 ? (<div className="text-center py-8"><FileText size={28} className="mx-auto text-gray-200 mb-2" /><p className="text-sm text-gray-400">Nenhuma licença cadastrada</p></div>) : (
                  <div className="grid grid-cols-2 gap-2">
                    {licencas.map(l => {
                      const dias = diasParaVencer(l.vencimento)
                      const vencido = dias !== null && dias < 0
                      const critico = dias !== null && dias >= 0 && dias <= 30
                      return (
                        <div key={l.id} className={`rounded-xl p-3 border ${vencido ? 'bg-red-50 border-red-200' : critico ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-100'}`}>
                          <div className="flex items-center justify-between mb-1">
                            <p className={`text-sm font-bold ${vencido ? 'text-red-700' : critico ? 'text-yellow-700' : 'text-green-700'}`}>{l.estado}</p>
                            <button onClick={() => excluirLicenca(l.id)} className="text-gray-300 hover:text-red-500 transition"><X size={12} /></button>
                          </div>
                          <p className={`text-xs ${vencido ? 'text-red-600' : critico ? 'text-yellow-600' : 'text-green-600'}`}>Vence: {fmtData(l.vencimento)}</p>
                          <p className={`text-xs font-medium mt-0.5 ${vencido ? 'text-red-500' : critico ? 'text-yellow-500' : 'text-green-500'}`}>{vencido ? `Vencido há ${Math.abs(dias!)} dias` : `${dias} dias restantes`}</p>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Abas globais */}
          <div className="flex gap-1 mb-5 bg-gray-100 rounded-2xl p-1">
            <button className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-xl transition bg-white shadow-sm text-red-600">
              <Truck size={15}/> Caminhões
            </button>
            <button onClick={() => setAbaGlobal('carretas')} className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-xl transition text-gray-500 hover:text-gray-800">
              🚛 Carretas
            </button>
          </div>

          <div className="flex items-center justify-between mb-5">
            <h1 className="text-2xl font-bold text-gray-900">Caminhões</h1>
            {perm !== 'view' && (
              <button onClick={() => setMostraCad(true)} className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition shadow-sm"><Plus size={16}/> Cadastrar</button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-green-50 border border-green-100 rounded-2xl p-4"><p className="text-xs text-green-600 font-medium">Rodando</p><p className="text-3xl font-bold text-green-700 mt-1">{rodando}</p></div>
            <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4"><p className="text-xs text-orange-600 font-medium">Parados / Manutenção</p><p className="text-3xl font-bold text-orange-700 mt-1">{parados}</p></div>
          </div>
          <div className="relative mb-4">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por placa, modelo ou frota..." className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-white shadow-sm" />
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Caminhões</p>
              <p className="text-xs text-gray-400">{filtrados.length} cadastrado(s)</p>
            </div>
            {filtrados.length === 0 ? (<div className="p-10 text-center"><Truck size={32} className="mx-auto text-gray-200 mb-2" /><p className="text-sm text-gray-400">Nenhum caminhão encontrado</p></div>)
            : filtrados.map(c => (
              <button key={c.id} onClick={() => selecionar(c)} className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition border-b border-gray-50 last:border-0 text-left">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${c.status === 'rodando' ? 'bg-green-100 text-green-600' : c.status === 'manutencao' ? 'bg-yellow-100 text-yellow-600' : 'bg-gray-100 text-gray-500'}`}><Truck size={18} /></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold text-gray-900">{c.placa}</p>
                    {c.placa_carreta && <span className="text-xs text-gray-400">/ {c.placa_carreta}</span>}
                    <span className={`text-xs px-2 py-0.5 rounded-full ${c.status === 'rodando' ? 'bg-green-100 text-green-700' : c.status === 'manutencao' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'}`}>{c.status}</span>
                    {c.frota && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">Frota {c.frota}</span>}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{c.modelo} {c.ano && `· ${c.ano}`}{c.motorista_atual && ` · ${c.motorista_atual}`}{c.status !== 'rodando' && diasParado(c.dt_parado) && ` · ${diasParado(c.dt_parado)} dia(s) parado`}</p>
                </div>
                <ChevronRight size={16} className="text-gray-300" />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}