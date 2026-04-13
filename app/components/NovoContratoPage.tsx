'use client'
import { useState, useEffect, useRef } from 'react'
import { contratosAPI, motoristasAPI } from '../services/api'

export default function NovoContratoPage({ setAba }: { setAba: (aba: string) => void }) {
  const [motoristas, setMotoristas] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingIA, setLoadingIA] = useState(false)
  const [erro, setErro] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    motorista: '',
    cliente: '',
    cnpj: '',
    placa: '',
    frota: '',
    contrato: '',
    data: '',
    fat_bruto: '',
    chapa: '',
    origem: '',
    destino: '',
    qtd_veiculos: '',
    adiantamento_pago: false,
    dt_pagamento: '',
    status: 'ABERTO',
    obs: '',
  })

  useEffect(() => {
    motoristasAPI.listar().then(setMotoristas).catch(() => {})
  }, [])

  function handle(e: any) {
    const { name, value, type, checked } = e.target
    setForm(f => ({ ...f, [name]: type === 'checkbox' ? checked : value }))
  }

  async function lerComIA(e: any) {
    const file = e.target.files?.[0]
    if (!file) return
    setLoadingIA(true)
    setErro('')
    try {
      const base64 = await new Promise<string>((res, rej) => {
        const r = new FileReader()
        r.onload = () => res((r.result as string).split(',')[1])
        r.onerror = () => rej()
        r.readAsDataURL(file)
      })

      const isPDF = file.type === 'application/pdf'
      const mediaType = file.type

      const response = await fetch('/api/ler-contrato', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64, mediaType, isPDF })
      })

      const parsed = await response.json()

      const normalizar = (s: string) =>
        s.trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

      const motoristaEncontrado = motoristas.find(m => {
        const nomeIA = normalizar(parsed.motorista || '')
        const nomeBanco = normalizar(m.nome)

        if (nomeBanco === nomeIA || nomeBanco.includes(nomeIA) || nomeIA.includes(nomeBanco)) return true

        const primeiroIA = nomeIA.split(' ')[0]
        const primeiroBanco = nomeBanco.split(' ')[0]
        if (primeiroIA.length > 3 && primeiroIA === primeiroBanco) {
          const ultimoIA = nomeIA.split(' ').pop()
          const ultimoBanco = nomeBanco.split(' ').pop()
          return ultimoIA === ultimoBanco
        }

        return primeiroIA.length > 3 && primeiroIA === primeiroBanco
      })

      setForm(f => ({
        ...f,
        ...Object.fromEntries(
          Object.entries(parsed).filter(([_, v]) => v !== '' && v !== null && v !== undefined)
        ),
        motorista: motoristaEncontrado ? motoristaEncontrado.nome : '',
        cliente: parsed.cliente_nome_completo || parsed.cliente || '',
        cnpj: parsed.cnpj || '',
      }))
    } catch (err) {
      setErro('Não foi possível ler o documento. Preencha manualmente.')
    } finally {
      setLoadingIA(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function salvar(e: any) {
    e.preventDefault()
    setLoading(true)
    setErro('')
    try {
      const payload: any = { ...form }
      if (payload.fat_bruto) payload.fat_bruto = parseFloat(payload.fat_bruto)
      if (payload.chapa) payload.chapa = parseFloat(payload.chapa)
      if (payload.qtd_veiculos) payload.qtd_veiculos = parseInt(payload.qtd_veiculos)
      if (!payload.data) delete payload.data
      if (!payload.dt_pagamento) delete payload.dt_pagamento
      await contratosAPI.criar(payload)
      setAba('contratos')
    } catch (e: any) {
      setErro('Erro ao salvar contrato.')
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-xl font-bold text-gray-900 mb-6">📄 Novo Contrato</h1>

      <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-sm font-medium text-blue-800 mb-2">🤖 Preencher automaticamente com IA</p>
        <p className="text-xs text-blue-600 mb-3">Envie um PDF ou imagem do contrato e a IA preencherá os campos automaticamente.</p>
        <label className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition
          ${loadingIA ? 'bg-blue-300 text-white cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}>
          {loadingIA ? '⏳ Lendo documento...' : '📎 Selecionar PDF ou Imagem'}
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,image/*"
            onChange={lerComIA}
            disabled={loadingIA}
            className="hidden"
          />
        </label>
      </div>

      {erro && (
        <div className="mb-4 p-3 bg-red-100 text-red-800 rounded-lg text-sm">{erro}</div>
      )}

      <form onSubmit={salvar} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Motorista *</label>
            <select name="motorista" value={form.motorista} onChange={handle} required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
              <option value="">Selecione...</option>
              {motoristas.filter(m => m.ativo).map(m => (
                <option key={m.id} value={m.nome}>{m.nome}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nº Contrato *</label>
            <input name="contrato" value={form.contrato} onChange={handle} required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cliente *</label>
            <input name="cliente" value={form.cliente} onChange={handle} required
              placeholder="Nome completo do cliente"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">CNPJ</label>
            <input name="cnpj" value={form.cnpj} onChange={handle}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Placa</label>
            <input name="placa" value={form.placa} onChange={handle}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Frota</label>
            <input name="frota" value={form.frota} onChange={handle}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Qtd Veículos</label>
            <input name="qtd_veiculos" type="number" value={form.qtd_veiculos} onChange={handle}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Origem</label>
            <input name="origem" value={form.origem} onChange={handle}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Destino</label>
            <input name="destino" value={form.destino} onChange={handle}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fat. Bruto (R$)</label>
            <input name="fat_bruto" type="number" step="0.01" value={form.fat_bruto} onChange={handle}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Chapa (R$)</label>
            <input name="chapa" type="number" step="0.01" value={form.chapa} onChange={handle}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Data</label>
            <input name="data" type="date" value={form.data} onChange={handle}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select name="status" value={form.status} onChange={handle}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
              <option value="ABERTO">ABERTO</option>
              <option value="PAGO">PAGO</option>
              <option value="CANCELADO">CANCELADO</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Dt. Pagamento</label>
            <input name="dt_pagamento" type="date" value={form.dt_pagamento} onChange={handle}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
          </div>
          <div className="flex items-center gap-2 pb-2">
            <input name="adiantamento_pago" type="checkbox" checked={form.adiantamento_pago} onChange={handle}
              className="w-4 h-4 accent-red-600" />
            <label className="text-sm font-medium text-gray-700">Adiantamento pago</label>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
          <textarea name="obs" value={form.obs} onChange={handle} rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
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