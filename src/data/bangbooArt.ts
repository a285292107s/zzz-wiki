import artIcons from '@/data/bangboo-art.json'

const LOCAL_BANGBOO_ART = `${import.meta.env.BASE_URL ?? '/'}data/img/bangboo-art`

const ART_ICONS = new Set<string>(artIcons as string[])

export const BANGBOO_ART_RATIO = '5 / 4'

function isBangbooArt(icon?: string | null): icon is string {
  return !!icon && ART_ICONS.has(icon)
}

export function bangbooArtSource(icon?: string | null): string {
  return isBangbooArt(icon) ? `${LOCAL_BANGBOO_ART}/${icon}_GaChaEF.webp` : ''
}

export function bangbooArtCardSources(icon?: string | null): string[] {
  if (!isBangbooArt(icon)) return []
  return [
    `${LOCAL_BANGBOO_ART}/card/${icon}_GaChaEF.webp`,
    `${LOCAL_BANGBOO_ART}/${icon}_GaChaEF.webp`,
  ]
}
