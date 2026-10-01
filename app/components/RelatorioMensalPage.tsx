'use client'

import { useEffect, useMemo, useState } from 'react'
import { Download, FileText, Loader2, Printer, RefreshCw } from 'lucide-react'
import { supabase } from '../services/supabase'
import { normalizarPlaca } from '../services/placas'

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const EMPRESA = 'CARLOS ROESEL TRANSPORTES LTDA'
const ENDERECO = 'R. RAIMUNDO MARÇAL DE MELO, 71 LOJA 01 - PAULO CAMILO'
const CONTATO = 'CEP: 32667-565, BETIM - MG · Fone/E-mail: croeseltransportes@gmail.com'

interface Motorista { id: string; nome: string }
interface Caminhao { id: string; placa: string; frota?: string | null }
interface Fechamento {
  id: string
  motorista_id: string
  caminhao_id: string
  data_inicio: string
  data_fim: string
  km_inicial: number
  km_final: number
  total_frete?: number | null
  comissao_motorista?: number | null
}
interface Contrato {
  id: string
  contrato: string
  origem?: string | null
  destino?: string | null
  fat_bruto?: number | null
  qtd_veiculos?: number | null
}
interface Viagem {
  id: string
  created_at: string
  motorista?: string | null
  caminhao_id?: string | null
  caminhao_placa?: string | null
  origem?: string | null
  destino?: string | null
  valor_contrato?: number | null
  valor_chapa?: number | null
}
interface Abastecimento {
  id: string
  data: string
  posto?: string | null
  cidade?: string | null
  estado?: string | null
  motorista?: string | null
  caminhao_placa?: string | null
  litros_combustivel?: number | null
  total?: number | null
  km?: number | null
  nota_fiscal_id?: string | null
  obs?: string | null
}
interface ViagemRelatorio {
  data: string
  docs: string
  origem: string
  destino: string
  produto: string
  peso: string
  km: number | null
  frete: number
}
interface DespesaRelatorio {
  data: string
  despesa: string
  fornecedor: string
  documento: string
  valor: number
}
interface Relatorio {
  motorista: string
  placas: string[]
  frotas: string[]
  documentos: string[]
  viagens: ViagemRelatorio[]
  despesas: DespesaRelatorio[]
  abastecimentos: Abastecimento[]
  frete: number
  comissao: number
  totalDespesas: number
  totalAbastecimentos: number
  totalLitros: number
  kmAbastecimentos: number
  mediaConsumo: number | null
}

function dataLocalISO(ano: number, mes: number, dia: number) {
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

function fmtData(data?: string | null) {
  if (!data) return '—'
  const parte = data.slice(0, 10)
  const [ano, mes, dia] = parte.split('-')
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : '—'
}

function fmtMoeda(valor: number | null | undefined) {
  return (valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtNumero(valor: number | null | undefined, casas = 2) {
  return (valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })
}

function valorSeguro(valor: number | null | undefined) {
  return Number(valor || 0)
}

export default function RelatorioMensalPage() {
  const hoje = new Date()
  const [motoristas, setMotoristas] = useState<Motorista[]>([])
  const [motoristaId, setMotoristaId] = useState('')
  const [mes, setMes] = useState(hoje.getMonth() + 1)
  const [ano, setAno] = useState(hoje.getFullYear())
  const [relatorio, setRelatorio] = useState<Relatorio | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    supabase.from('motoristas').select('id, nome').order('nome').then(({ data, error }) => {
      if (error) setErro('Não foi possível carregar os motoristas.')
      setMotoristas(data || [])
    })
  }, [])

  const motoristaSelecionado = useMemo(() => motoristas.find(item => item.id === motoristaId), [motoristas, motoristaId])

  async function gerarRelatorio() {
    setCarregando(true)
    setErro('')
    setRelatorio(null)

    const inicio = dataLocalISO(ano, mes, 1)
    const fim = dataLocalISO(ano, mes, new Date(ano, mes, 0).getDate())
    const inicioDataHora = `${inicio}T00:00:00`
    const fimDataHora = `${dataLocalISO(mes === 12 ? ano + 1 : ano, mes === 12 ? 1 : mes + 1, 1)}T00:00:00`

    try {
      const [{ data: fechamentos, error: erroFechamentos }, { data: viagens, error: erroViagens }, { data: caminhoes, error: erroCaminhoes }] = await Promise.all([
        supabase.from('fechamento_viagens').select('id, motorista_id, caminhao_id, data_inicio, data_fim, km_inicial, km_final, total_frete, comissao_motorista').lte('data_inicio', fim).gte('data_fim', inicio),
        supabase.from('viagens').select('id, created_at, motorista, caminhao_id, caminhao_placa, origem, destino, valor_contrato, valor_chapa').gte('created_at', inicioDataHora).lt('created_at', fimDataHora),
        supabase.from('caminhoes').select('id, placa, frota').order('placa'),
      ])
      if (erroFechamentos) throw erroFechamentos
      if (erroViagens) throw erroViagens
      if (erroCaminhoes) throw erroCaminhoes

      const fechamentosBase = (fechamentos || []) as Fechamento[]
      const nomesMotoristas = new Map(motoristas.map(item => [item.id, item.nome]))
      const fechamentosFiltrados = motoristaId ? fechamentosBase.filter(item => item.motorista_id === motoristaId) : fechamentosBase
      const nomeFiltro = motoristaSelecionado?.nome || ''
      const viagensFiltradas = ((viagens || []) as Viagem[]).filter(item => !nomeFiltro || item.motorista === nomeFiltro)
      const idsFechamentos = fechamentosFiltrados.map(item => item.id)
      const idsCaminhoes = [...new Set([...fechamentosFiltrados.map(item => item.caminhao_id), ...viagensFiltradas.map(item => item.caminhao_id).filter(Boolean) as string[]])]
      const caminhaoPorId = new Map(((caminhoes || []) as Caminhao[]).map(item => [item.id, item]))

      const [{ data: relFechContratos, error: erroRelContratos }, { data: relFechAbastecimentos, error: erroRelAbast }] = idsFechamentos.length > 0
        ? await Promise.all([
            supabase.from('fechamento_contratos').select('fechamento_id, contrato_id').in('fechamento_id', idsFechamentos),
            supabase.from('fechamento_abastecimentos').select('fechamento_id, abastecimento_id').in('fechamento_id', idsFechamentos),
          ])
        : [{ data: [], error: null }, { data: [], error: null }]
      if (erroRelContratos) throw erroRelContratos
      if (erroRelAbast) throw erroRelAbast

      const idsContratos = [...new Set((relFechContratos || []).map((item: any) => item.contrato_id).filter(Boolean))]
      const idsAbastecimentos = [...new Set((relFechAbastecimentos || []).map((item: any) => item.abastecimento_id).filter(Boolean))]
      const [{ data: contratos, error: erroContratos }, { data: abastecimentosFechamento, error: erroAbastecimentos }] = await Promise.all([
        idsContratos.length ? supabase.from('contratos').select('id, contrato, origem, destino, fat_bruto, qtd_veiculos').in('id', idsContratos) : Promise.resolve({ data: [], error: null } as any),
        idsAbastecimentos.length ? supabase.from('abastecimentos').select('id, data, posto, cidade, estado, motorista, caminhao_placa, litros_combustivel, total, km, nota_fiscal_id, obs').in('id', idsAbastecimentos).order('data') : Promise.resolve({ data: [], error: null } as any),
      ])
      if (erroContratos) throw erroContratos
      if (erroAbastecimentos) throw erroAbastecimentos

      const contratoPorId = new Map(((contratos || []) as Contrato[]).map(item => [item.id, item]))
      const contratosPorFechamento = new Map<string, Contrato[]>()
      ;(relFechContratos || []).forEach((rel: any) => {
        const contrato = contratoPorId.get(rel.contrato_id)
        if (!contrato) return
        contratosPorFechamento.set(rel.fechamento_id, [...(contratosPorFechamento.get(rel.fechamento_id) || []), contrato])
      })

      const viagensRelatorio: ViagemRelatorio[] = []
      const documentos = new Set<string>()
      fechamentosFiltrados.forEach(fechamento => {
        const contratosDoFechamento = contratosPorFechamento.get(fechamento.id) || []
        const km = valorSeguro(fechamento.km_final) - valorSeguro(fechamento.km_inicial)
        if (!contratosDoFechamento.length) {
          viagensRelatorio.push({ data: fechamento.data_fim, docs: '—', origem: '—', destino: '—', produto: '—', peso: '—', km, frete: valorSeguro(fechamento.total_frete) })
          return
        }
        contratosDoFechamento.forEach((contrato, indice) => {
          const documento = contrato.contrato || '—'
          if (contrato.contrato) documentos.add(contrato.contrato)
          viagensRelatorio.push({
            data: fechamento.data_fim,
            docs: documento,
            origem: contrato.origem || '—',
            destino: contrato.destino || '—',
            produto: contrato.qtd_veiculos ? `${contrato.qtd_veiculos} VEÍCULOS` : '—',
            peso: '—',
            km: indice === 0 ? km : null,
            frete: valorSeguro(contrato.fat_bruto),
          })
        })
      })

      // Viagens ainda não fechadas também aparecem no relatório, sem duplicar as que já estão representadas por um fechamento.
      const idsViagensRelacionadas = new Set<string>()
      const contratosUsados = new Set(documentos)
      viagensFiltradas.forEach(viagem => {
        if (!viagem.id || idsViagensRelacionadas.has(viagem.id)) return
        const valor = valorSeguro(viagem.valor_contrato)
        if (!valor && !viagem.origem && !viagem.destino) return
        viagensRelatorio.push({ data: viagem.created_at.slice(0, 10), docs: '—', origem: viagem.origem || '—', destino: viagem.destino || '—', produto: '—', peso: '—', km: null, frete: valor })
        idsViagensRelacionadas.add(viagem.id)
      })

      viagensRelatorio.sort((a, b) => a.data.localeCompare(b.data))
      const abastecimentos = ((abastecimentosFechamento || []) as Abastecimento[]).sort((a, b) => a.data.localeCompare(b.data))
      const frete = viagensRelatorio.reduce((soma, item) => soma + item.frete, 0)
      const comissao = fechamentosFiltrados.reduce((soma, item) => soma + (item.comissao_motorista != null ? valorSeguro(item.comissao_motorista) : valorSeguro(item.total_frete) * 0.10), 0) || frete * 0.10
      const despesasChapa: DespesaRelatorio[] = viagensFiltradas.filter(item => valorSeguro(item.valor_chapa) > 0).map(item => ({ data: item.created_at.slice(0, 10), despesa: 'CHAPA', fornecedor: nomeFiltro || item.motorista || '—', documento: '—', valor: valorSeguro(item.valor_chapa) }))
      const despesas: DespesaRelatorio[] = [...despesasChapa, { data: fim, despesa: 'COMISSÕES DOS MOTORISTAS', fornecedor: nomeFiltro || 'Motoristas', documento: '—', valor: comissao }]
      const totalDespesas = despesas.reduce((soma, item) => soma + item.valor, 0)
      const totalAbastecimentos = abastecimentos.reduce((soma, item) => soma + valorSeguro(item.total), 0)
      const totalLitros = abastecimentos.reduce((soma, item) => soma + valorSeguro(item.litros_combustivel), 0)
      const kmsAbastecimentos = abastecimentos.filter(item => valorSeguro(item.km) > 0).length > 1
        ? Math.max(...abastecimentos.map(item => valorSeguro(item.km))) - Math.min(...abastecimentos.map(item => valorSeguro(item.km)))
        : fechamentosFiltrados.reduce((soma, item) => soma + Math.max(0, valorSeguro(item.km_final) - valorSeguro(item.km_inicial)), 0)
      const nomes = motoristaId ? [nomeFiltro] : [...new Set(fechamentosFiltrados.map(item => nomesMotoristas.get(item.motorista_id)).filter(Boolean) as string[])]
      const placas = [...new Set([...fechamentosFiltrados.map(item => caminhaoPorId.get(item.caminhao_id)?.placa), ...viagensFiltradas.map(item => item.caminhao_placa)].filter(Boolean).map(item => normalizarPlaca(String(item))))]
      const frotas = [...new Set(fechamentosFiltrados.map(item => caminhaoPorId.get(item.caminhao_id)?.frota).filter(Boolean).map(String))]

      setRelatorio({
        motorista: nomes.length === 1 ? nomes[0] : 'Todos os motoristas',
        placas,
        frotas,
        documentos: [...documentos, ...[...contratosUsados].filter(Boolean)].filter((item, index, lista) => lista.indexOf(item) === index),
        viagens: viagensRelatorio,
        despesas,
        abastecimentos,
        frete,
        comissao,
        totalDespesas,
        totalAbastecimentos,
        totalLitros,
        kmAbastecimentos: kmsAbastecimentos,
        mediaConsumo: totalLitros > 0 && kmsAbastecimentos > 0 ? kmsAbastecimentos / totalLitros : null,
      })
    } catch (e: any) {
      setErro(e?.message || 'Não foi possível montar o relatório mensal.')
    } finally {
      setCarregando(false)
    }
  }

  function imprimir() {
    if (relatorio) window.print()
  }

  return (
    <div className="relatorio-mensal-page min-h-screen bg-gray-50 p-6">
      <style jsx global>{`
        @media print {
          aside, .relatorio-controles, .relatorio-acoes { display: none !important; }
          main { margin-left: 0 !important; }
          .relatorio-mensal-page { padding: 0 !important; background: white !important; }
          .relatorio-folha { box-shadow: none !important; border: 0 !important; max-width: none !important; }
          body { background: white !important; }
        }
      `}</style>

      <div className="relatorio-controles max-w-6xl mx-auto mb-5">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <h1 className="text-2xl font-black text-gray-900">Relatório Mensal de Viagens</h1>
            <p className="text-sm text-gray-500 mt-1">Modelo mensal com viagens, despesas, abastecimentos e resultado final.</p>
          </div>
          <div className="relatorio-acoes flex gap-2">
            <button onClick={gerarRelatorio} disabled={carregando} className="flex items-center gap-2 rounded-xl bg-red-700 px-4 py-2 text-sm font-bold text-white hover:bg-red-800 disabled:opacity-50"><RefreshCw size={16}/> Gerar relatório</button>
            <button onClick={imprimir} disabled={!relatorio} className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50"><Printer size={16}/> Imprimir / PDF</button>
          </div>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-3">
          <div><label className="text-xs font-bold uppercase text-gray-500">Mês</label><select value={mes} onChange={e => setMes(Number(e.target.value))} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm">{MESES.map((nome, indice) => <option key={nome} value={indice + 1}>{nome}</option>)}</select></div>
          <div><label className="text-xs font-bold uppercase text-gray-500">Ano</label><select value={ano} onChange={e => setAno(Number(e.target.value))} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm">{[ano - 1, ano, ano + 1].map(item => <option key={item} value={item}>{item}</option>)}</select></div>
          <div><label className="text-xs font-bold uppercase text-gray-500">Motorista</label><select value={motoristaId} onChange={e => setMotoristaId(e.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"><option value="">Todos os motoristas</option>{motoristas.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></div>
        </div>
        {erro && <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{erro}</div>}
        {carregando && <div className="mt-3 flex items-center gap-2 text-sm text-gray-500"><Loader2 size={16} className="animate-spin"/> Montando relatório com os dados do período...</div>}
      </div>

      {!relatorio && !carregando && <div className="relatorio-controles mx-auto max-w-6xl rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500"><FileText size={34} className="mx-auto mb-3 text-gray-300"/>Escolha o mês, o ano e, se desejar, o motorista. Depois clique em <b>Gerar relatório</b>.</div>}

      {relatorio && <div className="relatorio-folha mx-auto max-w-6xl rounded-sm border border-gray-300 bg-white p-7 text-[10px] text-gray-800 shadow-sm">
        <div className="border-b-2 border-gray-800 pb-3 text-center">
          <h2 className="text-base font-black">{EMPRESA}</h2>
          <p>{ENDERECO}</p>
          <p>{CONTATO}</p>
        </div>

        <div className="mt-4 border-b border-gray-500 pb-3">
          <h3 className="text-sm font-black">Resultado mensal das viagens</h3>
          <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1">
            <p><b>Motorista:</b> {relatorio.motorista}</p>
            <p><b>Período:</b> {MESES[mes - 1].toUpperCase()}/{ano}</p>
            <p><b>Placas:</b> {relatorio.placas.length ? relatorio.placas.join(' · ') : '—'}</p>
            <p><b>Frota:</b> {relatorio.frotas.length ? relatorio.frotas.join(' · ') : '—'}</p>
            <p className="md:col-span-2"><b>DOCs:</b> {relatorio.documentos.length ? relatorio.documentos.join(' · ') : '—'}</p>
            <p className="md:col-span-2"><b>Descrição:</b> {relatorio.motorista} · {relatorio.placas.join(' / ') || 'sem placa'} · {String(mes).padStart(2, '0')}/{ano}</p>
            <p><b>Comissão:</b> {fmtMoeda(relatorio.comissao)}</p>
          </div>
        </div>

        <RelatorioTabela titulo="Viagens" headers={['Data', 'Docs', 'Origem', 'Destino', 'Produto transportado', 'Peso', 'Km', 'Frete']}>
          {relatorio.viagens.map((item, indice) => <tr key={`${item.data}-${item.docs}-${indice}`} className="border-t border-gray-400"><td>{fmtData(item.data)}</td><td>{item.docs}</td><td>{item.origem}</td><td>{item.destino}</td><td>{item.produto}</td><td className="text-right">{item.peso}</td><td className="text-right">{item.km == null ? '—' : fmtNumero(item.km, 0)}</td><td className="text-right">{fmtMoeda(item.frete)}</td></tr>)}
          <tr className="border-t-2 border-gray-800 font-black"><td colSpan={6}>Total</td><td className="text-right">{fmtNumero(relatorio.viagens.reduce((soma, item) => soma + (item.km || 0), 0), 0)}</td><td className="text-right">{fmtMoeda(relatorio.frete)}</td></tr>
        </RelatorioTabela>

        <RelatorioTabela titulo="Despesas" headers={['Data', 'Despesa', 'Fornecedor', 'Doc/Número', 'Valor', '% s/Receita']}>
          {relatorio.despesas.map((item, indice) => <tr key={`${item.data}-${item.despesa}-${indice}`} className="border-t border-gray-400"><td>{fmtData(item.data)}</td><td>{item.despesa}</td><td>{item.fornecedor}</td><td>{item.documento}</td><td className="text-right">{fmtMoeda(item.valor)}</td><td className="text-right">{relatorio.frete > 0 ? `${fmtNumero(item.valor / relatorio.frete * 100)}%` : '—'}</td></tr>)}
          <tr className="border-t-2 border-gray-800 font-black"><td colSpan={4}>Total</td><td className="text-right">{fmtMoeda(relatorio.totalDespesas)}</td><td></td></tr>
        </RelatorioTabela>

        <RelatorioTabela titulo="Abastecimentos" headers={['Data', 'Fornecedor', 'Local / rota', 'Km', 'Valor', '% s/Receita']}>
          {relatorio.abastecimentos.map((item, indice) => <tr key={`${item.id}-${indice}`} className="border-t border-gray-400"><td>{fmtData(item.data)}</td><td>{item.posto || '—'}</td><td>{[item.cidade, item.estado].filter(Boolean).join(' / ') || '—'}</td><td className="text-right">{item.km ? fmtNumero(item.km, 0) : '—'}</td><td className="text-right">{fmtMoeda(item.total)}</td><td className="text-right">{relatorio.frete > 0 ? `${fmtNumero(valorSeguro(item.total) / relatorio.frete * 100)}%` : '—'}</td></tr>)}
          <tr className="border-t-2 border-gray-800 font-black"><td colSpan={4}>Total</td><td className="text-right">{fmtMoeda(relatorio.totalAbastecimentos)}</td><td></td></tr>
        </RelatorioTabela>

        <div className="mt-4 border border-gray-500">
          <h4 className="border-b border-gray-500 bg-gray-100 px-2 py-1 text-center font-black">Resumo abastecimentos</h4>
          <div className="grid grid-cols-1 md:grid-cols-2">
            <div className="border-b md:border-b-0 md:border-r border-gray-400 p-2"><p><b>Primeiro abastecimento:</b> {relatorio.abastecimentos[0] ? `${fmtData(relatorio.abastecimentos[0].data)} · ${relatorio.abastecimentos[0].posto || '—'}` : '—'}</p><p><b>Último abastecimento:</b> {relatorio.abastecimentos.length ? `${fmtData(relatorio.abastecimentos[relatorio.abastecimentos.length - 1].data)} · ${relatorio.abastecimentos[relatorio.abastecimentos.length - 1].posto || '—'}` : '—'}</p></div>
            <div className="p-2"><p><b>Total litros abastecidos:</b> {fmtNumero(relatorio.totalLitros)}</p><p><b>Diferença entre abastecimentos (Km):</b> {fmtNumero(relatorio.kmAbastecimentos, 0)}</p></div>
          </div>
        </div>

        <div className="mt-4 ml-auto max-w-sm border border-gray-500">
          <h4 className="border-b border-gray-500 bg-gray-100 px-2 py-1 text-center font-black">Resumo final</h4>
          <div className="space-y-1 p-2"><p className="flex justify-between"><span>(+) Frete</span><b>{fmtMoeda(relatorio.frete)}</b></p><p className="flex justify-between"><span>(-) Despesa</span><b>{fmtMoeda(relatorio.totalDespesas)}</b></p><p className="flex justify-between"><span>(-) Abastecimentos</span><b>{fmtMoeda(relatorio.totalAbastecimentos)}</b></p><p className="flex justify-between border-t border-gray-500 pt-1 font-black"><span>(=) Resultado</span><b>{fmtMoeda(relatorio.frete - relatorio.totalDespesas - relatorio.totalAbastecimentos)}</b></p><p className="flex justify-between"><span>Média Consumo</span><b>{relatorio.mediaConsumo == null ? '—' : `${fmtNumero(relatorio.mediaConsumo, 4)} Km/L`}</b></p></div>
        </div>
        <p className="mt-5 text-right text-[9px] text-gray-500">Relatório gerado pelo sistema Roesel · {new Date().toLocaleString('pt-BR')}</p>
      </div>}
    </div>
  )
}

function RelatorioTabela({ titulo, headers, children }: { titulo: string; headers: string[]; children: React.ReactNode }) {
  return <section className="mt-4"><h4 className="border border-b-0 border-gray-500 bg-gray-100 px-2 py-1 text-center font-black">{titulo}</h4><div className="overflow-hidden border border-gray-500"><table className="w-full table-fixed border-collapse"><thead><tr>{headers.map((header, indice) => <th key={header} className={`px-1 py-1 text-left font-black ${indice >= headers.length - 2 ? 'text-right' : ''}`}>{header}</th>)}</tr></thead><tbody>{children}</tbody></table></div></section>
}
