'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '../services/auth'
import { Search, Palmtree, History, ChevronDown, ChevronUp } from 'lucide-react'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_KEY!

interface Motorista {
  id: string; nome: string; de_ferias: boolean
  ferias_inicio: string; ferias_fim: string; substituto_id: string
  caminhao_id: string
}

interface HistoricoFerias {
  id: string; motorista_nome: string; substituto_nome: string
  caminhao_placa: string; ferias_inicio: string; ferias_fim: string
  created_at: string
}

interface Caminhao { id: string; placa: string }

function fmtData(d: string) {
  if (!d) return '—'
  const [y, m, dia] = d.split('T')[0].split('-')
  return `${dia}/${m}/${y}`
}

function diasFerias(inicio: string, fim: string) {
  if (!inicio || !fim) return null
  const i = new Date(inicio + 'T00:00:00')
  const f = new Date(fim + 'T00:00:00')
  return Math.ceil((f.getTime() - i.getTime()) / (1000 * 60 * 60 * 24))
}

export default function FeriasPage() {
  const { perm } = useAuth()
  const [motoristas, setMotoristas] = useState<Motorista[]>([])
  const [caminhoes, setCaminhoes] = useState<Caminhao[]>([])
  const [historicos, setHistoricos] = useState<Record<string, HistoricoFerias[]>>({})
  const [busca, setBusca] = useState('')
  const [expandido, setExpandido] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchTudo() }, [])

  async function fetchTudo() {
    setLoading(true)
    try {
      const [resMotoristas, resCaminhoes, resHistorico] = await Promise.all([
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

      const [mData, cData, hData] = await Promise.all([
        resMotoristas.json(), resCaminhoes.json(), resHistorico.json()
      ])

      setMotoristas(Array.isArray(mData) ? mData : [])
      setCaminhoes(Array.isArray(cData) ? cData : [])

      // Agrupa histórico por motorista_id
      if (Array.isArray(hData)) {
        const agrupado: Record<string, HistoricoFerias[]> = {}
        hData.forEach((h: any) => {
          if (!agrupado[h.motorista_id]) agrupado[h.motorista_id] = []
          agrupado[h.motorista_id].push(h)
        })
        setHistoricos(agrupado)
      }
    } catch {}
    setLoading(false)
  }

  const filtrados = busca.trim()
    ? motoristas.filter(m => m.nome.toLowerCase().includes(busca.toLowerCase()))
    : motoristas

  const emFerias = filtrados.filter(m => m.de_ferias)
  const disponiveis = filtrados.filter(m => !m.de_ferias)

  function getCaminhao(id: string) {
    return caminhoes.find(c => c.id === id)
  }

  function getSubstituto(id: string) {
    return motoristas.find(m => m.id === id)
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Palmtree size={26} className="text-blue-500" />
        <h1 className="text-2xl font-bold text-gray-900">Férias</h1>
      </div>

      {/* Busca */}
      <div className="relative mb-6">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={busca} onChange={e => setBusca(e.target.value)}
          placeholder="Buscar motorista..."
          className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-white shadow-sm" />
      </div>

      {loading ? (
        <div className="text-center py-10 text-gray-400 text-sm">Carregando...</div>
      ) : (
        <>
          {/* Em férias */}
          {emFerias.length > 0 && (
            <div className="mb-6">
              <p className="text-xs font-bold text-blue-600 uppercase tracking-wide mb-3 flex items-center gap-2">
                <Palmtree size={14} /> Em férias ({emFerias.length})
              </p>
              <div className="space-y-2">
                {emFerias.map(m => {
                  const substituto = getSubstituto(m.substituto_id)
                  const caminhao = getCaminhao(m.caminhao_id)
                  const hist = historicos[m.id] || []
                  const aberto = expandido === m.id

                  return (
                    <div key={m.id} className="bg-white rounded-2xl border border-blue-100 shadow-sm overflow-hidden">
                      <div className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                              {m.nome.charAt(0)}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-gray-900">{m.nome}</p>
                              <p className="text-xs text-blue-600 mt-0.5">
                                🏖️ {fmtData(m.ferias_inicio)} → {fmtData(m.ferias_fim)}
                                {m.ferias_inicio && m.ferias_fim && (
                                  <span className="ml-1 text-blue-400">
                                    ({diasFerias(m.ferias_inicio, m.ferias_fim)} dias)
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>
                          <button onClick={() => setExpandido(aberto ? null : m.id)}
                            className="text-gray-400 hover:text-gray-600 transition">
                            {aberto ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>
                        </div>

                        {substituto && (
                          <div className="mt-3 bg-blue-50 rounded-xl p-3 flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-blue-200 flex items-center justify-center text-blue-700 text-xs font-bold">
                              {substituto.nome.charAt(0)}
                            </div>
                            <div>
                              <p className="text-xs text-blue-500">Substituto</p>
                              <p className="text-xs font-semibold text-blue-800">{substituto.nome}</p>
                            </div>
                            {caminhao && (
                              <span className="ml-auto text-xs text-blue-600 font-medium">🚛 {caminhao.placa}</span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Histórico expandido */}
                      {aberto && hist.length > 0 && (
                        <div className="border-t border-blue-50 p-4">
                          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1">
                            <History size={12} /> Histórico de férias
                          </p>
                          <div className="space-y-2">
                            {hist.map(h => (
                              <div key={h.id} className="bg-gray-50 rounded-xl p-3">
                                <p className="text-xs font-medium text-gray-700">
                                  {fmtData(h.ferias_inicio)} → {fmtData(h.ferias_fim)}
                                  {h.ferias_inicio && h.ferias_fim && (
                                    <span className="text-gray-400 ml-1">
                                      ({diasFerias(h.ferias_inicio, h.ferias_fim)} dias)
                                    </span>
                                  )}
                                </p>
                                {h.substituto_nome && (
                                  <p className="text-xs text-gray-500 mt-0.5">Substituto: {h.substituto_nome}</p>
                                )}
                                {h.caminhao_placa && (
                                  <p className="text-xs text-gray-500 mt-0.5">🚛 {h.caminhao_placa}</p>
                                )}
                                <p className="text-xs text-gray-400 mt-0.5">Registrado em {fmtData(h.created_at)}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {aberto && hist.length === 0 && (
                        <div className="border-t border-blue-50 p-4 text-center text-xs text-gray-400">
                          Nenhum histórico registrado
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Disponíveis */}
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">
              Disponíveis ({disponiveis.length})
            </p>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {disponiveis.length === 0 ? (
                <div className="p-10 text-center text-sm text-gray-400">Nenhum motorista disponível</div>
              ) : disponiveis.map(m => {
                const hist = historicos[m.id] || []
                const aberto = expandido === m.id

                return (
                  <div key={m.id} className="border-b border-gray-50 last:border-0">
                    <button
                      onClick={() => setExpandido(aberto ? null : m.id)}
                      className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition text-left">
                      <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-bold text-sm flex-shrink-0">
                        {m.nome.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-900">{m.nome}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {hist.length > 0 ? `${hist.length} período(s) de férias` : 'Sem histórico de férias'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-400" />
                        {hist.length > 0 && (aberto ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />)}
                      </div>
                    </button>

                    {aberto && hist.length > 0 && (
                      <div className="px-5 pb-4 border-t border-gray-50">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wide my-3 flex items-center gap-1">
                          <History size={12} /> Histórico de férias
                        </p>
                        <div className="space-y-2">
                          {hist.map(h => (
                            <div key={h.id} className="bg-blue-50 rounded-xl p-3">
                              <p className="text-xs font-medium text-blue-800">
                                {fmtData(h.ferias_inicio)} → {fmtData(h.ferias_fim)}
                                {h.ferias_inicio && h.ferias_fim && (
                                  <span className="text-blue-400 ml-1">
                                    ({diasFerias(h.ferias_inicio, h.ferias_fim)} dias)
                                  </span>
                                )}
                              </p>
                              {h.substituto_nome && (
                                <p className="text-xs text-blue-600 mt-0.5">Substituto: {h.substituto_nome}</p>
                              )}
                              {h.caminhao_placa && (
                                <p className="text-xs text-blue-600 mt-0.5">🚛 {h.caminhao_placa}</p>
                              )}
                              <p className="text-xs text-blue-400 mt-0.5">Registrado em {fmtData(h.created_at)}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}