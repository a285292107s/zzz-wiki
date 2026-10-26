export function latinDecor(latin: string | undefined, localized: string): string {
  if (!latin) return ''
  return fold(localized).includes(fold(latin)) ? '' : latin
}

function fold(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')
}
