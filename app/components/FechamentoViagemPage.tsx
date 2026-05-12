'use client'
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../services/supabase'

type Motorista = { id: string; nome: string; adiantamento?: boolean }
type Caminhao = { id: string; placa: string }
type Contrato = { id: string; numero_contrato: string; fat_bruto: number; cliente?: string; data?: string }
type Abastecimento = {
  id: string; data: string; posto?: string
  litros_combustivel?: number; valor_combustivel?: number
  litros_arla?: number; valor_arla?: number
}

export default function FechamentoViagemPage() {
  const [motoristas, setMotoristas]         = useState<Motorista[]>([])
  const [motoristaId, setMotoristaId]       = useState('')
  const [caminhao, setCaminhao]             = useState<Caminhao | null>(null)
  const [dataInicio, setDataInicio]         = useState('')
  const [dataFim, setDataFim]               = useState('')
  const [kmInicial, setKmInicial]           = useState('')
  const [kmFinal, setKmFinal]               = useState('')
  const [busca, setBusca]                   = useState('')
  const [resultados, setResultados]         = useState<Contrato[]>([])
  const [selecionados, setSelecionados]     = useState<Contrato[]>([])
  const [abastecimentos, setAbastecimentos] = useState<Abastecimento[]>([])
  const [salvando, setSalvando]             = useState(false)
  const [erro, setErro]                     = useState('')
  const [sucesso, setSucesso]               = useState(false)

  // Carrega motoristas
  useEffect(() => {
    supabase.from('motoristas').select('id, nome, adiantamento').order('nome')
      .then(({ data }) => data && setMotoristas(data))
  }, [])

  // Quando seleciona motorista → busca caminhão vinculado
  useEffect(() => {
    if (!motoristaId) { setCaminhao(null); return }
    supabase
      .from('caminhoes')
      .select('id, placa')
      .eq('motorista_atual', motoristaId)
      .maybeSingle()
      .then(({ data }) => setCaminhao(data))
  }, [motoristaId])

  // Quando período muda → busca abastecimentos
  useEffect(() => {
    if (!motoristaId || !dataInicio || !dataFim) return
    supabase
      .from('abastecimentos')
      .select('id, data, posto, litros_combustivel, valor_combustivel, litros_arla, valor_arla')
      .eq('motorista_id', motoristaId)
      .gte('data', dataInicio)
      .lte('data', dataFim)
      .order('data')
      .then(({ data }) => setAbastecimentos(data || []))
  }, [motoristaId, dataInicio, dataFim])

  // Busca contratos pelo número/cliente
  useEffect(() => {
    if (busca.length < 2) { setResultados([]); return }
    const timer = setTimeout(() => {
      supabase
        .from('contratos')
        .select('id, numero_contrato, fat_bruto, cliente, data')
        .eq('motorista_id', motoristaId)
        .or(`numero_contrato.ilike.%${busca}%,cliente.ilike.%${busca}%`)
        .limit(8)
        .then(({ data }) => {
          const jaAdicionados = new Set(selecionados.map(s => s.id))
          setResultados((data || []).filter(c => !jaAdicionados.has(c.id)))
        })
    }, 300)
    return () => clearTimeout(timer)
  }, [busca, motoristaId, selecionados])

  function adicionarContrato(c: Contrato) {
    setSelecionados(prev => [...prev, c])
    setBusca('')
    setResultados([])
  }

  function removerContrato(id: string) {
    setSelecionados(prev => prev.filter(c => c.id !== id))
  }

  const resumo = useMemo(() => {
    const km = kmFinal && kmInicial ? Number(kmFinal) - Number(kmInicial) : 0
    const litros = abastecimentos.reduce((s, a) => s + (a.litros_combustivel || 0), 0)
    const valor  = abastecimentos.reduce((s, a) => s + (a.valor_combustivel || 0) + (a.valor_arla || 0), 0)
    const mediaKmL = litros > 0 && km > 0 ? km / litros : 0
    const totalFrete = selecionados.reduce((s, c) => s + (Number(c.fat_bruto) || 0), 0)
    return { km, litros, valor, mediaKmL, totalFrete }
  }, [abastecimentos, kmInicial, kmFinal, selecionados])

  async function salvar() {
    setErro('')
    if (!motoristaId || !dataInicio || !dataFim || !kmInicial || !kmFinal) {
      setErro('Preencha motorista, período e hodômetro.'); return
    }
    if (selecionados.length === 0) {
      setErro('Adicione ao menos um contrato.'); return
    }
    setSalvando(true)

    const { data: fech, error } = await supabase
      .from('fechamento_viagens')
      .insert({
        motorista_id: motoristaId,
        caminhao_id: caminhao?.id || null,
        data_inicio: dataInicio,
        data_fim: dataFim,
        km_inicial: Number(kmInicial),
        km_final: Number(kmFinal),
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
      abastecimentos.length > 0 && supabase.from('fechamento_abastecimentos').insert(
        abastecimentos.map(a => ({ fechamento_id: fech.id, abastecimento_id: a.id }))
      ),
    ])

    setSucesso(true)
    setSalvando(false)
    setTimeout(() => {
      setMotoristaId(''); setCaminhao(null)
      setDataInicio(''); setDataFim('')
      setKmInicial(''); setKmFinal('')
      setSelecionados([]); setAbastecimentos([])
      setSucesso(false)
    }, 2000)
  }

  const fmt = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
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
            onChange={e => { setMotoristaId(e.target.value); setSelecionados([]); setAbastecimentos([]) }}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            <option value="">Selecione o motorista...</option>
            {motoristas.map(m => (
              <option key={m.id} value={m.id}>{m.nome}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
            Placa (automático)
          </label>
          <div className={`w-full border rounded-lg px-3 py-2.5 text-sm
            ${caminhao ? 'border-gray-300 bg-gray-50 text-gray-800 font-semibold' : 'border-gray-200 bg-gray-50 text-gray-400'}`}>
            {caminhao ? caminhao.placa : motoristaId ? 'Nenhum caminhão vinculado' : '—'}
          </div>
        </div>
      </div>

      {/* ── Período + Hodômetro ── */}
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
          <span className="text-sm font-normal text-gray-400 ml-2">
            ({selecionados.length} adicionados)
          </span>
        </h2>

        {/* Busca */}
        {motoristaId && (
          <div className="relative mb-3">
            <input
              type="text"
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar contrato por número ou cliente..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            {resultados.length > 0 && (
              <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                {resultados.map(c => (
                  <button
                    key={c.id}
                    onClick={() => adicionarContrato(c)}
                    className="w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-red-50 transition text-left border-b last:border-0"
                  >
                    <span>
                      <span className="font-medium text-gray-800">#{c.numero_contrato}</span>
                      {c.cliente && <span className="text-gray-500 ml-2">· {c.cliente}</span>}
                    </span>
                    <span className="text-green-700 font-semibold shrink-0 ml-4">
                      {c.fat_bruto ? `R$ ${fmt(Number(c.fat_bruto))}` : '—'}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {!motoristaId && (
          <p className="text-gray-400 text-sm">Selecione um motorista para buscar contratos.</p>
        )}

        {/* Contratos selecionados */}
        {selecionados.length === 0 && motoristaId && (
          <p className="text-gray-400 text-sm">Nenhum contrato adicionado ainda.</p>
        )}
        <div className="space-y-2">
          {selecionados.map(c => (
            <div key={c.id}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-red-200 bg-red-50">
              <div className="flex-1 min-w-0">
                <span className="font-medium text-sm text-gray-800">#{c.numero_contrato}</span>
                {c.cliente && <span className="text-gray-500 text-sm ml-2">· {c.cliente}</span>}
                {c.data && <span className="text-gray-400 text-xs ml-2">{fmtData(c.data)}</span>}
              </div>
              <span className="text-green-700 font-semibold text-sm shrink-0">
                {c.fat_bruto ? `R$ ${fmt(Number(c.fat_bruto))}` : '—'}
              </span>
              <button onClick={() => removerContrato(c.id)}
                className="text-red-400 hover:text-red-600 text-lg leading-none shrink-0">×</button>
            </div>
          ))}
        </div>
      </div>

      {/* ── Abastecimentos ── */}
      {motoristaId && dataInicio && dataFim && (
        <div className="bg-white rounded-xl shadow p-5">
          <h2 className="text-base font-semibold text-gray-800 mb-3">
            Abastecimentos no Período
            <span className="text-sm font-normal text-gray-400 ml-2">
              ({abastecimentos.length} registros — vinculados automaticamente)
            </span>
          </h2>

          {abastecimentos.length === 0 ? (
            <p className="text-gray-400 text-sm">Nenhum abastecimento no período.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-400 uppercase tracking-wide border-b">
                    <th className="pb-2 pr-4">Data</th>
                    <th className="pb-2 pr-4">Posto</th>
                    <th className="pb-2 pr-4 text-right">Diesel (L)</th>
                    <th className="pb-2 pr-4 text-right">Arla (L)</th>
                    <th className="pb-2 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {abastecimentos.map(a => {
                    const valor = (a.valor_combustivel || 0) + (a.valor_arla || 0)
                    return (
                      <tr key={a.id} className="border-b last:border-0">
                        <td className="py-2 pr-4 text-gray-600">{fmtData(a.data)}</td>
                        <td className="py-2 pr-4 text-gray-600">{a.posto || '—'}</td>
                        <td className="py-2 pr-4 text-right">
                          {a.litros_combustivel ? `${Number(a.litros_combustivel).toFixed(0)} L` : '—'}
                        </td>
                        <td className="py-2 pr-4 text-right">
                          {a.litros_arla ? `${Number(a.litros_arla).toFixed(0)} L` : '—'}
                        </td>
                        <td className="py-2 text-right font-medium text-red-600">
                          {valor > 0 ? `R$ ${fmt(valor)}` : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Resumo ── */}
      {(selecionados.length > 0 || abastecimentos.length > 0) && (
        <div className="bg-gray-900 text-white rounded-xl p-5 grid grid-cols-2 md:grid-cols-4 gap-5">
          {[
            { label: 'KM Rodado',       value: resumo.km > 0        ? `${resumo.km.toLocaleString('pt-BR')} km`  : '—', color: 'text-white'   },
            { label: 'Total Abastecido',value: resumo.valor > 0     ? `R$ ${fmt(resumo.valor)}`                  : '—', color: 'text-red-400' },
            { label: 'Total Litros',    value: resumo.litros > 0    ? `${resumo.litros.toFixed(0)} L`            : '—', color: 'text-blue-400'},
            { label: 'Média km/L',      value: resumo.mediaKmL > 0  ? `${resumo.mediaKmL.toFixed(2)} km/L`      : '—', color: 'text-green-400'},
          ].map(item => (
            <div key={item.label}>
              <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">{item.label}</p>
              <p className={`text-xl font-bold ${item.color}`}>{item.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Erro / Sucesso / Salvar ── */}
      {erro && (
        <div className="text-red-700 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-3">{erro}</div>
      )}
      {sucesso && (
        <div className="text-green-700 text-sm bg-green-50 border border-green-200 rounded-lg px-4 py-3">
          ✓ Fechamento salvo com sucesso!
        </div>
      )}

      <div className="flex justify-end pb-8">
        <button
          onClick={salvar}
          disabled={!podeSalvar || salvando}
          className="bg-red-600 text-white px-8 py-3 rounded-xl font-semibold text-sm hover:bg-red-700 disabled:opacity-50 transition-colors"
        >
          {salvando ? 'Salvando...' : 'Salvar Fechamento'}
        </button>
      </div>
    </div>
  )
}