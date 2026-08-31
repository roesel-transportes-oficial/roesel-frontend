'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '../services/supabase'
import { useAuth } from '../services/auth'
import { Save, Trash2, ArrowLeft, FileText, DollarSign, CheckCircle, Clock, User, Building2, MapPin, Truck, Calendar, AlertCircle, Loader2, Download } from 'lucide-react'
import * as XLSX from 'xlsx'

interface Contrato {
  id: string; contrato: string; data: string; cliente: string
  cliente_nome_completo: string; cnpj: string; motorista: string
  cpf_motorista: string; placa: string; placa_carreta: string
  frota: string; origem: string; destino: string; fat_bruto: number
  qtd_veiculos: number; chapa: number; status: string; obs: string
  adiantamento_pago: boolean; dt_pagamento: string
}

interface Motorista { id: string; nome: string; cpf?: string; caminhao_id?: string }
interface Cliente { id: string; nome: string; cnpj: string }
interface Carreta { id: string; placa: string }

function nomeEmpresaSemIdentificador(valor: string) {
  return (valor || '')
    // Remove CNPJ quando ele vier junto do texto da empresa.
    .replace(/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g, '')
    // Remove código numérico no início, como "819-".
    .replace(/^\s*\d+\s*[-–—:]\s*/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function empresaDoContrato(contrato: Contrato) {
  return nomeEmpresaSemIdentificador(contrato.cliente_nome_completo || contrato.cliente || '')
}

const InputClass = "mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-red-500 bg-gray-50"
const LabelClass = "text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5"

export default function ContratosPage() {
  const { perm } = useAuth()
  const containerRef = useRef<HTMLDivElement>(null)
  const [contratos, setContratos] = useState<Contrato[]>([])
  const [motoristas, setMotoristas] = useState<Motorista[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [carretas, setCarretas] = useState<Carreta[]>([])
  const [sel, setSel] = useState<Contrato | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingLista, setLoadingLista] = useState(false)
  const [msg, setMsg] = useState('')
  const [confirmExcluir, setConfirmExcluir] = useState(false)
  const [filtroContrato, setFiltroContrato] = useState('')
  const [filtroMotorista, setFiltroMotorista] = useState('')
  const [filtroEmpresa, setFiltroEmpresa] = useState('')
  const [filtroInicio, setFiltroInicio] = useState('')
  const [filtroFim, setFiltroFim] = useState('')

  const [editData, setEditData] = useState('')
  const [editCliente, setEditCliente] = useState('')
  const [editCnpj, setEditCnpj] = useState('')
  const [editMotorista, setEditMotorista] = useState('')
  const [editPlaca, setEditPlaca] = useState('')
  const [editPlacaCarreta, setEditPlacaCarreta] = useState('')
  const [editFrota, setEditFrota] = useState('')
  const [editOrigem, setEditOrigem] = useState('')
  const [editDestino, setEditDestino] = useState('')
  const [editFatBruto, setEditFatBruto] = useState('')
  const [editQtdVeiculos, setEditQtdVeiculos] = useState('')
  const [editChapa, setEditChapa] = useState('')
  const [editStatus, setEditStatus] = useState('ABERTO')
  const [editObs, setEditObs] = useState('')
  const [editAdiantamentoPago, setEditAdiantamentoPago] = useState(false)
  const [editDtPagamento, setEditDtPagamento] = useState('')

  // ✅ Guarda contra corrida entre chamadas concorrentes de fetch_().
  // Existem DOIS useEffects que chamam fetch_() (filtro de mês/ano e o
  // MutationObserver de troca de aba). Se os dois dispararem quase ao
  // mesmo tempo, a resposta mais lenta podia "vencer" por último e
  // travar o loading pra sempre, mesmo com os dados já carregados pela
  // chamada mais rápida. Agora cada chamada tem um ID; só a chamada
  // MAIS RECENTE tem permissão de atualizar o estado — respostas
  // desatualizadas de chamadas antigas são simplesmente ignoradas.
  const fetchIdRef = useRef(0)

  async function fetch_() {
    const meuId = ++fetchIdRef.current
    setLoadingLista(true)
    try {
      let query = supabase
        .from('contratos')
        .select('id, contrato, data, cliente, cliente_nome_completo, cnpj, motorista, cpf_motorista, placa, placa_carreta, frota, origem, destino, fat_bruto, qtd_veiculos, chapa, status, obs, adiantamento_pago, dt_pagamento')
        .order('data', { ascending: true })

      const { data, error } = await query

      // Se já rodou outra chamada mais nova enquanto esta esperava a
      // resposta, esta aqui está obsoleta — não mexe em mais nada.
      if (meuId !== fetchIdRef.current) return

      if (error) {
        console.error('Erro ao buscar contratos:', error)
        return
      }
      if (data) setContratos(data as Contrato[])
    } catch (error) {
      if (meuId === fetchIdRef.current) console.error('Erro ao buscar contratos:', error)
    } finally {
      // Só a chamada mais recente pode desligar o loading. Uma chamada
      // antiga que termina depois (ou trava) não pode mais interferir.
      if (meuId === fetchIdRef.current) setLoadingLista(false)
    }
  }

  // Carrega dados estáticos (motoristas, clientes, carretas) apenas uma vez na montagem do componente
  useEffect(() => {
    const carregarDadosEstaticos = async () => {
      try {
        const [motoristasRes, clientesRes, carretasRes] = await Promise.all([
          supabase.from('motoristas').select('id, nome, cpf, caminhao_id').order('nome'),
          supabase.from('clientes').select('id, nome, cnpj').order('nome'),
          supabase.from('carretas').select('id, placa').order('placa')
        ])

        if (motoristasRes.data) setMotoristas(motoristasRes.data)
        if (clientesRes.data) setClientes(clientesRes.data)
        if (carretasRes.data) setCarretas(carretasRes.data)
      } catch (error) {
        console.error('Erro ao carregar dados estáticos:', error)
      }
    }

    carregarDadosEstaticos()
  }, []) // Sem dependências - carrega apenas uma vez

  // ✅ Detecta quando a aba volta a ficar visível (saiu do display:none no page.tsx)
  // e recarrega a lista — resolve o "contrato novo não aparece na lista"
  useEffect(() => {
    const container = containerRef.current
    const parent = container?.parentElement
    if (!parent) return

    const observer = new MutationObserver(() => {
      if (parent.style.display !== 'none') {
        fetch_()
      }
    })
    observer.observe(parent, { attributes: true, attributeFilter: ['style'] })
    return () => observer.disconnect()
  }, [])

  function handleSelectCliente(id: string) {
    const clienteEncontrado = clientes.find(c => c.id === id)
    if (clienteEncontrado) {
      setEditCliente(clienteEncontrado.nome)
      setEditCnpj(fmtCNPJ(clienteEncontrado.cnpj || ''))
    } else {
      setEditCliente('')
      setEditCnpj('')
    }
  }

  // ✅ CORRIGIDO: antes pegava o caminhão ATUAL do motorista
  // (motoristas.caminhao_id), o que está errado pra contratos
  // antigos — se o motorista já trocou de caminhão desde então, vinha
  // a placa errada. Agora consulta o historico_motorista_caminhao
  // pela DATA do contrato, achando o caminhão que ele realmente
  // dirigia naquele dia. Só cai pro caminhão atual se não achar nada
  // no histórico pra aquela data (ex: contrato de hoje mesmo).
  async function handleSelectMotorista(nome: string, dataContrato?: string) {
    setEditMotorista(nome)
    if (!nome) { setEditPlaca(''); return }

    const dataParaBuscar = dataContrato !== undefined ? dataContrato : editData

    if (dataParaBuscar) {
      const { data: hist } = await supabase
        .from('historico_motorista_caminhao')
        .select('caminhao_placa')
        .eq('motorista_nome', nome)
        .lte('data_inicio', dataParaBuscar)
        .or(`data_fim.is.null,data_fim.gte.${dataParaBuscar}`)
        .order('data_inicio', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (hist?.caminhao_placa) {
        setEditPlaca(hist.caminhao_placa)
        return
      }
    }

    // Sem histórico pra essa data — usa o caminhão atual do motorista como último recurso
    const mot = motoristas.find(m => m.nome === nome)
    if (mot?.caminhao_id) {
      const { data } = await supabase.from('caminhoes').select('placa').eq('id', mot.caminhao_id).maybeSingle()
      if (data) setEditPlaca(data.placa)
    } else {
      setEditPlaca('')
    }
  }

  const filtrados = useMemo(() => contratos
    .filter(c => {
        const numeroBusca = filtroContrato.trim().toLowerCase()
        if (numeroBusca && !String(c.contrato || '').toLowerCase().includes(numeroBusca)) return false
        if (filtroMotorista && c.motorista !== filtroMotorista) return false
        if (filtroEmpresa && empresaDoContrato(c) !== filtroEmpresa) return false
        if (filtroInicio && c.data < filtroInicio) return false
      if (filtroFim && c.data > filtroFim) return false
      return true
    })
    .sort((a, b) => a.data.localeCompare(b.data)),
    [contratos, filtroContrato, filtroMotorista, filtroEmpresa, filtroInicio, filtroFim]
  )

  const empresasUnicas = useMemo(() =>
    [...new Set(contratos.map(empresaDoContrato).filter(Boolean))].sort()
  , [contratos])

  function selecionar(c: Contrato) {
    setSel(c)
    setEditData(c.data || '')
    setEditCliente(c.cliente || '')
    setEditCnpj(fmtCNPJ(c.cnpj || ''))
    setEditMotorista(c.motorista || '')
    setEditPlaca(c.placa || '')
    setEditPlacaCarreta(c.placa_carreta || '')
    setEditFrota(c.frota || '')
    setEditOrigem(c.origem || '')
    setEditDestino(c.destino || '')
    setEditFatBruto(String(c.fat_bruto || ''))
    setEditQtdVeiculos(String(c.qtd_veiculos || ''))
    setEditChapa(String(c.chapa || ''))
    setEditStatus(c.status || 'ABERTO')
    setEditObs(c.obs || '')
    setEditAdiantamentoPago(c.adiantamento_pago || false)
    setEditDtPagamento(c.dt_pagamento || '')
    setConfirmExcluir(false)
  }

  function voltar() { setSel(null); setConfirmExcluir(false) }
  function showMsg(t: string) { setMsg(t); setTimeout(() => setMsg(''), 3000) }

  // ✅ CORRIGIDO: antes, salvar() e excluir() esperavam um fetch_()
  // completo (busca TODOS os contratos de novo) antes de mostrar
  // qualquer resultado — com 130+ contratos novos da importação
  // AUTOPORT, isso ficou visivelmente lento. Agora atualiza a lista
  // que já está na tela diretamente (sem esperar o servidor confirmar
  // de novo), então a resposta é instantânea. O servidor já foi
  // atualizado de verdade antes disso — só não perdemos tempo
  // buscando tudo de novo pra mostrar o que já sabemos que mudou.
  // ✅ CORRIGIDO: o .abortSignal() usado antes desligava sem querer o
  // retry automático que já existe pra conexão fria (services/supabase.ts)
  // — passar um "signal" próprio faz aquele sistema pular a própria
  // tentativa extra e fazer só UMA tentativa. Trocado por um timeout
  // "por fora" (Promise.race), que não interfere no retry — assim a
  // chamada continua tentando de novo sozinha se a rede estiver fria,
  // e só mostra erro se REALMENTE não conseguir depois de tentar.
  async function comTimeout<T = any>(promessa: PromiseLike<T>, ms: number): Promise<T> {
    let timeoutId: ReturnType<typeof setTimeout>
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('TIMEOUT')), ms)
    })
    try {
      return await Promise.race([Promise.resolve(promessa), timeoutPromise])
    } finally {
      clearTimeout(timeoutId!)
    }
  }

  async function salvar() {
    if (!sel) return
    setLoading(true)
    try {
      const dadosAtualizados = {
        data: editData,
        cliente: editCliente,
        cliente_nome_completo: editCliente,
        cnpj: editCnpj.replace(/\D/g, ''),
        motorista: editMotorista,
        placa: editPlaca,
        placa_carreta: editPlacaCarreta,
        frota: editFrota,
        origem: editOrigem,
        destino: editDestino,
        fat_bruto: parseFloat(editFatBruto) || 0,
        qtd_veiculos: parseInt(editQtdVeiculos) || 0,
        chapa: parseInt(editChapa) || 0,
        status: editStatus,
        obs: editObs,
        adiantamento_pago: editAdiantamentoPago,
        dt_pagamento: editDtPagamento || '',
      }

      if (perm !== 'demo') {
        // ✅ O banco exige NULL pra campo de data vazio (não aceita
        // string vazia "" — dá erro "invalid input syntax for type
        // date"). Por isso manda um objeto separado pro Supabase,
        // enquanto o estado local (dadosAtualizados) continua com
        // string vazia pra bater com o tipo do TypeScript.
        const dadosParaBanco = { ...dadosAtualizados, dt_pagamento: editDtPagamento || null }
        const { error } = await comTimeout<any>(
          supabase.from('contratos').update(dadosParaBanco).eq('id', sel.id),
          25000
        )
        if (error) throw error
      }

      setContratos(prev => prev.map(c => c.id === sel.id ? { ...c, ...dadosAtualizados } : c))
      showMsg('✅ Atualizado!')
      voltar()
    } catch (error: any) {
      console.error(error)
      if (error?.message === 'TIMEOUT') {
        showMsg('⏱️ Demorou demais pra salvar. Verifique sua conexão e tente novamente.')
      } else {
        showMsg('❌ Erro ao salvar: ' + (error?.message || ''))
      }
    } finally {
      setLoading(false)
    }
  }

  async function excluir() {
    if (!sel) return
    setLoading(true)
    try {
      if (perm !== 'demo') {
        const { error } = await comTimeout<any>(
          supabase.from('contratos').delete().eq('id', sel.id),
          25000
        )
        if (error) throw error
      }
      setContratos(prev => prev.filter(c => c.id !== sel.id))
      showMsg('Contrato excluído.')
      voltar()
    } catch (error: any) {
      if (error?.message === 'TIMEOUT') {
        showMsg('⏱️ Demorou demais pra excluir. Verifique sua conexão e tente novamente.')
      } else {
        showMsg('❌ Erro ao excluir: ' + (error?.message || ''))
      }
    } finally {
      setLoading(false)
    }
  }

  const totalFat = filtrados.reduce((s, c) => s + (c.fat_bruto || 0), 0)
  const abertos = filtrados.filter(c => c.status === 'ABERTO').length
  const pagos = filtrados.filter(c => c.status === 'PAGO').length

  function fmtData(d: string) {
    if (!d) return ''
    const [y, m, dia] = d.split('-')
    return `${dia}/${m}/${y}`
  }

  function fmtCNPJ(v: string) {
    if (!v) return ''
    const n = v.replace(/\D/g, '')
    return n
      .replace(/^(\d{2})(\d)/, "$1.$2")
      .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1/$2")
      .replace(/(\d{4})(\d)/, "$1-$2")
      .substring(0, 18)
  }

  function exportarExcel() {
    if (filtrados.length === 0) {
      showMsg('⚠️ Não há contratos para exportar com os filtros atuais.')
      return
    }

    const dados = filtrados.map(c => ({
      'Nº Contrato': c.contrato || '',
      Data: c.data ? new Date(`${c.data}T00:00:00`) : null,
      Motorista: c.motorista || '',
      'CPF Motorista': c.cpf_motorista || '',
      Empresa: empresaDoContrato(c),
      CNPJ: c.cnpj || '',
      'Placa Cavalo': c.placa || '',
      'Placa Carreta': c.placa_carreta || '',
      Frota: c.frota || '',
      Origem: c.origem || '',
      Destino: c.destino || '',
      'Faturamento Bruto': Number(c.fat_bruto || 0),
      'Qtd. Veículos': Number(c.qtd_veiculos || 0),
      Chapa: Number(c.chapa || 0),
      Status: c.status || '',
      'Adiantamento Pago': c.adiantamento_pago ? 'Sim' : 'Não',
      'Data de Pagamento': c.dt_pagamento ? new Date(`${c.dt_pagamento}T00:00:00`) : null,
      Observações: c.obs || '',
    }))

    const planilha = XLSX.utils.json_to_sheet(dados)
    const ultimaLinha = dados.length + 1
    planilha['!cols'] = [
      { wch: 16 }, { wch: 12 }, { wch: 28 }, { wch: 18 }, { wch: 32 }, { wch: 18 },
      { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 22 }, { wch: 22 }, { wch: 20 },
      { wch: 15 }, { wch: 12 }, { wch: 14 }, { wch: 20 }, { wch: 20 }, { wch: 42 },
    ]
    planilha['!autofilter'] = { ref: `A1:R${ultimaLinha}` }

    for (let linha = 2; linha <= ultimaLinha; linha++) {
      for (const coluna of ['B', 'Q']) {
        const celula = planilha[`${coluna}${linha}`]
        if (celula?.v instanceof Date) celula.z = 'dd/mm/yyyy'
      }
      const faturamento = planilha[`L${linha}`]
      if (faturamento) faturamento.z = '#,##0.00'
      for (const coluna of ['M', 'N']) {
        const celula = planilha[`${coluna}${linha}`]
        if (celula) celula.z = '#,##0'
      }
    }

    const livro = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(livro, planilha, 'Contratos')
    XLSX.writeFile(livro, `contratos_${new Date().toISOString().split('T')[0]}.xlsx`)
    showMsg(`✅ Excel exportado com ${filtrados.length} contrato(s).`)
  }

  return (
    <div ref={containerRef} className="p-6 max-w-full bg-gray-50 min-h-screen">
      {msg && (
        <div className="fixed top-6 right-6 z-50 p-4 bg-green-600 text-white rounded-2xl shadow-2xl font-black text-xs uppercase tracking-widest animate-bounce">
          {msg}
        </div>
      )}

      {sel ? (
        <div className="max-w-4xl mx-auto">
          <button onClick={voltar} className="flex items-center gap-2 text-gray-400 hover:text-red-600 mb-6 text-xs font-black uppercase tracking-widest transition-all">
            <ArrowLeft size={16}/> Voltar para lista
          </button>

          <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
            <div className={`px-8 py-8 flex items-center justify-between bg-gradient-to-br ${
              editStatus === 'PAGO' ? 'from-green-600 to-green-800' :
              editStatus === 'CANCELADO' ? 'from-gray-600 to-gray-800' :
              'from-red-600 to-red-800'
            }`}>
              <div className="flex items-center gap-6">
                <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white shadow-inner">
                  <FileText size={32} />
                </div>
                <div>
                  <h2 className="text-white font-black text-3xl tracking-tighter">CONTRATO #{sel.contrato}</h2>
                  <p className="text-white/70 text-xs font-bold uppercase tracking-widest">{editCliente || 'Cliente não informado'}</p>
                </div>
              </div>
              <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl border border-white/20">
                <p className="text-white/60 text-[10px] font-black uppercase tracking-widest mb-1">Status Atual</p>
                <p className="text-white font-black text-sm">{editStatus}</p>
              </div>
            </div>

            <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className={LabelClass}><Calendar size={12}/> Data do Contrato</label>
                    <input type="date" value={editData} onChange={e => { setEditData(e.target.value); if (editMotorista) handleSelectMotorista(editMotorista, e.target.value) }} className={InputClass} />
                  </div>
                  <div className="space-y-1">
                    <label className={LabelClass}><Clock size={12}/> Status</label>
                    <select value={editStatus} onChange={e => setEditStatus(e.target.value)} className={InputClass}>
                      <option>ABERTO</option>
                      <option>PAGO</option>
                      <option>CANCELADO</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className={LabelClass}><Building2 size={12}/> Cliente</label>
                  <select
                    value={clientes.find(c => c.nome === editCliente && (c.cnpj || '').replace(/\D/g, '') === editCnpj.replace(/\D/g, ''))?.id || ""}
                    onChange={e => handleSelectCliente(e.target.value)}
                    className={InputClass}
                  >
                    <option value="">Selecione o cliente...</option>
                    {clientes.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.nome} {c.cnpj ? ` - ${fmtCNPJ(c.cnpj)}` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className={LabelClass}>CNPJ do Cliente</label>
                  <input
                    value={editCnpj}
                    onChange={e => setEditCnpj(fmtCNPJ(e.target.value))}
                    className={InputClass}
                    placeholder="00.000.000/0000-00"
                  />
                </div>

                <div className="space-y-1">
                  <label className={LabelClass}><User size={12}/> Motorista Responsável</label>
                  <select value={editMotorista} onChange={e => handleSelectMotorista(e.target.value)} className={InputClass}>
                    <option value="">Selecione o motorista...</option>
                    {motoristas.map(m => <option key={m.id} value={m.nome}>{m.nome}</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className={LabelClass}><Truck size={12}/> Placa Cavalo</label>
                    <input value={editPlaca} onChange={e => setEditPlaca(e.target.value.toUpperCase())} className={InputClass} />
                  </div>
                  <div className="space-y-1">
                    <label className={LabelClass}><Truck size={12}/> Placa Carreta</label>
                    <select value={editPlacaCarreta} onChange={e => setEditPlacaCarreta(e.target.value)} className={InputClass}>
                      <option value="">Selecione a carreta...</option>
                      {carretas.map(c => <option key={c.id} value={c.placa}>{c.placa}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className={LabelClass}>Frota</label>
                    <input value={editFrota} onChange={e => setEditFrota(e.target.value)} className={InputClass} />
                  </div>
                  <div className="space-y-1">
                    <label className={LabelClass}>Qtd. Veículos</label>
                    <input type="number" value={editQtdVeiculos} onChange={e => setEditQtdVeiculos(e.target.value)} className={InputClass} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className={LabelClass}><MapPin size={12}/> Origem</label>
                    <input value={editOrigem} onChange={e => setEditOrigem(e.target.value)} className={InputClass} />
                  </div>
                  <div className="space-y-1">
                    <label className={LabelClass}><MapPin size={12}/> Destino</label>
                    <input value={editDestino} onChange={e => setEditDestino(e.target.value)} className={InputClass} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className={LabelClass}><DollarSign size={12}/> Faturamento Bruto</label>
                    <input type="number" step="0.01" value={editFatBruto} onChange={e => setEditFatBruto(e.target.value)} className={InputClass} />
                  </div>
                  <div className="space-y-1">
                    <label className={LabelClass}>Chapa</label>
                    <input type="number" value={editChapa} onChange={e => setEditChapa(e.target.value)} className={InputClass} />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className={LabelClass}>Observações</label>
                  <textarea value={editObs} onChange={e => setEditObs(e.target.value)} rows={3} className={InputClass} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-3 p-3 bg-gray-100 rounded-xl">
                    <input
                      type="checkbox"
                      checked={editAdiantamentoPago}
                      onChange={e => setEditAdiantamentoPago(e.target.checked)}
                      className="w-5 h-5 rounded border-gray-300"
                    />
                    <label className={LabelClass + ' m-0'}>Adiantamento Pago</label>
                  </div>
                  <div className="space-y-1">
                    <label className={LabelClass}>Data de Pagamento</label>
                    <input type="date" value={editDtPagamento} onChange={e => setEditDtPagamento(e.target.value)} className={InputClass} />
                  </div>
                </div>
              </div>
            </div>

            <div className="px-8 py-6 bg-gray-50 border-t border-gray-100 flex gap-4 justify-end">
              <button
                onClick={voltar}
                className="px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest border border-gray-200 text-gray-600 hover:bg-gray-100 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={() => setConfirmExcluir(true)}
                className="px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest bg-red-100 text-red-600 hover:bg-red-200 transition-all flex items-center gap-2"
              >
                <Trash2 size={14} /> Excluir
              </button>
              <button
                onClick={salvar}
                disabled={loading}
                className="px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest bg-red-600 text-white hover:bg-red-700 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Salvar
              </button>
            </div>

            {confirmExcluir && (
              <div className="px-8 py-6 bg-red-50 border-t border-red-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertCircle size={20} className="text-red-600" />
                  <p className="text-sm font-bold text-red-700">Tem certeza que deseja excluir este contrato?</p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setConfirmExcluir(false)}
                    className="px-4 py-2 rounded-lg font-black text-xs uppercase tracking-widest border border-red-300 text-red-600 hover:bg-red-100 transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={excluir}
                    disabled={loading}
                    className="px-4 py-2 rounded-lg font-black text-xs uppercase tracking-widest bg-red-600 text-white hover:bg-red-700 transition-all disabled:opacity-50"
                  >
                    {loading ? 'Excluindo...' : 'Confirmar Exclusão'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="max-w-full">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-8">
              <div>
                <h1 className="text-4xl font-black text-gray-900 tracking-tighter mb-2">Contratos</h1>
                <p className="text-sm text-gray-500 font-bold uppercase tracking-widest">Gerencie todos os contratos de fretes</p>
              </div>
              <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto flex-wrap">
                <input
                  type="search"
                  value={filtroContrato}
                  onChange={e => setFiltroContrato(e.target.value)}
                  placeholder="Buscar nº do contrato..."
                  aria-label="Buscar pelo número do contrato"
                  className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-red-500 bg-white md:w-56"
                />
                <select value={filtroMotorista} onChange={e => setFiltroMotorista(e.target.value)}
                  className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-red-500 bg-white">
                  <option value="">Todos os motoristas</option>
                  {motoristas.map(m => <option key={m.id} value={m.nome}>{m.nome}</option>)}
                </select>
                <select value={filtroEmpresa} onChange={e => setFiltroEmpresa(e.target.value)}
                  className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-red-500 bg-white">
                  <option value="">Todas as empresas</option>
                  {empresasUnicas.map(empresa => <option key={empresa} value={empresa}>{empresa}</option>)}
                </select>
                <input type="date" value={filtroInicio} onChange={e => setFiltroInicio(e.target.value)}
                  aria-label="Data inicial"
                  className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-red-500 bg-white" />
                <input type="date" value={filtroFim} onChange={e => setFiltroFim(e.target.value)}
                  aria-label="Data final"
                  className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-red-500 bg-white" />
                <button onClick={exportarExcel} disabled={filtrados.length === 0}
                  className="flex items-center justify-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-sm font-black uppercase hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed">
                  <Download size={16}/> Excel
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Faturamento Total</p>
                    <p className="text-2xl font-black text-gray-900">{totalFat.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                  </div>
                  <DollarSign size={32} className="text-red-200" />
                </div>
              </div>

              <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Contratos Abertos</p>
                    <p className="text-2xl font-black text-gray-900">{abertos}</p>
                  </div>
                  <Clock size={32} className="text-yellow-200" />
                </div>
              </div>

              <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Contratos Pagos</p>
                    <p className="text-2xl font-black text-gray-900">{pagos}</p>
                  </div>
                  <CheckCircle size={32} className="text-green-200" />
                </div>
              </div>
            </div>

            {loadingLista ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={32} className="animate-spin text-red-600" />
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="px-8 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Contrato</th>
                      <th className="px-8 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Motorista</th>
                      <th className="px-8 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Rota</th>
                      <th className="px-8 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Faturamento</th>
                      <th className="px-8 py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filtrados.map(c => (
                      <tr key={c.id} onClick={() => selecionar(c)} className="group hover:bg-red-50 cursor-pointer transition-colors">
                        <td className="px-8 py-5">
                          <p className="text-sm font-black text-gray-900 group-hover:text-red-600 transition-colors">#{c.contrato}</p>
                          <p className="text-[10px] font-bold text-gray-400 uppercase">{fmtData(c.data)}</p>
                        </td>
                        <td className="px-8 py-5">
                          <p className="text-sm font-black text-gray-800">{c.motorista}</p>
                          <p className="text-[10px] font-bold text-gray-400 uppercase truncate max-w-[200px]">{c.cliente}</p>
                        </td>
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-red-600 uppercase">{c.origem || '—'}</span>
                            <ArrowLeft size={10} className="rotate-180 text-gray-300" />
                            <span className="text-[10px] font-black text-red-600 uppercase">{c.destino || '—'}</span>
                          </div>
                          <p className="text-[9px] font-bold text-gray-400 uppercase mt-1">Placa: {c.placa}</p>
                        </td>
                        <td className="px-8 py-5">
                          <p className="text-sm font-black text-gray-900">{(c.fat_bruto || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                        </td>
                        <td className="px-8 py-5 text-right">
                          <span className={`inline-block px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${
                            c.status === 'PAGO' ? 'bg-green-100 text-green-700' :
                            c.status === 'CANCELADO' ? 'bg-gray-100 text-gray-600' :
                            'bg-yellow-100 text-yellow-700'
                          }`}>{c.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}