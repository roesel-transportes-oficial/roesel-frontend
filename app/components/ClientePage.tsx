'use client'
import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../services/auth'
import { Search, Plus, ArrowLeft, Save, Trash2, ChevronRight, UserCircle, Upload, Loader2, AlertCircle, MapPin, Phone, FileText } from 'lucide-react'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_KEY!

interface Cliente {
  id: string; nome: string; cnpj: string; endereco: string; cep: string
  cidade: string; estado: string; telefone: string; ie: string
}

const ESTADOS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']

export default function ClientePage() {
  const { perm } = useAuth()
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [busca, setBusca] = useState('')
  const [sel, setSel] = useState<Cliente | null>(null)
  const [mostraCad, setMostraCad] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingIA, setLoadingIA] = useState(false)
  const [msg, setMsg] = useState('')
  const [confirmExcluir, setConfirmExcluir] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [editNome, setEditNome] = useState('')
  const [editCnpj, setEditCnpj] = useState('')
  const [editEndereco, setEditEndereco] = useState('')
  const [editCep, setEditCep] = useState('')
  const [editCidade, setEditCidade] = useState('')
  const [editEstado, setEditEstado] = useState('')
  const [editTelefone, setEditTelefone] = useState('')
  const [editIe, setEditIe] = useState('')

  const [cadNome, setCadNome] = useState('')
  const [cadCnpj, setCadCnpj] = useState('')
  const [cadEndereco, setCadEndereco] = useState('')
  const [cadCep, setCadCep] = useState('')
  const [cadCidade, setCadCidade] = useState('')
  const [cadEstado, setCadEstado] = useState('')
  const [cadTelefone, setCadTelefone] = useState('')
  const [cadIe, setCadIe] = useState('')

  useEffect(() => { fetch_() }, [])

  async function fetch_() {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/clientes?order=nome.asc`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
      })
      const data = await res.json()
      setClientes(Array.isArray(data) ? data : [])
    } catch {}
  }

  async function lerContratoComIA(file: File) {
    setLoadingIA(true)
    try {
      const base64 = await new Promise<string>((res, rej) => {
        const r = new FileReader()
        r.onload = () => res((r.result as string).split(',')[1])
        r.onerror = () => rej(new Error('Erro ao ler arquivo'))
        r.readAsDataURL(file)
      })

      const mediaType = file.type === 'application/pdf' ? 'application/pdf'
        : file.type === 'image/png' ? 'image/png'
        : 'image/jpeg'

      const isPDF = file.type === 'application/pdf'

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY!,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-5',
          max_tokens: 1000,
          messages: [{
            role: 'user',
            content: [
              {
                type: isPDF ? 'document' : 'image',
                source: { type: 'base64', media_type: mediaType, data: base64 }
              },
              {
                type: 'text',
                text: `Extraia os dados do CONTRATANTE deste contrato de transporte e retorne APENAS um JSON válido, sem texto adicional, sem markdown:
{
  "nome": "nome ou razão social exata do contratante",
  "cnpj": "CNPJ somente números",
  "endereco": "endereço completo",
  "cep": "CEP somente números",
  "cidade": "cidade em maiúsculas",
  "estado": "UF com 2 letras maiúsculas",
  "telefone": "telefone somente números",
  "ie": "inscrição estadual somente números"
}`
              }
            ]
          }]
        })
      })

      const data = await response.json()
      const text = data.content?.[0]?.text || ''
      const match = text.match(/\{[\s\S]*\}/)
      if (!match) { showMsg('⚠️ Não foi possível extrair os dados.'); return }

      const d = JSON.parse(match[0])
      if (d.nome) setCadNome(d.nome)
      if (d.cnpj) setCadCnpj(d.cnpj)
      if (d.endereco) setCadEndereco(d.endereco)
      if (d.cep) setCadCep(d.cep)
      if (d.cidade) setCadCidade(d.cidade)
      if (d.estado) setCadEstado(d.estado)
      if (d.telefone) setCadTelefone(d.telefone)
      if (d.ie) setCadIe(d.ie)

      showMsg('✅ Dados extraídos com sucesso!')
    } catch {
      showMsg('⚠️ Erro ao processar o arquivo.')
    } finally {
      setLoadingIA(false)
    }
  }

  function fmtCnpj(v: string) {
    const d = v.replace(/\D/g,'').slice(0,14)
    if (d.length <= 2) return d
    if (d.length <= 5) return `${d.slice(0,2)}.${d.slice(2)}`
    if (d.length <= 8) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5)}`
    if (d.length <= 12) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8)}`
    return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`
  }

  function fmtCep(v: string) {
    const d = v.replace(/\D/g,'').slice(0,8)
    if (d.length <= 5) return d
    return `${d.slice(0,5)}-${d.slice(5)}`
  }

  const filtrados = busca.trim()
    ? clientes.filter(c =>
        c.nome?.toLowerCase().includes(busca.toLowerCase()) ||
        c.cnpj?.includes(busca) ||
        c.cidade?.toLowerCase().includes(busca.toLowerCase())
      )
    : clientes

  function selecionar(c: Cliente) {
    setSel(c)
    setEditNome(c.nome || '')
    setEditCnpj(c.cnpj || '')
    setEditEndereco(c.endereco || '')
    setEditCep(c.cep || '')
    setEditCidade(c.cidade || '')
    setEditEstado(c.estado || '')
    setEditTelefone(c.telefone || '')
    setEditIe(c.ie || '')
    setConfirmExcluir(false)
  }

  function voltar() { setSel(null); setConfirmExcluir(false) }
  function showMsg(t: string) { setMsg(t); setTimeout(() => setMsg(''), 4000) }

  function resetCad() {
    setCadNome(''); setCadCnpj(''); setCadEndereco(''); setCadCep('')
    setCadCidade(''); setCadEstado(''); setCadTelefone(''); setCadIe('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function salvar() {
    if (!sel) return
    setLoading(true)
    if (perm !== 'demo') {
      await fetch(`${SUPABASE_URL}/rest/v1/clientes?id=eq.${sel.id}`, {
        method: 'PATCH',
        headers: {
          apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json', Prefer: 'return=minimal'
        },
        body: JSON.stringify({
          nome: editNome.toUpperCase(), cnpj: editCnpj, endereco: editEndereco,
          cep: editCep, cidade: editCidade.toUpperCase(), estado: editEstado,
          telefone: editTelefone, ie: editIe
        })
      })
    }
    await fetch_(); setLoading(false); voltar(); showMsg('✅ Atualizado!')
  }

  async function excluir() {
    if (!sel) return
    setLoading(true)
    if (perm !== 'demo') {
      await fetch(`${SUPABASE_URL}/rest/v1/clientes?id=eq.${sel.id}`, {
        method: 'DELETE',
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
      })
    }
    await fetch_(); setLoading(false); voltar(); showMsg('Cliente excluído.')
  }

  async function cadastrar() {
    if (!cadNome) return
    setLoading(true)
    if (perm !== 'demo') {
      await fetch(`${SUPABASE_URL}/rest/v1/clientes`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json', Prefer: 'return=minimal'
        },
        body: JSON.stringify({
          nome: cadNome.toUpperCase(), cnpj: cadCnpj, endereco: cadEndereco,
          cep: cadCep, cidade: cadCidade.toUpperCase(), estado: cadEstado,
          telefone: cadTelefone, ie: cadIe
        })
      })
    }
    await fetch_(); setLoading(false)
    resetCad(); setMostraCad(false)
    showMsg('✅ Cliente cadastrado!')
  }

  if (mostraCad) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
        <div className="max-w-2xl mx-auto">
          <button onClick={() => { setMostraCad(false); resetCad() }} className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-8 font-medium transition-colors group">
            <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" /> Voltar
          </button>

          {msg && (
            <div className={`mb-6 p-4 rounded-lg text-sm font-semibold border ${msg.startsWith('⚠️') ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
              {msg}
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-8 py-8">
              <h2 className="text-white font-black text-3xl tracking-tight">Novo Cliente</h2>
              <p className="text-blue-100 text-sm font-medium mt-2">Preencha os dados abaixo ou importe de um contrato</p>
            </div>

            <div className="p-8 space-y-8">
              {/* Seção de Importação IA */}
              <div className="p-6 bg-gradient-to-br from-blue-50 to-cyan-50 border-2 border-dashed border-blue-200 rounded-xl">
                <div className="flex items-start gap-3 mb-4">
                  <FileText size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-blue-900">Importar do Contrato</p>
                    <p className="text-sm text-blue-700 mt-1">Envie uma imagem ou PDF do contrato e a IA preencherá os dados automaticamente</p>
                  </div>
                </div>
                <input ref={fileInputRef} type="file" accept="image/*,application/pdf" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) lerContratoComIA(f) }} />
                <button onClick={() => fileInputRef.current?.click()} disabled={loadingIA}
                  className="w-full flex items-center justify-center gap-2 border-2 border-blue-300 hover:border-blue-400 bg-white hover:bg-blue-50 text-blue-600 hover:text-blue-700 rounded-lg py-3 text-sm font-semibold transition disabled:opacity-50">
                  {loadingIA ? <><Loader2 size={16} className="animate-spin" /> Lendo contrato com IA...</> : <><Upload size={16} /> Selecionar imagem ou PDF</>}
                </button>
              </div>

              {/* Formulário */}
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Nome / Razão Social *</label>
                  <input value={cadNome} onChange={e => setCadNome(e.target.value)} placeholder="Nome da empresa" 
                    className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">CNPJ</label>
                    <input value={fmtCnpj(cadCnpj)} onChange={e => setCadCnpj(e.target.value.replace(/\D/g,''))}
                      placeholder="00.000.000/0000-00" maxLength={18} 
                      className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">IE</label>
                    <input value={cadIe} onChange={e => setCadIe(e.target.value)} placeholder="Inscrição Estadual" 
                      className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Endereço</label>
                  <input value={cadEndereco} onChange={e => setCadEndereco(e.target.value)} placeholder="Rua, número, bairro" 
                    className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">CEP</label>
                    <input value={fmtCep(cadCep)} onChange={e => setCadCep(e.target.value.replace(/\D/g,''))}
                      placeholder="00000-000" maxLength={9} 
                      className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Telefone</label>
                    <input value={cadTelefone} onChange={e => setCadTelefone(e.target.value)} placeholder="(00) 00000-0000" 
                      className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Cidade</label>
                    <input value={cadCidade} onChange={e => setCadCidade(e.target.value.toUpperCase())} placeholder="Nome da cidade" 
                      className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Estado (UF)</label>
                    <select value={cadEstado} onChange={e => setCadEstado(e.target.value)} 
                      className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all">
                      <option value="">Selecione...</option>
                      {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Botões */}
              <div className="flex gap-3 pt-4">
                <button onClick={cadastrar} disabled={loading || !cadNome}
                  className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg py-3 text-sm font-semibold transition">
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                  Cadastrar Cliente
                </button>
                <button onClick={() => { setMostraCad(false); resetCad() }}
                  className="flex-1 border border-slate-300 text-slate-700 rounded-lg py-3 text-sm font-semibold hover:bg-slate-50 transition">
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>

        {msg && (
          <div className="fixed bottom-6 right-6 p-4 rounded-lg shadow-lg font-semibold text-sm animate-bounce"
            style={{
              backgroundColor: msg.startsWith('✅') ? '#10b981' : '#f59e0b',
              color: 'white'
            }}>
            {msg}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-5xl mx-auto">
        {sel ? (
          <div>
            <button onClick={voltar} className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-8 font-medium transition-colors group">
              <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" /> Voltar
            </button>

            <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
              {/* Header */}
              <div className="bg-gradient-to-r from-red-600 to-red-700 px-8 py-8">
                <div className="flex items-center gap-5">
                  <div className="w-16 h-16 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-white shadow-lg">
                    <UserCircle size={32} />
                  </div>
                  <div>
                    <h2 className="text-white font-black text-3xl tracking-tight">{sel.nome}</h2>
                    <p className="text-red-100 text-sm font-medium mt-1">{sel.cidade}{sel.estado && ` - ${sel.estado}`}</p>
                  </div>
                </div>
              </div>

              {/* Conteúdo */}
              <div className="p-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Coluna Esquerda */}
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Nome / Razão Social</label>
                      <input value={editNome} onChange={e => setEditNome(e.target.value)} 
                        className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">CNPJ</label>
                        <input value={fmtCnpj(editCnpj)} onChange={e => setEditCnpj(e.target.value.replace(/\D/g,''))}
                          placeholder="00.000.000/0000-00" maxLength={18} 
                          className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">IE</label>
                        <input value={editIe} onChange={e => setEditIe(e.target.value)} 
                          className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all" />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Endereço</label>
                      <input value={editEndereco} onChange={e => setEditEndereco(e.target.value)} 
                        className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">CEP</label>
                        <input value={fmtCep(editCep)} onChange={e => setEditCep(e.target.value.replace(/\D/g,''))}
                          placeholder="00000-000" maxLength={9} 
                          className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Telefone</label>
                        <input value={editTelefone} onChange={e => setEditTelefone(e.target.value)} 
                          className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all" />
                      </div>
                    </div>
                  </div>

                  {/* Coluna Direita */}
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Cidade</label>
                        <input value={editCidade} onChange={e => setEditCidade(e.target.value.toUpperCase())} 
                          className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Estado (UF)</label>
                        <select value={editEstado} onChange={e => setEditEstado(e.target.value)} 
                          className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all">
                          <option value="">Selecione...</option>
                          {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
                        </select>
                      </div>
                    </div>

                    {/* Informações adicionais */}
                    <div className="p-5 bg-slate-50 rounded-lg border border-slate-200 space-y-4">
                      <h3 className="font-bold text-slate-900 text-sm">Informações do Cliente</h3>
                      <div className="space-y-3 text-sm">
                        <div className="flex items-center gap-3">
                          <FileText size={16} className="text-slate-400" />
                          <span className="text-slate-600">ID: <span className="font-mono font-semibold text-slate-900">{sel.id.slice(0, 8)}...</span></span>
                        </div>
                        <div className="flex items-center gap-3">
                          <MapPin size={16} className="text-slate-400" />
                          <span className="text-slate-600">Localização: <span className="font-semibold text-slate-900">{editCidade} - {editEstado}</span></span>
                        </div>
                        {editTelefone && (
                          <div className="flex items-center gap-3">
                            <Phone size={16} className="text-slate-400" />
                            <span className="text-slate-600">Telefone: <span className="font-semibold text-slate-900">{editTelefone}</span></span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-8 py-6 bg-slate-50 border-t border-slate-200 flex gap-3 justify-end">
                <button onClick={voltar}
                  className="px-6 py-2.5 rounded-lg font-semibold text-sm text-slate-700 border border-slate-300 hover:bg-slate-100 transition-colors">
                  Cancelar
                </button>
                <button onClick={() => setConfirmExcluir(true)}
                  className="px-6 py-2.5 rounded-lg font-semibold text-sm bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition-colors flex items-center gap-2">
                  <Trash2 size={16} /> Excluir
                </button>
                <button onClick={salvar} disabled={loading}
                  className="px-6 py-2.5 rounded-lg font-semibold text-sm bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center gap-2">
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  Salvar Alterações
                </button>
              </div>

              {confirmExcluir && (
                <div className="px-8 py-6 bg-red-50 border-t border-red-200 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <AlertCircle size={20} className="text-red-600" />
                    <p className="font-semibold text-red-700">Tem certeza que deseja excluir este cliente?</p>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setConfirmExcluir(false)}
                      className="px-4 py-2 rounded-lg font-semibold text-sm border border-red-300 text-red-700 hover:bg-red-100 transition-colors">
                      Cancelar
                    </button>
                    <button onClick={excluir} disabled={loading}
                      className="px-4 py-2 rounded-lg font-semibold text-sm bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors">
                      {loading ? 'Excluindo...' : 'Confirmar Exclusão'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div>
            {/* Header */}
            <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-2">Clientes</h1>
                <p className="text-slate-600 font-medium">Gerencie todos os clientes da sua operação</p>
              </div>
              {perm !== 'view' && (
                <button onClick={() => setMostraCad(true)}
                  className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors shadow-lg">
                  <Plus size={18} /> Novo Cliente
                </button>
              )}
            </div>

            {/* Busca */}
            <div className="mb-8">
              <div className="relative">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={busca} onChange={e => setBusca(e.target.value)}
                  placeholder="Buscar por nome, CNPJ ou cidade..."
                  className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm font-medium" />
              </div>
            </div>

            {/* Lista de Clientes */}
            {filtrados.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
                <UserCircle size={48} className="mx-auto text-slate-300 mb-4" />
                <p className="text-slate-600 font-semibold">Nenhum cliente cadastrado</p>
                <p className="text-slate-500 text-sm mt-2">Comece adicionando um novo cliente</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filtrados.map(c => (
                  <button key={c.id} onClick={() => selecionar(c)}
                    className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-lg hover:border-slate-300 transition-all text-left group">
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center flex-shrink-0 text-blue-600 group-hover:scale-110 transition-transform">
                        <UserCircle size={24} />
                      </div>
                      <ChevronRight size={18} className="text-slate-300 group-hover:text-slate-500 transition-colors" />
                    </div>
                    <h3 className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors mb-2">{c.nome}</h3>
                    <div className="space-y-1 text-sm">
                      <p className="text-slate-600">{c.cnpj ? fmtCnpj(c.cnpj) : 'CNPJ não informado'}</p>
                      <p className="text-slate-500 flex items-center gap-1">
                        <MapPin size={14} />
                        {c.cidade}{c.estado && ` - ${c.estado}`}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {msg && (
        <div className="fixed bottom-6 right-6 p-4 rounded-lg shadow-lg font-semibold text-sm animate-bounce"
          style={{
            backgroundColor: msg.startsWith('✅') ? '#10b981' : '#f59e0b',
            color: 'white'
          }}>
          {msg}
        </div>
      )}
    </div>
  )
}
