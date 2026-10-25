import entries from '@/data/wengine-gifs.json'

const LOCAL = `${import.meta.env.BASE_URL ?? '/'}data/img/wengine-gif`

type WEngineGifEntry = { contentId: string; url: string }

const ENTRIES = entries as Record<string, WEngineGifEntry>

function keyOf(id?: number | string | null): string | null {
  if (id == null || id === '') return null
  const key = String(id)
  return Object.prototype.hasOwnProperty.call(ENTRIES, key) ? key : null
}

export function hasWEngineGif(id?: number | string | null): boolean {
  return keyOf(id) !== null
}

export function wEngineGifSources(id?: number | string | null): string[] {
  const key = keyOf(id)
  return key ? [`${LOCAL}/${key}.webp`] : []
}

export function wEngineGifPosterSources(id?: number | string | null): string[] {
  const key = keyOf(id)
  return key ? [`${LOCAL}/poster/${key}.webp`] : []
}
