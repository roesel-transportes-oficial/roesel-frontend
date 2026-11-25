'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '../services/supabase'
import { AlertCircle, Loader2, RefreshCw, Download, Copy, CheckCircle2, Receipt } from 'lucide-react'

interface Pendente {
  id: string; numero_cte: string; origem: string; destino: string
  remetente_nome: string; tomador_nome: string; uf: string; valor_icms: number; created_at: string
}
interface Gnre {
  id: string; cte_id: string; numero_cte: string; uf_favorecida: string; valor: number; status: string
  data_vencimento: string; linha_digitavel: string; motivo: string; pdf_path: string; created_at: string
}

const STATUS: Record<string, { t: string; c: string }> = {
  processando: { t: 'No portal',  c: 'bg-yellow-100 text-yellow-700' },
  emitida:     { t: 'A pagar',    c: 'bg-orange-100 text-orange-700' },
  paga:        { t: 'Paga',       c: 'bg-green-100 text-green-700' },
  rejeitada:   { t: 'Rejeitada',  c: 'bg-red-100 text-red-700' },
}
const IC = "border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-gray-50"
const brl = (v: number) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const hoje = () => new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10)
const esperar = (ms: number) => new Promise(r => setTimeout(r, ms))

export default function GnrePage() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [pendentes, setPendentes] = useState<Pendente[]>([])
  const [guias, setGuias]         = useState<Gnre[]>([])
  const [carregando, setCarregando] = useState(false)
  const [acaoId, setAcaoId]       = useState<string | null>(null)
  const [vencimentos, setVencimentos] = useState<Record<string, string>>({})
  const [erro, setErro]           = useState('')
  const [msg, setMsg]             = useState('')

  async function chamar(url: string, opcoes: RequestInit = {}) {
    const { data } = await supabase.auth.getSession()
    const token = data?.session?.access_token
    if (!token) throw new Error('Sessão expirada. Atualize a página e faça login novamente.')
    const res = await fetch(url, {
      ...opcoes,
      headers: { ...(opcoes.body ? { 'Content-Type': 'application/json' } : {}), Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
    let dados: any = null
    try { dados = await res.json() } catch {}
    if (!res.ok) throw new Error(dados?.detail || dados?.error || `Erro ${res.status}`)
    return dados
  }
  function showMsg(t: string) { setMsg(t); setTimeout(() => setMsg(''), 6000) }

  async function carregar() {
    setCarregando(true)
    try {
      const [p, g] = await Promise.all([chamar('/api/gnres/pendentes'), chamar('/api/gnres')])
      setPendentes(Array.isArray(p) ? p : [])
      setGuias(Array.isArray(g) ? g : [])
    } catch (e: any) {
      setErro(e?.message || 'Erro ao carregar.')
    } finally { setCarregando(false) }
  }

  useEffect(() => {
    carregar()
    const el = containerRef.current?.parentElement
    if (!el) return
    const obs = new MutationObserver(() => { if (el.style.display !== 'none') carregar() })
    obs.observe(el, { attributes: true, attributeFilter: ['style'] })
    return () => obs.disconnect()
  }, [])

  // O portal leva alguns segundos para processar: consulta até 4 vezes
  async function acompanhar(id: string) {
    for (let i = 0; i < 4; i++) {
      await esperar(4000)
      const r = await chamar(`/api/gnres/${id}/consultar`, { method: 'POST' })
      if (r?.status === 'emitida') { showMsg('Guia emitida. Já pode baixar o PDF.'); return }
      if (r?.status === 'rejeitada') { setErro(`Portal GNRE recusou: ${r.motivo}`); return }
    }
    showMsg('O portal ainda está processando. Clique em Consultar daqui a pouco.')
  }

  async function gerar(p: Pendente) {
    setAcaoId(p.id); setErro('')
    try {
      const r = await chamar(`/api/gnres/cte/${p.id}`, {
        method: 'POST', body: JSON.stringify({ vencimento: vencimentos[p.id] || hoje() }),
      })
      await carregar()
      if (r?.id) await acompanhar(r.id)
    } catch (e: any) {
      setErro(e?.message || 'Erro ao gerar a GNRE.')
    } finally { setAcaoId(null); carregar() }
  }

  async function acao(g: Gnre, tipo: 'consultar' | 'pdf' | 'paga') {
    if (tipo === 'paga' && !confirm(`Marcar a GNRE do CT-e ${g.numero_cte} como paga?`)) return
    setAcaoId(g.id); setErro('')
    try {
      if (tipo === 'pdf') {
        const r = await chamar(`/api/gnres/${g.id}/pdf`)
        if (r?.url) window.open(r.url, '_blank')
      } else if (tipo === 'consultar') {
        const r = await chamar(`/api/gnres/${g.id}/consultar`, { method: 'POST' })
        if (r?.status === 'emitida') showMsg('Guia emitida.')
        else if (r?.status === 'rejeitada') setErro(`Portal GNRE recusou: ${r.motivo}`)
        else showMsg('Ainda processando no portal.')
      } else {
        await chamar(`/api/gnres/${g.id}/paga`, { method: 'POST' })
        showMsg('Marcada como paga.')
      }
      carregar()
    } catch (e: any) {
      setErro(e?.message || 'Erro.')
    } finally { setAcaoId(null) }
  }

  function copiar(t: string) {
    navigator.clipboard?.writeText(t.replace(/\s/g, '')).then(() => showMsg('Linha digitável copiada.')).catch(() => {})
  }

  const aPagar = guias.filter(g => g.status === 'emitida')

  return (
    <div ref={containerRef} className="p-6 space-y-6">
      {msg && <div className="fixed top-6 right-6 z-[70] p-4 bg-green-600 text-white rounded-2xl shadow-2xl font-bold text-xs uppercase">{msg}</div>}

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">GNRE</h1>
        <button onClick={carregar} className="flex items-center gap-2 bg-gray-700 hover:bg-gray-800 text-white px-4 py-2 rounded-xl text-sm font-bold uppercase">
          {carregando ? <Loader2 size={16} className="animate-spin"/> : <RefreshCw size={16}/>} Atualizar
        </button>
      </div>

      {erro && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <AlertCircle size={16} className="mt-0.5 shrink-0"/> <span>{erro}</span>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        <Cartao t="CT-es sem GNRE" v={String(pendentes.length)}/>
        <Cartao t="Guias a pagar" v={String(aPagar.length)}/>
        <Cartao t="Total a pagar" v={brl(aPagar.reduce((s, g) => s + Number(g.valor || 0), 0))}/>
      </div>

      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <p className="font-bold text-gray-800">CT-es que precisam de GNRE</p>
          <p className="text-xs text-gray-500">CT-es autorizados que começam fora de MG e têm ICMS. A guia sai em nome da Roesel para o estado de origem.</p>
        </div>
        {pendentes.length === 0 ? (
          <p className="p-6 text-center text-sm text-gray-400">Nenhum CT-e pendente.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr><th className="text-left p-3">CT-e</th><th className="text-left p-3">Trajeto</th><th className="text-left p-3">Tomador</th>
                <th className="text-left p-3">Estado</th><th className="text-right p-3">ICMS</th><th className="text-left p-3">Vencimento</th><th className="p-3"></th></tr>
            </thead>
            <tbody>
              {pendentes.map(p => (
                <tr key={p.id} className="border-t border-gray-100">
                  <td className="p-3 font-bold">{p.numero_cte}</td>
                  <td className="p-3">{p.origem} → {p.destino}</td>
                  <td className="p-3">{p.tomador_nome}</td>
                  <td className="p-3">{p.uf}</td>
                  <td className="p-3 text-right">{brl(p.valor_icms)}</td>
                  <td className="p-3">
                    <input type="date" className={IC} value={vencimentos[p.id] || hoje()}
                      onChange={e => setVencimentos(v => ({ ...v, [p.id]: e.target.value }))}/>
                  </td>
                  <td className="p-3 text-right">
                    <button onClick={() => gerar(p)} disabled={acaoId === p.id}
                      className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold uppercase disabled:opacity-50 ml-auto">
                      {acaoId === p.id ? <Loader2 size={14} className="animate-spin"/> : <Receipt size={14}/>} Gerar GNRE
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100"><p className="font-bold text-gray-800">Guias geradas</p></div>
        {guias.length === 0 ? (
          <p className="p-6 text-center text-sm text-gray-400">Nenhuma guia ainda.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr><th className="text-left p-3">CT-e</th><th className="text-left p-3">Estado</th><th className="text-right p-3">Valor</th>
                <th className="text-left p-3">Vencimento</th><th className="text-left p-3">Situação</th><th className="text-right p-3">Ações</th></tr>
            </thead>
            <tbody>
              {guias.map(g => {
                const st = STATUS[g.status] || STATUS.processando
                return (
                  <tr key={g.id} className="border-t border-gray-100 align-top">
                    <td className="p-3 font-bold">{g.numero_cte}</td>
                    <td className="p-3">{g.uf_favorecida}</td>
                    <td className="p-3 text-right">{brl(Number(g.valor))}</td>
                    <td className="p-3">{g.data_vencimento ? g.data_vencimento.split('-').reverse().join('/') : ''}</td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded-lg text-xs font-bold ${st.c}`}>{st.t}</span>
                      {g.status === 'rejeitada' && g.motivo && <p className="text-xs text-red-600 mt-1 max-w-sm">{g.motivo}</p>}
                      {g.linha_digitavel && g.status === 'emitida' && <p className="text-xs font-mono text-gray-500 mt-1">{g.linha_digitavel}</p>}
                    </td>
                    <td className="p-3">
                      <div className="flex justify-end gap-1">
                        {acaoId === g.id && <Loader2 size={16} className="animate-spin text-gray-400"/>}
                        {g.status === 'processando' && <Botao t="Consultar no portal" onClick={() => acao(g, 'consultar')} icon={<RefreshCw size={14}/>}/>}
                        {g.linha_digitavel && <Botao t="Copiar linha digitável" onClick={() => copiar(g.linha_digitavel)} icon={<Copy size={14}/>}/>}
                        {g.pdf_path && <Botao t="Baixar PDF da guia" onClick={() => acao(g, 'pdf')} icon={<Download size={14}/>}/>}
                        {g.status === 'emitida' && <Botao t="Marcar como paga" onClick={() => acao(g, 'paga')} icon={<CheckCircle2 size={14}/>} cor="text-green-600"/>}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </section>
      <p className="text-xs text-gray-400">Se uma guia for rejeitada, corrija o que o portal pediu e gere de novo: a rejeitada não bloqueia uma nova.</p>
    </div>
  )
}

function Cartao({ t, v }: { t: string; v: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <p className="text-xs text-gray-500 uppercase font-semibold">{t}</p>
      <p className="text-2xl font-black text-gray-900 mt-1">{v}</p>
    </div>
  )
}

function Botao({ t, onClick, icon, cor = 'text-gray-600' }: { t: string; onClick: () => void; icon: React.ReactNode; cor?: string }) {
  return <button title={t} onClick={onClick} className={`p-2 rounded-lg hover:bg-gray-100 ${cor}`}>{icon}</button>
}
