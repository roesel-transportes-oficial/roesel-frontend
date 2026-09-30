export const KM_MAXIMO_ENTRE_ABASTECIMENTOS = 5000
export const KM_LITRO_MINIMO = 1.5
export const KM_LITRO_MAXIMO = 4.5
export const LITROS_MINIMOS_TANQUE_CHEIO = 100

export interface AbastecimentoAnaliseInput {
  id?: string | null
  data?: string | null
  caminhao_id?: string | null
  caminhao_placa?: string | null
  motorista?: string | null
  posto?: string | null
  estado?: string | null
  cidade?: string | null
  tipo_combustivel?: string | null
  litros_combustivel?: number | string | null
  valor_litro_combustivel?: number | string | null
  km?: number | string | null
  tanque_cheio?: boolean | null
  total?: number | string | null
}

export interface AlertaAbastecimento {
  tipo: 'erro' | 'atencao'
  mensagem: string
}

export interface AnaliseAbastecimento {
  kmAnterior: number | null
  kmRodado: number | null
  consumoKmPorLitro: number | null
  alertas: AlertaAbastecimento[]
}

export interface ResumoAbastecimentos {
  registros: number
  total: number
  litros: number
  precoMedio: number | null
  menorPreco: number | null
  maiorPreco: number | null
  kmRodados: number
  custoPorKm: number | null
  comAlertas: number
}

export interface ComparativoAbastecimentos {
  grupo: string
  registros: number
  total: number
  litros: number
  precoMedio: number | null
  menorPreco: number | null
  maiorPreco: number | null
}

export interface TendenciaPosto {
  posto: string
  cidade: string
  estado: string
  tipoCombustivel: string
  primeiroPreco: number
  ultimoPreco: number
  variacao: number
  variacaoPercentual: number
}

export interface EconomiaRegiao {
  regiao: string
  tipoCombustivel: string
  precoCompetitivo: number
  litrosComparados: number
  economiaPotencial: number
}

export interface ComparacaoPrecoRegional {
  media: number | null
  preco: number | null
  acimaDaMedia: boolean
  percentualAcima: number
}

function numero(valor: unknown): number | null {
  if (valor === null || valor === undefined || valor === '') return null
  const convertido = Number(valor)
  return Number.isFinite(convertido) ? convertido : null
}

function texto(valor: unknown): string {
  return String(valor ?? '').trim()
}

export function chaveVeiculo(registro: AbastecimentoAnaliseInput): string {
  return texto(registro.caminhao_id) || texto(registro.caminhao_placa).replace(/[^A-Z0-9]/gi, '').toUpperCase() || 'SEM_VEICULO'
}

function ordenar(a: AbastecimentoAnaliseInput, b: AbastecimentoAnaliseInput): number {
  const dataA = texto(a.data)
  const dataB = texto(b.data)
  const porData = dataA.localeCompare(dataB)
  if (porData !== 0) return porData
  const kmA = numero(a.km) ?? Number.MAX_SAFE_INTEGER
  const kmB = numero(b.km) ?? Number.MAX_SAFE_INTEGER
  if (kmA !== kmB) return kmA - kmB
  return texto(a.id).localeCompare(texto(b.id))
}

function adicionarAlerta(alertas: AlertaAbastecimento[], tipo: AlertaAbastecimento['tipo'], mensagem: string) {
  if (!alertas.some(alerta => alerta.mensagem === mensagem)) alertas.push({ tipo, mensagem })
}

function analisarRegistro(registro: AbastecimentoAnaliseInput, anterior: AbastecimentoAnaliseInput | null): AnaliseAbastecimento {
  const alertas: AlertaAbastecimento[] = []
  const kmAtual = numero(registro.km)
  const kmAnterior = numero(anterior?.km)
  const litros = numero(registro.litros_combustivel)
  let kmRodado: number | null = null
  let consumoKmPorLitro: number | null = null

  if (!texto(registro.cidade) || !texto(registro.estado)) {
    adicionarAlerta(alertas, 'erro', 'Cidade e UF do posto não informadas.')
  }
  if (!texto(registro.tipo_combustivel)) {
    adicionarAlerta(alertas, 'erro', 'Tipo de combustível não informado.')
  }
  if (kmAtual === null) {
    adicionarAlerta(alertas, 'atencao', 'Hodômetro não informado; o lançamento não entra no cálculo de distância.')
  }
  if (kmAtual !== null && kmAnterior !== null) {
    kmRodado = kmAtual - kmAnterior
    if (kmRodado <= 0) {
      adicionarAlerta(alertas, 'erro', 'Hodômetro menor ou igual ao abastecimento anterior.')
    } else if (kmRodado > KM_MAXIMO_ENTRE_ABASTECIMENTOS) {
      adicionarAlerta(alertas, 'atencao', `Diferença de hodômetro muito alta: ${kmRodado.toLocaleString('pt-BR')} km desde o abastecimento anterior.`)
    }

    if (kmRodado > 0 && litros && litros > 0) {
      consumoKmPorLitro = kmRodado / litros
      if (consumoKmPorLitro < KM_LITRO_MINIMO || consumoKmPorLitro > KM_LITRO_MAXIMO) {
        adicionarAlerta(alertas, 'atencao', `Média estimada fora da faixa: ${consumoKmPorLitro.toFixed(2)} km/L.`)
      }
    }
  }
  if (registro.tanque_cheio === true && litros !== null && litros > 0 && litros < LITROS_MINIMOS_TANQUE_CHEIO) {
    adicionarAlerta(alertas, 'atencao', `Tanque cheio marcado com apenas ${litros.toLocaleString('pt-BR')} litros.`)
  }

  return { kmAnterior, kmRodado, consumoKmPorLitro, alertas }
}

export function calcularAnalises(registros: AbastecimentoAnaliseInput[]): Map<string, AnaliseAbastecimento> {
  const resultado = new Map<string, AnaliseAbastecimento>()
  const porVeiculo = new Map<string, AbastecimentoAnaliseInput[]>()

  registros.forEach(registro => {
    const chave = chaveVeiculo(registro)
    const lista = porVeiculo.get(chave) || []
    lista.push(registro)
    porVeiculo.set(chave, lista)
  })

  porVeiculo.forEach(lista => {
    lista.sort(ordenar)
    let anterior: AbastecimentoAnaliseInput | null = null
    lista.forEach(registro => {
      const id = texto(registro.id)
      if (id) resultado.set(id, analisarRegistro(registro, anterior))
      if (numero(registro.km) !== null) anterior = registro
    })
  })

  return resultado
}

export function avisosParaLancamento(
  registro: AbastecimentoAnaliseInput,
  existentes: AbastecimentoAnaliseInput[],
  ignorarId?: string,
): AlertaAbastecimento[] {
  const temporario = { ...registro, id: '__novo_abastecimento__' }
  const base = existentes.filter(item => !ignorarId || texto(item.id) !== ignorarId)
  return calcularAnalises([...base, temporario]).get('__novo_abastecimento__')?.alertas || []
}

function resumoNumerico(registros: AbastecimentoAnaliseInput[], analises?: Map<string, AnaliseAbastecimento>, baseRegistros = registros): ResumoAbastecimentos {
  const total = registros.reduce((soma, registro) => soma + (numero(registro.total) || 0), 0)
  const litros = registros.reduce((soma, registro) => soma + (numero(registro.litros_combustivel) || 0), 0)
  const valores = registros
    .map(registro => numero(registro.valor_litro_combustivel))
    .filter((valor): valor is number => valor !== null && valor > 0)
  const litrosComPreco = registros.reduce((soma, registro) => {
    const litrosRegistro = numero(registro.litros_combustivel) || 0
    const preco = numero(registro.valor_litro_combustivel) || 0
    return soma + litrosRegistro * preco
  }, 0)
  const kmRodados = calcularKmRodados(registros, baseRegistros)
  const comAlertas = analises
    ? registros.filter(registro => texto(registro.id) && (analises.get(texto(registro.id))?.alertas.length || 0) > 0).length
    : 0

  return {
    registros: registros.length,
    total,
    litros,
    precoMedio: litros > 0 ? litrosComPreco / litros : null,
    menorPreco: valores.length ? Math.min(...valores) : null,
    maiorPreco: valores.length ? Math.max(...valores) : null,
    kmRodados,
    custoPorKm: kmRodados > 0 ? total / kmRodados : null,
    comAlertas,
  }
}

export function calcularResumo(registros: AbastecimentoAnaliseInput[], analises?: Map<string, AnaliseAbastecimento>, baseRegistros = registros): ResumoAbastecimentos {
  return resumoNumerico(registros, analises, baseRegistros)
}

export function calcularKmRodados(registros: AbastecimentoAnaliseInput[], baseRegistros = registros): number {
  const idsSelecionados = new Set(registros.map(registro => texto(registro.id)).filter(Boolean))
  const porVeiculo = new Map<string, AbastecimentoAnaliseInput[]>()
  baseRegistros.forEach(registro => {
    const lista = porVeiculo.get(chaveVeiculo(registro)) || []
    lista.push(registro)
    porVeiculo.set(chaveVeiculo(registro), lista)
  })

  let total = 0
  porVeiculo.forEach(lista => {
    lista.sort(ordenar)
    let anterior: number | null = null
    lista.forEach(registro => {
      const km = numero(registro.km)
      if (km === null) return
      if (anterior !== null && (!idsSelecionados.size || idsSelecionados.has(texto(registro.id)))) {
        const distancia = km - anterior
        if (distancia > 0 && distancia <= KM_MAXIMO_ENTRE_ABASTECIMENTOS) total += distancia
      }
      anterior = km
    })
  })
  return total
}

export function compararPrecoRegional(
  registros: AbastecimentoAnaliseInput[],
  registro: AbastecimentoAnaliseInput,
): ComparacaoPrecoRegional {
  const estado = texto(registro.estado).toUpperCase()
  const tipo = texto(registro.tipo_combustivel).toUpperCase()
  const valores = registros
    .filter(item => texto(item.estado).toUpperCase() === estado && texto(item.tipo_combustivel).toUpperCase() === tipo)
    .map(item => numero(item.valor_litro_combustivel))
    .filter((item): item is number => item !== null && item > 0)
  const preco = numero(registro.valor_litro_combustivel)
  if (!valores.length || preco === null || !estado || !tipo) {
    return { media: null, preco, acimaDaMedia: false, percentualAcima: 0 }
  }
  const media = valores.reduce((soma, valor) => soma + valor, 0) / valores.length
  const percentualAcima = media > 0 ? ((preco - media) / media) * 100 : 0
  return { media, preco, acimaDaMedia: percentualAcima > 5, percentualAcima }
}

function valorGrupo(registro: AbastecimentoAnaliseInput, agrupador: (registro: AbastecimentoAnaliseInput) => string): string {
  return agrupador(registro).trim() || 'Não informado'
}

export function compararPor(
  registros: AbastecimentoAnaliseInput[],
  agrupador: (registro: AbastecimentoAnaliseInput) => string,
): ComparativoAbastecimentos[] {
  const grupos = new Map<string, AbastecimentoAnaliseInput[]>()
  registros.forEach(registro => {
    const grupo = valorGrupo(registro, agrupador)
    const lista = grupos.get(grupo) || []
    lista.push(registro)
    grupos.set(grupo, lista)
  })

  return [...grupos.entries()]
    .map(([grupo, lista]) => {
      const resumo = calcularResumo(lista)
      return {
        grupo,
        registros: resumo.registros,
        total: resumo.total,
        litros: resumo.litros,
        precoMedio: resumo.precoMedio,
        menorPreco: resumo.menorPreco,
        maiorPreco: resumo.maiorPreco,
      }
    })
    .sort((a, b) => (b.precoMedio || 0) - (a.precoMedio || 0))
}

export function calcularTendenciaPostos(registros: AbastecimentoAnaliseInput[]): TendenciaPosto[] {
  const grupos = new Map<string, AbastecimentoAnaliseInput[]>()
  registros.forEach(registro => {
    const chave = [texto(registro.posto) || 'Não informado', texto(registro.cidade), texto(registro.estado), texto(registro.tipo_combustivel) || 'Não informado'].join('|')
    const lista = grupos.get(chave) || []
    lista.push(registro)
    grupos.set(chave, lista)
  })

  return [...grupos.values()]
    .map(lista => {
      const ordenada = [...lista].sort(ordenar)
      const primeiroPreco = numero(ordenada[0]?.valor_litro_combustivel)
      const ultimoPreco = numero(ordenada[ordenada.length - 1]?.valor_litro_combustivel)
      if (primeiroPreco === null || ultimoPreco === null || ordenada.length < 2) return null
      const variacao = ultimoPreco - primeiroPreco
      return {
        posto: texto(ordenada[0].posto) || 'Não informado',
        cidade: texto(ordenada[0].cidade) || 'Não informado',
        estado: texto(ordenada[0].estado) || 'Não informado',
        tipoCombustivel: texto(ordenada[0].tipo_combustivel) || 'Não informado',
        primeiroPreco,
        ultimoPreco,
        variacao,
        variacaoPercentual: primeiroPreco > 0 ? (variacao / primeiroPreco) * 100 : 0,
      }
    })
    .filter((item): item is TendenciaPosto => item !== null && item.variacao > 0)
    .sort((a, b) => b.variacao - a.variacao)
}

export function estimarEconomiaPorRegiao(registros: AbastecimentoAnaliseInput[]): EconomiaRegiao[] {
  const grupos = new Map<string, AbastecimentoAnaliseInput[]>()
  registros.forEach(registro => {
    const regiao = texto(registro.estado)
    const tipo = texto(registro.tipo_combustivel) || 'Não informado'
    if (!regiao) return
    const chave = `${regiao}|${tipo}`
    const lista = grupos.get(chave) || []
    lista.push(registro)
    grupos.set(chave, lista)
  })

  return [...grupos.entries()]
    .map(([chave, lista]) => {
      const [regiao, tipoCombustivel] = chave.split('|')
      const precos = lista.map(item => numero(item.valor_litro_combustivel)).filter((item): item is number => item !== null && item > 0)
      if (!precos.length) return null
      const precoCompetitivo = Math.min(...precos)
      const litrosComparados = lista.reduce((soma, item) => soma + (numero(item.litros_combustivel) || 0), 0)
      const economiaPotencial = lista.reduce((soma, item) => {
        const preco = numero(item.valor_litro_combustivel) || precoCompetitivo
        const litros = numero(item.litros_combustivel) || 0
        return soma + Math.max(0, preco - precoCompetitivo) * litros
      }, 0)
      return { regiao, tipoCombustivel, precoCompetitivo, litrosComparados, economiaPotencial }
    })
    .filter((item): item is EconomiaRegiao => item !== null)
    .sort((a, b) => b.economiaPotencial - a.economiaPotencial)
}
