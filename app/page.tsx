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
import { useState, useEffect } from 'react'
import { useAuth } from './services/auth'
import Login from './components/Login'
import Sidebar from './components/Sidebar'

const FLAG_RECARREGOU = 'auto_reload_travado'

export default function Home() {
  const { user, loading } = useAuth()
  const [aba, setAba] = useState('dashboard')
  const [travouDemais, setTravouDemais] = useState(false)

  // ✅ Se a tela ficar em "loading" por mais de 8s, é sinal de que algo
  // travou (sessão presa, chamada que não resolve, etc.) — recarrega a
  // página automaticamente, sem precisar fechar e abrir a aba na mão.
  // O sessionStorage evita loop infinito: só recarrega automaticamente
  // uma vez; se travar de novo depois do reload, mostra um aviso em vez
  // de ficar recarregando sem parar.
  useEffect(() => {
    if (!loading) {
      try { sessionStorage.removeItem(FLAG_RECARREGOU) } catch {}
      return
    }

    const timer = setTimeout(() => {
      let jaTentou = false
      try { jaTentou = sessionStorage.getItem(FLAG_RECARREGOU) === '1' } catch {}

      if (jaTentou) {
        setTravouDemais(true)
      } else {
        try { sessionStorage.setItem(FLAG_RECARREGOU, '1') } catch {}
        window.location.reload()
      }
    }, 8000)

    return () => clearTimeout(timer)
  }, [loading])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center max-w-sm px-4">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-red-600 border-t-transparent mx-auto mb-4"></div>
          <p className="text-sm text-gray-600">Carregando...</p>
          {travouDemais && (
            <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-xl text-xs text-orange-700">
              Isso está demorando mais que o normal.
              <button
                onClick={() => window.location.reload()}
                className="block mx-auto mt-2 underline font-medium"
              >
                Clique aqui para recarregar
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  if (!user) return <Login />

  return (
    <div className="flex min-h-screen">
      <Sidebar aba={aba} setAba={setAba} />
      <main className="flex-1 ml-56 overflow-auto min-h-screen bg-gray-50">

        <div style={{ display: aba === 'dashboard'     ? 'block' : 'none' }}><DashboardPage /></div>
        <div style={{ display: aba === 'contratos'     ? 'block' : 'none' }}><ContratosPage /></div>
        <div style={{ display: aba === 'motorista'     ? 'block' : 'none' }}><MotoristaPage /></div>
        <div style={{ display: aba === 'caminhao'      ? 'block' : 'none' }}><CaminhaoPage /></div>
        <div style={{ display: aba === 'viagens'       ? 'block' : 'none' }}><ViagemPage /></div>
        <div style={{ display: aba === 'ferias'        ? 'block' : 'none' }}><FeriasPage /></div>
        <div style={{ display: aba === 'clientes'      ? 'block' : 'none' }}><ClientePage /></div>
        <div style={{ display: aba === 'abastecimento' ? 'block' : 'none' }}><AbastecimentoPage /></div>
        <div style={{ display: aba === 'fornecedor'    ? 'block' : 'none' }}><FornecedorPage /></div>
        <div style={{ display: aba === 'comissoes'     ? 'block' : 'none' }}><ComissoesPage /></div>
        <div style={{ display: aba === 'multas'        ? 'block' : 'none' }}><MultasPage /></div>
        <div style={{ display: aba === 'avarias'       ? 'block' : 'none' }}><AvariasPage /></div>
        <div style={{ display: aba === 'premios'       ? 'block' : 'none' }}><PremiosPage /></div>
        <div style={{ display: aba === 'contas_pagar'  ? 'block' : 'none' }}><ContasPagarPage /></div>

        {/* Desmontam ao sair — comportamento intencional */}
        {aba === 'novo'       && <NovoContratoPage setAba={setAba} />}
        {aba === 'fechamento' && <FechamentoViagemPage setAba={setAba} />}

        {/* Placeholders */}
        {aba === 'usuarios'       && <Placeholder title="Usuários" icon="👥" />}
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