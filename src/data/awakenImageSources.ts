import cropsJson from '@/data/awaken-crops.json'

export const LOCAL_AWAKEN = `${import.meta.env.BASE_URL ?? '/'}data/img/awaken`

const CROPS: Record<string, { pos?: number }> = cropsJson as Record<string, { pos?: number }>

export const AWAKEN_PANEL_TEXTURE = `${LOCAL_AWAKEN}/EF_BG.webp`

export function awakenArtSource(image?: string | null): string {
  return image ? `${LOCAL_AWAKEN}/AvatarSpecialAwakenBg_${image}.webp` : ''
}

export function awakenNameSource(image?: string | null): string {
  return image ? `${LOCAL_AWAKEN}/AvatarSpecialAwakenBg_${image}Text.webp` : ''
}

export function awakenLevelPlate(level: number): string {
  const n = Math.min(Math.max(Math.trunc(level) || 1, 1), 6)
  return `${LOCAL_AWAKEN}/ASA_${String(n).padStart(2, '0')}.webp`
}

export function awakenCropPosition(image?: string | null): string {
  const pos = image ? CROPS[image]?.pos : undefined
  return `${typeof pos === 'number' ? pos : 50}% 50%`
}
