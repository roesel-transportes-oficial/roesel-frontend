export function normalizarPlaca(valor: unknown): string {
  const original = String(valor ?? '').trim().toUpperCase()
  const compacta = original.replace(/[^A-Z0-9]/g, '')

  // Antes de validar, corrige apenas O/I nas posições que, no padrão
  // Mercosul, obrigatoriamente são numéricas. Isso trata erros comuns de
  // digitação/OCR sem alterar letras que pertencem à placa.
  if (/^[A-Z]{3}.{4}$/.test(compacta)) {
    const partes = compacta.split('')
    partes[3] = partes[3].replace(/O/g, '0').replace(/I/g, '1')
    partes[5] = partes[5].replace(/O/g, '0').replace(/I/g, '1')
    partes[6] = partes[6].replace(/O/g, '0').replace(/I/g, '1')
    const possivelMercosul = partes.join('')
    if (/^[A-Z]{3}\d[A-Z]\d{2}$/.test(possivelMercosul)) {
      return `${possivelMercosul.slice(0, 3)}-${possivelMercosul.slice(3)}`
    }
  }

  // Modelo antigo: AAA-1234. Converte o segundo digito para a letra
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
