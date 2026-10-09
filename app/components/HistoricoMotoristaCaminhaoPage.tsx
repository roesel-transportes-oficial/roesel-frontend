'use client'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../services/supabase'
import { normalizarPlaca, chavePlaca } from '../services/placas'
import { History, Search, Truck, User, Calendar } from 'lucide-react'

interface Registro {
  id: string
  caminhao_id: string
  caminhao_placa: string
  motorista_nome: string
  data_inicio: string
  data_fim: string | null
}

function fmtData(d: string | null) {
  if (!d) return 'Atual'
  const [y, m, dia] = d.split('-')
  return `${dia}/${m}/${y}`
}

export default function HistoricoMotoristaCaminhaoPage() {
  const [registros, setRegistros] = useState<Registro[]>([])
  const [loading, setLoading]     = useState(false)
  const [busca, setBusca]         = useState('')
  const [modo, setModo]           = useState<'placa' | 'motorista'>('placa')

  useEffect(() => { fetch_() }, [])

  async function fetch_() {
    setLoading(true)
    const { data } = await supabase
      .from('historico_motorista_caminhao')
      .select('*')
      .order('caminhao_placa')
      .order('data_inicio', { ascending: false })
    setRegistros((data || []).map(r => ({ ...r, caminhao_placa: normalizarPlaca(r.caminhao_placa) })))
    setLoading(false)
  }

  const filtrados = useMemo(() => {
    if (!busca.trim()) return registros
    const b = busca.toLowerCase()
    return registros.filter(r =>
      chavePlaca(r.caminhao_placa).toLowerCase().includes(b.replace(/[^a-z0-9]/g, '')) ||
      r.motorista_nome?.toLowerCase().includes(b)
    )
  }, [registros, busca])

  // Agrupa por placa (ou por motorista, dependendo do modo escolhido)
  const agrupados = useMemo(() => {
    const chaveDe = (r: Registro) => modo === 'placa' ? normalizarPlaca(r.caminhao_placa) : r.motorista_nome
    const grupos: Record<string, Registro[]> = {}
    for (const r of filtrados) {
      const chave = chaveDe(r)
      if (!grupos[chave]) grupos[chave] = []
      grupos[chave].push(r)
    }
    return Object.entries(grupos).sort(([a], [b]) => a.localeCompare(b))
  }, [filtrados, modo])

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <History size={24} className="text-red-600"/> Histórico de Motorista × Caminhão
          </h1>
          <p className="text-sm text-gray-500">Quem estava com qual caminhão em cada período</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col md:flex-row gap-3 items-center">
        <div className="relative flex-1 w-full">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
          <input value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="Buscar placa ou motorista..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-500"/>
        </div>
        <div className="flex bg-gray-100 p-1 rounded-xl">
          <button onClick={() => setModo('placa')}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition ${modo === 'placa' ? 'bg-white shadow text-red-600' : 'text-gray-500'}`}>
            <Truck size={12} className="inline mr-1"/> Por Caminhão
          </button>
          <button onClick={() => setModo('motorista')}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition ${modo === 'motorista' ? 'bg-white shadow text-red-600' : 'text-gray-500'}`}>
            <User size={12} className="inline mr-1"/> Por Motorista
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">Carregando...</div>
      ) : agrupados.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
          <History size={32} className="mx-auto text-gray-200 mb-2"/>
          <p className="text-sm text-gray-400">Nenhum registro encontrado.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {agrupados.map(([chave, itens]) => (
            <div key={chave} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
                {modo === 'placa' ? <Truck size={16} className="text-red-600"/> : <User size={16} className="text-red-600"/>}
                <span className="font-black text-gray-900">{chave}</span>
                <span className="text-xs text-gray-400">({itens.length} período{itens.length > 1 ? 's' : ''})</span>
              </div>
              <div className="divide-y divide-gray-50">
                {itens.map(r => (
                  <div key={r.id} className="px-5 py-3 flex items-center justify-between hover:bg-gray-50/50 transition">
                    <div className="flex items-center gap-3">
                      {modo === 'placa'
                        ? <><User size={14} className="text-gray-400"/><span className="text-sm font-bold text-gray-900">{r.motorista_nome}</span></>
                        : <><Truck size={14} className="text-gray-400"/><span className="text-sm font-bold text-gray-900">{normalizarPlaca(r.caminhao_placa)}</span></>
                      }
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <Calendar size={12} className="text-gray-400"/>
                      <span className="font-bold text-gray-600">{fmtData(r.data_inicio)}</span>
                      <span className="text-gray-300">→</span>
                      <span className={`font-bold ${r.data_fim ? 'text-gray-600' : 'text-green-600'}`}>
                        {fmtData(r.data_fim)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
