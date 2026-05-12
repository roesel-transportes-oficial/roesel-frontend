'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../services/supabase'
import { X } from 'lucide-react'

type Motorista = {
  id: string
  nome: string
}

type Caminhao = {
  id: string
  placa: string
}

type Contrato = {
  id: string
  contrato: string
  fat_bruto: number | null
  cliente?: string | null
  origem?: string | null
  destino?: string | null
}

type Abastecimento = {
  id: string
  data: string
  posto?: string | null
  litros_combustivel?: number | null
  valor_combustivel?: number | null
  litros_arla?: number | null
  valor_arla?: number | null
}

export default function FechamentoViagemPage() {
  const [motoristas, setMotoristas] = useState<Motorista[]>([])
  const [motoristaId, setMotoristaId] = useState('')
  const [caminhao, setCaminhao] = useState<Caminhao | null>(null)

  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [kmInicial, setKmInicial] = useState('')
  const [kmFinal, setKmFinal] = useState('')

  const [busca, setBusca] = useState('')
  const [resultados, setResultados] = useState<Contrato[]>([])
  const [selecionados, setSelecionados] = useState<Contrato[]>([])

  const [abastecimentos, setAbastecimentos] = useState<Abastecimento[]>([])
  const [abastSelecionados, setAbastSelecionados] = useState<Set<string>>(new Set())

  const [carregandoAbastecimentos, setCarregandoAbastecimentos] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState(false)

  useEffect(() => {
    supabase
      .from('motoristas')
      .select('id, nome')
      .order('nome')
      .then(({ data, error }) => {
        if (error) {
          setErro('Erro ao carregar motoristas: ' + error.message)
          return
        }

        if (data) setMotoristas(data)
      })
  }, [])

  useEffect(() => {
    setErro('')

    if (!motoristaId) {
      setCaminhao(null)
      setAbastecimentos([])
      setAbastSelecionados(new Set())
      return
    }

    supabase
      .from('caminhoes')
      .select('id, placa')
      .eq('motorista_atual', motoristaId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          setErro('Erro ao buscar caminhão vinculado: ' + error.message)
          setCaminhao(null)
          return
        }

        setCaminhao(data)
      })
  }, [motoristaId])

  useEffect(() => {
    if (!caminhao?.id || !dataInicio || !dataFim) {
      setAbastecimentos([])
      setAbastSelecionados(new Set())
      return
    }

    setCarregandoAbastecimentos(true)

    supabase
      .from('abastecimentos')
      .select('id, data, posto, litros_combustivel, valor_combustivel, litros_arla, valor_arla')
      .eq('caminhao_id', caminhao.id)
      .gte('data', dataInicio)
      .lte('data', dataFim)
      .order('data', { ascending: true })
      .then(({ data, error }) => {
        setCarregandoAbastecimentos(false)

        if (error) {
          setErro('Erro ao carregar abastecimentos do período: ' + error.message)
          setAbastecimentos([])
          setAbastSelecionados(new Set())
          return
        }

        const lista = data || []
        setAbastecimentos(lista)

        // Por padrão, tudo que veio no período já fica marcado.
        // Se não quiser vincular algum, basta desmarcar manualmente.
        setAbastSelecionados(new Set(lista.map(a => a.id)))
      })
  }, [caminhao?.id, dataInicio, dataFim])

  useEffect(() => {
    if (!busca.trim() || busca.trim().length < 2) {
      setResultados([])
      return
    }

    const timer = setTimeout(() => {
      const jaAdicionados = new Set(selecionados.map(s => s.id))

      supabase
        .from('contratos')
        .select('id, contrato, fat_bruto, cliente, origem, destino')
        .or(`contrato.ilike.%${busca.trim()}%,cliente.ilike.%${busca.trim()}%`)
        .limit(10)
        .then(({ data, error }) => {
          if (error) {
            setErro('Erro ao buscar contratos: ' + error.message)
            setResultados([])
            return
          }

          setResultados((data || []).filter(c => !jaAdicionados.has(c.id)))
        })
    }, 300)

    return () => clearTimeout(timer)
  }, [busca, selecionados])

  function adicionarContrato(contrato: Contrato) {
    setSelecionados(prev => [...prev, contrato])
    setBusca('')
    setResultados([])
  }

  function removerContrato(id: string) {
    setSelecionados(prev => prev.filter(c => c.id !== id))
  }

  function toggleAbastecimento(id: string) {
    setAbastSelecionados(prev => {
      const next = new Set(prev)

      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }

      return next
    })
  }

  function selecionarTodosAbastecimentos() {
    setAbastSelecionados(new Set(abastecimentos.map(a => a.id)))
  }

  function limparAbastecimentos() {
    setAbastSelecionados(new Set())
  }

  const abastAtivos = useMemo(() => {
    return abastecimentos.filter(a => abastSelecionados.has(a.id))
  }, [abastecimentos, abastSelecionados])

  const resumo = useMemo(() => {
    const km = kmFinal && kmInicial ? Number(kmFinal) - Number(kmInicial) : 0
    const litrosCombustivel = abastAtivos.reduce((total, a) => total + Number(a.litros_combustivel || 0), 0)
    const litrosArla = abastAtivos.reduce((total, a) => total + Number(a.litros_arla || 0), 0)
    const valorCombustivel = abastAtivos.reduce((total, a) => total + Number(a.valor_combustivel || 0), 0)
    const valorArla = abastAtivos.reduce((total, a) => total + Number(a.valor_arla || 0), 0)
    const valorTotalAbastecido = valorCombustivel + valorArla
    const mediaLitrosPorAbastecimento = abastAtivos.length > 0 ? litrosCombustivel / abastAtivos.length : 0
    const mediaKmPorLitro = km > 0 && litrosCombustivel > 0 ? km / litrosCombustivel : 0
    const totalContratos = selecionados.reduce((total, c) => total + Number(c.fat_bruto || 0), 0)

    return {
      km,
      litrosCombustivel,
      litrosArla,
      valorCombustivel,
      valorArla,
      valorTotalAbastecido,
      mediaLitrosPorAbastecimento,
      mediaKmPorLitro,
      totalContratos,
    }
  }, [abastAtivos, kmInicial, kmFinal, selecionados])

  async function salvar() {
    setErro('')
    setSucesso(false)

    if (!motoristaId || !dataInicio || !dataFim || !kmInicial || !kmFinal) {
      setErro('Preencha motorista, período e hodômetro.')
      return
    }

    if (Number(kmFinal) <= Number(kmInicial)) {
      setErro('O KM final precisa ser maior que o KM inicial.')
      return
    }

    if (selecionados.length === 0) {
      setErro('Adicione ao menos um contrato para vincular ao fechamento.')
      return
    }

    setSalvando(true)

    const { data: fechamento, error: erroFechamento } = await supabase
      .from('fechamento_viagens')
      .insert({
        motorista_id: motoristaId,
        caminhao_id: caminhao?.id || null,
        data_inicio: dataInicio,
        data_fim: dataFim,
        km_inicial: Number(kmInicial),
        km_final: Number(kmFinal),
      })
      .select()
      .single()

    if (erroFechamento || !fechamento) {
      setErro('Erro ao salvar fechamento: ' + (erroFechamento?.message || 'tente novamente.'))
      setSalvando(false)
      return
    }

    const { error: erroContratos } = await supabase
      .from('fechamento_contratos')
      .insert(selecionados.map(c => ({ fechamento_id: fechamento.id, contrato_id: c.id })))

    if (erroContratos) {
      setErro('Fechamento criado, mas houve erro ao vincular contratos: ' + erroContratos.message)
      setSalvando(false)
      return
    }

    if (abastAtivos.length > 0) {
      const { error: erroAbastecimentos } = await supabase
        .from('fechamento_abastecimentos')
        .insert(abastAtivos.map(a => ({ fechamento_id: fechamento.id, abastecimento_id: a.id })))

      if (erroAbastecimentos) {
        setErro('Fechamento criado, mas houve erro ao vincular abastecimentos: ' + erroAbastecimentos.message)
        setSalvando(false)
        return
      }
    }

    setSucesso(true)
    setSalvando(false)

    setTimeout(() => {
      setMotoristaId('')
      setCaminhao(null)
      setDataInicio('')
      setDataFim('')
      setKmInicial('')
      setKmFinal('')
      setBusca('')
      setResultados([])
      setSelecionados([])
      setAbastecimentos([])
      setAbastSelecionados(new Set())
      setSucesso(false)
    }, 2000)
  }

  const fmt = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const fmtInteiro = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 0 })
  const fmtData = (d: string) => (d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—')

  const podeSalvar =
    !!motoristaId &&
    !!dataInicio &&
    !!dataFim &&
    !!kmInicial &&
    !!kmFinal &&
    Number(kmFinal) > Number(kmInicial) &&
    selecionados.length > 0

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-gray-800">Fechamento de Viagem</h1>
        <p className="text-sm text-gray-500">
          Selecione o motorista, informe o período, escolha os contratos e confirme quais abastecimentos serão vinculados ao fechamento.
        </p>
      </div>

      {/* Barra fixa de resumo: agora fica sempre visível no topo, mesmo antes de informar KM. */}
      <div className="sticky top-0 z-30 -mx-6 px-6 py-3 bg-gray-100/95 backdrop-blur border-b border-gray-200">
        <div className="bg-gray-900 text-white rounded-xl p-4 grid grid-cols-2 md:grid-cols-5 gap-4 shadow-lg">
          <div>
            <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">KM rodado</p>
            <p className="text-lg md:text-xl font-bold text-white">
              {resumo.km > 0 ? `${fmtInteiro(resumo.km)} km` : '—'}
            </p>
          </div>

          <div>
            <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Total litros</p>
            <p className="text-lg md:text-xl font-bold text-blue-400">
              {resumo.litrosCombustivel > 0 ? `${fmt(resumo.litrosCombustivel)} L` : '—'}
            </p>
          </div>

          <div>
            <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Média litros</p>
            <p className="text-lg md:text-xl font-bold text-cyan-400">
              {resumo.mediaLitrosPorAbastecimento > 0 ? `${fmt(resumo.mediaLitrosPorAbastecimento)} L` : '—'}
            </p>
          </div>

          <div>
            <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Média km/L</p>
            <p className="text-lg md:text-xl font-bold text-green-400">
              {resumo.mediaKmPorLitro > 0 ? `${fmt(resumo.mediaKmPorLitro)} km/L` : '—'}
            </p>
          </div>

          <div>
            <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Abastecido</p>
            <p className="text-lg md:text-xl font-bold text-red-400">
              {resumo.valorTotalAbastecido > 0 ? `R$ ${fmt(resumo.valorTotalAbastecido)}` : '—'}
            </p>
          </div>
        </div>
      </div>

      {/* Motorista e placa */}
      <div className="bg-white rounded-xl shadow p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
            Motorista <span className="text-red-500">*</span>
          </label>
          <select
            value={motoristaId}
            onChange={e => {
              setMotoristaId(e.target.value)
              setSelecionados([])
              setAbastecimentos([])
              setAbastSelecionados(new Set())
            }}
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
            Placa automática
          </label>
          <div
            className={`w-full border rounded-lg px-3 py-2.5 text-sm font-semibold ${
              caminhao ? 'border-gray-300 bg-gray-50 text-gray-800' : 'border-gray-200 bg-gray-50 text-gray-400'
            }`}
          >
            {caminhao ? caminhao.placa : motoristaId ? 'Nenhum caminhão vinculado' : '—'}
          </div>
        </div>
      </div>

      {/* Período e hodômetro */}
      <div className="bg-white rounded-xl shadow p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
            Data saída <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={dataInicio}
            onChange={e => setDataInicio(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
            Data retorno <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={dataFim}
            onChange={e => setDataFim(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
            KM inicial <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            value={kmInicial}
            onChange={e => setKmInicial(e.target.value)}
            placeholder="Ex: 125000"
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
            KM final <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            value={kmFinal}
            onChange={e => setKmFinal(e.target.value)}
            placeholder="Ex: 127500"
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>

        <div className="col-span-2 md:col-span-4 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5">
          <span className="text-sm text-blue-700">
            KM percorrido:{' '}
            <strong>
              {resumo.km > 0 ? `${fmtInteiro(resumo.km)} km` : 'informe o KM inicial e final'}
            </strong>
          </span>
        </div>
      </div>

      {/* Contratos */}
      <div className="bg-white rounded-xl shadow p-5">
        <h2 className="text-base font-semibold text-gray-800 mb-3">
          Contratos vinculados
          <span className="text-sm font-normal text-gray-400 ml-2">({selecionados.length} selecionados)</span>
        </h2>

        <div className="relative mb-4">
          <input
            type="text"
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar contrato por número ou cliente..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          />

          {resultados.length > 0 && (
            <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
              {resultados.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => adicionarContrato(c)}
                  className="w-full flex items-start justify-between gap-4 px-4 py-3 text-sm hover:bg-red-50 transition text-left border-b last:border-0"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="font-semibold text-gray-800">#{c.contrato}</span>
                      {c.cliente && <span className="text-gray-500">· {c.cliente}</span>}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Origem: <span className="font-medium">{c.origem || '—'}</span>
                      <span className="mx-1">→</span>
                      Destino: <span className="font-medium">{c.destino || '—'}</span>
                    </p>
                  </div>

                  <span className="text-green-700 font-semibold shrink-0">
                    {Number(c.fat_bruto || 0) > 0 ? `R$ ${fmt(Number(c.fat_bruto))}` : '—'}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {selecionados.length === 0 ? (
          <p className="text-gray-400 text-sm">Nenhum contrato selecionado ainda.</p>
        ) : (
          <div className="space-y-2">
            {selecionados.map(c => (
              <div key={c.id} className="flex items-start gap-3 px-4 py-3 rounded-lg border border-red-200 bg-red-50">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-gray-800">#{c.contrato}</span>
                    {c.cliente && <span className="text-gray-500 text-sm">· {c.cliente}</span>}
                    {Number(c.fat_bruto || 0) > 0 && (
                      <span className="text-green-700 font-semibold text-sm md:ml-auto">R$ {fmt(Number(c.fat_bruto))}</span>
                    )}
                  </div>

                  <p className="text-xs text-gray-600 mt-1">
                    De <span className="font-semibold">{c.origem || '—'}</span>
                    <span className="mx-1">para</span>
                    <span className="font-semibold">{c.destino || '—'}</span>
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => removerContrato(c.id)}
                  className="text-red-400 hover:text-red-600 shrink-0 mt-0.5"
                  aria-label="Remover contrato"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Abastecimentos */}
      <div className="bg-white rounded-xl shadow p-5">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2 mb-4">
          <div>
            <h2 className="text-base font-semibold text-gray-800">Abastecimentos vinculados</h2>
            <p className="text-xs text-gray-400 mt-1">
              Os abastecimentos vêm automaticamente pelo caminhão e pelo período informado. Você pode marcar ou desmarcar quais serão vinculados.
            </p>
          </div>

          <div className="flex gap-3 text-xs shrink-0">
            <button type="button" onClick={selecionarTodosAbastecimentos} className="text-red-600 hover:underline">
              Selecionar todos
            </button>
            <span className="text-gray-300">|</span>
            <button type="button" onClick={limparAbastecimentos} className="text-red-600 hover:underline">
              Limpar seleção
            </button>
          </div>
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 mb-4 grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Caminhão</p>
            <p className="font-semibold text-gray-700">{caminhao?.placa || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Período</p>
            <p className="font-semibold text-gray-700">{fmtData(dataInicio)} até {fmtData(dataFim)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Selecionados</p>
            <p className="font-semibold text-gray-700">{abastSelecionados.size}/{abastecimentos.length}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Litros selecionados</p>
            <p className="font-semibold text-gray-700">{resumo.litrosCombustivel > 0 ? `${fmt(resumo.litrosCombustivel)} L` : '—'}</p>
          </div>
        </div>

        {!caminhao || !dataInicio || !dataFim ? (
          <p className="text-gray-400 text-sm">
            Selecione o motorista e informe data saída e data retorno para carregar os abastecimentos do período.
          </p>
        ) : carregandoAbastecimentos ? (
          <p className="text-gray-400 text-sm">Carregando abastecimentos do período...</p>
        ) : abastecimentos.length === 0 ? (
          <p className="text-gray-400 text-sm">Nenhum abastecimento encontrado no período selecionado.</p>
        ) : (
          <div className="space-y-2">
            {abastecimentos.map(a => {
              const litrosCombustivel = Number(a.litros_combustivel || 0)
              const litrosArla = Number(a.litros_arla || 0)
              const valor = Number(a.valor_combustivel || 0) + Number(a.valor_arla || 0)
              const marcado = abastSelecionados.has(a.id)

              return (
                <label
                  key={a.id}
                  className={`flex flex-col md:flex-row md:items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-colors select-none ${
                    marcado ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-gray-50 opacity-70'
                  }`}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <input
                      type="checkbox"
                      checked={marcado}
                      onChange={() => toggleAbastecimento(a.id)}
                      className="w-4 h-4 accent-red-600 shrink-0"
                    />

                    <div className="min-w-0">
                      <span className="text-sm font-medium text-gray-700">{fmtData(a.data)}</span>
                      {a.posto && <span className="text-gray-500 text-sm ml-2">· {a.posto}</span>}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-xs text-gray-600 md:text-right shrink-0 pl-7 md:pl-0">
                    <span>{litrosCombustivel > 0 ? `${fmt(litrosCombustivel)} L diesel` : '— diesel'}</span>
                    <span>{litrosArla > 0 ? `${fmt(litrosArla)} L Arla` : '— Arla'}</span>
                    <span className="font-semibold text-red-600">{valor > 0 ? `R$ ${fmt(valor)}` : '—'}</span>
                  </div>
                </label>
              )
            })}
          </div>
        )}
      </div>

      {erro && (
        <div className="text-red-700 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {erro}
        </div>
      )}

      {sucesso && (
        <div className="text-green-700 text-sm bg-green-50 border border-green-200 rounded-lg px-4 py-3">
          Fechamento salvo com sucesso.
        </div>
      )}

      <div className="flex justify-end pb-8">
        <button
          type="button"
          onClick={salvar}
          disabled={!podeSalvar || salvando}
          className="bg-red-600 text-white px-8 py-3 rounded-xl font-semibold text-sm hover:bg-red-700 disabled:opacity-50 transition-colors"
        >
          {salvando ? 'Salvando...' : 'Salvar fechamento'}
        </button>
      </div>
    </div>
  )
}
