/**
 * Format a phone number string into US format: (XXX) XXX-XXXX
 * Strips all non-digit characters, then applies mask.
 */
export function formatPhoneUS(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 10)
  if (digits.length === 0) return ''
  if (digits.length <= 3) return `(${digits}`
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

/**
 * Strip formatting to get raw digits for storage
 */
export function unformatPhone(value: string): string {
  return value.replace(/\D/g, '')
}
