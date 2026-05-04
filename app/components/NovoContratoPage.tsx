'use client'
import { useState, useEffect, useRef } from 'react'
import { contratosAPI, motoristasAPI } from '../services/api'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_KEY!

export default function NovoContratoPage({ setAba }: { setAba: (aba: string) => void }) {
  const [motoristas, setMotoristas] = useState<any[]>([])
  const [clientes, setClientes] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingIA, setLoadingIA] = useState(false)
  const [erro, setErro] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    motorista: '', cliente: '', cnpj: '', placa: '', placa_carreta: '',
    frota: '', contrato: '', data: '', fat_bruto: '', chapa: '',
    origem: '', destino: '', qtd_veiculos: '', adiantamento_pago: false,
    dt_pagamento: '', status: 'ABERTO', obs: '',
  })

  useEffect(() => {
    motoristasAPI.listar().then(setMotoristas).catch(() => {})
    fetchClientes()
  }, [])

  async function fetchClientes() {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/clientes?order=nome.asc`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
      })
      const data = await res.json()
      setClientes(Array.isArray(data) ? data : [])
    } catch {}
  }

  function handle(e: any) {
    const { name, value, type, checked } = e.target
    setForm(f => ({ ...f, [name]: type === 'checkbox' ? checked : value }))
  }

  function selecionarCliente(valor: string) {
    if (!valor) { setForm(f => ({ ...f, cliente: '', cnpj: '' })); return }
    const [nome, cnpj] = valor.split('||')
    const cliente = clientes.find(c => c.nome === nome && (c.cnpj || '') === cnpj)
    setForm(f => ({ ...f, cliente: nome, cnpj: cliente?.cnpj ? formatCnpj(cliente.cnpj) : '' }))
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
    for (let i = 0; i < shorter.length; i++) {
      if (longer.includes(shorter[i])) matches++
    }
    return matches / longer.length
  }

  function nomesSaoParecidos(nomeA: string, nomeB: string): boolean {
    const a = normalizar(nomeA)
    const b = normalizar(nomeB)
    // Verifica se tem pelo menos 2 palavras significativas em comum
    const palavrasA = a.split(' ').filter(p => p.length > 3)
    const palavrasB = b.split(' ').filter(p => p.length > 3)
    const emComum = palavrasA.filter(p => palavrasB.some(pb =>
      pb === p || (pb.length > 3 && p.length > 3 && (pb.slice(0,-1) === p.slice(0,-1)))
    ))
    return emComum.length >= 2
  }

  function encontrarCliente(nomeIA: string, cnpjIA?: string, origemIA?: string) {
    if (!nomeIA && !cnpjIA) return null
    const nomeNorm = nomeIA ? normalizar(nomeIA) : ''

    // 1. Match por CNPJ — SÓ aceita se o nome também for parecido
    if (cnpjIA) {
      const cnpjLimpo = cnpjIA.replace(/\D/g, '')
      if (cnpjLimpo.length === 14) {
        const found = clientes.find(c => (c.cnpj || '').replace(/\D/g, '') === cnpjLimpo)
        if (found && nomeNorm) {
          // Valida se o nome tem pelo menos 2 palavras em comum
          if (nomesSaoParecidos(nomeIA, found.nome)) return found
          // Se o nome não bate, ignora o CNPJ e continua para match por nome
        }
      }
    }

    if (!nomeNorm) return null

    // 2. Match exato por nome com desempate por cidade
    const todosExatos = clientes.filter(c => normalizar(c.nome) === nomeNorm)
    if (todosExatos.length === 1) return todosExatos[0]
    if (todosExatos.length > 1) {
      if (origemIA) {
        const cidadeOrigem = normalizar(origemIA.split('-')[0].trim())
        const porCidade = todosExatos.find(c =>
          normalizar(c.cidade || '').includes(cidadeOrigem) ||
          cidadeOrigem.includes(normalizar(c.cidade || ''))
        )
        if (porCidade) return porCidade
      }
      // Desempate por CNPJ parcial (primeiros 8 dígitos do CNPJ da empresa)
      if (cnpjIA) {
        const cnpjParcial = cnpjIA.replace(/\D/g, '').slice(0, 8)
        const porCnpjParcial = todosExatos.find(c =>
          (c.cnpj || '').replace(/\D/g, '').startsWith(cnpjParcial)
        )
        if (porCnpjParcial) return porCnpjParcial
      }
      return todosExatos[0]
    }

    // 3. Um contém o outro — com desempate por cidade
    const todosContem = clientes.filter(c => {
      const nomeCad = normalizar(c.nome)
      return nomeCad.includes(nomeNorm) || nomeNorm.includes(nomeCad)
    })
    if (todosContem.length === 1) return todosContem[0]
    if (todosContem.length > 1) {
      if (origemIA) {
        const cidadeOrigem = normalizar(origemIA.split('-')[0].trim())
        const porCidade = todosContem.find(c =>
          normalizar(c.cidade || '').includes(cidadeOrigem) ||
          cidadeOrigem.includes(normalizar(c.cidade || ''))
        )
        if (porCidade) return porCidade
      }
      return todosContem[0]
    }

    // 4. Palavra por palavra com tolerância a OCR
    const found = clientes.find(c => {
      const nomeCad = normalizar(c.nome)
      const palavrasIA = nomeNorm.split(' ').filter(p => p.length > 2)
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

    // 5. Similaridade alta
    let melhorScore = 0, melhorCliente = null
    for (const c of clientes) {
      const score = similaridade(normalizar(c.nome), nomeNorm)
      if (score > melhorScore && score > 0.85) { melhorScore = score; melhorCliente = c }
    }
    return melhorCliente
  }

  async function lerComIA(e: any) {
    const file = e.target.files?.[0]
    if (!file) return
    setLoadingIA(true); setErro('')
    try {
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

      // Busca motorista
      const motoristaEncontrado = motoristas.find(m => {
        const nomeIA = normalizar(parsed.motorista || '')
        const nomeBanco = normalizar(m.nome)
        if (nomeBanco === nomeIA || nomeBanco.includes(nomeIA) || nomeIA.includes(nomeBanco)) return true
        const primeiroIA = nomeIA.split(' ')[0]
        const primeiroBanco = nomeBanco.split(' ')[0]
        if (primeiroIA.length > 3 && primeiroIA === primeiroBanco) {
          return nomeIA.split(' ').pop() === nomeBanco.split(' ').pop()
        }
        return primeiroIA.length > 3 && primeiroIA === primeiroBanco
      })

      // Busca cliente com CNPJ validado contra o nome
      const clienteEncontrado = encontrarCliente(
        parsed.cliente_nome_completo || parsed.cliente || '',
        parsed.cnpj || '',
        parsed.origem || ''
      )

      setForm(f => ({
        ...f,
        ...Object.fromEntries(Object.entries(parsed).filter(([_, v]) => v !== '' && v !== null && v !== undefined)),
        motorista: motoristaEncontrado ? motoristaEncontrado.nome : '',
        cliente: clienteEncontrado?.nome || parsed.cliente_nome_completo || parsed.cliente || '',
        cnpj: clienteEncontrado?.cnpj ? formatCnpj(clienteEncontrado.cnpj) : parsed.cnpj ? formatCnpj(parsed.cnpj) : '',
      }))
    } catch { setErro('Não foi possível ler o documento. Preencha manualmente.') }
    finally { setLoadingIA(false); if (fileRef.current) fileRef.current.value = '' }
  }

  async function salvar(e: any) {
    e.preventDefault(); setLoading(true); setErro('')
    try {
      const payload: any = { ...form }
      if (payload.fat_bruto) payload.fat_bruto = parseFloat(payload.fat_bruto)
      if (payload.chapa) payload.chapa = parseFloat(payload.chapa)
      if (payload.qtd_veiculos) payload.qtd_veiculos = parseInt(payload.qtd_veiculos)
      if (!payload.data) delete payload.data
      if (!payload.dt_pagamento) delete payload.dt_pagamento
      await contratosAPI.criar(payload)
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

  const IC = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"

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
      </div>

      {erro && <div className="mb-4 p-3 bg-red-100 text-red-800 rounded-lg text-sm">{erro}</div>}

      <form onSubmit={salvar} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Motorista *</label>
            <select name="motorista" value={form.motorista} onChange={handle} required className={IC}>
              <option value="">Selecione...</option>
              {motoristas.filter(m => m.ativo).map(m => <option key={m.id} value={m.nome}>{m.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nº Contrato *</label>
            <input name="contrato" value={form.contrato} onChange={handle} required className={IC} />
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
            <input name="placa" value={form.placa} onChange={handle} className={IC} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Placa da Carreta</label>
            <input name="placa_carreta" value={form.placa_carreta} onChange={handle} className={IC} />
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Data</label>
            <input name="data" type="date" value={form.data} onChange={handle} className={IC} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Origem</label>
            <input name="origem" value={form.origem} onChange={handle} className={IC} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Destino</label>
            <input name="destino" value={form.destino} onChange={handle} className={IC} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Frete Contratado (R$)</label>
            <input name="fat_bruto" type="number" step="0.01" value={form.fat_bruto} onChange={handle} className={IC} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Chapa (R$)</label>
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