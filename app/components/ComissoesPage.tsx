'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '../services/auth'
import { Search, DollarSign, ChevronRight, ArrowLeft, Check } from 'lucide-react'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_KEY!

interface Comissao {
  id: string; contrato_id: string; contrato: string
  motorista: string; data: string; fat_bruto: number
  comissao_total: number; comissao_carga: number; comissao_folha: number
  carga_paga: boolean; folha_paga: boolean; mes: number; ano: number
}

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

async function sbGet(tabela: string, params: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${tabela}?${params}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
  })
  return res.json()
}

async function sbPatch(tabela: string, params: string, data: any) {
  await fetch(`${SUPABASE_URL}/rest/v1/${tabela}?${params}`, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(data),
  })
}

export default function ComissoesPage() {
  const { perm } = useAuth()
  const [comissoes, setComissoes] = useState<Comissao[]>([])
  const [busca, setBusca] = useState('')
  const [filtroMes, setFiltroMes] = useState(new Date().getMonth() + 1)
  const [filtroAno, setFiltroAno] = useState(new Date().getFullYear())
  const [sel, setSel] = useState<Comissao | null>(null)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => { fetch_() }, [filtroMes, filtroAno])

  async function fetch_() {
    let params = 'order=data.desc'
    if (filtroMes) params += `&mes=eq.${filtroMes}`
    if (filtroAno) params += `&ano=eq.${filtroAno}`
    const data = await sbGet('comissoes', params)
    setComissoes(Array.isArray(data) ? data : [])
  }

  function showMsg(t: string) { setMsg(t); setTimeout(() => setMsg(''), 3000) }

  async function marcarCarga(c: Comissao) {
    setLoading(true)
    await sbPatch('comissoes', `id=eq.${c.id}`, { carga_paga: !c.carga_paga })
    await fetch_()
    if (sel?.id === c.id) setSel({ ...sel, carga_paga: !c.carga_paga })
    setLoading(false)
    showMsg(!c.carga_paga ? '✅ Carga marcada como paga!' : 'Carga desmarcada.')
  }

  async function marcarFolha(c: Comissao) {
    setLoading(true)
    await sbPatch('comissoes', `id=eq.${c.id}`, { folha_paga: !c.folha_paga })
    await fetch_()
    if (sel?.id === c.id) setSel({ ...sel, folha_paga: !c.folha_paga })
    setLoading(false)
    showMsg(!c.folha_paga ? '✅ Folha marcada como paga!' : 'Folha desmarcada.')
  }

  const filtrados = busca.trim()
    ? comissoes.filter(c => c.motorista?.toLowerCase().includes(busca.toLowerCase()) ||
        c.contrato?.toLowerCase().includes(busca.toLowerCase()))
    : comissoes

  // Agrupa por motorista
  const porMotorista: Record<string, { total: number; carga: number; folha: number; qtd: number }> = {}
  filtrados.forEach(c => {
    if (!porMotorista[c.motorista]) porMotorista[c.motorista] = { total: 0, carga: 0, folha: 0, qtd: 0 }
    porMotorista[c.motorista].total += c.comissao_total || 0
    porMotorista[c.motorista].carga += c.comissao_carga || 0
    porMotorista[c.motorista].folha += c.comissao_folha || 0
    porMotorista[c.motorista].qtd++
  })

  const totalGeral = filtrados.reduce((s, c) => s + (c.comissao_total || 0), 0)
  const totalCargaPago = filtrados.filter(c => c.carga_paga).reduce((s, c) => s + (c.comissao_carga || 0), 0)
  const totalFolhaPago = filtrados.filter(c => c.folha_paga).reduce((s, c) => s + (c.comissao_folha || 0), 0)
  const totalPendente = filtrados.filter(c => !c.carga_paga).reduce((s, c) => s + (c.comissao_carga || 0), 0)
    + filtrados.filter(c => !c.folha_paga).reduce((s, c) => s + (c.comissao_folha || 0), 0)

  function fmtData(d: string) {
    if (!d) return ''
    const [y, m, dia] = d.split('-')
    return `${dia}/${m}/${y}`
  }

  function fmtMoeda(v: number) {
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {msg && <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-xl text-sm">{msg}</div>}

      {sel ? (
        <div className="max-w-2xl">
          <button onClick={() => setSel(null)} className="flex items-center gap-2 text-gray-500 hover:text-gray-800 mb-4 text-sm transition">
            <ArrowLeft size={16}/> Voltar
          </button>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-5 bg-gradient-to-r from-red-600 to-red-700">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center text-white">
                  <DollarSign size={24} />
                </div>
                <div>
                  <h2 className="text-white font-bold text-xl">#{sel.contrato}</h2>
                  <p className="text-white/80 text-sm">{sel.motorista}</p>
                </div>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-400">Data</p>
                  <p className="text-sm font-semibold text-gray-800 mt-1">{fmtData(sel.data)}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-400">Fat. Bruto</p>
                  <p className="text-sm font-semibold text-gray-800 mt-1">{fmtMoeda(sel.fat_bruto)}</p>
                </div>
              </div>

              <div className="bg-red-50 border border-red-100 rounded-xl p-4">
                <p className="text-xs font-semibold text-red-500 uppercase tracking-wide mb-2">Comissão total (10%)</p>
                <p className="text-2xl font-bold text-red-700">{fmtMoeda(sel.comissao_total)}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className={`rounded-xl p-4 border ${sel.carga_paga ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-100'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">5% Carga</p>
                    {sel.carga_paga && <Check size={14} className="text-green-600" />}
                  </div>
                  <p className={`text-xl font-bold ${sel.carga_paga ? 'text-green-700' : 'text-gray-800'}`}>
                    {fmtMoeda(sel.comissao_carga)}
                  </p>
                  <p className={`text-xs mt-1 ${sel.carga_paga ? 'text-green-600' : 'text-gray-400'}`}>
                    {sel.carga_paga ? 'Pago' : 'Pendente'}
                  </p>
                  {perm !== 'view' && (
                    <button onClick={() => marcarCarga(sel)} disabled={loading}
                      className={`mt-3 w-full py-1.5 rounded-lg text-xs font-medium transition ${
                        sel.carga_paga ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-red-600 text-white hover:bg-red-700'
                      }`}>
                      {sel.carga_paga ? 'Desmarcar' : 'Marcar como pago'}
                    </button>
                  )}
                </div>

                <div className={`rounded-xl p-4 border ${sel.folha_paga ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-100'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">5% Folha</p>
                    {sel.folha_paga && <Check size={14} className="text-green-600" />}
                  </div>
                  <p className={`text-xl font-bold ${sel.folha_paga ? 'text-green-700' : 'text-gray-800'}`}>
                    {fmtMoeda(sel.comissao_folha)}
                  </p>
                  <p className={`text-xs mt-1 ${sel.folha_paga ? 'text-green-600' : 'text-gray-400'}`}>
                    {sel.folha_paga ? 'Pago' : 'Pendente'}
                  </p>
                  {perm !== 'view' && (
                    <button onClick={() => marcarFolha(sel)} disabled={loading}
                      className={`mt-3 w-full py-1.5 rounded-lg text-xs font-medium transition ${
                        sel.folha_paga ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-red-600 text-white hover:bg-red-700'
                      }`}>
                      {sel.folha_paga ? 'Desmarcar' : 'Marcar como pago'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-5">
            <h1 className="text-2xl font-bold text-gray-900">Comissões</h1>
          </div>

          <div className="flex gap-2 mb-4 flex-wrap">
            <div className="flex-1 relative min-w-48">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={busca} onChange={e => setBusca(e.target.value)}
                placeholder="Buscar motorista ou contrato..."
                className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-white shadow-sm" />
            </div>
            <select value={filtroMes} onChange={e => setFiltroMes(Number(e.target.value))}
              className="border border-gray-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-white shadow-sm">
              <option value={0}>Todos os meses</option>
              {MESES.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
            </select>
            <select value={filtroAno} onChange={e => setFiltroAno(Number(e.target.value))}
              className="border border-gray-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-white shadow-sm">
              <option value={2025}>2025</option>
              <option value={2026}>2026</option>
            </select>
          </div>

          {/* Cards resumo */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-2">Total comissões</p>
              <p className="text-lg font-bold text-gray-900">{fmtMoeda(totalGeral)}</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-2">Carga pago</p>
              <p className="text-lg font-bold text-green-600">{fmtMoeda(totalCargaPago)}</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-2">Folha pago</p>
              <p className="text-lg font-bold text-green-600">{fmtMoeda(totalFolhaPago)}</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-2">Pendente</p>
              <p className="text-lg font-bold text-red-600">{fmtMoeda(totalPendente)}</p>
            </div>
          </div>

          {/* Resumo por motorista com contratos individuais */}
          {Object.keys(porMotorista).length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-4">
              <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Resumo por motorista</p>
              </div>
              {Object.entries(porMotorista).map(([nome, val]) => (
                <div key={nome}>
                  {/* Header motorista */}
                  <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-bold text-xs">
                        {nome.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{nome}</p>
                        <p className="text-xs text-gray-400">{val.qtd} contrato(s)</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-gray-800">{fmtMoeda(val.total)}</p>
                      <p className="text-xs text-gray-400">Carga: {fmtMoeda(val.carga)} · Folha: {fmtMoeda(val.folha)}</p>
                    </div>
                  </div>
                  {/* Contratos individuais do motorista */}
                  {filtrados.filter(c => c.motorista === nome).map(c => (
                    <button key={c.id} onClick={() => setSel(c)}
                      className="w-full flex items-center gap-4 px-5 py-3 hover:bg-gray-50 transition border-b border-gray-50 last:border-0 text-left">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-sm font-medium text-gray-800">#{c.contrato}</p>
                          <span className="text-xs text-gray-400">{fmtData(c.data)}</span>
                        </div>
                        <p className="text-xs text-gray-400">
                          Fat. {fmtMoeda(c.fat_bruto)} → 10% = <span className="font-semibold text-gray-600">{fmtMoeda(c.comissao_total)}</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="flex gap-1">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.carga_paga ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                            Carga {c.carga_paga ? '✓' : fmtMoeda(c.comissao_carga)}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.folha_paga ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                            Folha {c.folha_paga ? '✓' : fmtMoeda(c.comissao_folha)}
                          </span>
                        </div>
                        <ChevronRight size={14} className="text-gray-300" />
                      </div>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}