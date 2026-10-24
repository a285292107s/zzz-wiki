import artCodes from '@/data/weapon-art.json'

const LOCAL_WEAPON_ART = `${import.meta.env.BASE_URL ?? '/'}data/img/weapon-art`

const ART_CODES = new Set<string>(artCodes as string[])

export const WEAPON_ART_RATIO = '5 / 4'

function isWeaponArt(codeName?: string | null): codeName is string {
  return !!codeName && ART_CODES.has(codeName)
}

export function weaponArtSource(codeName?: string | null): string {
  return isWeaponArt(codeName) ? `${LOCAL_WEAPON_ART}/${codeName}_GachaEF.webp` : ''
}

export function weaponArtCardSources(codeName?: string | null): string[] {
  if (!isWeaponArt(codeName)) return []
  return [
    `${LOCAL_WEAPON_ART}/card/${codeName}_GachaEF.webp`,
    `${LOCAL_WEAPON_ART}/${codeName}_GachaEF.webp`,
  ]
}
