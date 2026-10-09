'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '../services/auth'

const AVISO_ID = 'roesel-atualizacao-abastecimentos-v2'

export default function AvisoAtualizacao() {
  const { email } = useAuth()
  const [visivel, setVisivel] = useState(false)

  useEffect(() => {
    if (!email) return

    const chave = `${AVISO_ID}:${email.toLowerCase()}`
    const jaVisto = window.localStorage.getItem(chave)
    if (!jaVisto) setVisivel(true)
  }, [email])

  function fechar() {
    if (email) {
      const chave = `${AVISO_ID}:${email.toLowerCase()}`
      window.localStorage.setItem(chave, new Date().toISOString())
    }
    setVisivel(false)
  }

  if (!visivel) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="aviso-atualizacao-titulo">
      <div className="w-full max-w-xl overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="bg-red-700 px-6 py-5 text-white">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-red-100">Aviso importante</p>
          <h2 id="aviso-atualizacao-titulo" className="mt-1 text-2xl font-black">Atualização do sistema</h2>
        </div>

        <div className="px-6 py-6 text-sm leading-7 text-gray-700">
          <p>
            O sistema recebeu novas melhorias no módulo de Abastecimentos para aumentar o controle, a conferência e a economia da frota.
          </p>

          <p className="mt-4">
            Agora é possível informar cidade/UF do posto, tipo de combustível e se o abastecimento foi com tanque cheio. O sistema também apresenta alertas para hodômetro inconsistente, consumo fora da faixa esperada, tanque cheio com poucos litros e preços acima da média local.
          </p>

          <p className="mt-4">
            Foram adicionados indicadores de gasto total, litros, preço médio, menor e maior preço, KM rodados e custo por KM, além de comparativos por região, posto, placa e motorista, estimativa de economia, novos filtros e relatório Excel com os alertas.
          </p>

          <p className="mt-4 font-semibold text-gray-900">
            Se encontrar qualquer comportamento diferente, avise o desenvolvedor.
          </p>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-gray-100 bg-gray-50 px-6 py-4 sm:flex-row sm:justify-end">
          <button onClick={fechar} className="rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-bold text-gray-600 transition hover:border-red-300 hover:text-red-700">
            Fechar
          </button>
          <button onClick={fechar} className="rounded-xl bg-red-700 px-5 py-3 text-sm font-black text-white transition hover:bg-red-800">
            Entendi
          </button>
        </div>
      </div>
    </div>
  )
}
