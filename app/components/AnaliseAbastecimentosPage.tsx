'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Download, Filter, RefreshCw, TrendingUp } from 'lucide-react'
import * as XLSX from 'xlsx'
import { normalizarPlaca, chavePlaca } from '../services/placas'
import { supabaseRestFetch } from '../services/rest'
import {
  calcularAnalises,
  calcularResumo,
  calcularTendenciaPostos,
  compararPor,
  compararPrecoRegional,
  estimarEconomiaPorRegiao,
  type AnaliseAbastecimento,
  type AbastecimentoAnaliseInput,
} from '../services/abastecimentoAnalise'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const IC = 'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-gray-50'

type Abastecimento = AbastecimentoAnaliseInput & {
  id: string
  data: string
  caminhao_placa: string
  motorista: string
  posto: string
  cidade: string
  estado: string
  tipo_combustivel: string
  litros_combustivel: number
  valor_litro_combustivel: number
  km: number
  total: number
  tanque_cheio: boolean
  obs: string
}

async function supaFetchTodos(path: string) {
  const registros: any[] = []
  const tamanhoPagina = 1000
  let pagina = 0
  const separador = path.includes('?') ? '&' : '?'

  while (true) {
    const inicio = pagina * tamanhoPagina
    const res = await supabaseRestFetch(`${SUPABASE_URL}/rest/v1/${path}${separador}limit=${tamanhoPagina}&offset=${inicio}`)
    if (!res.ok) throw new Error(await res.text())
    const lote = await res.json()
    if (!Array.isArray(lote)) break
    registros.push(...lote)
    if (lote.length < tamanhoPagina) break
    pagina += 1
  }

  return registros
}

function moeda(valor: number | null | undefined) {
  return valor == null ? '—' : `R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 3 })}`
}

function numero(valor: number | null | undefined, casas = 2) {
  return valor == null ? '—' : valor.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })
}

function formatarData(data: string) {
  if (!data) return '—'
  const [ano, mes, dia] = data.split('-')
  return `${dia}/${mes}/${ano}`
}

export default function AnaliseAbastecimentosPage() {
  const [registros, setRegistros] = useState<Abastecimento[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [filtroInicio, setFiltroInicio] = useState('')
  const [filtroFim, setFiltroFim] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroCidade, setFiltroCidade] = useState('')
  const [filtroPosto, setFiltroPosto] = useState('')
  const [filtroPlaca, setFiltroPlaca] = useState('')
  const [filtroMotorista, setFiltroMotorista] = useState('')
  const [filtroCombustivel, setFiltroCombustivel] = useState('')

  async function carregar() {
    setCarregando(true)
    setErro('')
    try {
      const data = await supaFetchTodos('abastecimentos?order=data.asc,id.asc')
      setRegistros(data.map((registro: any) => ({
        ...registro,
        caminhao_placa: normalizarPlaca(registro.caminhao_placa || ''),
        motorista: registro.motorista || '',
        posto: registro.posto || '',
        cidade: registro.cidade || '',
        estado: registro.estado || '',
        tipo_combustivel: String(registro.tipo_combustivel || '').toUpperCase(),
        tanque_cheio: registro.tanque_cheio === true,
      })))
    } catch (e: any) {
      setErro(e?.message || 'Não foi possível carregar os abastecimentos.')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => { carregar() }, [])

  const opcoes = useMemo(() => ({
    estados: [...new Set(registros.map(item => item.estado).filter(Boolean))].sort(),
    cidades: [...new Set(registros.map(item => item.cidade).filter(Boolean))].sort(),
    postos: [...new Set(registros.map(item => item.posto).filter(Boolean))].sort(),
    placas: [...new Set(registros.map(item => normalizarPlaca(item.caminhao_placa)).filter(Boolean))].sort(),
    motoristas: [...new Set(registros.map(item => item.motorista).filter(Boolean))].sort(),
    combustiveis: [...new Set(registros.map(item => item.tipo_combustivel).filter(Boolean))].sort(),
  }), [registros])

  const filtrados = useMemo(() => registros.filter(item => {
    if (filtroInicio && item.data < filtroInicio) return false
    if (filtroFim && item.data > filtroFim) return false
    if (filtroEstado && item.estado !== filtroEstado) return false
    if (filtroCidade && item.cidade !== filtroCidade) return false
    if (filtroPosto && item.posto !== filtroPosto) return false
    if (filtroPlaca && chavePlaca(item.caminhao_placa) !== chavePlaca(filtroPlaca)) return false
    if (filtroMotorista && item.motorista !== filtroMotorista) return false
    if (filtroCombustivel && item.tipo_combustivel !== filtroCombustivel) return false
    return true
  }).sort((a, b) => a.data.localeCompare(b.data) || Number(a.km || 0) - Number(b.km || 0)), [
    registros, filtroInicio, filtroFim, filtroEstado, filtroCidade, filtroPosto, filtroPlaca, filtroMotorista, filtroCombustivel,
  ])

  const analises = useMemo(() => calcularAnalises(registros), [registros])
  const resumo = useMemo(() => calcularResumo(filtrados, analises, registros), [filtrados, analises, registros])
  const comparativos = useMemo(() => [
    ['Por UF / região', compararPor(filtrados, item => item.estado || '')],
    ['Por posto', compararPor(filtrados, item => item.posto || '')],
    ['Por placa', compararPor(filtrados, item => normalizarPlaca(item.caminhao_placa || ''))],
    ['Por motorista', compararPor(filtrados, item => item.motorista || '')],
  ] as const, [filtrados])
  const tendencias = useMemo(() => calcularTendenciaPostos(filtrados), [filtrados])
  const economias = useMemo(() => estimarEconomiaPorRegiao(filtrados), [filtrados])
  const acimaDaMedia = useMemo(() => filtrados.filter(item => compararPrecoRegional(registros, item).acimaDaMedia).length, [filtrados, registros])
  const alertas = useMemo(() => filtrados.filter(item => (analises.get(item.id)?.alertas.length || 0) > 0), [filtrados, analises])

  function limparFiltros() {
    setFiltroInicio(''); setFiltroFim(''); setFiltroEstado(''); setFiltroCidade('')
    setFiltroPosto(''); setFiltroPlaca(''); setFiltroMotorista(''); setFiltroCombustivel('')
  }

  function exportarExcel() {
    if (!filtrados.length) return
    const dados = filtrados.map(item => {
      const analise = analises.get(item.id)
      const regional = compararPrecoRegional(registros, item)
      return {
        Data: item.data ? new Date(`${item.data}T00:00:00`) : null,
        Placa: normalizarPlaca(item.caminhao_placa),
        Motorista: item.motorista || '',
        Combustível: item.tipo_combustivel || '',
        Posto: item.posto || '',
        Cidade: item.cidade || '',
        UF: item.estado || '',
        'Tanque cheio': item.tanque_cheio ? 'SIM' : 'NÃO',
        Litros: Number(item.litros_combustivel || 0),
        'Preço por litro': Number(item.valor_litro_combustivel || 0),
        KM: Number(item.km || 0),
        'KM rodados': Number(analise?.kmRodado || 0),
        'Média km/L': Number(analise?.consumoKmPorLitro || 0),
        Total: Number(item.total || 0),
        'Preço acima da média local': regional.acimaDaMedia ? 'SIM' : 'NÃO',
        Alertas: analise?.alertas.map(alerta => alerta.mensagem).join(' | ') || '',
        Observações: item.obs || '',
      }
    })
    const sheet = XLSX.utils.json_to_sheet(dados)
    sheet['!cols'] = [12, 12, 28, 14, 30, 20, 8, 14, 12, 18, 14, 14, 14, 16, 24, 60, 42].map(wch => ({ wch }))
    sheet['!autofilter'] = { ref: `A1:Q${dados.length + 1}` }
    const book = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(book, sheet, 'Análise Abastecimentos')
    XLSX.writeFile(book, `analise_abastecimentos_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  const cards = [
    ['Gasto total', moeda(resumo.total), 'text-red-600'],
    ['Litros', `${numero(resumo.litros)} L`, 'text-gray-900'],
    ['Preço médio', moeda(resumo.precoMedio), 'text-gray-900'],
    ['Menor / maior preço', `${moeda(resumo.menorPreco)} · ${moeda(resumo.maiorPreco)}`, 'text-gray-900'],
    ['KM rodados', numero(resumo.kmRodados, 0), 'text-gray-900'],
    ['Custo por KM', moeda(resumo.custoPorKm), 'text-red-600'],
    ['Com alertas', String(alertas.length), alertas.length ? 'text-amber-600' : 'text-green-600'],
    ['Acima da média local', String(acimaDaMedia), acimaDaMedia ? 'text-amber-600' : 'text-green-600'],
  ]

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Análise de Abastecimentos</h1>
          <p className="text-sm text-gray-500 mt-1">Preços, consumo, alertas e oportunidades de economia da frota</p>
        </div>
        <div className="flex gap-2">
          <button onClick={carregar} className="flex items-center gap-2 border border-gray-200 bg-white text-gray-700 px-4 py-2 rounded-xl text-sm font-bold hover:bg-gray-50"><RefreshCw size={16}/> Atualizar</button>
          <button onClick={exportarExcel} disabled={!filtrados.length} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-emerald-700 disabled:opacity-50"><Download size={16}/> Excel analítico</button>
        </div>
      </div>

      {erro && <div className="mb-4 p-3 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm">{erro}</div>}
      {carregando ? <div className="bg-white rounded-2xl p-10 text-center text-gray-500">Carregando análise...</div> : (
        <>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div><label className="text-xs font-bold text-gray-500 uppercase mb-1 block"><Filter size={11} className="inline mr-1"/>Período inicial</label><input type="date" value={filtroInicio} onChange={e => setFiltroInicio(e.target.value)} className={IC}/></div>
            <div><label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Período final</label><input type="date" value={filtroFim} onChange={e => setFiltroFim(e.target.value)} className={IC}/></div>
            <div><label className="text-xs font-bold text-gray-500 uppercase mb-1 block">UF / região</label><select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)} className={IC}><option value="">Todos</option>{opcoes.estados.map(item => <option key={item} value={item}>{item}</option>)}</select></div>
            <div><label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Cidade</label><select value={filtroCidade} onChange={e => setFiltroCidade(e.target.value)} className={IC}><option value="">Todas</option>{opcoes.cidades.map(item => <option key={item} value={item}>{item}</option>)}</select></div>
            <div><label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Posto</label><select value={filtroPosto} onChange={e => setFiltroPosto(e.target.value)} className={IC}><option value="">Todos</option>{opcoes.postos.map(item => <option key={item} value={item}>{item}</option>)}</select></div>
            <div><label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Placa</label><select value={filtroPlaca} onChange={e => setFiltroPlaca(e.target.value)} className={IC}><option value="">Todas</option>{opcoes.placas.map(item => <option key={item} value={item}>{item}</option>)}</select></div>
            <div><label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Motorista</label><select value={filtroMotorista} onChange={e => setFiltroMotorista(e.target.value)} className={IC}><option value="">Todos</option>{opcoes.motoristas.map(item => <option key={item} value={item}>{item}</option>)}</select></div>
            <div><label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Combustível</label><select value={filtroCombustivel} onChange={e => setFiltroCombustivel(e.target.value)} className={IC}><option value="">Todos</option>{opcoes.combustiveis.map(item => <option key={item} value={item}>{item}</option>)}</select></div>
            <div className="lg:col-span-4 flex justify-between items-center"><span className="text-xs text-gray-400">{filtrados.length} de {registros.length} registros analisados</span><button onClick={limparFiltros} className="text-xs text-red-600 font-bold hover:underline">Limpar filtros</button></div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            {cards.map(([titulo, valor, cor]) => <div key={titulo} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4"><p className="text-[10px] font-black uppercase tracking-wide text-gray-400">{titulo}</p><p className={`mt-2 text-lg font-black ${cor}`}>{valor}</p></div>)}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
            {comparativos.map(([titulo, dados]) => <div key={titulo} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"><div className="px-4 py-3 bg-gray-50 text-xs font-black uppercase text-gray-500">{titulo}</div><div className="max-h-64 overflow-auto">{dados.slice(0, 15).map(item => <div key={item.grupo} className="flex items-center justify-between gap-3 px-4 py-2 border-t border-gray-100 text-xs"><span className="truncate font-semibold text-gray-700">{item.grupo}</span><span className="text-right whitespace-nowrap"><b>{moeda(item.precoMedio)}</b><br/><span className="text-gray-400">{moeda(item.total)} · {item.registros} lanç.</span></span></div>)}{!dados.length && <p className="p-4 text-xs text-gray-400">Sem dados para os filtros atuais.</p>}</div></div>)}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
            <div className="bg-white rounded-2xl border border-amber-100 shadow-sm overflow-hidden"><div className="px-4 py-3 bg-amber-50 text-xs font-black uppercase text-amber-700"><TrendingUp size={14} className="inline mr-1"/>Postos com aumento de preço</div>{tendencias.slice(0, 12).map(item => <div key={`${item.posto}-${item.cidade}-${item.tipoCombustivel}`} className="px-4 py-2 border-t border-amber-100 text-xs flex justify-between gap-3"><span className="truncate">{item.posto} · {item.cidade}/{item.estado}</span><b className="text-amber-700 whitespace-nowrap">+{numero(item.variacaoPercentual)}%</b></div>)}{!tendencias.length && <p className="p-4 text-xs text-gray-400">Ainda não há duas leituras do mesmo posto para comparar.</p>}</div>
            <div className="bg-white rounded-2xl border border-green-100 shadow-sm overflow-hidden"><div className="px-4 py-3 bg-green-50 text-xs font-black uppercase text-green-700">Estimativa de economia por UF e combustível</div>{economias.slice(0, 12).map(item => <div key={`${item.regiao}-${item.tipoCombustivel}`} className="px-4 py-2 border-t border-green-100 text-xs flex justify-between gap-3"><span>{item.regiao} · {item.tipoCombustivel} <span className="text-gray-400">(ref. {moeda(item.precoCompetitivo)})</span></span><b className="text-green-700 whitespace-nowrap">{moeda(item.economiaPotencial)}</b></div>)}{!economias.length && <p className="p-4 text-xs text-gray-400">Informe UF, combustível e preço para estimar economia.</p>}</div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 flex items-center justify-between"><h2 className="text-sm font-black text-gray-800"><AlertTriangle size={16} className="inline mr-1 text-amber-500"/>Lançamentos que precisam de conferência</h2><span className="text-xs text-gray-400">{alertas.length} encontrados</span></div>
            {alertas.slice(0, 100).map(item => { const analise: AnaliseAbastecimento | undefined = analises.get(item.id); return <div key={item.id} className="px-4 py-3 border-t border-gray-100 text-xs grid grid-cols-1 md:grid-cols-[120px_120px_1fr] gap-2"><span className="font-semibold">{formatarData(item.data)} · {normalizarPlaca(item.caminhao_placa)}</span><span className="text-gray-500">{item.motorista || 'Sem motorista'}</span><span className="text-amber-700">{analise?.alertas.map(alerta => alerta.mensagem).join(' • ')}</span></div> })}
            {!alertas.length && <p className="p-5 text-sm text-green-700">Nenhum alerta nos filtros atuais.</p>}
          </div>
        </>
      )}
    </div>
  )
}
