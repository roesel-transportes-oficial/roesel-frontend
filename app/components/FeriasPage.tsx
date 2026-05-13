'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '../services/auth'
import { Search, Palmtree, History } from 'lucide-react'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_KEY!

interface Motorista {
  id: string; nome: string; de_ferias: boolean
  ferias_inicio: string; ferias_fim: string; substituto_id: string; caminhao_id: string
}
interface HistoricoFerias {
  id: string; motorista_id: string; motorista_nome: string; substituto_nome: string
  caminhao_placa: string; ferias_inicio: string; ferias_fim: string; created_at: string
}
interface Caminhao { id: string; placa: string }

function fmtData(d: string) {
  if (!d) return '—'
  const [y, m, dia] = d.split('T')[0].split('-')
  return `${dia}/${m}/${y}`
}

function diasFerias(inicio: string, fim: string) {
  if (!inicio || !fim) return null
  return Math.ceil((new Date(fim+'T00:00:00').getTime() - new Date(inicio+'T00:00:00').getTime()) / (1000*60*60*24))
}

export default function FeriasPage() {
  const [abaAtiva, setAbaAtiva] = useState<'ferias' | 'historico'>('ferias')
  const [motoristas, setMotoristas]   = useState<Motorista[]>([])
  const [caminhoes, setCaminhoes]     = useState<Caminhao[]>([])
  const [historicos, setHistoricos]   = useState<HistoricoFerias[]>([])
  const [busca, setBusca]             = useState('')
  const [buscaHist, setBuscaHist]     = useState('')
  const [loading, setLoading]         = useState(true)

  useEffect(() => { fetchTudo() }, [])

  async function fetchTudo() {
    setLoading(true)
    try {
      const [resM, resC, resH] = await Promise.all([
        fetch(`${SUPABASE_URL}/rest/v1/motoristas?ativo=eq.true&order=nome.asc`, {
          headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
        }),
        fetch(`${SUPABASE_URL}/rest/v1/caminhoes?order=placa.asc`, {
          headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
        }),
        fetch(`${SUPABASE_URL}/rest/v1/historico_ferias?order=created_at.desc`, {
          headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
        }),
      ])
      const [mData, cData, hData] = await Promise.all([resM.json(), resC.json(), resH.json()])
      setMotoristas(Array.isArray(mData) ? mData : [])
      setCaminhoes(Array.isArray(cData) ? cData : [])
      setHistoricos(Array.isArray(hData) ? hData : [])
    } catch {}
    setLoading(false)
  }

  const getCaminhao  = (id: string) => caminhoes.find(c => c.id === id)
  const getSubstituto = (id: string) => motoristas.find(m => m.id === id)

  const emFerias     = motoristas.filter(m => m.de_ferias)
  const disponiveis  = motoristas.filter(m => !m.de_ferias)

  const filtradosFerias = busca.trim()
    ? motoristas.filter(m => m.nome.toLowerCase().includes(busca.toLowerCase()))
    : motoristas

  const emFeriasFilt   = filtradosFerias.filter(m => m.de_ferias)
  const disponiveisFilt = filtradosFerias.filter(m => !m.de_ferias)

  const historicofiltrado = buscaHist.trim()
    ? historicos.filter(h =>
        h.motorista_nome?.toLowerCase().includes(buscaHist.toLowerCase()) ||
        h.substituto_nome?.toLowerCase().includes(buscaHist.toLowerCase())
      )
    : historicos

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Palmtree size={26} className="text-blue-500"/>
          <h1 className="text-2xl font-bold text-gray-900">Férias</h1>
        </div>

        {/* Tabs */}
        <div className="flex bg-white p-1 rounded-xl shadow-sm border border-gray-200">
          <button onClick={() => setAbaAtiva('ferias')}
            className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all
              ${abaAtiva === 'ferias' ? 'bg-red-600 text-white shadow-md' : 'text-gray-400 hover:text-gray-600'}`}>
            Férias
          </button>
          <button onClick={() => setAbaAtiva('historico')}
            className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all
              ${abaAtiva === 'historico' ? 'bg-red-600 text-white shadow-md' : 'text-gray-400 hover:text-gray-600'}`}>
            Histórico
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-10 text-gray-400 text-sm">Carregando...</div>
      ) : abaAtiva === 'ferias' ? (
        <>
          {/* Busca */}
          <div className="relative mb-6">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"/>
            <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar motorista..."
              className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-white shadow-sm"/>
          </div>

          {/* Em férias */}
          {emFeriasFilt.length > 0 && (
            <div className="mb-6">
              <p className="text-xs font-bold text-blue-600 uppercase tracking-wide mb-3 flex items-center gap-2">
                <Palmtree size={14}/> Em férias ({emFeriasFilt.length})
              </p>
              <div className="space-y-3">
                {emFeriasFilt.map(m => {
                  const substituto = getSubstituto(m.substituto_id)
                  const caminhao   = getCaminhao(m.caminhao_id)
                  return (
                    <div key={m.id} className="bg-white rounded-2xl border border-blue-100 shadow-sm p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-base flex-shrink-0">
                          {m.nome.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-gray-900">{m.nome}</p>
                          <p className="text-xs text-blue-600 mt-0.5">
                            🏖️ {fmtData(m.ferias_inicio)} → {fmtData(m.ferias_fim)}
                            {m.ferias_inicio && m.ferias_fim && (
                              <span className="ml-1 text-blue-400">({diasFerias(m.ferias_inicio, m.ferias_fim)} dias)</span>
                            )}
                          </p>
                        </div>
                        <span className="text-xs bg-blue-100 text-blue-700 font-bold px-2 py-1 rounded-full">Férias</span>
                      </div>
                      {substituto && (
                        <div className="mt-3 bg-blue-50 rounded-xl p-3 flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-blue-200 flex items-center justify-center text-blue-700 text-xs font-bold flex-shrink-0">
                            {substituto.nome.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] text-blue-500 uppercase font-bold">Substituto</p>
                            <p className="text-xs font-semibold text-blue-800 truncate">{substituto.nome}</p>
                          </div>
                          {caminhao && <span className="text-xs text-blue-600 font-medium shrink-0">🚛 {caminhao.placa}</span>}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {emFeriasFilt.length === 0 && (
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-8 text-center mb-6">
              <Palmtree size={32} className="mx-auto text-blue-200 mb-2"/>
              <p className="text-sm text-blue-400">Nenhum motorista de férias no momento</p>
            </div>
          )}

          {/* Disponíveis */}
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">
              Disponíveis ({disponiveisFilt.length})
            </p>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {disponiveisFilt.length === 0 ? (
                <div className="p-8 text-center text-sm text-gray-400">Nenhum motorista disponível</div>
              ) : disponiveisFilt.map(m => (
                <div key={m.id} className="flex items-center gap-4 px-5 py-4 border-b border-gray-50 last:border-0">
                  <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-bold text-sm flex-shrink-0">
                    {m.nome.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900">{m.nome}</p>
                    <p className="text-xs text-gray-400 mt-0.5">Disponível</p>
                  </div>
                  <div className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0"/>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        /* ── HISTÓRICO ── */
        <>
          <div className="relative mb-6">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"/>
            <input value={buscaHist} onChange={e => setBuscaHist(e.target.value)}
              placeholder="Buscar por motorista ou substituto..."
              className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-white shadow-sm"/>
          </div>

          {historicofiltrado.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
              <History size={32} className="mx-auto text-gray-200 mb-2"/>
              <p className="text-sm text-gray-400">Nenhum histórico de férias registrado</p>
            </div>
          ) : (
            <div className="space-y-3">
              {historicofiltrado.map(h => (
                <div key={h.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm flex-shrink-0">
                        {h.motorista_nome?.charAt(0) || '?'}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900">{h.motorista_nome}</p>
                        <p className="text-xs text-blue-600 mt-0.5">
                          🏖️ {fmtData(h.ferias_inicio)} → {fmtData(h.ferias_fim)}
                          {h.ferias_inicio && h.ferias_fim && (
                            <span className="ml-1 text-blue-400">({diasFerias(h.ferias_inicio, h.ferias_fim)} dias)</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 shrink-0">{fmtData(h.created_at)}</p>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {h.substituto_nome && (
                      <div className="bg-gray-50 rounded-xl p-2.5">
                        <p className="text-[10px] text-gray-400 uppercase font-bold">Substituto</p>
                        <p className="text-xs font-semibold text-gray-700 mt-0.5">{h.substituto_nome}</p>
                      </div>
                    )}
                    {h.caminhao_placa && (
                      <div className="bg-gray-50 rounded-xl p-2.5">
                        <p className="text-[10px] text-gray-400 uppercase font-bold">Caminhão</p>
                        <p className="text-xs font-semibold text-gray-700 mt-0.5">🚛 {h.caminhao_placa}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}