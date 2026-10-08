// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import HollowImage from '@/components/HollowImage.vue'

/** 取组件渲染出的 <img>（unframed 时就是根节点；带框时在 .frame 里） */
function img(wrapper: ReturnType<typeof mount>) {
  return wrapper.find('img')
}

describe('HollowImage · 候选链', () => {
  it('字符串候选照旧可用（单地址调用方未受影响）', () => {
    const w = mount(HollowImage, { props: { srcs: ['/a.webp'], alt: 'x' } })
    expect(img(w).attributes('src')).toBe('/a.webp')
    expect(img(w).attributes('srcset')).toBeUndefined()
  })

  it('对象候选把 srcset/sizes 透传到 <img>，src 为无 srcset 时的兜底', () => {
    const w = mount(HollowImage, {
      props: {
        srcs: [
          {
            src: '/hero/wide/a.webp',
            srcset: '/hero/card/a.webp 800w, /hero/wide/a.webp 1600w',
            sizes: '1322px',
          },
        ],
      },
    })
    expect(img(w).attributes('src')).toBe('/hero/wide/a.webp')
    expect(img(w).attributes('srcset')).toBe('/hero/card/a.webp 800w, /hero/wide/a.webp 1600w')
    expect(img(w).attributes('sizes')).toBe('1322px')
  })

  it('候选失败（404）后退到下一候选，并清掉上一档的 srcset', async () => {
    const w = mount(HollowImage, {
      props: {
        srcs: [
          { src: '/gone/a.webp', srcset: '/gone/a.webp 800w', sizes: '100vw' },
          { src: '/ok/a.webp' },
        ],
      },
    })
    expect(img(w).attributes('src')).toBe('/gone/a.webp')
    await img(w).trigger('error')
    expect(img(w).attributes('src')).toBe('/ok/a.webp')
    expect(img(w).attributes('srcset')).toBeUndefined()
  })

  it('空候选与 null 被跳过；全空时 unframed 不渲染 <img>', () => {
    const w = mount(HollowImage, { props: { srcs: [null, undefined, { src: '' }], unframed: true } })
    expect(w.find('img').exists()).toBe(false)
  })

  it('unframed 模式同样带 srcset（首页横幅走的就是这条路）', () => {
    const w = mount(HollowImage, {
      props: {
        unframed: true,
        srcs: [{ src: '/w/a.webp', srcset: '/c/a.webp 800w, /w/a.webp 1600w', sizes: '100vw' }],
      },
    })
    expect(w.find('img').attributes('srcset')).toBe('/c/a.webp 800w, /w/a.webp 1600w')
  })
})

describe('HollowImage · 共享元素', () => {
  it('本组件不发任何 view-transition 声明：名字挂在调用方的裁切容器上（.deck-item / .hero-bg）', () => {
    // <img> 带 zoom 构图 transform，渲染盒比可视区域大；带名元素的快照不含祖先裁切，
    // 挂在 <img> 或外框上都会起飞在一圈放大的画面上（曾实测）。真正的名字由调用方
    // 挂在自己的 overflow: hidden 容器上（见 utils/viewTransition 的 VT_SHARED_NAME）。
    const unframed = mount(HollowImage, { props: { unframed: true, srcs: ['/a.webp'] } })
    const framed = mount(HollowImage, { props: { srcs: ['/a.webp'] } })
    expect((img(unframed).element as HTMLElement).style.viewTransitionName).toBe('')
    expect((img(framed).element as HTMLElement).style.viewTransitionName).toBe('')
    expect((framed.find('.frame').element as HTMLElement).style.viewTransitionName).toBe('')
  })
})
