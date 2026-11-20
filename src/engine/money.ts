import Fraction from 'fraction.js'

export type Amount = Fraction

export function amount(value: string | number): Amount {
  return new Fraction(value)
}

export const zero = amount(0)

export function nonNegative(value: Amount): Amount {
  return value.compare(zero) < 0 ? zero : value
}

export function parsePounds(value: string): Amount | null {
  const input = value.trim()
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(input)) return null
  return amount(input.replaceAll(',', ''))
}

export function formatPounds(value: Amount, places = 2): string {
  const scale = 10n ** BigInt(places)
  const scaledNumerator = value.n * scale
  const rounded = scaledNumerator / value.d + (2n * (scaledNumerator % value.d) >= value.d ? 1n : 0n)
  const whole = (rounded / scale).toLocaleString('en-GB')
  const fractional = (rounded % scale).toString().padStart(places, '0')
  const sign = value.s < 0n && rounded !== 0n ? '−' : ''
  return `${sign}£${whole}${places ? `.${fractional}` : ''}`
}
