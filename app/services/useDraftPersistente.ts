'use client'
import { useEffect, useState } from 'react'

// ✅ Gancho reutilizável pra qualquer formulário do sistema guardar
// rascunho automaticamente no navegador (sessionStorage), e recuperar
// sozinho se a aba recarregar sem você querer — o que agora sabemos
// que acontece quando o Chrome "descarta" a aba por falta de memória
// depois de muito tempo em segundo plano.
//
// Uso (dentro de qualquer componente de formulário):
//
//   const [form, setForm] = useDraftPersistente('chave_unica_da_tela', FORM_INICIAL)
//
// Funciona igual um useState normal — só que salva sozinho a cada
// mudança, e já carrega o rascunho salvo (se existir) na primeira
// renderização.
//
// Pra limpar o rascunho depois de salvar com sucesso (evita reabrir
// dado antigo depois que já foi enviado):
//
//   limparDraft('chave_unica_da_tela')

export function useDraftPersistente<T>(chave: string, valorInicial: T): [T, (v: T | ((prev: T) => T)) => void] {
  const [valor, setValorState] = useState<T>(() => {
    if (typeof window === 'undefined') return valorInicial
    try {
      const salvo = sessionStorage.getItem(`draft_${chave}`)
      return salvo ? JSON.parse(salvo) : valorInicial
    } catch {
      return valorInicial
    }
  })

  function setValor(v: T | ((prev: T) => T)) {
    setValorState(prev => {
      const novo = typeof v === 'function' ? (v as (prev: T) => T)(prev) : v
      try { sessionStorage.setItem(`draft_${chave}`, JSON.stringify(novo)) } catch {}
      return novo
    })
  }

  return [valor, setValor]
}

export function limparDraft(chave: string) {
  try { sessionStorage.removeItem(`draft_${chave}`) } catch {}
}
