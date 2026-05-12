'use client'
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../services/supabase'
import { X } from 'lucide-react'

type Motorista     = { id: string; nome: string }
type Caminhao      = { id: string; placa: string }
type Contrato      = { id: string; numero_contrato: string; fat_bruto: number; cliente?: string; origem?: string; destino?: string }
type Abastecimento = {
  id: string; data: string; posto?: string
  litros_combustivel?: number; valor_combustivel?: number
  litros_arla?: number; valor_arla?: number
}

export default function FechamentoViagemPage() {
  const [motoristas, setMotoristas]             = useState<Motorista[]>([])
  const [motoristaId, setMotoristaId]           = useState('')
  const [caminhao, setCaminhao]                 = useState<Caminhao | null>(null)
  const [dataInicio, setDataInicio]             = useState('')
  const [dataFim, setDataFim]                   = useState('')
  const [kmInicial, setKmInicial]               = useState('')
  const [kmFinal, setKmFinal]                   = useState('')
  const [busca, setBusca]                       = useState('')
  const [resultados, setResultados]             = useState<Contrato[]>([])
  const [selecionados, setSelecionados]         = useState<Contrato[]>([])
  const [abastecimentos, setAbastecimentos]     = useState<Abastecimento[]>([])
  const [abastSelecionados, setAbastSelecionados] = useState<Set<string>>(new Set())
  const [salvando, setSalvando]                 = useState(false)
  const [erro, setErro]                         = useState('')
  const [sucesso, setSucesso]                   = useState(false)

  useEffect(() => {
    supabase.from('motoristas').select('id, nome').order('nome')
      .then(({ data }) => data && setMotoristas(data))
  }, [])

  useEffect(() => {
    if (!motoristaId) { setCaminhao(null); return }
    supabase.from('caminhoes').select('id, placa')
      .eq('motorista_atual', motoristaId).maybeSingle()
      .then(({ data }) => setCaminhao(data))
  }, [motoristaId])

  // Abastecimentos automáticos → pré-seleciona todos
  useEffect(() => {
    if (!motoristaId || !dataInicio || !dataFim) { setAbastecimentos([]); setAbastSelecionados(new Set()); return }
    supabase
      .from('abastecimentos')
      .select('id, data, posto, litros_combustivel, valor_combustivel, litros_arla, valor_arla')
      .eq('motorista_id', motoristaId)
      .gte('data', dataInicio)
      .lte('data', dataFim)
      .order('data')
      .then(({ data }) => {
        const lista = data || []
        setAbastecimentos(lista)
        setAbastSelecionados(new Set(lista.map(a => a.id))) // pré-seleciona todos
      })
  }, [motoristaId, dataInicio, dataFim])

  useEffect(() => {
    if (!busca.trim() || busca.length < 2 || !motoristaId) { setResultados([]); return }
    const timer = setTimeout(() => {
      const jaAdicionados = new Set(selecionados.map(s => s.id))
      supabase
        .from('contratos')
        .select('id, numero_contrato, fat_bruto, cliente, origem, destino')
        .eq('motorista_id', motoristaId)
        .or(`numero_contrato.ilike.%${busca}%,cliente.ilike.%${busca}%`)
        .limit(8)
        .then(({ data }) =>
          setResultados((data || []).filter(c => !jaAdicionados.has(c.id)))
        )
    }, 300)
    return () => clearTimeout(timer)
  }, [busca, motoristaId, selecionados])

  function adicionar(c: Contrato) {
    setSelecionados(prev => [...prev, c])
    setBusca(''); setResultados([])
  }
  function remover(id: string) { setSelecionados(prev => prev.filter(c => c.id !== id)) }

  function toggleAbast(id: string) {
    setAbastSelecionados(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // Resumo usa só abastecimentos marcados
  const abastAtivos = useMemo(
    () => abastecimentos.filter(a => abastSelecionados.has(a.id)),
    [abastecimentos, abastSelecionados]
  )

  const resumo = useMemo(() => {
    const km       = kmFinal && kmInicial ? Number(kmFinal) - Number(kmInicial) : 0
    const litros   = abastAtivos.reduce((s, a) => s + (a.litros_combustivel || 0), 0)
    const valor    = abastAtivos.reduce((s, a) => s + (a.valor_combustivel || 0) + (a.valor_arla || 0), 0)
    const mediaKmL = litros > 0 && km > 0 ? km / litros : 0
    return { km, litros, valor, mediaKmL }
  }, [abastAtivos, kmInicial, kmFinal])

  async function salvar() {
    setErro('')
    if (!motoristaId || !dataInicio || !dataFim || !kmInicial || !kmFinal) {
      setErro('Preencha motorista, período e hodômetro.'); return
    }
    if (selecionados.length === 0) { setErro('Adicione ao menos um contrato.'); return }
    setSalvando(true)

    const { data: fech, error } = await supabase
      .from('fechamento_viagens')
      .insert({
        motorista_id: motoristaId,
        caminhao_id:  caminhao?.id || null,
        data_inicio:  dataInicio,
        data_fim:     dataFim,
        km_inicial:   Number(kmInicial),
        km_final:     Number(kmFinal),
      })
      .select().single()

    if (error || !fech) {
      setErro('Erro ao salvar: ' + (error?.message || 'tente novamente.'))
      setSalvando(false); return
    }

    await Promise.all([
      supabase.from('fechamento_contratos').insert(
        selecionados.map(c => ({ fechamento_id: fech.id, contrato_id: c.id }))
      ),
      abastAtivos.length > 0 && supabase.from('fechamento_abastecimentos').insert(
        abastAtivos.map(a => ({ fechamento_id: fech.id, abastecimento_id: a.id }))
      ),
    ])

    setSucesso(true); setSalvando(false)
    setTimeout(() => {
      setMotoristaId(''); setCaminhao(null)
      setDataInicio(''); setDataFim('')
      setKmInicial(''); setKmFinal('')
      setSelecionados([]); setAbastecimentos([])
      setAbastSelecionados(new Set()); setSucesso(false)
    }, 2000)
  }

  const fmt     = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
  const fmtData = (d: string) => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—'
  const podeSalvar = !!motoristaId && !!dataInicio && !!dataFim && !!kmInicial && !!kmFinal && selecionados.length > 0

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      <h1 className="text-2xl font-bold text-gray-800">Fechamento de Viagem</h1>

      {/* ── Motorista + Placa ── */}
      <div className="bg-white rounded-xl shadow p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
            Motorista <span className="text-red-500">*</span>
          </label>
          <select
            value={motoristaId}
            onChange={e => { setMotoristaId(e.target.value); setSelecionados([]); setAbastecimentos([]); setAbastSelecionados(new Set()) }}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            <option value="">Selecione o motorista...</option>
            {motoristas.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
            Placa (automático)
          </label>
          <div className={`w-full border rounded-lg px-3 py-2.5 text-sm font-semibold
            ${caminhao ? 'border-gray-300 bg-gray-50 text-gray-800' : 'border-gray-200 bg-gray-50 text-gray-400'}`}>
            {caminhao ? caminhao.placa : motoristaId ? 'Nenhum caminhão vinculado' : '—'}
          </div>
        </div>
      </div>

      {/* ── Datas + Hodômetro ── */}
      <div className="bg-white rounded-xl shadow p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
            Data Saída <span className="text-red-500">*</span>
          </label>
          <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
            Data Retorno <span className="text-red-500">*</span>
          </label>
          <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
            KM Inicial <span className="text-red-500">*</span>
          </label>
          <input type="number" value={kmInicial} onChange={e => setKmInicial(e.target.value)}
            placeholder="Ex: 125000"
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
            KM Final <span className="text-red-500">*</span>
          </label>
          <input type="number" value={kmFinal} onChange={e => setKmFinal(e.target.value)}
            placeholder="Ex: 127500"
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
        </div>
        {kmInicial && kmFinal && Number(kmFinal) > Number(kmInicial) && (
          <div className="col-span-2 md:col-span-4 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5">
            <span className="text-sm text-blue-700">
              KM percorrido: <strong>{(Number(kmFinal) - Number(kmInicial)).toLocaleString('pt-BR')} km</strong>
            </span>
          </div>
        )}
      </div>

      {/* ── Contratos ── */}
      <div className="bg-white rounded-xl shadow p-5">
        <h2 className="text-base font-semibold text-gray-800 mb-3">
          Contratos Vinculados
          <span className="text-sm font-normal text-gray-400 ml-2">({selecionados.length} adicionados)</span>
        </h2>

        {motoristaId ? (
          <div className="relative mb-4">
            <input
              type="text" value={busca} onChange={e => setBusca(e.target.value)}
              placeholder="Buscar contrato por número ou cliente..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            {resultados.length > 0 && (
              <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                {resultados.map(c => (
                  <button key={c.id} onClick={() => adicionar(c)}
                    className="w-full flex items-start justify-between px-4 py-3 text-sm hover:bg-red-50 transition text-left border-b last:border-0">
                    <div>
                      <span className="font-semibold text-gray-800">#{c.numero_contrato}</span>
                      {c.cliente && <span className="text-gray-500 ml-2">· {c.cliente}</span>}
                      {(c.origem || c.destino) && (
                        <p className="text-xs text-gray-400 mt-0.5">📍 {c.origem || '—'} → {c.destino || '—'}</p>
                      )}
                    </div>
                    <span className="text-green-700 font-semibold shrink-0 ml-4">
                      {c.fat_bruto ? `R$ ${fmt(Number(c.fat_bruto))}` : '—'}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className="text-gray-400 text-sm mb-4">Selecione um motorista para buscar contratos.</p>
        )}

        {selecionados.length === 0 ? (
          <p className="text-gray-400 text-sm">Nenhum contrato adicionado ainda.</p>
        ) : (
          <div className="space-y-2">
            {selecionados.map(c => (
              <div key={c.id} className="flex items-start gap-3 px-4 py-3 rounded-lg border border-red-200 bg-red-50">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-gray-800">#{c.numero_contrato}</span>
                    {c.cliente && <span className="text-gray-500 text-sm">· {c.cliente}</span>}
                    {c.fat_bruto > 0 && (
                      <span className="text-green-700 font-semibold text-sm ml-auto">R$ {fmt(Number(c.fat_bruto))}</span>
                    )}
                  </div>
                  {(c.origem || c.destino) && (
                    <p className="text-xs text-gray-500 mt-1">
                      📍 <span className="font-medium">{c.origem || '—'}</span>
                      <span className="mx-1">→</span>
                      <span className="font-medium">{c.destino || '—'}</span>
                    </p>
                  )}
                </div>
                <button onClick={() => remover(c.id)} className="text-red-400 hover:text-red-600 shrink-0 mt-0.5">
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Abastecimentos ── */}
      {motoristaId && dataInicio && dataFim && (
        <div className="bg-white rounded-xl shadow p-5">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-base font-semibold text-gray-800">Abastecimentos</h2>
            <div className="flex gap-3 text-xs">
              <button onClick={() => setAbastSelecionados(new Set(abastecimentos.map(a => a.id)))}
                className="text-red-600 hover:underline">Todos</button>
              <span className="text-gray-300">|</span>
              <button onClick={() => setAbastSelecionados(new Set())}
                className="text-red-600 hover:underline">Nenhum</button>
            </div>
          </div>
          <p className="text-xs text-gray-400 mb-4">
            Carregados automaticamente de {fmtData(dataInicio)} até {fmtData(dataFim)} —
            <span className="font-medium text-gray-600 ml-1">{abastSelecionados.size}/{abastecimentos.length} selecionados</span>
          </p>

          {abastecimentos.length === 0 ? (
            <p className="text-gray-400 text-sm">Nenhum abastecimento no período.</p>
          ) : (
            <div className="space-y-2">
              {abastecimentos.map(a => {
                const valor    = (a.valor_combustivel || 0) + (a.valor_arla || 0)
                const marcado  = abastSelecionados.has(a.id)
                return (
                  <label key={a.id}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-colors select-none
                      ${marcado ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-gray-50 opacity-60'}`}>
                    <input
                      type="checkbox" checked={marcado} onChange={() => toggleAbast(a.id)}
                      className="w-4 h-4 accent-red-600 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-gray-700">{fmtData(a.data)}</span>
                      {a.posto && <span className="text-gray-500 text-sm ml-2">· {a.posto}</span>}
                    </div>
                    <div className="text-right text-xs text-gray-500 shrink-0 space-x-3">
                      {a.litros_combustivel ? <span>⛽ {Number(a.litros_combustivel).toFixed(0)} L</span> : null}
                      {a.litros_arla        ? <span>🔵 {Number(a.litros_arla).toFixed(0)} L</span>        : null}
                      {valor > 0 && <span className="font-semibold text-red-600">R$ {fmt(valor)}</span>}
                    </div>
                  </label>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Resumo ── */}
      {(selecionados.length > 0 || abastAtivos.length > 0 || (kmInicial && kmFinal)) && (
        <div className="bg-gray-900 text-white rounded-xl p-5 grid grid-cols-2 md:grid-cols-4 gap-5">
          {[
            { label: 'KM Rodado',        value: resumo.km > 0       ? `${resumo.km.toLocaleString('pt-BR')} km` : '—', color: 'text-white'    },
            { label: 'Total Abastecido', value: resumo.valor > 0    ? `R$ ${fmt(resumo.valor)}`                  : '—', color: 'text-red-400'  },
            { label: 'Total Litros',     value: resumo.litros > 0   ? `${resumo.litros.toFixed(0)} L`            : '—', color: 'text-blue-400' },
            { label: 'Média km/L',       value: resumo.mediaKmL > 0 ? `${resumo.mediaKmL.toFixed(2)} km/L`       : '—', color: 'text-green-400'},
          ].map(item => (
            <div key={item.label}>
              <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">{item.label}</p>
              <p className={`text-xl font-bold ${item.color}`}>{item.value}</p>
            </div>
          ))}
        </div>
      )}

      {erro && (
        <div className="text-red-700 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-3">{erro}</div>
      )}
      {sucesso && (
        <div className="text-green-700 text-sm bg-green-50 border border-green-200 rounded-lg px-4 py-3">
          ✓ Fechamento salvo com sucesso!
        </div>
      )}

      <div className="flex justify-end pb-8">
        <button onClick={salvar} disabled={!podeSalvar || salvando}
          className="bg-red-600 text-white px-8 py-3 rounded-xl font-semibold text-sm hover:bg-red-700 disabled:opacity-50 transition-colors">
          {salvando ? 'Salvando...' : 'Salvar Fechamento'}
        </button>
      </div>
    </div>
  )
}