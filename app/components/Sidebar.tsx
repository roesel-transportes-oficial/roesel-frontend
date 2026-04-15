'use client'
import { useState } from 'react'
import { useAuth } from '../services/auth'
import { LayoutDashboard, FileText, FilePlus, User, DollarSign, Trophy, LogOut, Car, Fuel, Users, Building2, ChevronDown, ChevronRight, Wallet, TrendingUp, TrendingDown } from 'lucide-react'

const menus = [
  { id: 'dashboard',    label: 'Visão Geral',   icon: LayoutDashboard, adminOnly: false },
  { id: 'novo',         label: 'Novo Contrato', icon: FilePlus,        adminOnly: false },
  { id: 'contratos',    label: 'Contratos',     icon: FileText,        adminOnly: false },
  { id: 'motorista',    label: 'Motorista',     icon: User,            adminOnly: false },
  { id: 'caminhao',     label: 'Caminhão',      icon: Car,             adminOnly: false },
  { id: 'premios',      label: 'Prêmios',       icon: Trophy,          adminOnly: false },
  { id: 'usuarios',     label: 'Usuários',      icon: Users,           adminOnly: true  },
]

const isFinanceiro = (aba: string) => ['comissoes', 'contas_pagar', 'contas_receber'].includes(aba)
const isAbastecimento = (aba: string) => ['abastecimento', 'fornecedor'].includes(aba)

export default function Sidebar({ aba, setAba }: { aba: string; setAba: (a: string) => void }) {
  const { user, perm, logout } = useAuth()
  const [abastOpen, setAbastOpen] = useState(isAbastecimento(aba))
  const [finOpen, setFinOpen] = useState(isFinanceiro(aba))

  return (
    <aside className="fixed top-0 left-0 h-screen w-56 bg-gray-900 flex flex-col">
      <div className="p-4 border-b border-gray-700">
        <p className="text-xs text-gray-400">SESSÃO ATIVA</p>
        <p className="text-white font-medium">{user}</p>
        <p className="text-xs text-gray-400">{perm === 'total' ? 'Administrador' : 'Visualizador'}</p>
      </div>
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        <p className="text-xs text-gray-500 px-2 py-2">NAVEGAÇÃO</p>

        {menus.filter(m => !m.adminOnly || perm === 'total').map(m => (
          <button key={m.id} onClick={() => setAba(m.id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition
              ${aba === m.id ? 'bg-red-600 text-white' : 'text-gray-300 hover:bg-gray-800'}`}>
            <m.icon size={18} />
            {m.label}
          </button>
        ))}

        {/* Abastecimentos com submenu */}
        <div>
          <button
            onClick={() => {
              setAbastOpen(!abastOpen)
              if (!abastOpen) setAba('abastecimento')
            }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition
              ${isAbastecimento(aba) ? 'bg-red-600 text-white' : 'text-gray-300 hover:bg-gray-800'}`}>
            <Fuel size={18} />
            <span className="flex-1 text-left">Abastecimentos</span>
            {abastOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
          {abastOpen && (
            <div className="ml-4 mt-1 space-y-1 border-l border-gray-700 pl-3">
              <button onClick={() => setAba('abastecimento')}
                className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg text-xs transition
                  ${aba === 'abastecimento' ? 'text-white font-semibold' : 'text-gray-400 hover:text-gray-200'}`}>
                <Fuel size={14} /> Registros
              </button>
              <button onClick={() => setAba('fornecedor')}
                className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg text-xs transition
                  ${aba === 'fornecedor' ? 'text-white font-semibold' : 'text-gray-400 hover:text-gray-200'}`}>
                <Building2 size={14} /> Fornecedores
              </button>
            </div>
          )}
        </div>

        {/* Financeiro com submenu */}
        <div>
          <button
            onClick={() => {
              setFinOpen(!finOpen)
              if (!finOpen) setAba('comissoes')
            }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition
              ${isFinanceiro(aba) ? 'bg-red-600 text-white' : 'text-gray-300 hover:bg-gray-800'}`}>
            <Wallet size={18} />
            <span className="flex-1 text-left">Financeiro</span>
            {finOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
          {finOpen && (
            <div className="ml-4 mt-1 space-y-1 border-l border-gray-700 pl-3">
              <button onClick={() => setAba('comissoes')}
                className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg text-xs transition
                  ${aba === 'comissoes' ? 'text-white font-semibold' : 'text-gray-400 hover:text-gray-200'}`}>
                <DollarSign size={14} /> Comissões
              </button>
              <button onClick={() => setAba('contas_pagar')}
                className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg text-xs transition
                  ${aba === 'contas_pagar' ? 'text-white font-semibold' : 'text-gray-400 hover:text-gray-200'}`}>
                <TrendingDown size={14} /> Contas a Pagar
              </button>
              <button onClick={() => setAba('contas_receber')}
                className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg text-xs transition
                  ${aba === 'contas_receber' ? 'text-white font-semibold' : 'text-gray-400 hover:text-gray-200'}`}>
                <TrendingUp size={14} /> Contas a Receber
              </button>
            </div>
          )}
        </div>

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