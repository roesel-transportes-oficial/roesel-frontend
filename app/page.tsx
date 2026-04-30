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
import { useState } from 'react'
import { useAuth } from './services/auth'
import Login from './components/Login'
import Sidebar from './components/Sidebar'

export default function Home() {
  const { user, loading } = useAuth()
  const [aba, setAba] = useState('dashboard')

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
      <Sidebar aba={aba} setAba={setAba} />
      <main className="flex-1 ml-56 overflow-auto min-h-screen bg-gray-50">
        {aba === 'dashboard'      && <DashboardPage />}
        {aba === 'novo'           && <NovoContratoPage setAba={setAba} />}
        {aba === 'contratos'      && <ContratosPage />}
        {aba === 'viagens'        && <ViagemPage />}
        {aba === 'motorista'      && <MotoristaPage />}
        {aba === 'ferias'         && <FeriasPage />}
        {aba === 'caminhao'       && <CaminhaoPage />}
        {aba === 'clientes'       && <ClientePage />}
        {aba === 'abastecimento'  && <AbastecimentoPage />}
        {aba === 'fornecedor'     && <FornecedorPage />}
        {aba === 'comissoes'      && <ComissoesPage />}
        {aba === 'multas'         && <MultasPage />}
        {aba === 'avarias'        && <AvariasPage />}
        {aba === 'premios'        && <PremiosPage />}
        {aba === 'usuarios'       && <Placeholder title="Usuários" icon="👥" />}
        {aba === 'contas_pagar'   && <Placeholder title="Contas a Pagar" icon="📉" />}
        {aba === 'contas_receber' && <Placeholder title="Contas a Receber" icon="📈" />}
      </main>
    </div>
  )
}

function Placeholder({ title, icon }: { title: string; icon: string }) {
  return (
    <div className="p-6">
      <h1 className="text-xl font-bold text-gray-900 mb-2">{icon} {title}</h1>
      <p className="text-gray-500 text-sm">Em construção...</p>
    </div>
  )
}