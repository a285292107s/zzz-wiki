import cropsJson from '@/data/awaken-crops.json'

export const LOCAL_AWAKEN = `${import.meta.env.BASE_URL ?? '/'}data/img/awaken`

const CROPS: Record<string, { pos?: number }> = cropsJson as Record<string, { pos?: number }>

export function awakenArtSource(image?: string | null): string {
  return image ? `${LOCAL_AWAKEN}/AvatarSpecialAwakenBg_${image}.webp` : ''
}

export function awakenCropPosition(image?: string | null): string {
  const pos = image ? CROPS[image]?.pos : undefined
  return `${typeof pos === 'number' ? pos : 50}% 50%`
}
