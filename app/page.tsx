'use client'
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
        {aba === 'dashboard'  && <Placeholder title="Visão Geral"    icon="📊" />}
        {aba === 'novo'       && <Placeholder title="Novo Contrato"  icon="📄" />}
        {aba === 'contratos'  && <Placeholder title="Contratos"      icon="📋" />}
        {aba === 'motorista'  && <Placeholder title="Motoristas"     icon="👤" />}
        {aba === 'frota'      && <Placeholder title="Frota"          icon="🚛" />}
        {aba === 'comissoes'  && <Placeholder title="Comissões"      icon="💳" />}
        {aba === 'premios'    && <Placeholder title="Prêmios"        icon="🏆" />}
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