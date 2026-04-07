'use client'
import { useAuth } from '../services/auth'
import { LayoutDashboard, FileText, FilePlus, User, Truck, DollarSign, Trophy, LogOut } from 'lucide-react'

const menus = [
  { id: 'dashboard', label: 'Visão Geral',    icon: LayoutDashboard },
  { id: 'novo',      label: 'Novo Contrato',  icon: FilePlus },
  { id: 'contratos', label: 'Contratos',      icon: FileText },
  { id: 'motorista', label: 'Motorista',      icon: User },
  { id: 'frota',     label: 'Frota',          icon: Truck },
  { id: 'comissoes', label: 'Comissões',      icon: DollarSign },
  { id: 'premios',   label: 'Prêmios',        icon: Trophy },
]

export default function Sidebar({ aba, setAba }: { aba: string; setAba: (a: string) => void }) {
  const { user, logout } = useAuth()

  return (
    <aside className="fixed top-0 left-0 h-screen w-56 bg-gray-900 flex flex-col">
      <div className="p-4 border-b border-gray-700">
        <p className="text-xs text-gray-400">SESSÃO ATIVA</p>
        <p className="text-white font-medium">Erick</p>
        <p className="text-xs text-gray-400">{user}</p>
      </div>
      <nav className="flex-1 p-2 space-y-1">
        <p className="text-xs text-gray-500 px-2 py-2">NAVEGAÇÃO</p>
        {menus.map(m => (
          <button key={m.id} onClick={() => setAba(m.id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition
              ${aba === m.id ? 'bg-red-600 text-white' : 'text-gray-300 hover:bg-gray-800'}`}>
            <m.icon size={18} />
            {m.label}
          </button>
        ))}
      </nav>
      <div className="p-3 border-t border-gray-700">
        <button onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-300 hover:bg-gray-800 transition">
          <LogOut size={18} /> Sair
        </button>
      </div>
    </aside>
  )
}