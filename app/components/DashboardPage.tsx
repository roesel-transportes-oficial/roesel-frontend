'use client'
import { useState, useEffect } from 'react'
import { contratosAPI, motoristasAPI, caminhoesAPI } from '../services/api'
import { AlertTriangle, FileText, DollarSign, Users, Truck, Clock, TrendingUp } from 'lucide-react'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_KEY!

function diasParaVencer(data: string) {
  if (!data) return null
  const hoje = new Date()
  const venc = new Date(data + 'T00:00:00')
  return Math.ceil((venc.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))
}

function vencStatus(data: string) {
  const dias = diasParaVencer(data)
  if (dias === null) return null
  if (dias < 0) return 'vencido'
  if (dias <= 15) return 'critico'
  if (dias <= 30) return 'alerta'
  return 'ok'
}

export default function DashboardPage() {
  const [contratos, setContratos] = useState<any[]>([])
  const [motoristas, setMotoristas] = useState<any[]>([])
  const [caminhoes, setCaminhoes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const hoje = new Date()
  const mes = hoje.getMonth() + 1
  const ano = hoje.getFullYear()
  const nomeMes = hoje.toLocaleString('pt-BR', { month: 'long' })

  useEffect(() => {
    async function carregar() {
      const [c, m, cam] = await Promise.all([
        contratosAPI.listar({ mes, ano }),
        motoristasAPI.listar(),
        caminhoesAPI.listar(),
      ])
      setContratos(c)
      setMotoristas(m)
      setCaminhoes(cam)
      setLoading(false)
    }
    carregar()
  }, [])

  // Contratos do mês
  const totalContratos = contratos.length
  const totalFat = contratos.reduce((s: number, c: any) => s + (c.fat_bruto || 0), 0)
  const contratosAbertos = contratos.filter((c: any) => c.status === 'ABERTO').length
  const contratosPagos = contratos.filter((c: any) => c.status === 'PAGO').length

  // Motoristas de férias
  const deFerias = motoristas.filter((m: any) => m.de_ferias)

  // Caminhões parados
  const parados = caminhoes.filter((c: any) => c.status !== 'rodando')

  // Alertas de vencimento
  const alertasVenc: { nome: string; campo: string; dias: number; status: string }[] = []
  motoristas.filter((m: any) => m.ativo).forEach((m: any) => {
    const campos = [
      { label: 'CNH', data: m.vencimento_cnh },
      { label: 'Permisso', data: m.vencimento_permisso },
      { label: 'Toxicológico', data: m.vencimento_toxicologico },
      { label: 'Periódico', data: m.vencimento_periodico },
    ]
    campos.forEach(c => {
      const s = vencStatus(c.data)
      if (s && s !== 'ok') {
        alertasVenc.push({
          nome: m.nome,
          campo: c.label,
          dias: diasParaVencer(c.data) || 0,
          status: s,
        })
      }
    })
  })

  alertasVenc.sort((a, b) => a.dias - b.dias)

  if (loading) return (
    <div className="p-6 flex items-center justify-center h-64">
      <p className="text-gray-400 text-sm">Carregando...</p>
    </div>
  )

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Visão Geral</h1>
        <p className="text-sm text-gray-400 mt-1 capitalize">{nomeMes} de {ano}</p>
      </div>

      {/* Cards principais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-blue-100 rounded-xl flex items-center justify-center">
              <FileText size={16} className="text-blue-600" />
            </div>
            <p className="text-xs text-gray-500 font-medium">Contratos</p>
          </div>
          <p className="text-3xl font-bold text-gray-900">{totalContratos}</p>
          <p className="text-xs text-gray-400 mt-1">{contratosAbertos} abertos · {contratosPagos} pagos</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-green-100 rounded-xl flex items-center justify-center">
              <DollarSign size={16} className="text-green-600" />
            </div>
            <p className="text-xs text-gray-500 font-medium">Faturamento</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {totalFat.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </p>
          <p className="text-xs text-gray-400 mt-1">Bruto no mês</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-blue-100 rounded-xl flex items-center justify-center">
              <Users size={16} className="text-blue-600" />
            </div>
            <p className="text-xs text-gray-500 font-medium">De férias</p>
          </div>
          <p className="text-3xl font-bold text-gray-900">{deFerias.length}</p>
          <p className="text-xs text-gray-400 mt-1">motorista(s)</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-orange-100 rounded-xl flex items-center justify-center">
              <Truck size={16} className="text-orange-600" />
            </div>
            <p className="text-xs text-gray-500 font-medium">Parados</p>
          </div>
          <p className="text-3xl font-bold text-gray-900">{parados.length}</p>
          <p className="text-xs text-gray-400 mt-1">caminhão(ões)</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Alertas de vencimento */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={16} className="text-amber-500" />
            <h2 className="font-semibold text-gray-800 text-sm">Alertas de vencimento</h2>
          </div>
          {alertasVenc.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">Nenhum vencimento próximo</p>
          ) : (
            <div className="space-y-2">
              {alertasVenc.map((a, i) => (
                <div key={i} className={`flex items-center justify-between p-3 rounded-xl text-sm ${
                  a.status === 'vencido' ? 'bg-red-50' :
                  a.status === 'critico' ? 'bg-orange-50' : 'bg-yellow-50'
                }`}>
                  <div>
                    <p className={`font-medium text-xs ${
                      a.status === 'vencido' ? 'text-red-700' :
                      a.status === 'critico' ? 'text-orange-700' : 'text-yellow-700'
                    }`}>{a.nome}</p>
                    <p className={`text-xs ${
                      a.status === 'vencido' ? 'text-red-500' :
                      a.status === 'critico' ? 'text-orange-500' : 'text-yellow-600'
                    }`}>{a.campo}</p>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-lg ${
                    a.status === 'vencido' ? 'bg-red-100 text-red-700' :
                    a.status === 'critico' ? 'bg-orange-100 text-orange-700' : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {a.status === 'vencido' ? `${Math.abs(a.dias)}d atrás` : `${a.dias}d`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Motoristas de férias */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-base">🏖️</span>
            <h2 className="font-semibold text-gray-800 text-sm">Motoristas de férias</h2>
          </div>
          {deFerias.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">Nenhum motorista de férias</p>
          ) : (
            <div className="space-y-2">
              {deFerias.map((m: any) => {
                const substituto = motoristas.find((s: any) => s.id === m.substituto_id)
                const inicio = m.ferias_inicio ? new Date(m.ferias_inicio + 'T00:00:00').toLocaleDateString('pt-BR') : ''
                const fim = m.ferias_fim ? new Date(m.ferias_fim + 'T00:00:00').toLocaleDateString('pt-BR') : ''
                return (
                  <div key={m.id} className="bg-blue-50 rounded-xl p-3">
                    <p className="text-sm font-semibold text-blue-800">{m.nome}</p>
                    {inicio && fim && <p className="text-xs text-blue-500 mt-0.5">{inicio} → {fim}</p>}
                    {substituto && <p className="text-xs text-blue-600 mt-1">Substituto: {substituto.nome}</p>}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Caminhões parados */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <Truck size={16} className="text-orange-500" />
            <h2 className="font-semibold text-gray-800 text-sm">Caminhões parados</h2>
          </div>
          {parados.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">Todos os caminhões rodando</p>
          ) : (
            <div className="space-y-2">
              {parados.map((c: any) => {
                const dias = c.dt_parado
                  ? Math.ceil((new Date().getTime() - new Date(c.dt_parado + 'T00:00:00').getTime()) / (1000 * 60 * 60 * 24))
                  : null
                return (
                  <div key={c.id} className="bg-orange-50 rounded-xl p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-orange-800">{c.placa}</p>
                      {dias && <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-lg">{dias}d parado</span>}
                    </div>
                    <p className="text-xs text-orange-600 mt-0.5 capitalize">{c.status}</p>
                    {c.motivo_parado && <p className="text-xs text-orange-500 mt-0.5">{c.motivo_parado}</p>}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Últimos contratos */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={16} className="text-gray-500" />
            <h2 className="font-semibold text-gray-800 text-sm">Últimos contratos do mês</h2>
          </div>
          {contratos.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">Nenhum contrato este mês</p>
          ) : (
            <div className="space-y-2">
              {contratos.slice(0, 5).map((c: any) => (
                <div key={c.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-800">#{c.contrato}</p>
                    <p className="text-xs text-gray-400">{c.motorista}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-800">
                      {(c.fat_bruto || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      c.status === 'PAGO' ? 'bg-green-100 text-green-700' :
                      c.status === 'CANCELADO' ? 'bg-red-100 text-red-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>{c.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}