// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import HollowImage from '../src/components/HollowImage.vue'

describe('HollowImage banner banner avatar', () => {
  it('applies banner ratio to frame and contain fit', () => {
    const w = mount(HollowImage, {
      props: {
        srcs: ['https://x/IconRoleGeneral67.webp'],
        fit: 'contain',
        ratio: '44 / 16',
        fallback: 'ZZ',
      },
    })
    const frame = w.find('.frame')
    // frame 走 ratio 内联样式
    expect(frame.attributes('style')).toContain('aspect-ratio: 44 / 16')
    const img = w.find('img')
    expect(img.classes()).toContain('fit-contain')
    // 图片 src 使用完整
    expect(img.attributes('src')).toBe('https://x/IconRoleGeneral67.webp')
  })
})
