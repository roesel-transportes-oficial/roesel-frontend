'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '../services/auth'

const AVISO_ID = 'roesel-atualizacao-seguranca-v1'

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
            O sistema recebeu melhorias importantes para aumentar a segurança e a organização das informações. Agora existe confirmação de e-mail, troca obrigatória de senha a cada 60 dias e correções nos históricos, abastecimentos, fechamentos e placas dos caminhões.
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
