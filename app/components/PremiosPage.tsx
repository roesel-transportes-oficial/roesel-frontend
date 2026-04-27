'use client'
import { useState, useEffect } from 'react'
import { Trophy, CheckCircle, XCircle, Fuel, FileText, AlertTriangle, ShieldAlert } from 'lucide-react'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_KEY!

const META_FAT = 127000
const META_MEDIA = 2.70

interface MotoristaRanking {
  nome: string
  faturamento: number
  media_km_l: number
  tem_multa: boolean
  tem_avaria: boolean
  aprovado: boolean
}

export default function PremiosPage() {
  const hoje = new Date()
  const [mes, setMes] = useState(String(hoje.getMonth() + 1).padStart(2, '0'))
  const [ano, setAno] = useState(String(hoje.getFullYear()))
  const [ranking, setRanking] = useState<MotoristaRanking[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => { calcular() }, [mes, ano])

  async function calcular() {
    setLoading(true)
    try {
      const inicioMes = `${ano}-${mes}-01`
      const fimMes = new Date(parseInt(ano), parseInt(mes), 0).toISOString().split('T')[0]

      // Busca motoristas ativos
      const resMotoristas = await fetch(`${SUPABASE_URL}/rest/v1/motoristas?ativo=eq.true&order=nome.asc`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
      })
      const motoristas = await resMotoristas.json()

      // Busca contratos do mês
      const resContratos = await fetch(
        `${SUPABASE_URL}/rest/v1/contratos?data=gte.${inicioMes}&data=lte.${fimMes}`,
        { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
      )
      const contratos = await resContratos.json()

      // Busca abastecimentos do mês
      const resAbast = await fetch(
        `${SUPABASE_URL}/rest/v1/abastecimentos?data=gte.${inicioMes}&data=lte.${fimMes}`,
        { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
      )
      const abastecimentos = await resAbast.json()

      // Busca multas do mês
      const resMultas = await fetch(
        `${SUPABASE_URL}/rest/v1/multas?data=gte.${inicioMes}&data=lte.${fimMes}`,
        { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
      )
      const multas = await resMultas.json()

      // Busca avarias do mês
      const resAvarias = await fetch(
        `${SUPABASE_URL}/rest/v1/avarias?data=gte.${inicioMes}&data=lte.${fimMes}`,
        { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
      )
      const avarias = await resAvarias.json()

      // Calcula ranking por motorista
      const result: MotoristaRanking[] = motoristas.map((m: any) => {
        const nome = m.nome

        // Faturamento
        const faturamento = contratos
          .filter((c: any) => c.motorista === nome)
          .reduce((s: number, c: any) => s + (c.fat_bruto || 0), 0)

        // Média km/l — usa registros com km ordenados por data
        const abastMotorista = abastecimentos
          .filter((a: any) => a.motorista === nome && a.km)
          .sort((a: any, b: any) => new Date(a.data).getTime() - new Date(b.data).getTime())

        let media_km_l = 0
        if (abastMotorista.length >= 2) {
          const kmPercorrido = abastMotorista[abastMotorista.length - 1].km - abastMotorista[0].km
          const litrosTotais = abastMotorista.slice(1).reduce((s: number, a: any) => s + (a.litros_combustivel || 0), 0)
          if (litrosTotais > 0) media_km_l = kmPercorrido / litrosTotais
        } else if (abastMotorista.length === 1) {
          // Se só tem um registro, não dá pra calcular km percorrido
          media_km_l = 0
        }

        // Multas e avarias
        const tem_multa = multas.some((mu: any) => mu.motorista === nome)
        const tem_avaria = avarias.some((av: any) => av.motorista === nome)

        const aprovado = faturamento >= META_FAT &&
          media_km_l >= META_MEDIA &&
          !tem_multa &&
          !tem_avaria

        return { nome, faturamento, media_km_l, tem_multa, tem_avaria, aprovado }
      })

      // Ordena: aprovados primeiro, depois por faturamento
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
    { v: '04', l: 'Abril' }, { v: '05', l: 'Maio' }, { v: '06', l: 'Junho' },
    { v: '07', l: 'Julho' }, { v: '08', l: 'Agosto' }, { v: '09', l: 'Setembro' },
    { v: '10', l: 'Outubro' }, { v: '11', l: 'Novembro' }, { v: '12', l: 'Dezembro' },
  ]

  const anos = ['2024', '2025', '2026', '2027']
  const aprovados = ranking.filter(r => r.aprovado)

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Trophy size={28} className="text-yellow-500" />
        <h1 className="text-2xl font-bold text-gray-900">Ranking de Prêmios</h1>
      </div>

      {/* Filtro de mês/ano */}
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

      {/* Critérios */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
          <FileText size={20} className="mx-auto text-blue-500 mb-1" />
          <p className="text-xs text-gray-500">Faturamento mín.</p>
          <p className="text-sm font-bold text-gray-800">R$ 127.000</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
          <Fuel size={20} className="mx-auto text-green-500 mb-1" />
          <p className="text-xs text-gray-500">Média mín.</p>
          <p className="text-sm font-bold text-gray-800">2,70 km/l</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
          <AlertTriangle size={20} className="mx-auto text-yellow-500 mb-1" />
          <p className="text-xs text-gray-500">Multas</p>
          <p className="text-sm font-bold text-gray-800">Nenhuma</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
          <ShieldAlert size={20} className="mx-auto text-red-500 mb-1" />
          <p className="text-xs text-gray-500">Avarias</p>
          <p className="text-sm font-bold text-gray-800">Nenhuma</p>
        </div>
      </div>

      {/* Banner aprovados */}
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

      {/* Ranking */}
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
                <div>
                  <p className="text-sm font-bold text-gray-900">{m.nome}</p>
                </div>
              </div>

              {/* Faturamento */}
              <div className="flex flex-col items-center">
                <p className="text-xs font-semibold text-gray-700">
                  {m.faturamento.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
                {m.faturamento >= META_FAT
                  ? <CheckCircle size={16} className="text-green-500 mt-1" />
                  : <XCircle size={16} className="text-red-400 mt-1" />
                }
              </div>

              {/* Média */}
              <div className="flex flex-col items-center">
                <p className="text-xs font-semibold text-gray-700">
                  {m.media_km_l > 0 ? m.media_km_l.toFixed(2) : '-'} km/l
                </p>
                {m.media_km_l >= META_MEDIA
                  ? <CheckCircle size={16} className="text-green-500 mt-1" />
                  : <XCircle size={16} className="text-red-400 mt-1" />
                }
              </div>

              {/* Multa/Avaria */}
              <div className="flex flex-col items-center">
                {!m.tem_multa && !m.tem_avaria
                  ? <CheckCircle size={16} className="text-green-500" />
                  : <div className="flex gap-1">
                      {m.tem_multa && <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">Multa</span>}
                      {m.tem_avaria && <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">Avaria</span>}
                    </div>
                }
              </div>

              {/* Status */}
              <div className="flex justify-center">
                {m.aprovado
                  ? <span className="bg-yellow-400 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                      🏆 Elegível
                    </span>
                  : <span className="bg-gray-100 text-gray-500 text-xs px-3 py-1 rounded-full">
                      Não elegível
                    </span>
                }
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}