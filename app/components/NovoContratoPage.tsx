'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../services/supabase'

export default function NovoContratoPage({ setAba }: { setAba: (aba: string) => void }) {
  const [motoristas, setMotoristas] = useState<any[]>([])
  const [clientes, setClientes]     = useState<any[]>([])
  const [caminhoes, setCaminhoes]   = useState<any[]>([])
  const [carretas, setCarretas]     = useState<any[]>([])
  const [loading, setLoading]       = useState(false)
  const [loadingIA, setLoadingIA]   = useState(false)
  const [erro, setErro]             = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const [placaLidaIA, setPlacaLidaIA]               = useState('')
  const [placaCarretaLidaIA, setPlacaCarretaLidaIA] = useState('')
  const [contratoLidoIA, setContratoLidoIA]         = useState(false)
  const [camposIAAtivos, setCamposIAAtivos]         = useState(false)

  const [form, setForm] = useState({
    motorista: '', cliente: '', cnpj: '', placa: '', placa_carreta: '',
    frota: '', contrato: '', data: '', fat_bruto: '', chapa: '',
    origem: '', destino: '', qtd_veiculos: '', adiantamento_pago: false,
    dt_pagamento: '', status: 'ABERTO', obs: '',
  })

  useEffect(() => {
    Promise.all([
      fetchMotoristas(),
      fetchClientes(),
      fetchCaminhoes(),
      fetchCarretas(),
    ])
  }, [])

  async function fetchMotoristas() {
    const { data } = await supabase.from('motoristas').select('*').order('nome')
    if (data) setMotoristas(data)
  }

  async function fetchClientes(): Promise<any[]> {
    const { data } = await supabase.from('clientes').select('*').order('nome')
    const lista = data || []
    setClientes(lista)
    return lista
  }

  async function fetchCaminhoes() {
    const { data } = await supabase.from('caminhoes').select('*').order('placa')
    if (data) setCaminhoes(data)
  }

  async function fetchCarretas() {
    const { data } = await supabase.from('carretas').select('*').order('placa')
    if (data) setCarretas(data)
  }

  // ─── Regra do Chapa ──────────────────────────────────────────────────────
  function calcularChapa(destino: string, cliente: string): string {
    const d = destino.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    const c = cliente.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

    const semChapa =
      d.includes('IGARAPE') ||
      d.includes('BETIM') ||
      d.includes('GUARUJA') ||
      d.includes('SANTOS') ||
      (c.includes('AUTOPORT') && d.includes('JUIZ DE FORA'))

    return semChapa ? '0' : '250'
  }

  function handle(e: any) {
    const { name, value, type, checked } = e.target
    const novo = type === 'checkbox' ? checked : value

    setForm(f => {
      const atualizado = { ...f, [name]: novo }
      // Recalcula chapa automaticamente quando muda destino ou cliente
      if (name === 'destino' || name === 'cliente') {
        atualizado.chapa = calcularChapa(
          name === 'destino' ? novo : f.destino,
          name === 'cliente' ? novo : f.cliente
        )
      }
      return atualizado
    })
  }

  function selecionarCliente(valor: string) {
    if (!valor) {
      setForm(f => ({ ...f, cliente: '', cnpj: '', chapa: calcularChapa(f.destino, '') }))
      return
    }
    const [nome, cnpj] = valor.split('||')
    const cliente = clientes.find(c => c.nome === nome && (c.cnpj || '') === cnpj)
    setForm(f => ({
      ...f,
      cliente: nome,
      cnpj: cliente?.cnpj ? formatCnpj(cliente.cnpj) : '',
      chapa: calcularChapa(f.destino, nome),
    }))
  }

  function formatCnpj(v: string) {
    const d = v.replace(/\D/g, '').slice(0, 14)
    if (d.length <= 2) return d
    if (d.length <= 5) return `${d.slice(0,2)}.${d.slice(2)}`
    if (d.length <= 8) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5)}`
    if (d.length <= 12) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8)}`
    return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`
  }

  function normalizar(s: string) {
    return s.trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  }

  function similaridade(a: string, b: string): number {
    if (a === b) return 1
    if (!a.length || !b.length) return 0
    const longer = a.length > b.length ? a : b
    const shorter = a.length > b.length ? b : a
    let matches = 0
    for (let i = 0; i < shorter.length; i++) { if (longer.includes(shorter[i])) matches++ }
    return matches / longer.length
  }

  function nomesSaoParecidos(nomeA: string, nomeB: string): boolean {
    const a = normalizar(nomeA); const b = normalizar(nomeB)
    const palavrasA = a.split(' ').filter(p => p.length > 3)
    const palavrasB = b.split(' ').filter(p => p.length > 3)
    const emComum = palavrasA.filter(p => palavrasB.some(pb =>
      pb === p || (pb.length > 3 && p.length > 3 && pb.slice(0,-1) === p.slice(0,-1))
    ))
    return emComum.length >= 2
  }

  function encontrarClienteLista(lista: any[], nomeIA: string, cnpjIA?: string, origemIA?: string) {
    if (!nomeIA && !cnpjIA) return null
    const nomeNorm = nomeIA ? normalizar(nomeIA) : ''

    if (cnpjIA) {
      const cnpjLimpo = cnpjIA.replace(/\D/g, '')
      if (cnpjLimpo.length === 14) {
        const found = lista.find(c => (c.cnpj || '').replace(/\D/g, '') === cnpjLimpo)
        if (found && nomeNorm && nomesSaoParecidos(nomeIA, found.nome)) return found
      }
      if (cnpjLimpo.length >= 8) {
        const base = cnpjLimpo.slice(0, 8)
        const porBase = lista.find(c => (c.cnpj || '').replace(/\D/g, '').startsWith(base))
        if (porBase && nomeNorm && nomesSaoParecidos(nomeIA, porBase.nome)) return porBase
      }
    }

    if (!nomeNorm) return null

    const todosExatos = lista.filter(c => normalizar(c.nome) === nomeNorm)
    if (todosExatos.length === 1) return todosExatos[0]
    if (todosExatos.length > 1) {
      if (origemIA) {
        const cidadeOrigem = normalizar(origemIA.split('-')[0].trim())
        const porCidade = todosExatos.find(c =>
          normalizar(c.cidade || '').includes(cidadeOrigem) || cidadeOrigem.includes(normalizar(c.cidade || ''))
        )
        if (porCidade) return porCidade
      }
      return todosExatos[0]
    }

    const todosContem = lista.filter(c => {
      const nomeCad = normalizar(c.nome)
      return nomeCad.includes(nomeNorm) || nomeNorm.includes(nomeCad)
    })
    if (todosContem.length === 1) return todosContem[0]
    if (todosContem.length > 1) {
      if (origemIA) {
        const cidadeOrigem = normalizar(origemIA.split('-')[0].trim())
        const porCidade = todosContem.find(c =>
          normalizar(c.cidade || '').includes(cidadeOrigem) || cidadeOrigem.includes(normalizar(c.cidade || ''))
        )
        if (porCidade) return porCidade
      }
      return todosContem[0]
    }

    const found = lista.find(c => {
      const nomeCad = normalizar(c.nome)
      const palavrasIA  = nomeNorm.split(' ').filter(p => p.length > 2)
      const palavrasCad = nomeCad.split(' ').filter(p => p.length > 2)
      const matches = palavrasIA.filter(pIA =>
        palavrasCad.some(pCad => {
          if (pCad === pIA) return true
          if (pCad.length === pIA.length && pCad.length > 3) {
            let diffs = 0
            for (let i = 0; i < pCad.length; i++) { if (pCad[i] !== pIA[i]) diffs++ }
            return diffs <= 1
          }
          return false
        })
      )
      return matches.length >= Math.max(2, Math.floor(palavrasIA.length * 0.6))
    })
    if (found) return found

    let melhorScore = 0, melhorCliente = null
    for (const c of lista) {
      const score = similaridade(normalizar(c.nome), nomeNorm)
      if (score > melhorScore && score > 0.85) { melhorScore = score; melhorCliente = c }
    }
    return melhorCliente
  }

  function encontrarMotorista(lista: any[], nomeIA: string): any | null {
    if (!nomeIA) return null
    const nomeNorm = normalizar(nomeIA)
    return lista.find(m => {
      const nomeBanco = normalizar(m.nome)
      if (nomeBanco === nomeNorm) return true
      if (nomeBanco.includes(nomeNorm) || nomeNorm.includes(nomeBanco)) return true
      const palavrasIA    = nomeNorm.split(' ').filter(Boolean)
      const palavrasBanco = nomeBanco.split(' ').filter(Boolean)
      const primeiroIA = palavrasIA[0] || ''; const ultimoIA = palavrasIA[palavrasIA.length - 1] || ''
      const primeiroBanco = palavrasBanco[0] || ''; const ultimoBanco = palavrasBanco[palavrasBanco.length - 1] || ''
      if (primeiroIA.length > 3 && primeiroBanco === primeiroIA && ultimoBanco === ultimoIA) return true
      if (palavrasIA.length >= 2 && palavrasIA.length === palavrasBanco.length) {
        let difTotal = 0
        for (let i = 0; i < palavrasIA.length; i++) {
          const a = palavrasIA[i], b = palavrasBanco[i]
          if (a === b) continue
          if (a.length !== b.length) { difTotal += 2; continue }
          let d = 0
          for (let j = 0; j < a.length; j++) if (a[j] !== b[j]) d++
          difTotal += d
        }
        if (difTotal <= 2) return true
      }
      return false
    }) || null
  }

  function normalizaPlaca(p: string): string {
    const clean = p.replace(/[^A-Z0-9]/gi, '').toUpperCase()
    if (clean.length === 7) {
      return (
        clean[0] + clean[1] + clean[2] +
        clean[3].replace(/O/g, '0').replace(/I/g, '1') +
        clean[4] +
        clean[5].replace(/O/g, '0').replace(/I/g, '1') +
        clean[6].replace(/O/g, '0').replace(/I/g, '1')
      )
    }
    return clean.replace(/O/g, '0').replace(/I/g, '1')
  }

  function diffChars(a: string, b: string): number {
    if (a.length !== b.length) return 99
    let diff = 0
    for (let i = 0; i < a.length; i++) { if (a[i] !== b[i]) diff++ }
    return diff
  }

  function encontrarPorPlaca(lista: any[], placaIA: string): any | null {
    if (!placaIA) return null
    const placaNorm = normalizaPlaca(placaIA)
    const exato = lista.find(c => normalizaPlaca(c.placa) === placaNorm)
    if (exato) return exato
    const umChar = lista.find(c => diffChars(normalizaPlaca(c.placa), placaNorm) <= 1)
    if (umChar) return umChar
    if (placaNorm.length >= 4) {
      const sufixo = placaNorm.slice(-4)
      const porSufixo = lista.find(c => normalizaPlaca(c.placa).endsWith(sufixo))
      if (porSufixo) return porSufixo
    }
    const doisChar = lista.find(c => diffChars(normalizaPlaca(c.placa), placaNorm) <= 2)
    if (doisChar) return doisChar
    if (placaNorm.length >= 5) {
      const prefixo = placaNorm.slice(0, 3); const sufixo2 = placaNorm.slice(-2)
      const porPS = lista.find(c => { const p = normalizaPlaca(c.placa); return p.startsWith(prefixo) && p.endsWith(sufixo2) })
      if (porPS) return porPS
    }
    if (placaNorm.length >= 3) {
      const prefixo = placaNorm.slice(0, 3)
      const porPrefixo = lista.find(c => { const p = normalizaPlaca(c.placa); return p.startsWith(prefixo) && Math.abs(p.length - placaNorm.length) <= 2 })
      if (porPrefixo) return porPrefixo
    }
    return null
  }

  function encontrarCaminhao(p: string) { return encontrarPorPlaca(caminhoes, p) }
  function encontrarCarreta(p: string)  { return encontrarPorPlaca(carretas, p) }

  async function lerComIA(e: any) {
    const file = e.target.files?.[0]
    if (!file) return
    setLoadingIA(true); setErro('')
    setPlacaLidaIA(''); setPlacaCarretaLidaIA('')
    setContratoLidoIA(false); setCamposIAAtivos(false)
    try {
      let clientesAtuais = clientes
      if (clientesAtuais.length === 0) clientesAtuais = await fetchClientes()

      const base64 = await new Promise<string>((res, rej) => {
        const r = new FileReader()
        r.onload = () => res((r.result as string).split(',')[1])
        r.onerror = () => rej()
        r.readAsDataURL(file)
      })

      const response = await fetch('/api/ler-contrato', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64, mediaType: file.type, isPDF: file.type === 'application/pdf' })
      })
      const parsed = await response.json()

      const motoristasAtivos    = motoristas.filter(m => m.ativo !== false)
      const motoristaEncontrado = encontrarMotorista(motoristasAtivos, parsed.motorista || '')
      const clienteEncontrado   = encontrarClienteLista(
        clientesAtuais,
        parsed.cliente_nome_completo || parsed.cliente || '',
        parsed.cnpj || '', parsed.origem || ''
      )
      const caminhaoEncontrado = encontrarCaminhao(parsed.placa || '')
      const carretaEncontrada  = encontrarCarreta(parsed.placa_carreta || '')

      const nomeCliente = clienteEncontrado?.nome || parsed.cliente_nome_completo || parsed.cliente || ''
      const destino     = parsed.destino || ''

      setPlacaLidaIA(parsed.placa || '')
      setPlacaCarretaLidaIA(parsed.placa_carreta || '')
      if (parsed.contrato) setContratoLidoIA(true)
      setCamposIAAtivos(true)

      setForm(f => ({
        ...f,
        ...Object.fromEntries(Object.entries(parsed).filter(([_, v]) => v !== '' && v !== null && v !== undefined)),
        motorista:     motoristaEncontrado ? motoristaEncontrado.nome : '',
        cliente:       nomeCliente,
        cnpj:          parsed.cnpj ? formatCnpj(parsed.cnpj) : clienteEncontrado?.cnpj ? formatCnpj(clienteEncontrado.cnpj) : '',
        placa:         caminhaoEncontrado ? caminhaoEncontrado.placa : '',
        placa_carreta: carretaEncontrada ? carretaEncontrada.placa : '',
        // ← Calcula chapa automaticamente com os dados da IA
        chapa: calcularChapa(destino, nomeCliente),
      }))
    } catch { setErro('Não foi possível ler o documento. Preencha manualmente.') }
    finally { setLoadingIA(false); if (fileRef.current) fileRef.current.value = '' }
  }

  async function salvar(e: any) {
    e.preventDefault(); setLoading(true); setErro('')
    try {
      const payload: any = { ...form }
      payload.fat_bruto    = parseFloat(payload.fat_bruto) || 0
      payload.chapa        = parseFloat(payload.chapa) || 0
      payload.qtd_veiculos = parseInt(payload.qtd_veiculos) || 0
      payload.placa_carreta = payload.placa_carreta || ''
      if (!payload.data) delete payload.data
      if (!payload.dt_pagamento) delete payload.dt_pagamento

      // 1. Salva contrato + comissão
      const res = await fetch('/api/contratos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error(await res.text())

      // 2. Busca contrato recém criado
      const { data: contratoData } = await supabase
        .from('contratos').select('id')
        .eq('contrato', form.contrato)
        .order('created_at', { ascending: false })
        .limit(1).maybeSingle()
      const contratoId = contratoData?.id || null

      if (contratoId) {
        // 3. Busca caminhão pela placa
        let caminhaoId: string | null = null
        if (form.placa) {
          const { data: camData } = await supabase
            .from('caminhoes').select('id').eq('placa', form.placa).limit(1).maybeSingle()
          if (camData) caminhaoId = camData.id
        }

        // 4. Cria viagem automaticamente
        const { data: viagemData } = await supabase.from('viagens').insert({
          motorista:      form.motorista,
          caminhao_id:    caminhaoId,
          caminhao_placa: form.placa || '',
          empresa:        form.cliente,
          origem:         form.origem,
          destino:        form.destino,
          valor_contrato: payload.fat_bruto,
          status:         'EM ANDAMENTO',
          obs:            `Gerado do contrato #${form.contrato}`
        }).select().maybeSingle()

        // 5. Vincula viagem ↔ contrato
        if (viagemData?.id) {
          await supabase.from('viagem_contratos').insert({
            viagem_id:       viagemData.id,
            contrato_id:     contratoId,
            contrato_numero: form.contrato
          })
        }
      }

      setAba('contratos')
    } catch { setErro('Erro ao salvar contrato.'); setLoading(false) }
  }

  function clienteSelectValue() {
    const c = clientes.find(c => c.nome === form.cliente && formatCnpj(c.cnpj || '') === form.cnpj)
    if (c) return `${c.nome}||${c.cnpj || ''}`
    const c2 = clientes.find(c => c.nome === form.cliente)
    if (c2) return `${c2.nome}||${c2.cnpj || ''}`
    return ''
  }

  const IC        = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
  const ICwarn    = "w-full border border-orange-300 bg-orange-50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
  const ICconfirm = "w-full border-2 border-orange-400 bg-orange-50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
  const avisoIA   = camposIAAtivos ? <span className="text-xs text-orange-500 font-medium ml-1">⚠️ Confira</span> : null

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-xl font-bold text-gray-900 mb-6">📄 Novo Contrato</h1>

      <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-sm font-medium text-blue-800 mb-2">🤖 Preencher automaticamente com IA</p>
        <p className="text-xs text-blue-600 mb-3">Envie um PDF ou imagem do contrato e a IA preencherá os campos automaticamente.</p>
        <label className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition
          ${loadingIA ? 'bg-blue-300 text-white cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}>
          {loadingIA ? '⏳ Lendo documento...' : '📎 Selecionar PDF ou Imagem'}
          <input ref={fileRef} type="file" accept=".pdf,image/*" onChange={lerComIA} disabled={loadingIA} className="hidden" />
        </label>
        {camposIAAtivos && (
          <p className="text-xs text-orange-600 mt-3 font-medium">
            ⚠️ Campos preenchidos pela IA — confira data, origem, destino e nº contrato antes de salvar.
          </p>
        )}
      </div>

      {erro && <div className="mb-4 p-3 bg-red-100 text-red-800 rounded-lg text-sm">{erro}</div>}

      <form onSubmit={salvar} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Motorista *</label>
            <select name="motorista" value={form.motorista} onChange={handle} required className={IC}>
              <option value="">Selecione...</option>
              {motoristas.filter(m => m.ativo !== false).map(m => (
                <option key={m.id} value={m.nome}>{m.nome}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nº Contrato * {contratoLidoIA && <span className="text-xs text-orange-500 font-medium">⚠️ Confira no documento</span>}
            </label>
            <input name="contrato" value={form.contrato}
              onChange={e => { handle(e); setContratoLidoIA(false) }}
              required className={contratoLidoIA ? ICconfirm : IC} />
            {contratoLidoIA && (
              <p className="text-xs mt-1 text-orange-500">OCR confunde dígitos similares (9↔2, 5↔1, 7↔2).</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cliente *</label>
            <select value={clienteSelectValue()} onChange={e => selecionarCliente(e.target.value)} className={IC}>
              <option value="">Selecione...</option>
              {clientes.map(c => (
                <option key={c.id} value={`${c.nome}||${c.cnpj || ''}`}>
                  {c.nome}{c.cnpj ? ` · ${formatCnpj(c.cnpj)}` : ''}
                </option>
              ))}
            </select>
            {form.cliente && !clientes.find(c => c.nome === form.cliente) && (
              <input name="cliente" value={form.cliente} onChange={handle}
                placeholder="Cliente não cadastrado — edite ou cadastre"
                className="mt-1 w-full border border-orange-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-orange-50" />
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">CNPJ</label>
            <input name="cnpj" value={form.cnpj} onChange={handle} className={IC} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Placa do Caminhão</label>
            <select name="placa" value={form.placa} onChange={handle} className={form.placa ? IC : ICwarn}>
              <option value="">Selecione...</option>
              {caminhoes.map(c => (
                <option key={c.id} value={c.placa}>{c.placa}{c.modelo ? ` · ${c.modelo}` : ''}</option>
              ))}
            </select>
            {placaLidaIA && (
              <p className="text-xs mt-1 text-gray-400">
                IA leu: <span className="font-mono font-semibold text-gray-600">{placaLidaIA}</span>
                {form.placa
                  ? <span className="text-green-600 ml-1">✅ vinculado a {form.placa}</span>
                  : <span className="text-orange-500 ml-1">⚠️ não encontrada — selecione manualmente</span>}
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Placa da Carreta</label>
            <select name="placa_carreta" value={form.placa_carreta} onChange={handle} className={form.placa_carreta ? IC : ICwarn}>
              <option value="">Selecione...</option>
              {carretas.map(c => (
                <option key={c.id} value={c.placa}>{c.placa}{c.modelo ? ` · ${c.modelo}` : ''}</option>
              ))}
            </select>
            {placaCarretaLidaIA && (
              <p className="text-xs mt-1 text-gray-400">
                IA leu: <span className="font-mono font-semibold text-gray-600">{placaCarretaLidaIA}</span>
                {form.placa_carreta
                  ? <span className="text-green-600 ml-1">✅ vinculado a {form.placa_carreta}</span>
                  : <span className="text-orange-500 ml-1">⚠️ não encontrada — selecione manualmente</span>}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Frota</label>
            <input name="frota" value={form.frota} onChange={handle} className={IC} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Qtd Veículos</label>
            <input name="qtd_veiculos" type="number" value={form.qtd_veiculos} onChange={handle} className={IC} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Data {avisoIA}</label>
            <input name="data" type="date" value={form.data}
              onChange={e => { handle(e); setCamposIAAtivos(false) }}
              className={camposIAAtivos ? ICconfirm : IC} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Origem {avisoIA}</label>
            <input name="origem" value={form.origem}
              onChange={e => { handle(e); setCamposIAAtivos(false) }}
              className={camposIAAtivos ? ICconfirm : IC} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Destino {avisoIA}</label>
            <input name="destino" value={form.destino}
              onChange={e => { handle(e); setCamposIAAtivos(false) }}
              className={camposIAAtivos ? ICconfirm : IC} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Frete Contratado (R$)</label>
            <input name="fat_bruto" type="number" step="0.01" value={form.fat_bruto} onChange={handle} className={IC} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Chapa (R$)
              {form.chapa === '0' && (
                <span className="ml-2 text-xs text-green-600 font-medium">✅ sem chapa</span>
              )}
              {form.chapa === '250' && (
                <span className="ml-2 text-xs text-blue-600 font-medium">🔧 R$ 250 calculado</span>
              )}
            </label>
            <input name="chapa" type="number" step="0.01" value={form.chapa} onChange={handle} className={IC} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select name="status" value={form.status} onChange={handle} className={IC}>
              <option value="ABERTO">ABERTO</option>
              <option value="PAGO">PAGO</option>
              <option value="CANCELADO">CANCELADO</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Dt. Pagamento</label>
            <input name="dt_pagamento" type="date" value={form.dt_pagamento} onChange={handle} className={IC} />
          </div>
          <div className="flex items-center gap-2 pb-2">
            <input name="adiantamento_pago" type="checkbox" checked={form.adiantamento_pago} onChange={handle} className="w-4 h-4 accent-red-600" />
            <label className="text-sm font-medium text-gray-700">Adiantamento pago</label>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
          <textarea name="obs" value={form.obs} onChange={handle} rows={3} className={IC} />
        </div>

        <div className="flex justify-end">
          <button type="submit" disabled={loading}
            className="bg-red-600 hover:bg-red-700 text-white font-medium px-6 py-2 rounded-lg text-sm disabled:opacity-50">
            {loading ? 'Salvando...' : 'Salvar Contrato'}
          </button>
        </div>
      </form>
    </div>
  )
}