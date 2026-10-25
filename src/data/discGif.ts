import entries from '@/data/disc-gifs.json'

const LOCAL = `${import.meta.env.BASE_URL ?? '/'}data/img/disc-gif`

type DiscGifEntry = { contentId: string; url: string }

const ENTRIES = entries as Record<string, DiscGifEntry>

function keyOf(id?: number | string | null): string | null {
  if (id == null || id === '') return null
  const key = String(id)
  return Object.prototype.hasOwnProperty.call(ENTRIES, key) ? key : null
}

export function hasDiscGif(id?: number | string | null): boolean {
  return keyOf(id) !== null
}

export function discGifSources(id?: number | string | null): string[] {
  const key = keyOf(id)
  return key ? [`${LOCAL}/${key}.webp`] : []
}

export function discGifPosterSources(id?: number | string | null): string[] {
  const key = keyOf(id)
  return key ? [`${LOCAL}/poster/${key}.webp`] : []
}
