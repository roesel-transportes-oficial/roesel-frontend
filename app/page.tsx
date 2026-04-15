'use client'
import ContratosPage from './components/ContratosPage'
import MotoristaPage from './components/MotoristaPage'
import NovoContratoPage from './components/NovoContratoPage'
import CaminhaoPage from './components/CaminhaoPage'
import DashboardPage from './components/DashboardPage'
import AbastecimentoPage from './components/AbastecimentoPage'
import FornecedorPage from './components/FornecedorPage'
import ComissoesPage from './components/ComissoesPage'
import { useState } from 'react'
import { useAuth } from './services/auth'
import Login from './components/Login'
import Sidebar from './components/Sidebar'

export default function Home() {
  const { user } = useAuth()
  const [aba, setAba] = useState('dashboard')

  if (!user) return <Login />

  return (
    <div className="flex min-h-screen">
      <Sidebar aba={aba} setAba={setAba} />
      <main className="flex-1 ml-56 overflow-auto min-h-screen bg-gray-50">
        {aba === 'dashboard'     && <DashboardPage />}
        {aba === 'novo'          && <NovoContratoPage setAba={setAba} />}
        {aba === 'contratos'     && <ContratosPage />}
        {aba === 'motorista'     && <MotoristaPage />}
        {aba === 'caminhao'      && <CaminhaoPage />}
        {aba === 'abastecimento' && <AbastecimentoPage />}
        {aba === 'fornecedor'    && <FornecedorPage />}
        {aba === 'comissoes'     && <ComissoesPage />}
        {aba === 'premios'       && <Placeholder title="Prêmios" icon="🏆" />}
        {aba === 'usuarios'      && <Placeholder title="Usuários" icon="👥" />}
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