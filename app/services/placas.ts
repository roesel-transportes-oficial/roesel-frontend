export function normalizarPlaca(valor: unknown): string {
  const original = String(valor ?? '').trim().toUpperCase()
  const compacta = original.replace(/[^A-Z0-9]/g, '')

  // Mercosul: AAA-1A11.
  if (/^[A-Z]{3}\d[A-Z]\d{2}$/.test(compacta)) {
    return `${compacta.slice(0, 3)}-${compacta.slice(3)}`
  }

  // Modelo antigo: AAA-1234. Converte o quinto digito para a letra
  // equivalente do padrao Mercosul (0=A, 1=B, ..., 9=J).
  if (/^[A-Z]{3}\d{4}$/.test(compacta)) {
    const letraMercosul = 'ABCDEFGHIJ'[Number(compacta[4])]
    return `${compacta.slice(0, 4)}${letraMercosul}${compacta.slice(5)}`
  }

  // Valores incompletos ou fora do padrão não são inventados nem alterados
  // além de caixa alta e espaços nas pontas.
  return original
}

export function chavePlaca(valor: unknown): string {
  return normalizarPlaca(valor).replace(/[^A-Z0-9]/g, '')
}

export function mesmaPlaca(a: unknown, b: unknown): boolean {
  return chavePlaca(a) !== '' && chavePlaca(a) === chavePlaca(b)
}
