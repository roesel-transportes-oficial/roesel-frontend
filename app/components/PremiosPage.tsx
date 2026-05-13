
'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../services/supabase'
import { Trophy, CheckCircle, XCircle, Fuel, FileText, AlertTriangle, ShieldAlert, Download, Clock, CheckCircle2, Search, Trash2 } from 'lucide-react'
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_KEY!

const META_FAT   = 127000
const META_MEDIA = 2.70

interface MotoristaRanking {
  nome: string; faturamento: number; media_km_l: number
  tem_multa: boolean; tem_avaria: boolean; aprovado: boolean
}

interface Premio {
  id: string; motorista: string; status: string; valor: number; obs: string; updated_at: string; fechamento_id?: string;
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
  const [buscaMotorista, setBuscaMotorista] = useState('');
  const [dataInicioFiltro, setDataInicioFiltro] = useState('');
  const [dataFimFiltro, setDataFimFiltro] = useState('');

  useEffect(() => { fetchPremios() }, [buscaMotorista, dataInicioFiltro, dataFimFiltro])
  useEffect(() => { if (tab === 'ranking') calcular() }, [tab, mes, ano])

  async function fetchPremios() {
    setLoadingPremios(true)
    try {
      let query = supabase.from('premios').select('*').order('updated_at', { ascending: false });

      if (buscaMotorista) {
        query = query.ilike('motorista', `%${buscaMotorista}%`);
      }
      if (dataInicioFiltro) {
        query = query.gte('updated_at', dataInicioFiltro + 'T00:00:00.000Z');
      }
      if (dataFimFiltro) {
        query = query.lte('updated_at', dataFimFiltro + 'T23:59:59.999Z');
      }

      const { data, error } = await query;
      if (error) throw error;
      if (data) setPremios(data as Premio[]);
    } catch (e) {
      console.error('Erro ao carregar prêmios:', e);
    }
    setLoadingPremios(false)
  }

  async function toggleStatus(premio: Premio) {
    const novoStatus = premio.status === 'pago' ? 'pendente' : 'pago'
    await supabase.from('premios').update({ status: novoStatus }).eq('id', premio.id)
    setPremios(prev => prev.map(p => p.id === premio.id ? { ...p, status: novoStatus } : p))
  }

  async function excluirPremio(id: string) {
    if (!confirm('Tem certeza que deseja excluir este prêmio?')) return;
    setLoadingPremios(true);
    try {
      await supabase.from('premios').delete().eq('id', id);
      setPremios(prev => prev.filter(p => p.id !== id));
    } catch (e) {
      console.error('Erro ao excluir prêmio:', e);
      alert('Erro ao excluir prêmio.');
    } finally {
      setLoadingPremios(false);
    }
  }

  function baixarFolhaPDF(p: Premio) {
    const doc = new jsPDF();
    const fmt = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    const dataGeracao = new Date(p.updated_at).toLocaleDateString('pt-BR');

    const linhas = p.obs.split(' | ');
    const campos = Object.fromEntries(
      linhas.map(l => { const [k, ...v] = l.split(': '); return [k?.trim(), v.join(': ')?.trim()] })
    );

    doc.setFontSize(18);
    doc.text('FOLHA DE PAGAMENTO - ROESEL TRANSPORTES', 14, 20);
    doc.setFontSize(12);
    doc.text(`Motorista: ${p.motorista}`, 14, 30);
    doc.text(`Data Geração: ${dataGeracao}`, 14, 37);
    doc.text(`Status: ${p.status.toUpperCase()}`, 14, 44);

    doc.setFontSize(14);
    doc.text('DETALHES DA VIAGEM', 14, 58);
    doc.setFontSize(12);
    doc.text(`Período: ${campos['Período'] || '—'}`, 14, 68);
    doc.text(`Vencimento: ${campos['Vencimento'] || '—'}`, 14, 75);
    doc.text(`Placa: ${campos['Placa'] || '—'}`, 14, 82);
    doc.text(`KM Rodado: ${campos['KM Rodado'] || '—'}`, 14, 89);
    doc.text(`Contratos: ${campos['Contratos'] || '—'}`, 14, 96);
    doc.text(`Abastecimento: ${campos['Abastecimento'] || '—'}`, 14, 103);
    doc.text(`Média: ${campos['Média'] || '—'}`, 14, 110);

    doc.setFontSize(14);
    doc.text('FINANCEIRO', 14, 124);
    doc.setFontSize(12);
    doc.text(`Comissão (10%): R$ ${fmt(p.valor)}`, 14, 134);

    doc.save(`folha_${p.motorista.replace(/ /g, '_')}_${dataGeracao.replace(/\//g, '-')}.pdf`);
  }

  function baixarTodasFolhasPDF() {
    const doc = new jsPDF();
    const fmt = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2 });

    const head = [['Motorista', 'Data Geração', 'Status', 'Comissão', 'Detalhes']];
    const body = premios.map(p => [
      p.motorista,
      new Date(p.updated_at).toLocaleDateString('pt-BR'),
      p.status.toUpperCase(),
      `R$ ${fmt(p.valor)}`,
      p.obs
    ]);

    (doc as any).autoTable({
      head: head,
      body: body,
      startY: 20,
      headStyles: { fillColor: [200, 200, 200], textColor: [0, 0, 0] },
      styles: { fontSize: 10, cellPadding: 3 },
      columnStyles: { 3: { halign: 'right' } },
    });

    doc.save(`todas_folhas_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.pdf`);
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

          {/* Cabeçalho com download geral e filtros */}
          <div className="flex flex-col md:flex-row items-center justify-between mb-4 gap-3">
            <h2 className="text-sm font-black text-gray-700 uppercase tracking-widest">
              Folhas de Pagamento
            </h2>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="text" placeholder="Buscar motorista..." value={buscaMotorista}
                  onChange={e => setBuscaMotorista(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-sm bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-red-500 transition-all" />
              </div>
              <input type="date" value={dataInicioFiltro} onChange={e => setDataInicioFiltro(e.target.value)}
                className="py-2 px-3 text-sm bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-red-500 transition-all" />
              <input type="date" value={dataFimFiltro} onChange={e => setDataFimFiltro(e.target.value)}
                className="py-2 px-3 text-sm bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-red-500 transition-all" />
              {premios.length > 0 && (
                <button onClick={baixarTodasFolhasPDF}
                  className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-xl text-xs font-black uppercase hover:bg-gray-800 transition">
                  <Download size={14} /> Baixar Todas
                </button>
              )}
            </div>
          </div>

          {loadingPremios ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
              <p className="text-sm text-gray-400">Carregando...</p>
            </div>
          ) : premios.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
              <Trophy size={32} className="mx-auto text-gray-200 mb-2" />
              <p className="text-sm text-gray-400">Nenhuma folha gerada ainda.</p>
              <p className="text-xs text-gray-300 mt-1">As folhas de pagamento aparecerão aqui após o fechamento de viagens.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {premios.map(p => (
                <div key={p.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-black text-gray-900 uppercase">{p.motorista}</h3>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest
                        ${p.status === 'pago' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {p.status}
                      </span>
                      <button onClick={() => excluirPremio(p.id)} className="text-gray-400 hover:text-red-600">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-gray-600">
                    {p.obs.split(' | ').map((item, i) => (
                      <p key={i} className="truncate">{item}</p>
                    ))}
                  </div>
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                    <p className="text-xl font-black text-green-600">R$ {fmt(p.valor)}</p>
                    <div className="flex gap-2">
                      <button onClick={() => toggleStatus(p)}
                        className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold uppercase transition-colors
                          ${p.status === 'pago' ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}>
                        {p.status === 'pago' ? <Clock size={12} /> : <CheckCircle2 size={12} />} 
                        {p.status === 'pago' ? 'Marcar como Pendente' : 'Marcar como Pago'}
                      </button>
                      <button onClick={() => baixarFolhaPDF(p)}
                        className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold uppercase bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors">
                        <Download size={12} /> Baixar Folha
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        /* ── Ranking ── */
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-black text-gray-700 uppercase tracking-widest">Ranking de Motoristas</h2>
            <div className="flex gap-2">
              <select value={mes} onChange={e => setMes(e.target.value)}
                className="py-2 px-3 text-sm bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-red-500 transition-all">
                {meses.map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
              </select>
              <select value={ano} onChange={e => setAno(e.target.value)}
                className="py-2 px-3 text-sm bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-red-500 transition-all">
                {anos.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="p-10 text-center">
              <p className="text-sm text-gray-400">Calculando ranking...</p>
            </div>
          ) : ranking.length === 0 ? (
            <div className="p-10 text-center">
              <Trophy size={32} className="mx-auto text-gray-200 mb-2" />
              <p className="text-sm text-gray-400">Nenhum motorista no ranking para este período.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {ranking.map((r, i) => (
                <div key={r.nome} className="bg-gray-50 rounded-2xl border border-gray-100 p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-black text-gray-400">#{i + 1}</span>
                    <div>
                      <p className="text-sm font-bold text-gray-900">{r.nome}</p>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span>Faturamento: R$ {fmt(r.faturamento)}</span>
                        <span>Média: {fmt(r.media_km_l)} km/L</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {r.tem_multa && <AlertTriangle size={16} className="text-yellow-500" />}
                    {r.tem_avaria && <ShieldAlert size={16} className="text-red-500" />}
                    {r.aprovado ? (
                      <CheckCircle size={20} className="text-green-500" />
                    ) : (
                      <XCircle size={20} className="text-red-500" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
