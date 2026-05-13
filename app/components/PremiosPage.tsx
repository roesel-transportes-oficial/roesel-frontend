'use client'
import { useState, useEffect } from 'react'
import { Trophy, CheckCircle, XCircle, Fuel, FileText, AlertTriangle, ShieldAlert, Download, Clock, CheckCircle2 } from 'lucide-react'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_KEY!

const META_FAT   = 127000
const META_MEDIA = 2.70

interface MotoristaRanking {
  nome: string; faturamento: number; media_km_l: number
  tem_multa: boolean; tem_avaria: boolean; aprovado: boolean
}

interface Premio {
  id: string; motorista: string; status: string; valor: number; obs: string; updated_at: string
}

export default function PremiosPage() {
  const hoje = new Date()
  const [tab, setTab]       = useState<'folhas' | 'ranking'>('folhas')
  const [mes, setMes]       = useState(String(hoje.getMonth() + 1).padStart(2, '0'))
  const [ano, setAno]       = useState(String(hoje.getFullYear()))
  const [ranking, setRanking] = useState<MotoristaRanking[]>([])
  const [premios, setPremios] = useState<Premio[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingPremios, setLoadingPremios] = useState(false)

  useEffect(() => { fetchPremios() }, [])
  useEffect(() => { if (tab === 'ranking') calcular() }, [tab, mes, ano])

  async function fetchPremios() {
    setLoadingPremios(true)
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/premios?order=updated_at.desc`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
      })
      const data = await res.json()
      if (Array.isArray(data)) setPremios(data)
    } catch {}
    setLoadingPremios(false)
  }

  async function toggleStatus(premio: Premio) {
    const novoStatus = premio.status === 'pago' ? 'pendente' : 'pago'
    await fetch(`${SUPABASE_URL}/rest/v1/premios?id=eq.${premio.id}`, {
      method: 'PATCH',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ status: novoStatus })
    })
    setPremios(prev => prev.map(p => p.id === premio.id ? { ...p, status: novoStatus } : p))
  }

  function baixarFolha(p: Premio) {
    const fmt = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
    const data = new Date(p.updated_at).toLocaleDateString('pt-BR')

    // Parseia os campos do obs
    const linhas = p.obs.split(' | ')
    const campos = Object.fromEntries(
      linhas.map(l => { const [k, ...v] = l.split(': '); return [k?.trim(), v.join(': ')?.trim()] })
    )

    const csv = [
      ['FOLHA DE PAGAMENTO - ROESEL TRANSPORTES'],
      [''],
      ['Motorista', p.motorista],
      ['Data Geração', data],
      ['Status', p.status.toUpperCase()],
      [''],
      ['DETALHES DA VIAGEM'],
      ['Período',     campos['Período']     || '—'],
      ['Vencimento',  campos['Vencimento']  || '—'],
      ['Placa',       campos['Placa']       || '—'],
      ['KM Rodado',   campos['KM Rodado']   || '—'],
      ['Contratos',   campos['Contratos']   || '—'],
      ['Abastecimento', campos['Abastecimento'] || '—'],
      ['Média',       campos['Média']       || '—'],
      [''],
      ['FINANCEIRO'],
      ['Comissão (10%)', `R$ ${fmt(p.valor)}`],
    ]
    const csvStr = csv.map(r => r.join(';')).join('\n')
    const blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `folha_${p.motorista.replace(/ /g, '_')}_${data.replace(/\//g, '-')}.csv`
    link.click()
  }

  function baixarTodasFolhas() {
    const fmt = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
    const rows = [
      ['Motorista', 'Data', 'Status', 'Comissão', 'Detalhes'],
      ...premios.map(p => [
        p.motorista,
        new Date(p.updated_at).toLocaleDateString('pt-BR'),
        p.status.toUpperCase(),
        `R$ ${fmt(p.valor)}`,
        p.obs
      ])
    ]
    const csv = rows.map(r => r.join(';')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `todas_folhas_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.csv`
    link.click()
  }

  async function calcular() {
    setLoading(true)
    try {
      const inicioMes = `${ano}-${mes}-01`
      const fimMes    = new Date(parseInt(ano), parseInt(mes), 0).toISOString().split('T')[0]

      const [resM, resC, resA, resMu, resAv] = await Promise.all([
        fetch(`${SUPABASE_URL}/rest/v1/motoristas?ativo=eq.true&order=nome.asc`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }),
        fetch(`${SUPABASE_URL}/rest/v1/contratos?data=gte.${inicioMes}&data=lte.${fimMes}`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }),
        fetch(`${SUPABASE_URL}/rest/v1/abastecimentos?data=gte.${inicioMes}&data=lte.${fimMes}`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }),
        fetch(`${SUPABASE_URL}/rest/v1/multas?data=gte.${inicioMes}&data=lte.${fimMes}`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }),
        fetch(`${SUPABASE_URL}/rest/v1/avarias?data=gte.${inicioMes}&data=lte.${fimMes}`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }),
      ])

      const [motoristas, contratos, abastecimentos, multas, avarias] = await Promise.all([
        resM.json(), resC.json(), resA.json(), resMu.json(), resAv.json()
      ])

      const result: MotoristaRanking[] = motoristas.map((m: any) => {
        const nome        = m.nome
        const faturamento = contratos.filter((c: any) => c.motorista === nome).reduce((s: number, c: any) => s + (c.fat_bruto || 0), 0)
        const abastM      = abastecimentos.filter((a: any) => a.motorista === nome && a.km).sort((a: any, b: any) => new Date(a.data).getTime() - new Date(b.data).getTime())
        let media_km_l    = 0
        if (abastM.length >= 2) {
          const kmPercorrido  = abastM[abastM.length - 1].km - abastM[0].km
          const litrosTotais  = abastM.slice(1).reduce((s: number, a: any) => s + (a.litros_combustivel || 0), 0)
          if (litrosTotais > 0) media_km_l = kmPercorrido / litrosTotais
        }
        const tem_multa  = multas.some((mu: any) => mu.motorista === nome)
        const tem_avaria = avarias.some((av: any) => av.motorista === nome)
        const aprovado   = faturamento >= META_FAT && media_km_l >= META_MEDIA && !tem_multa && !tem_avaria
        return { nome, faturamento, media_km_l, tem_multa, tem_avaria, aprovado }
      })

      result.sort((a, b) => {
        if (a.aprovado && !b.aprovado) return -1
        if (!a.aprovado && b.aprovado) return 1
        return b.faturamento - a.faturamento
      })

      setRanking(result.filter(r => r.faturamento > 0 || r.media_km_l > 0 || r.tem_multa || r.tem_avaria))
    } catch {}
    setLoading(false)
  }

  const meses = [
    { v: '01', l: 'Janeiro' }, { v: '02', l: 'Fevereiro' }, { v: '03', l: 'Março' },
    { v: '04', l: 'Abril'   }, { v: '05', l: 'Maio'      }, { v: '06', l: 'Junho'  },
    { v: '07', l: 'Julho'   }, { v: '08', l: 'Agosto'    }, { v: '09', l: 'Setembro' },
    { v: '10', l: 'Outubro' }, { v: '11', l: 'Novembro'  }, { v: '12', l: 'Dezembro' },
  ]
  const anos      = ['2024', '2025', '2026', '2027']
  const aprovados = ranking.filter(r => r.aprovado)
  const fmt       = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2 })

  const pendentes = premios.filter(p => p.status === 'pendente')
  const pagos     = premios.filter(p => p.status === 'pago')

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Trophy size={28} className="text-yellow-500" />
          <h1 className="text-2xl font-bold text-gray-900">Prêmios</h1>
        </div>
        {/* Tabs */}
        <div className="flex bg-gray-100 p-1 rounded-xl">
          <button onClick={() => setTab('folhas')}
            className={`px-5 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all
              ${tab === 'folhas' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>
            Folhas Geradas
          </button>
          <button onClick={() => setTab('ranking')}
            className={`px-5 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all
              ${tab === 'ranking' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>
            Ranking
          </button>
        </div>
      </div>

      {tab === 'folhas' ? (
        <>
          {/* Resumo */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
              <p className="text-xs text-gray-400 font-bold uppercase mb-1">Total Geradas</p>
              <p className="text-2xl font-black text-gray-900">{premios.length}</p>
            </div>
            <div className="bg-yellow-50 rounded-2xl border border-yellow-100 shadow-sm p-4 text-center">
              <Clock size={18} className="mx-auto text-yellow-500 mb-1" />
              <p className="text-xs text-yellow-600 font-bold uppercase mb-1">Pendentes</p>
              <p className="text-2xl font-black text-yellow-700">{pendentes.length}</p>
            </div>
            <div className="bg-green-50 rounded-2xl border border-green-100 shadow-sm p-4 text-center">
              <CheckCircle2 size={18} className="mx-auto text-green-500 mb-1" />
              <p className="text-xs text-green-600 font-bold uppercase mb-1">Pagos</p>
              <p className="text-2xl font-black text-green-700">{pagos.length}</p>
            </div>
          </div>

          {/* Cabeçalho com download geral */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-black text-gray-700 uppercase tracking-widest">
              Folhas de Pagamento
            </h2>
            {premios.length > 0 && (
              <button onClick={baixarTodasFolhas}
                className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-xl text-xs font-black uppercase hover:bg-gray-800 transition">
                <Download size={14} /> Baixar Todas
              </button>
            )}
          </div>

          {loadingPremios ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
              <p className="text-sm text-gray-400">Carregando...</p>
            </div>
          ) : premios.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
              <Trophy size={32} className="mx-auto text-gray-200 mb-2" />
              <p className="text-sm text-gray-400">Nenhuma folha gerada ainda.</p>
              <p className="text-xs text-gray-300 mt-1">As folhas são criadas ao finalizar um Fechamento de Viagem.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {premios.map(p => (
                <div key={p.id}
                  className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all
                    ${p.status === 'pago' ? 'border-green-100' : 'border-gray-100'}`}>
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <p className="text-base font-black text-gray-900">{p.motorista}</p>
                          <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full
                            ${p.status === 'pago' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                            {p.status}
                          </span>
                        </div>
                        {/* Detalhes do obs */}
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1 mt-3">
                          {p.obs.split(' | ').map((item, i) => {
                            const [label, ...rest] = item.split(': ')
                            const valor = rest.join(': ')
                            if (!label || !valor) return null
                            return (
                              <div key={i}>
                                <p className="text-[9px] font-black text-gray-400 uppercase">{label}</p>
                                <p className="text-xs font-bold text-gray-700">{valor}</p>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Comissão</p>
                        <p className="text-2xl font-black text-green-600">R$ {fmt(p.valor)}</p>
                        <p className="text-[10px] text-gray-400 mt-1">
                          {new Date(p.updated_at).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-50">
                      <button onClick={() => toggleStatus(p)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase transition-all
                          ${p.status === 'pago'
                            ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            : 'bg-green-600 text-white hover:bg-green-700'}`}>
                        {p.status === 'pago'
                          ? <><Clock size={13} /> Marcar Pendente</>
                          : <><CheckCircle2 size={13} /> Marcar como Pago</>}
                      </button>
                      <button onClick={() => baixarFolha(p)}
                        className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-xl text-xs font-black uppercase hover:bg-gray-800 transition">
                        <Download size={13} /> Baixar Folha
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        /* ── RANKING ── */
        <>
          <div className="flex gap-3 mb-6">
            <select value={mes} onChange={e => setMes(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-white">
              {meses.map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
            </select>
            <select value={ano} onChange={e => setAno(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-white">
              {anos.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            <button onClick={calcular} disabled={loading}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition disabled:opacity-50">
              {loading ? 'Calculando...' : 'Atualizar'}
            </button>
          </div>

          <div className="grid grid-cols-4 gap-3 mb-6">
            {[
              { icon: <FileText size={20} className="mx-auto text-blue-500 mb-1" />, label: 'Faturamento mín.', value: 'R$ 127.000' },
              { icon: <Fuel size={20} className="mx-auto text-green-500 mb-1" />, label: 'Média mín.', value: '2,70 km/l' },
              { icon: <AlertTriangle size={20} className="mx-auto text-yellow-500 mb-1" />, label: 'Multas', value: 'Nenhuma' },
              { icon: <ShieldAlert size={20} className="mx-auto text-red-500 mb-1" />, label: 'Avarias', value: 'Nenhuma' },
            ].map(c => (
              <div key={c.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
                {c.icon}
                <p className="text-xs text-gray-500">{c.label}</p>
                <p className="text-sm font-bold text-gray-800">{c.value}</p>
              </div>
            ))}
          </div>

          {aprovados.length > 0 && (
            <div className="mb-6 p-4 bg-gradient-to-r from-yellow-400 to-yellow-500 rounded-2xl">
              <div className="flex items-center gap-2 mb-2">
                <Trophy size={20} className="text-white" />
                <p className="text-white font-bold">{aprovados.length} motorista(s) elegível(is) ao prêmio!</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {aprovados.map(m => (
                  <span key={m.nome} className="bg-white/30 text-white text-xs font-semibold px-3 py-1 rounded-full">
                    🏆 {m.nome}
                  </span>
                ))}
              </div>
            </div>
          )}

          {loading ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
              <p className="text-sm text-gray-400">Calculando ranking...</p>
            </div>
          ) : ranking.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
              <Trophy size={32} className="mx-auto text-gray-200 mb-2" />
              <p className="text-sm text-gray-400">Nenhum dado encontrado para este período</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 grid grid-cols-6 gap-2">
                <p className="text-xs font-semibold text-gray-400 uppercase col-span-2">Motorista</p>
                <p className="text-xs font-semibold text-gray-400 uppercase text-center">Faturamento</p>
                <p className="text-xs font-semibold text-gray-400 uppercase text-center">Média km/l</p>
                <p className="text-xs font-semibold text-gray-400 uppercase text-center">Multa/Avaria</p>
                <p className="text-xs font-semibold text-gray-400 uppercase text-center">Status</p>
              </div>
              {ranking.map((m, i) => (
                <div key={m.nome}
                  className={`grid grid-cols-6 gap-2 items-center px-5 py-4 border-b border-gray-50 last:border-0
                    ${m.aprovado ? 'bg-yellow-50' : ''}`}>
                  <div className="col-span-2 flex items-center gap-3">
                    <span className="text-lg font-bold text-gray-400">#{i + 1}</span>
                    <p className="text-sm font-bold text-gray-900">{m.nome}</p>
                  </div>
                  <div className="flex flex-col items-center">
                    <p className="text-xs font-semibold text-gray-700">
                      {m.faturamento.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </p>
                    {m.faturamento >= META_FAT ? <CheckCircle size={16} className="text-green-500 mt-1" /> : <XCircle size={16} className="text-red-400 mt-1" />}
                  </div>
                  <div className="flex flex-col items-center">
                    <p className="text-xs font-semibold text-gray-700">{m.media_km_l > 0 ? m.media_km_l.toFixed(2) : '-'} km/l</p>
                    {m.media_km_l >= META_MEDIA ? <CheckCircle size={16} className="text-green-500 mt-1" /> : <XCircle size={16} className="text-red-400 mt-1" />}
                  </div>
                  <div className="flex flex-col items-center">
                    {!m.tem_multa && !m.tem_avaria
                      ? <CheckCircle size={16} className="text-green-500" />
                      : <div className="flex gap-1">
                          {m.tem_multa  && <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">Multa</span>}
                          {m.tem_avaria && <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">Avaria</span>}
                        </div>}
                  </div>
                  <div className="flex justify-center">
                    {m.aprovado
                      ? <span className="bg-yellow-400 text-white text-xs font-bold px-3 py-1 rounded-full">🏆 Elegível</span>
                      : <span className="bg-gray-100 text-gray-500 text-xs px-3 py-1 rounded-full">Não elegível</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}