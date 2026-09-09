export function normalizarPlaca(valor: unknown): string {
  const original = String(valor ?? '').trim().toUpperCase()
  const compacta = original.replace(/[^A-Z0-9]/g, '')

  // Padrão antigo: AAA-1234. Mantém o padrão antigo e apenas
  // acrescenta o hífen quando a placa foi digitada sem formatação.
  if (/^[A-Z]{3}\d{4}$/.test(compacta)) {
    return `${compacta.slice(0, 3)}-${compacta.slice(3)}`
  }

  // Padrão Mercosul: AAA-1A11. Também apenas garante o hífen.
  if (/^[A-Z]{3}\d[A-Z]\d{2}$/.test(compacta)) {
    return `${compacta.slice(0, 3)}-${compacta.slice(3)}`
  }

  // Valores incompletos ou fora do padrão não são inventados nem alterados
  // além de caixa alta e espaços nas pontas.
  return original
}

export function placaValida(valor: unknown): boolean {
  const bruto = String(valor ?? '').trim().toUpperCase()
  const compacto = bruto.replace(/[^A-Z0-9]/g, '')
  if (!compacto) return false

  // Aceita a placa antiga AAA-1234 para convertê-la ao Mercosul.
  if (/^[A-Z]{3}[0-9]{4}$/.test(compacto)) return true

  // Aceita o Mercosul já pronto ou com O/I nas posições numéricas,
  // que normalizarPlaca corrige quando a estrutura é reconhecível.
  const normalizada = normalizarPlaca(bruto)
  return /^[A-Z]{3}-[0-9][A-Z][0-9]{2}$/.test(normalizada)
}

export function chavePlaca(valor: unknown): string {
  return normalizarPlaca(valor).replace(/[^A-Z0-9]/g, '')
}

export function mesmaPlaca(a: unknown, b: unknown): boolean {
  return chavePlaca(a) !== '' && chavePlaca(a) === chavePlaca(b)
}
