'use client'

import ContratosPage from './components/ContratosPage'
import MotoristaPage from './components/MotoristaPage'
import NovoContratoPage from './components/NovoContratoPage'
import CaminhaoPage from './components/CaminhaoPage'
import DashboardPage from './components/DashboardPage'
import AbastecimentoPage from './components/AbastecimentoPage'
import FornecedorPage from './components/FornecedorPage'
import ComissoesPage from './components/ComissoesPage'
import ClientePage from './components/ClientePage'
import MultasPage from './components/MultasPage'
import AvariasPage from './components/AvariasPage'
import PremiosPage from './components/PremiosPage'
import ViagemPage from './components/ViagemPage'
import FeriasPage from './components/FeriasPage'
import FechamentoViagemPage from './components/FechamentoViagemPage'
import ContasPagarPage from './components/ContasPagarPage'
import CtePage from './components/CtePage'
import NotasDiversasPage from './components/NotasDiversasPage'
import { useState } from 'react'
import { useAuth } from './services/auth'
import Login from './components/Login'
import Sidebar from './components/Sidebar'

const ABAS_INICIAIS = new Set(['dashboard'])

export default function Home() {
  const { user, loading } = useAuth()
  const [aba, setAba] = useState('dashboard')
  const [abasVisitadas, setAbasVisitadas] = useState<Set<string>>(ABAS_INICIAIS)

  function navegarPara(novaAba: string) {
    setAba(novaAba)
    setAbasVisitadas((atuais) => {
      if (atuais.has(novaAba)) return atuais
      const atualizadas = new Set(atuais)
      atualizadas.add(novaAba)
      return atualizadas
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-red-600 border-t-transparent mx-auto mb-4"></div>
          <p className="text-sm text-gray-600">Carregando...</p>
        </div>
      </div>
    )
  }

  if (!user) return <Login />

  return (
    <div className="flex min-h-screen">
      <Sidebar aba={aba} setAba={navegarPara} />
      <main className="flex-1 ml-56 overflow-auto min-h-screen bg-gray-50">
        {Array.from(abasVisitadas).map((abaVisitada) => (
          <div
            key={abaVisitada}
            style={{ display: aba === abaVisitada ? 'block' : 'none' }}
            aria-hidden={aba !== abaVisitada}
          >
            {renderizarAba(abaVisitada, navegarPara)}
          </div>
        ))}
      </main>
    </div>
  )
}

function renderizarAba(aba: string, setAba: (novaAba: string) => void) {
  switch (aba) {
    case 'dashboard': return <DashboardPage />
    case 'contratos': return <ContratosPage />
    case 'motorista': return <MotoristaPage />
    case 'caminhao': return <CaminhaoPage />
    case 'viagens': return <ViagemPage />
    case 'ferias': return <FeriasPage />
    case 'clientes': return <ClientePage />
    case 'abastecimento': return <AbastecimentoPage />
    case 'fornecedor': return <FornecedorPage />
    case 'comissoes': return <ComissoesPage />
    case 'multas': return <MultasPage />
    case 'avarias': return <AvariasPage />
    case 'premios': return <PremiosPage />
    case 'contas_pagar': return <ContasPagarPage />
    case 'cte': return <CtePage />
    case 'notas': return <NotasDiversasPage />
    case 'novo': return <NovoContratoPage setAba={setAba} />
    case 'fechamento': return <FechamentoViagemPage setAba={setAba} />
    case 'usuarios': return <Placeholder title="Usuários" icon="👥" />
    case 'contas_receber': return <Placeholder title="Contas a Receber" icon="📈" />
    default: return <DashboardPage />
  }
}

function Placeholder({ title, icon }: { title: string; icon: string }) {
  return (
    <div className="p-6">
      <h1 className="text-xl font-bold text-gray-900 mb-2">{icon} {title}</h1>
      <p className="text-gray-500 text-sm">Em construção...</p>
    </div>
  )
}
