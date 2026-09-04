'use client'
import { useState, useEffect, useRef, useMemo } from 'react'
import { supabase } from '../services/supabase'
import { useAuth } from '../services/auth'
import { useDraftPersistente, limparDraft } from '../services/useDraftPersistente'
import { Plus, ArrowLeft, Save, Trash2, Fuel, Upload, Loader2, Filter, Download, X } from 'lucide-react'
import * as XLSX from 'xlsx'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_KEY!

interface Abastecimento {
  id: string; data: string; caminhao_id: string; caminhao_placa: string
  motorista: string; posto: string; cnpj_posto: string; estado: string; cidade: string
  litros_combustivel: number; valor_litro_combustivel: number
  litros_arla: number; valor_litro_arla: number
  total: number; km: number; obs: string; viagem_id: string; desconto: number
}
interface Caminhao   { id: string; placa: string; modelo: string; motorista_atual: string }
interface Motorista { id: string; nome: string; ativo?: boolean; freelancer?: boolean }
interface Fornecedor { id: string; nome: string; cnpj: string; cidade: string; estado: string }
interface Viagem     { id: string; motorista: string; caminhao_placa: string; data_saida: string; status: string; empresa: string; origem: string; destino: string }

function textoParaChave(valor: unknown) {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function chaveAbastecimento(a: Partial<Abastecimento>) {
  const caminhao = a.caminhao_id || textoParaChave(a.caminhao_placa)
  const motorista = textoParaChave(a.motorista)

  // Com KM informado, o mesmo caminhão nunca pode voltar para um KM já usado.
  // Data, motorista, posto e valores podem variar entre abastecimentos.
  if (a.km != null && Number.isFinite(Number(a.km))) {
    return `principal|${caminhao}|${Number(a.km)}`
  }

  // Sem KM, mantém uma chave mais completa para não juntar lançamentos
  // diferentes que não podem ser identificados com segurança.
  return [
    'sem-km', a.data, caminhao, motorista, textoParaChave(a.posto),
    textoParaChave(a.cnpj_posto).replace(/\D/g, ''),
    Number(a.litros_combustivel || 0).toFixed(3),
    Number(a.valor_litro_combustivel || 0).toFixed(4),
    Number(a.litros_arla || 0).toFixed(3),
    Number(a.valor_litro_arla || 0).toFixed(4),
    Number(a.total || 0).toFixed(2), Number(a.desconto || 0).toFixed(2),
  ].join('|')
}

function semDuplicados(lista: Abastecimento[]) {
  const vistos = new Set<string>()
  return lista.filter(item => {
    const chave = chaveAbastecimento(item)
    if (vistos.has(chave)) return false
    vistos.add(chave)
    return true
  })
}

const IC = "mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-gray-50"
const LC = "text-xs font-semibold text-gray-500 uppercase tracking-wide"
const ESTADOS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']

async function supaFetch(path: string, method = 'GET', body?: any) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: method === 'POST' ? 'return=representation' : 'return=minimal',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(await res.text())
  if (res.status === 204 || method === 'PATCH' || method === 'DELETE') return null
  return res.json()
}

export default function AbastecimentoPage() {
  const { perm } = useAuth()
  const [abastecimentos, setAbastecimentos] = useState<Abastecimento[]>([])
  const [caminhoes, setCaminhoes]           = useState<Caminhao[]>([])
  const [motoristas, setMotoristas]         = useState<Motorista[]>([])
  const [fornecedores, setFornecedores]     = useState<Fornecedor[]>([])
  const [sel, setSel]                       = useState<Abastecimento | null>(null)
  const [mostraCad, setMostraCad]           = useState(false)
  const [loading, setLoading]               = useState(false)
  const [loadingIA, setLoadingIA]           = useState(false)
  const [msg, setMsg]                       = useState('')
  const [confirmExcluir, setConfirmExcluir] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [viagensCaminhao, setViagensCaminhao] = useState<Viagem[]>([])

  // ── Profrotas ─────────────────────────────────────────────────────────
  const [mostraProfrotas, setMostraProfrotas]   = useState(false)
  const [profrotasInicio, setProfrotasInicio]   = useState('')
  const [profrotasFim, setProfrotasFim]         = useState('')
  const [importando, setImportando]             = useState(false)
  const [resultadoImport, setResultadoImport]   = useState<{ importados: number; ignorados: number; total: number } | null>(null)

  const [filtroMotorista, setFiltroMotorista] = useState('')
  const [filtroPlaca, setFiltroPlaca]         = useState('')
  const [filtroInicio, setFiltroInicio]       = useState('')
  const [filtroFim, setFiltroFim]             = useState('')

  const [editData, setEditData]                     = useState('')
  const [editCaminhaoId, setEditCaminhaoId]         = useState('')
  const [editCaminhaoPlaca, setEditCaminhaoPlaca]   = useState('')
  const [editMotorista, setEditMotorista]           = useState('')
  const [editPosto, setEditPosto]                   = useState('')
  const [editCnpjPosto, setEditCnpjPosto]           = useState('')
  const [editEstado, setEditEstado]                 = useState('')
  const [editCidade, setEditCidade]                 = useState('')
  const [editLitrosComb, setEditLitrosComb]         = useState('')
  const [editValorLitroComb, setEditValorLitroComb] = useState('')
  const [editLitrosArla, setEditLitrosArla]         = useState('')
  const [editValorLitroArla, setEditValorLitroArla] = useState('')
  const [editKm, setEditKm]                         = useState('')
  const [editObs, setEditObs]                       = useState('')
  const [editUsaArla, setEditUsaArla]               = useState(false)
  const [editViagemId, setEditViagemId]             = useState('')
  const [editDesconto, setEditDesconto]             = useState('')

  const [cadData, setCadData]                       = useDraftPersistente('abast_cadData', new Date().toISOString().split('T')[0])
  const [cadCaminhaoId, setCadCaminhaoId]           = useDraftPersistente('abast_cadCaminhaoId', '')
  const [cadCaminhaoPlaca, setCadCaminhaoPlaca]     = useDraftPersistente('abast_cadCaminhaoPlaca', '')
  const [cadMotorista, setCadMotorista]             = useDraftPersistente('abast_cadMotorista', '')
  const [cadPosto, setCadPosto]                     = useDraftPersistente('abast_cadPosto', '')
  const [cadCnpjPosto, setCadCnpjPosto]             = useDraftPersistente('abast_cadCnpjPosto', '')
  const [cadEstado, setCadEstado]                   = useDraftPersistente('abast_cadEstado', '')
  const [cadCidade, setCadCidade]                   = useDraftPersistente('abast_cadCidade', '')
  const [cadLitrosComb, setCadLitrosComb]           = useDraftPersistente('abast_cadLitrosComb', '')
  const [cadValorLitroComb, setCadValorLitroComb]   = useDraftPersistente('abast_cadValorLitroComb', '')
  const [cadLitrosArla, setCadLitrosArla]           = useDraftPersistente('abast_cadLitrosArla', '')
  const [cadValorLitroArla, setCadValorLitroArla]   = useDraftPersistente('abast_cadValorLitroArla', '')
  const [cadKm, setCadKm]                           = useDraftPersistente('abast_cadKm', '')
  const [cadObs, setCadObs]                         = useDraftPersistente('abast_cadObs', '')
  const [usaArla, setUsaArla]                       = useDraftPersistente('abast_usaArla', false)
  const [cadViagemId, setCadViagemId]               = useDraftPersistente('abast_cadViagemId', '')
  const [cadDesconto, setCadDesconto]               = useDraftPersistente('abast_cadDesconto', '')

  // Motoristas que estavam vinculados ao caminhão na data do abastecimento.
  const [cadMotoristasHistorico, setCadMotoristasHistorico] = useState<string[]>([])
  const [editMotoristasHistorico, setEditMotoristasHistorico] = useState<string[]>([])

  useEffect(() => {
    Promise.all([
      fetch_(),
      supabase.from('caminhoes').select('id, placa, modelo, motorista_atual').order('placa')
        .then(({ data }) => data && setCaminhoes(data)),
      supabase.from('motoristas').select('id, nome, ativo, freelancer').eq('ativo', true).order('nome')
        .then(({ data }) => data && setMotoristas(data)),
      fetchFornecedores()
    ])
  }, [])

  async function fetch_() {
    try {
      const data = await supaFetch('abastecimentos?order=data.asc')
      const lista = Array.isArray(data) ? data as Abastecimento[] : []
      setAbastecimentos(semDuplicados(lista))
    } catch {}
  }

  async function fetchFornecedores() {
    try {
      const data = await supaFetch('fornecedores?order=nome.asc')
      setFornecedores(Array.isArray(data) ? data : [])
    } catch {}
  }

  async function fetchViagensCaminhao(caminhaoId: string) {
    if (!caminhaoId) { setViagensCaminhao([]); return }
    try {
      const data = await supaFetch(`viagens?caminhao_id=eq.${caminhaoId}&order=created_at.desc&limit=20`)
      setViagensCaminhao(Array.isArray(data) ? data : [])
    } catch { setViagensCaminhao([]) }
  }

  async function buscarMotoristasHistorico(caminhaoId: string, data: string): Promise<string[]> {
    if (!caminhaoId || !data) return []
    const { data: historico, error } = await supabase
      .from('historico_motorista_caminhao')
      .select('motorista_nome')
      .eq('caminhao_id', caminhaoId)
      .lte('data_inicio', data)
      .or(`data_fim.is.null,data_fim.gte.${data}`)
      .order('data_inicio', { ascending: false })

    if (error) {
      console.error('Erro ao buscar motoristas do histórico:', error)
      return []
    }

    return [...new Set((historico || []).map(h => h.motorista_nome).filter(Boolean))]
  }

  useEffect(() => {
    let ativo = true
    buscarMotoristasHistorico(cadCaminhaoId, cadData).then(nomes => {
      if (!ativo) return
      setCadMotoristasHistorico(nomes)
      if (nomes.length === 1 && !cadMotorista) setCadMotorista(nomes[0])
    })
    return () => { ativo = false }
  }, [cadCaminhaoId, cadData])

  useEffect(() => {
    let ativo = true
    buscarMotoristasHistorico(editCaminhaoId, editData).then(nomes => {
      if (!ativo) return
      setEditMotoristasHistorico(nomes)
    })
    return () => { ativo = false }
  }, [editCaminhaoId, editData])

  // ── Importar Profrotas ───────────────────────────────────────────────
  async function importarProfrotas() {
    if (!profrotasInicio || !profrotasFim) {
      showMsg('⚠️ Informe o período para importar.')
      return
    }
    setImportando(true)
    setResultadoImport(null)
    try {
      const res = await fetch('/api/profrotas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataInicio: profrotasInicio, dataFim: profrotasFim }),
      })
      const json = await res.json()
      if (!json.ok) {
        showMsg('❌ ' + (json.error || 'Erro ao importar'))
        return
      }
      setResultadoImport({ importados: json.importados, ignorados: json.ignorados, total: json.total })
      await fetch_()
    } catch (e: any) {
      showMsg('❌ Erro: ' + e.message)
    } finally {
      setImportando(false)
    }
  }

  function calcTotal(lc: string, vlc: string, la: string, vla: string, desc: string) {
    return (parseFloat(lc)||0)*(parseFloat(vlc)||0) + (parseFloat(la)||0)*(parseFloat(vla)||0) - (parseFloat(desc)||0)
  }

  function fmtData(d: string) {
    if (!d) return ''
    const [y, m, dia] = d.split('-')
    return `${dia}/${m}/${y}`
  }

  function preencherFornecedor(cnpj: string, modo: 'cad' | 'edit') {
    const f = fornecedores.find(f => f.cnpj?.replace(/\D/g,'') === cnpj.replace(/\D/g,''))
    if (!f) return
    if (modo === 'cad') { setCadPosto(f.nome); setCadCidade(f.cidade||''); setCadEstado(f.estado||''); setCadCnpjPosto(f.cnpj||'') }
    else { setEditPosto(f.nome); setEditCidade(f.cidade||''); setEditEstado(f.estado||''); setEditCnpjPosto(f.cnpj||'') }
  }

  function selecionarFornecedor(valor: string, modo: 'cad' | 'edit') {
    if (!valor) {
      if (modo === 'cad') { setCadPosto(''); setCadCnpjPosto(''); setCadCidade(''); setCadEstado('') }
      else { setEditPosto(''); setEditCnpjPosto(''); setEditCidade(''); setEditEstado('') }
      return
    }
    const [nome, cnpj] = valor.split('||')
    const f = fornecedores.find(f => f.nome === nome)
    if (modo === 'cad') { setCadPosto(nome); setCadCnpjPosto(cnpj||f?.cnpj||''); setCadCidade(f?.cidade||''); setCadEstado(f?.estado||'') }
    else { setEditPosto(nome); setEditCnpjPosto(cnpj||f?.cnpj||''); setEditCidade(f?.cidade||''); setEditEstado(f?.estado||'') }
  }

  function fornecedorVal(nome: string) {
    const f = fornecedores.find(f => f.nome === nome)
    return f ? `${f.nome}||${f.cnpj||''}` : ''
  }

  function fmtCnpj(v: string) {
    const d = v.replace(/\D/g,'').slice(0,14)
    if (d.length <= 2) return d
    if (d.length <= 5) return `${d.slice(0,2)}.${d.slice(2)}`
    if (d.length <= 8) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5)}`
    if (d.length <= 12) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8)}`
    return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`
  }

  async function lerCupomComIA(file: File) {
    setLoadingIA(true)
    try {
      const base64 = await new Promise<string>((res, rej) => {
        const r = new FileReader()
        r.onload = () => res((r.result as string).split(',')[1])
        r.onerror = () => rej()
        r.readAsDataURL(file)
      })
      const mediaType = file.type === 'application/pdf' ? 'application/pdf' : file.type === 'image/png' ? 'image/png' : 'image/jpeg'
      const res = await fetch('/api/ler-cupom', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64, mediaType }),
      })
      const json = await res.json()
      if (!json.ok) { showMsg('⚠️ ' + (json.erro || 'Não foi possível extrair.')); return }
      const d = json.dados
      if (d.data_abastecimento) setCadData(d.data_abastecimento)
      if (d.km) setCadKm(String(d.km))
      if (d.litros_combustivel) setCadLitrosComb(String(d.litros_combustivel))
      if (d.valor_litro_combustivel) setCadValorLitroComb(String(d.valor_litro_combustivel))
      if (d.litros_arla && d.litros_arla > 0) { setUsaArla(true); setCadLitrosArla(String(d.litros_arla)); if (d.valor_litro_arla) setCadValorLitroArla(String(d.valor_litro_arla)) }
      if (d.cnpj_posto) {
        const cnpjLimpo = d.cnpj_posto.replace(/\D/g,'')
        const found = fornecedores.find(f => f.cnpj?.replace(/\D/g,'') === cnpjLimpo)
        if (found) { setCadPosto(found.nome); setCadCnpjPosto(found.cnpj||''); setCadCidade(found.cidade||''); setCadEstado(found.estado||'') }
        else { setCadCnpjPosto(d.cnpj_posto); if (d.cidade) setCadCidade(d.cidade); if (d.estado) setCadEstado(d.estado); if (d.nome_posto) setCadPosto(d.nome_posto) }
      }
      if (d.placa) {
        const cam = caminhoes.find(c => c.placa.replace(/[^A-Z0-9]/gi,'').toLowerCase() === d.placa.replace(/[^A-Z0-9]/gi,'').toLowerCase())
        if (cam) { setCadCaminhaoId(cam.id); setCadCaminhaoPlaca(cam.placa); setCadMotorista(cam.motorista_atual||''); await fetchViagensCaminhao(cam.id) }
      }
      showMsg('✅ Dados extraídos com sucesso!')
    } catch { showMsg('⚠️ Erro ao processar o arquivo.') }
    finally { setLoadingIA(false) }
  }

  function labelViagem(v: Viagem) {
    return `${fmtData(v.data_saida)} · ${v.status}${v.empresa ? ` · ${v.empresa}` : ''}${v.origem ? ` · ${v.origem} → ${v.destino}` : ''}`
  }

  const motoristasUnicos = useMemo(() =>
    [...new Set(abastecimentos.map(a => a.motorista).filter(Boolean))].sort()
  , [abastecimentos])

  const placasUnicas = useMemo(() =>
    [...new Set(abastecimentos.map(a => a.caminhao_placa).filter(Boolean))].sort()
  , [abastecimentos])

  const filtrados = useMemo(() => abastecimentos
    .filter(a => {
      if (filtroMotorista && a.motorista !== filtroMotorista) return false
      if (filtroPlaca && a.caminhao_placa !== filtroPlaca) return false
      if (filtroInicio && a.data < filtroInicio) return false
      if (filtroFim   && a.data > filtroFim)   return false
      return true
    })
    .sort((a, b) => a.data.localeCompare(b.data)),
    [abastecimentos, filtroMotorista, filtroPlaca, filtroInicio, filtroFim]
  )

  const totalGeral = useMemo(() => filtrados.reduce((s, a) => s + (a.total||0), 0), [filtrados])

  function exportarExcel() {
    if (filtrados.length === 0) {
      showMsg('⚠️ Não há registros para exportar com os filtros atuais.')
      return
    }

    const dados = filtrados.map(a => ({
      Data: a.data ? new Date(`${a.data}T00:00:00`) : null,
      Placa: a.caminhao_placa || '',
      Motorista: a.motorista || '',
      Posto: a.posto || '',
      'CNPJ Posto': a.cnpj_posto || '',
      Estado: a.estado || '',
      Cidade: a.cidade || '',
      'Litros Combustível': Number(a.litros_combustivel || 0),
      'Valor Litro Combustível': Number(a.valor_litro_combustivel || 0),
      'Litros ARLA': Number(a.litros_arla || 0),
      'Valor Litro ARLA': Number(a.valor_litro_arla || 0),
      KM: Number(a.km || 0),
      Desconto: Number(a.desconto || 0),
      Total: Number(a.total || 0),
      Observações: a.obs || '',
    }))

    const planilha = XLSX.utils.json_to_sheet(dados)
    const ultimaLinha = dados.length + 1
    planilha['!cols'] = [
      { wch: 12 }, { wch: 12 }, { wch: 28 }, { wch: 30 }, { wch: 18 },
      { wch: 10 }, { wch: 20 }, { wch: 20 }, { wch: 22 }, { wch: 14 },
      { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 42 },
    ]
    planilha['!autofilter'] = { ref: `A1:O${ultimaLinha}` }

    for (let linha = 2; linha <= ultimaLinha; linha++) {
      const celulaData = planilha[`A${linha}`]
      if (celulaData?.v instanceof Date) celulaData.z = 'dd/mm/yyyy'
      for (const coluna of ['H', 'I', 'J', 'K', 'M', 'N']) {
        const celula = planilha[`${coluna}${linha}`]
        if (celula) celula.z = '#,##0.00'
      }
      const celulaKm = planilha[`L${linha}`]
      if (celulaKm) celulaKm.z = '#,##0'
    }

    const livro = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(livro, planilha, 'Abastecimentos')
    XLSX.writeFile(livro, `abastecimentos_${new Date().toISOString().split('T')[0]}.xlsx`)
    showMsg(`✅ Excel exportado com ${filtrados.length} registro(s).`)
  }

  async function selecionar(a: Abastecimento) {
    setSel(a)
    setEditData(a.data||''); setEditCaminhaoId(a.caminhao_id||''); setEditCaminhaoPlaca(a.caminhao_placa||'')
    setEditMotorista(a.motorista||''); setEditPosto(a.posto||''); setEditCnpjPosto(a.cnpj_posto||'')
    setEditEstado(a.estado||''); setEditCidade(a.cidade||'')
    setEditLitrosComb(String(a.litros_combustivel||'')); setEditValorLitroComb(String(a.valor_litro_combustivel||''))
    setEditLitrosArla(String(a.litros_arla||'')); setEditValorLitroArla(String(a.valor_litro_arla||''))
    setEditKm(a.km ? String(a.km) : ''); setEditObs(a.obs||''); setEditUsaArla((a.litros_arla||0) > 0)
    setEditViagemId(a.viagem_id||''); setEditDesconto(String(a.desconto||''))
    setConfirmExcluir(false)
    await fetchViagensCaminhao(a.caminhao_id||'')
  }

  function voltar() { setSel(null); setConfirmExcluir(false) }
  function showMsg(t: string) { setMsg(t); setTimeout(() => setMsg(''), 4000) }

  async function verificarKmJaUsado(caminhaoId: string, km: string, idIgnorar?: string) {
    if (!caminhaoId || km === '' || !Number.isFinite(Number(km))) return null

    let consulta = supabase
      .from('abastecimentos')
      .select('id, data, motorista, caminhao_placa, km')
      .eq('caminhao_id', caminhaoId)
      .eq('km', Number(km))
      .limit(1)

    if (idIgnorar) consulta = consulta.neq('id', idIgnorar)
    const { data, error } = await consulta.maybeSingle()
    if (error) {
      console.error('Erro ao verificar KM já utilizado:', error)
      return null
    }
    return data || null
  }

  function mensagemDeErroAbastecimento(error: any) {
    const bruto = String(error?.message || error || '')
    if (error?.code === '23505' || bruto.includes('duplicate key') || bruto.includes('ux_abastecimentos')) {
      return '⚠️ Este KM já foi usado nesse caminhão. Informe o KM atual do veículo.'
    }
    return '❌ Não foi possível salvar: ' + (error?.message || 'verifique a conexão.')
  }

  async function salvar() {
    if (!sel) return
    setLoading(true)
    try {
      const total = calcTotal(editLitrosComb, editValorLitroComb, editUsaArla ? editLitrosArla : '0', editUsaArla ? editValorLitroArla : '0', editDesconto)
      const atualizado: Partial<Abastecimento> = {
        data: editData, caminhao_id: editCaminhaoId, caminhao_placa: editCaminhaoPlaca,
        motorista: editMotorista, posto: editPosto, cnpj_posto: editCnpjPosto,
        litros_combustivel: parseFloat(editLitrosComb) || 0,
        valor_litro_combustivel: parseFloat(editValorLitroComb) || 0,
        litros_arla: editUsaArla ? parseFloat(editLitrosArla) || 0 : 0,
        valor_litro_arla: editUsaArla ? parseFloat(editValorLitroArla) || 0 : 0,
        km: editKm !== '' ? Number(editKm) : undefined,
        total, desconto: parseFloat(editDesconto) || 0,
      }

      if (abastecimentos.some(a => a.id !== sel.id && chaveAbastecimento(a) === chaveAbastecimento(atualizado))) {
        showMsg('⚠️ Este KM já foi usado nesse caminhão. Informe o KM atual do veículo.')
        return
      }

      if (perm !== 'demo') {
        const existente = await verificarKmJaUsado(editCaminhaoId, editKm, sel.id)
        if (existente) {
          showMsg(`⚠️ O KM ${Number(editKm).toLocaleString('pt-BR')} já está registrado para este caminhão${existente.data ? ` em ${fmtData(existente.data)}` : ''}.`)
          return
        }
        await supaFetch(`abastecimentos?id=eq.${sel.id}`, 'PATCH', {
          ...atualizado, km: editKm !== '' ? Number(editKm) : null,
          estado: editEstado, cidade: editCidade,
          obs: editObs, viagem_id: editViagemId || null,
        })
      }
      await fetch_()
      voltar(); showMsg('✅ Atualizado!')
    } catch (e: any) {
      showMsg(mensagemDeErroAbastecimento(e))
    } finally {
      setLoading(false)
    }
  }

  async function excluir() {
    if (!sel) return
    setLoading(true)
    if (perm !== 'demo') await supaFetch(`abastecimentos?id=eq.${sel.id}`, 'DELETE')
    await fetch_(); setLoading(false); voltar(); showMsg('Abastecimento excluído.')
  }

  function resetCad() {
    setCadData(new Date().toISOString().split('T')[0]); setCadCaminhaoId(''); setCadCaminhaoPlaca(''); setCadMotorista(''); setCadMotoristasHistorico([])
    setCadPosto(''); setCadCnpjPosto(''); setCadEstado(''); setCadCidade('')
    setCadLitrosComb(''); setCadValorLitroComb(''); setCadLitrosArla(''); setCadValorLitroArla('')
    setCadKm(''); setCadObs(''); setUsaArla(false); setCadViagemId(''); setCadDesconto('')
    setViagensCaminhao([])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function cadastrar() {
    if (!cadCaminhaoId) return
    setLoading(true)
    try {
      const total = calcTotal(cadLitrosComb, cadValorLitroComb, usaArla ? cadLitrosArla : '0', usaArla ? cadValorLitroArla : '0', cadDesconto)
      const novoAbastecimento: Partial<Abastecimento> = {
        data: cadData, caminhao_id: cadCaminhaoId, caminhao_placa: cadCaminhaoPlaca,
        motorista: cadMotorista, posto: cadPosto, cnpj_posto: cadCnpjPosto,
        litros_combustivel: parseFloat(cadLitrosComb) || 0,
        valor_litro_combustivel: parseFloat(cadValorLitroComb) || 0,
        litros_arla: usaArla ? parseFloat(cadLitrosArla) || 0 : 0,
        valor_litro_arla: usaArla ? parseFloat(cadValorLitroArla) || 0 : 0,
        km: cadKm !== '' ? Number(cadKm) : undefined,
        total, desconto: parseFloat(cadDesconto) || 0,
      }

      if (abastecimentos.some(a => chaveAbastecimento(a) === chaveAbastecimento(novoAbastecimento))) {
        showMsg('⚠️ Este KM já foi usado nesse caminhão. Informe o KM atual do veículo.')
        return
      }

      if (perm !== 'demo') {
        const existente = await verificarKmJaUsado(cadCaminhaoId, cadKm)
        if (existente) {
          showMsg(`⚠️ O KM ${Number(cadKm).toLocaleString('pt-BR')} já está registrado para este caminhão${existente.data ? ` em ${fmtData(existente.data)}` : ''}.`)
          return
        }
        await supaFetch('abastecimentos', 'POST', {
          ...novoAbastecimento, km: cadKm !== '' ? Number(cadKm) : null,
          estado: cadEstado, cidade: cadCidade,
          obs: cadObs, viagem_id: cadViagemId || null,
        })
      }
      await fetch_()
      resetCad(); setMostraCad(false); showMsg('✅ Abastecimento registrado!')
    } catch (e: any) {
      showMsg(mensagemDeErroAbastecimento(e))
    } finally {
      setLoading(false)
    }
  }

  const Toggle = ({ value, onChange }: { value: boolean; onChange: () => void }) => (
    <button onClick={onChange}
      className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors ${value ? 'bg-red-600' : 'bg-gray-300'}`}>
      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${value ? 'translate-x-5' : 'translate-x-1'}`} />
    </button>
  )

  const FornecedorOptions = () => (
    <>
      <option value="">Selecione...</option>
      {fornecedores.map(f => <option key={f.id} value={`${f.nome}||${f.cnpj||''}`}>{f.nome}{f.cnpj ? ` · ${fmtCnpj(f.cnpj)}` : ''}</option>)}
    </>
  )

  function renderFormFields(modo: 'cad' | 'edit') {
    const data      = modo === 'cad' ? cadData      : editData
    const km        = modo === 'cad' ? cadKm        : editKm
    const posto     = modo === 'cad' ? cadPosto     : editPosto
    const cnpj      = modo === 'cad' ? cadCnpjPosto : editCnpjPosto
    const cidade    = modo === 'cad' ? cadCidade    : editCidade
    const estado    = modo === 'cad' ? cadEstado    : editEstado
    const camId     = modo === 'cad' ? cadCaminhaoId : editCaminhaoId
    const motorista = modo === 'cad' ? cadMotorista : editMotorista
    const lc        = modo === 'cad' ? cadLitrosComb : editLitrosComb
    const vlc       = modo === 'cad' ? cadValorLitroComb : editValorLitroComb
    const la        = modo === 'cad' ? cadLitrosArla : editLitrosArla
    const vla       = modo === 'cad' ? cadValorLitroArla : editValorLitroArla
    const arla      = modo === 'cad' ? usaArla : editUsaArla
    const desc      = modo === 'cad' ? cadDesconto : editDesconto
    const obs       = modo === 'cad' ? cadObs : editObs

    const setData      = modo === 'cad' ? setCadData      : setEditData
    const setKm        = modo === 'cad' ? setCadKm        : setEditKm
    const setCnpj      = modo === 'cad' ? setCadCnpjPosto : setEditCnpjPosto
    const setCidade    = modo === 'cad' ? setCadCidade    : setEditCidade
    const setEstado    = modo === 'cad' ? setCadEstado    : setEditEstado
    const setLc        = modo === 'cad' ? setCadLitrosComb : setEditLitrosComb
    const setVlc       = modo === 'cad' ? setCadValorLitroComb : setEditValorLitroComb
    const setLa        = modo === 'cad' ? setCadLitrosArla : setEditLitrosArla
    const setVla       = modo === 'cad' ? setCadValorLitroArla : setEditValorLitroArla
    const setArla      = modo === 'cad' ? setUsaArla : setEditUsaArla
    const setDesc      = modo === 'cad' ? setCadDesconto : setEditDesconto
    const setObs       = modo === 'cad' ? setCadObs : setEditObs

    return (
      <>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={LC}>Data *</label><input type="date" value={data} onChange={e => setData(e.target.value)} className={IC}/></div>
          <div><label className={LC}>KM</label><input type="number" value={km} onChange={e => setKm(e.target.value)} placeholder="Ex: 156650" className={IC}/></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LC}>Fornecedor</label>
            <select value={fornecedorVal(posto)} onChange={e => selecionarFornecedor(e.target.value, modo)} className={IC}><FornecedorOptions/></select>
          </div>
          <div>
            <label className={LC}>CNPJ</label>
            <input value={fmtCnpj(cnpj)} onChange={e => { const v = e.target.value.replace(/\D/g,''); setCnpj(v); if (v.length === 14) preencherFornecedor(v, modo) }} maxLength={18} className={IC}/>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={LC}>Cidade</label><input value={cidade} onChange={e => setCidade(e.target.value.toUpperCase())} className={IC}/></div>
          <div>
            <label className={LC}>Estado (UF)</label>
            <select value={estado} onChange={e => setEstado(e.target.value)} className={IC}>
              <option value="">Selecione...</option>
              {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className={LC}>Caminhão *</label>
          <select value={camId} onChange={async e => {
            const cam = caminhoes.find(c => c.id === e.target.value)
            if (modo === 'cad') { setCadCaminhaoId(e.target.value); setCadCaminhaoPlaca(cam?.placa||''); setCadMotorista(cam?.motorista_atual||''); setCadViagemId('') }
            else { setEditCaminhaoId(e.target.value); setEditCaminhaoPlaca(cam?.placa||''); setEditMotorista(cam?.motorista_atual||''); setEditViagemId('') }
            await fetchViagensCaminhao(e.target.value)
          }} className={IC}>
            <option value="">Selecione o caminhão...</option>
            {caminhoes.map(c => <option key={c.id} value={c.id}>{c.placa}{c.modelo && ` · ${c.modelo}`}</option>)}
          </select>
        </div>
        <div>
          <label className={LC}>Motorista</label>
          {(() => {
            const historicoNomes = modo === 'cad' ? cadMotoristasHistorico : editMotoristasHistorico
            const freelancersAtivos = motoristas.filter(m => m.freelancer).map(m => m.nome).filter(Boolean)
            const nomesDisponiveis = historicoNomes.length > 0
              ? [...historicoNomes, ...freelancersAtivos]
              : motoristas.map(m => m.nome).filter(Boolean)
            const opcoes = [...new Set([ ...nomesDisponiveis, motorista ].filter(Boolean))]
            return (
              <>
                <select
                  value={motorista}
                  onChange={e => modo === 'cad' ? setCadMotorista(e.target.value) : setEditMotorista(e.target.value)}
                  className={IC}
                >
                  <option value="">Selecione o motorista...</option>
                  {opcoes.map(nome => {
                    const motoristaCadastro = motoristas.find(m => m.nome === nome)
                    return <option key={nome} value={nome}>{nome}{motoristaCadastro?.freelancer ? ' · Freelancer' : ''}</option>
                  })}
                </select>
                {historicoNomes.length === 0 && camId && data && (
                  <p className="text-[10px] text-blue-500 mt-1">Sem histórico para esta data — mostrando todos os motoristas ativos.</p>
                )}
                {historicoNomes.length > 0 && freelancersAtivos.length > 0 && (
                  <p className="text-[10px] text-purple-600 mt-1">Além do histórico, freelancers ativos podem ser selecionados para qualquer caminhão.</p>
                )}
              </>
            )
          })()}
        </div>
        <div className="border-t border-gray-100 pt-3">
          <p className={LC + " mb-3"}>Combustível</p>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={LC}>Litros</label><input type="number" step="0.01" value={lc} onChange={e => setLc(e.target.value)} className={IC} placeholder="0,00"/></div>
            <div><label className={LC}>Valor por litro (R$)</label><input type="number" step="0.001" value={vlc} onChange={e => setVlc(e.target.value)} className={IC} placeholder="0,000"/></div>
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-gray-100 pt-3">
          <p className={LC}>ARLA 32</p>
          <Toggle value={arla} onChange={() => setArla(!arla)}/>
        </div>
        {arla && (
          <div className="grid grid-cols-2 gap-3">
            <div><label className={LC}>Litros ARLA</label><input type="number" step="0.01" value={la} onChange={e => setLa(e.target.value)} className={IC}/></div>
            <div><label className={LC}>Valor por litro ARLA</label><input type="number" step="0.001" value={vla} onChange={e => setVla(e.target.value)} className={IC}/></div>
          </div>
        )}
        <div><label className={LC}>Desconto (R$)</label><input type="number" step="0.01" value={desc} onChange={e => setDesc(e.target.value)} className={IC} placeholder="0,00"/></div>
        <div><label className={LC}>Observações</label><textarea value={obs} onChange={e => setObs(e.target.value)} className={IC + " h-20 resize-none"}/></div>
        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
          <p className="text-sm font-bold text-gray-700">Total</p>
          <p className="text-xl font-black text-red-600">
            R$ {calcTotal(lc, vlc, arla ? la : '0', arla ? vla : '0', desc).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>
      </>
    )
  }

  if (mostraCad) return (
    <div className="p-6 max-w-2xl mx-auto">
      <button onClick={() => { setMostraCad(false); resetCad() }} className="flex items-center gap-2 text-gray-500 hover:text-gray-800 mb-4 text-sm transition">
        <ArrowLeft size={16}/> Voltar
      </button>
      {msg && <div className={`mb-4 p-3 rounded-xl text-sm border ${msg.startsWith('⚠️') ? 'bg-yellow-50 border-yellow-200 text-yellow-700' : 'bg-green-50 border-green-200 text-green-700'}`}>{msg}</div>}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-bold text-gray-800 mb-4 text-lg">Novo Abastecimento</h3>
        <div className="mb-5 p-4 bg-gradient-to-r from-red-50 to-orange-50 border border-red-100 rounded-2xl">
          <p className="text-sm font-semibold text-gray-700">📎 Importar cupom fiscal</p>
          <p className="text-xs text-gray-500 mt-0.5 mb-3">Envie uma imagem ou PDF e a IA preencherá os campos automaticamente</p>
          <input ref={fileInputRef} type="file" accept="image/*,application/pdf" className="hidden"
            onChange={e => { const file = e.target.files?.[0]; if (file) lerCupomComIA(file) }} />
          <button onClick={() => fileInputRef.current?.click()} disabled={loadingIA}
            className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-red-200 hover:border-red-400 bg-white text-red-600 rounded-xl py-3 text-sm font-medium transition disabled:opacity-60">
            {loadingIA ? <><Loader2 size={16} className="animate-spin"/> Lendo com IA...</> : <><Upload size={16}/> Selecionar imagem ou PDF</>}
          </button>
        </div>
        <div className="space-y-3">
          {renderFormFields('cad')}
          <button onClick={cadastrar} disabled={loading || !cadCaminhaoId}
            className="w-full flex items-center justify-center gap-2 bg-red-600 text-white px-4 py-3 rounded-xl text-sm font-bold uppercase hover:bg-red-700 transition disabled:opacity-60 mt-2">
            {loading ? <><Loader2 size={16} className="animate-spin"/> Salvando...</> : <><Save size={16}/> Salvar Abastecimento</>}
          </button>
        </div>
      </div>
    </div>
  )

  if (sel) return (
    <div className="p-6 max-w-2xl mx-auto">
      <button onClick={voltar} className="flex items-center gap-2 text-gray-500 hover:text-gray-800 mb-4 text-sm transition"><ArrowLeft size={16}/> Voltar</button>
      {msg && <div className={`mb-4 p-3 rounded-xl text-sm border ${msg.startsWith('⚠️') ? 'bg-yellow-50 border-yellow-200 text-yellow-700' : 'bg-green-50 border-green-200 text-green-700'}`}>{msg}</div>}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-bold text-gray-800 mb-4 text-lg">Editar Abastecimento</h3>
        <div className="space-y-3">
          {renderFormFields('edit')}
          <div className="flex gap-3 mt-4">
            <button onClick={salvar} disabled={loading || !editCaminhaoId}
              className="w-full flex items-center justify-center gap-2 bg-red-600 text-white px-4 py-3 rounded-xl text-sm font-bold uppercase hover:bg-red-700 transition disabled:opacity-60">
              {loading ? <><Loader2 size={16} className="animate-spin"/> Salvando...</> : <><Save size={16}/> Salvar Alterações</>}
            </button>
            <button onClick={() => setConfirmExcluir(true)} disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-gray-200 text-gray-700 px-4 py-3 rounded-xl text-sm font-bold uppercase hover:bg-gray-300 transition disabled:opacity-60">
              <Trash2 size={16}/> Excluir
            </button>
          </div>
          {confirmExcluir && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white p-6 rounded-xl shadow-lg text-center">
                <p className="text-lg font-bold mb-4">Confirmar Exclusão</p>
                <p className="mb-6">Tem certeza que deseja excluir este abastecimento?</p>
                <div className="flex justify-center gap-4">
                  <button onClick={excluir} className="bg-red-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-red-700">Sim, Excluir</button>
                  <button onClick={() => setConfirmExcluir(false)} className="bg-gray-300 text-gray-800 px-4 py-2 rounded-lg font-bold hover:bg-gray-400">Cancelar</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {msg && <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-xl text-sm">{msg}</div>}

      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Abastecimentos</h1>
        <div className="flex gap-2">
          {/* ── Botão Profrotas ── */}
          <button onClick={() => { setMostraProfrotas(true); setResultadoImport(null) }}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-bold uppercase transition">
            <Download size={16}/> Importar Profrotas
          </button>
          <button onClick={exportarExcel} disabled={filtrados.length === 0}
            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-bold uppercase hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed">
            <Download size={16}/> Excel
          </button>
          <button onClick={() => setMostraCad(true)}
            className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-xl text-sm font-bold uppercase hover:bg-red-700 transition">
            <Plus size={16}/> Novo
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4 grid grid-cols-1 md:grid-cols-4 gap-3">
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1 mb-1"><Filter size={11}/> Motorista</label>
          <select value={filtroMotorista} onChange={e => setFiltroMotorista(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-gray-50">
            <option value="">Todos</option>
            {motoristasUnicos.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1 mb-1"><Filter size={11}/> Placa</label>
          <select value={filtroPlaca} onChange={e => setFiltroPlaca(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-gray-50">
            <option value="">Todas</option>
            {placasUnicas.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Data Início</label>
          <input type="date" value={filtroInicio} onChange={e => setFiltroInicio(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-gray-50"/>
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Data Fim</label>
          <input type="date" value={filtroFim} onChange={e => setFiltroFim(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-gray-50"/>
        </div>
        {(filtroMotorista || filtroPlaca || filtroInicio || filtroFim) && (
          <div className="md:col-span-4 flex justify-end">
            <button onClick={() => { setFiltroMotorista(''); setFiltroPlaca(''); setFiltroInicio(''); setFiltroFim('') }}
              className="text-xs text-red-600 hover:underline font-semibold">Limpar filtros</button>
          </div>
        )}
      </div>

      {abastecimentos.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
          <Fuel size={32} className="mx-auto text-gray-200 mb-2"/>
          <p className="text-sm text-gray-400">Nenhum abastecimento registrado ainda.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full table-fixed">
            <thead className="bg-gray-50">
              <tr>
                <th className="w-24 px-4 py-3 text-left text-xs font-black text-gray-500 uppercase">Data</th>
                <th className="w-24 px-4 py-3 text-left text-xs font-black text-gray-500 uppercase">Caminhão</th>
                <th className="w-40 px-4 py-3 text-left text-xs font-black text-gray-500 uppercase">Motorista</th>
                <th className="px-4 py-3 text-left text-xs font-black text-gray-500 uppercase">Posto</th>
                <th className="w-24 px-4 py-3 text-left text-xs font-black text-gray-500 uppercase">KM</th>
                <th className="w-28 px-4 py-3 text-right text-xs font-black text-gray-500 uppercase">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtrados.map(a => (
                <tr key={a.id} onClick={() => selecionar(a)} className="hover:bg-gray-50 transition-colors cursor-pointer">
                  <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{fmtData(a.data)}</td>
                  <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{a.caminhao_placa}</td>
                  <td className="px-4 py-3 text-sm text-gray-900 truncate max-w-0">{a.motorista}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 truncate max-w-0">{a.posto}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{a.km ? a.km.toLocaleString('pt-BR') : '—'}</td>
                  <td className="px-4 py-3 text-sm font-bold text-red-600 text-right whitespace-nowrap">
                    R$ {(a.total||0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50">
            <p className="text-xs text-gray-400">{filtrados.length} registro(s)</p>
            <p className="text-sm font-bold text-gray-700">
              Total: <span className="text-red-600">R$ {totalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            </p>
          </div>
        </div>
      )}

      {/* ── MODAL PROFROTAS ── */}
      {mostraProfrotas && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-5 bg-blue-600 flex items-center justify-between">
              <div>
                <h2 className="text-white font-black text-lg uppercase tracking-tight">Importar Profrotas</h2>
                <p className="text-blue-200 text-xs mt-0.5">Apenas transações autorizadas serão importadas</p>
              </div>
              <button onClick={() => { setMostraProfrotas(false); setResultadoImport(null) }}
                className="text-white/80 hover:text-white">
                <X size={24}/>
              </button>
            </div>

            <div className="p-6 space-y-4">
              {!resultadoImport ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Data Início</label>
                      <input type="date" value={profrotasInicio} onChange={e => setProfrotasInicio(e.target.value)}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"/>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Data Fim</label>
                      <input type="date" value={profrotasFim} onChange={e => setProfrotasFim(e.target.value)}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"/>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400">⚠️ O período máximo permitido pela Profrotas é de 2 meses.</p>
                  <button onClick={importarProfrotas} disabled={importando || !profrotasInicio || !profrotasFim}
                    className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-black text-sm uppercase tracking-widest transition disabled:opacity-50">
                    {importando
                      ? <><Loader2 size={16} className="animate-spin"/> Importando...</>
                      : <><Download size={16}/> Importar Abastecimentos</>}
                  </button>
                </>
              ) : (
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                    <span className="text-3xl">✅</span>
                  </div>
                  <div>
                    <p className="text-xl font-black text-gray-900">{resultadoImport.importados} importados</p>
                    <p className="text-sm text-gray-400 mt-1">
                      {resultadoImport.ignorados} já existiam · {resultadoImport.total} autorizados no período
                    </p>
                  </div>
                  <button onClick={() => { setMostraProfrotas(false); setResultadoImport(null) }}
                    className="w-full bg-gray-900 text-white py-3 rounded-xl font-black text-sm uppercase tracking-widest hover:bg-black transition">
                    Fechar
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}