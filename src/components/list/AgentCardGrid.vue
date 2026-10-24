<script setup lang="ts">
/* ============================================================
 * AgentCardGrid — 代理人名录的卡片陈列（9:16 立绘格 + 图下标本签 + 骨架 + 空态）。
 *
 * 取景与 /calibrate 的角色格同源：格子固定 9:16、overflow hidden，图按
 * featured-pool.json 的校准参数（水平对焦 pos + 放大 zoom/originY）构图；
 * 未校准的角色回落居中取景——「宁可少裁一点，也不假装知道脸在哪」。
 *
 * 为什么不复用 CardGrid（驱动盘/音擎的栅格壳）：那套卡壳是 --bg-2 填充 + 16px 内衬的
 * 「卡片盒」，本页的陈列语言是**画 + 图下签条**——格与格之间靠留白分栏，格子里只有
 * 一条 1px 细线的取景框（与 /calibrate 的选型格一致）。骨架与空态的处置沿用 CardGrid
 * 的既有判据：骨架与真卡同几何、栅格为空时不渲染栅格线。
 *
 * 立绘候选链耗尽时格子留 --bg-0 空底，不改版式、不塌高。
 *
 * 签条为什么让阵营只留图标：阵营全名最长 11 字（罗斯凯利法·弗林特工坊），与属性·职业
 * 挤在 ~159px 的 nowrap 单行里必然被省略号吃掉半截（1440 下实测 18 张卡有 7 张截断）。
 * 故阵营移出签条、在名字行右端占一枚 24×24 的图标位——不套外框（原色徽记自带轮廓，再画一圈
 * 细线等于两层边），位里贴本地阵营图标**原色原图**（与筛选下拉同一份资产；不描摹成单色——
 * 徽记的辨识信息本来就靠形状与配色，抹成一片灰反而认不出是哪个阵营）。阵营全名仍由这一位的
 * title 与读屏文字给出，悬停签条的 title 也给全四项。稀有度顺势从方框徽章改成签条行末尾的
 * 纯文字（颜色仍按档位走 S 金/A 紫/B 蓝），与属性、职业同一套排法。图标缺失的阵营
 * （当前 0 个）沿用筛选下拉同款的细线圆圈占位：宁可画一个空心圈，也不把长名字塞回签条再截一遍。
 * ============================================================ */

import { RouterLink } from 'vue-router'
import { ELEMENTS, PROFESSIONS, RANK_TO_TIER } from '@/domain/enums'
import type { AttrCode, SpecCode } from '@/domain/enums'
import { campIconUrl } from '@/domain/filterIcons'
import type { CharacterListItem } from '@/data/types'
import { heroFileForForm } from '@/data/heroGenderVariants'
import { heroGridSources } from '@/data/heroImageSources'
import { getCardFraming } from '@/data/heroCalibration'
import { pickName } from '@/utils/names'
import { pickText } from '@/domain/lang'
import { useHeroForm } from '@/composables/useHeroForm'
import { useLocale } from '@/composables/useLocale'
import { useUiText } from '@/composables/useUiText'
import { useMediaQuery } from '@/composables/useMediaQuery'
import HollowImage from '@/components/HollowImage.vue'
import NoMatchState from '@/components/list/NoMatchState.vue'

const props = withDefaults(
  defineProps<{
    items: readonly CharacterListItem[]
    /** 详情页路径前缀（由 catalog 派生，单一事实源） */
    base: string
    /** 加载态：渲染等量骨架格（与真卡同几何，避免骨架→内容的布局跳动） */
    skeleton?: boolean
    /** 骨架格数量 */
    skeletonCount?: number
    /** 无匹配空态标题 */
    emptyText?: string
    /** 是否有可清除的检索/筛选条件（true 才给「清除」按钮） */
    showClear?: boolean
  }>(),
  { skeleton: false, skeletonCount: 12, emptyText: undefined, showClear: false },
)

const emit = defineEmits<{ (e: 'clear'): void }>()

/** 形态偏好：佩洛伊斯（1551）双形态，切换入口在设置页 */
const { heroForm } = useHeroForm()
/** 当前展示语言：标本签上的角色名取该语言的名录名（名录本身按语言落盘，由调用方取） */
const { lang } = useLocale()
const { t } = useUiText()
/** 卡片档位判定：DPR≥1.5 走 wide/，否则 card/（见 heroGridSources 的取景说明） */
const retina = useMediaQuery('(min-resolution: 1.5dppx)')

function heroSrcs(id: number) {
  return heroGridSources(heroFileForForm(id, heroForm.value), { retina: retina.value })
}

/** 校准构图（水平脸对焦 + 放大消透明边）；未校准返回 undefined → 居中取景 */
function calStyle(id: number): Record<string, string> | undefined {
  const c = getCardFraming(id)
  return c
    ? {
        objectPosition: c.pos,
        transformOrigin: `50% ${c.originY}%`,
        transform: `scale(${c.zoom})`,
      }
    : undefined
}

/** 属性：有特殊属性（如 星见雅→烈霜）时用它的名字，颜色仍随主属性 */
function elInfo(row: CharacterListItem): { text: string; color: string } | null {
  if (row.element == null) return null
  const el = ELEMENTS[row.element as AttrCode]
  if (!el) return null
  return { text: row.special_element ?? pickText(el.label, lang.value), color: el.color }
}

function profText(row: CharacterListItem): string | null {
  if (row.type == null) return null
  const p = PROFESSIONS[row.type as SpecCode]
  return p ? pickText(p.label, lang.value) : null
}

/** 稀有度：与同行属性/职业同款纯文字，颜色仍按档位走（S 金 / A 紫 / B 蓝） */
function rankInfo(row: CharacterListItem): { text: string; color: string } | null {
  if (row.rank == null) return null
  const tier = RANK_TO_TIER[row.rank]
  return tier ? { text: tier, color: `var(--rank-${tier.toLowerCase()})` } : null
}

/** 签条 hover 的完整信息：可见部分是「属性 · 职业 · 稀有度」，阵营（含 11 字长名）改由图标承载，
 *  故 title 这里给全四项（可见三项 + 阵营名） */
function metaText(row: CharacterListItem): string {
  return [elInfo(row)?.text, profText(row), rankInfo(row)?.text, row.camp_name]
    .filter(Boolean)
    .join(' · ')
}

/** 阵营图标（本地资产，与筛选下拉同一份）；无阵营码或无图 → null（转细线圆圈占位） */
function campIcon(row: CharacterListItem): string | null {
  return row.camp == null ? null : campIconUrl(row.camp)
}
</script>

<template>
  <div class="cards-wrap">
    <ol
      v-if="props.skeleton || props.items.length"
      class="grid"
      :class="{ skel: props.skeleton }"
      :aria-busy="props.skeleton || undefined"
    >
      <template v-if="props.skeleton">
        <li v-for="i in props.skeletonCount" :key="i" aria-hidden="true">
          <span class="card-art"><span class="bar" /></span>
        </li>
      </template>

      <template v-else>
        <li v-for="row in props.items" :key="row.Id">
          <RouterLink class="card" :to="`${props.base}/${row.Id}`">
            <span class="card-art">
              <!-- alt 留空：名字就在同一链接的签条上，读屏不必念第二遍 -->
              <HollowImage unframed :srcs="heroSrcs(row.Id)" :img-style="calStyle(row.Id)" />
            </span>

            <span class="plate">
              <span class="plate-top">
                <span class="plate-name">{{ pickName(row, lang) }}</span>
                <!-- 阵营位：长名放不进签条，改用本地图标（原色原图、不套外框）；名字靠 title + 读屏文字兜住 -->
                <span
                  v-if="row.camp_name || row.camp != null"
                  class="plate-camp"
                  :title="row.camp_name"
                >
                  <!-- 阵营图标贴本地原图（与筛选下拉同一份资产）；alt 置空，名字交给 title 与读屏文字 -->
                  <img
                    v-if="campIcon(row)"
                    class="camp-ic"
                    :src="campIcon(row)!"
                    alt=""
                    loading="lazy"
                  />
                  <!-- 无图标兜底：与筛选下拉同款的细线圆圈，不写文字（写文字又会截断） -->
                  <svg v-else class="camp-ic" viewBox="0 0 16 16" aria-hidden="true">
                    <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="2" />
                  </svg>
                  <span v-if="row.camp_name" class="sr-only">{{ row.camp_name }}</span>
                </span>
              </span>
              <span class="plate-meta mono" :title="metaText(row)">
                <span v-if="elInfo(row)" :style="{ color: elInfo(row)!.color }">{{
                  elInfo(row)!.text
                }}</span>
                <span v-if="profText(row)">{{ profText(row) }}</span>
                <!-- 稀有度用纯文字：与同行属性/职业同一套排法，颜色仍按档位区分；不再套方框徽章 -->
                <span v-if="rankInfo(row)" :style="{ color: rankInfo(row)!.color }">{{
                  rankInfo(row)!.text
                }}</span>
              </span>
            </span>
          </RouterLink>
        </li>
      </template>
    </ol>

    <!-- 空态分工：AsyncState 管「数据级为空」；「筛掉全部结果」由这里承担 -->
    <div v-else class="grid-empty">
      <NoMatchState :title="props.emptyText ?? t.noMatch.agents" :show-clear="props.showClear" @clear="emit('clear')" />
    </div>
  </div>
</template>

<style scoped>
.grid {
  display: grid;
  /* 156px 下限：9:16 下每格约 156×277，属性/职业/阵营一行签条放得下；
     与 /calibrate 的选型格同一取景比例，只是列宽档位不同 */
  grid-template-columns: repeat(auto-fill, minmax(156px, 1fr));
  gap: var(--space-inline) 10px;
  list-style: none;
  padding: 0;
  margin: 0;
}

/* 窄屏：156px 下限只放得下一轨 → 会得到 320×569 的巨型格子。
   放宽到 130px（与 /calibrate 同一档），一屏两列，签条仍放得下。 */
@media (max-width: 480px) {
  .grid {
    grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  }
}

.card {
  display: block;
  color: inherit;
  text-decoration: none;
}

/* ---------- 取景格 ---------- */

.card-art {
  position: relative;
  display: block;
  aspect-ratio: 9 / 16;
  overflow: hidden;
  border: 1px solid var(--line-1);
  border-radius: 2px;
  background: var(--bg-0);
  transition: border-color var(--t-fast) var(--ease);
}

/* 立绘铺满取景格；校准参数经 imgStyle 内联覆盖（inline 优先于本规则） */
.card-art :deep(img) {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
}

/* ---------- 图下标本签 ---------- */

.plate {
  display: block;
  padding-top: 7px;
}

.plate-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.plate-name {
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-family: var(--serif);
  font-size: var(--fs-subhead);
  letter-spacing: 0.01em;
  color: var(--ink-0);
  transition: color var(--t-fast) var(--ease);
}

/* 阵营位：占住名字行右端原先那枚 24px 徽章的位置（故卡片总高不变）。
   不套外框——原色徽记自带轮廓，再加 1px 细线等于画两层边；名字行的 8px gap 保证不贴上名字。
   图标是纯装饰，名字靠 title 与位内的读屏文字给出 */
.plate-camp {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  color: var(--ink-1);
  transition: color var(--t-fast) var(--ease);
}

/* 位定尺寸、图标铺满：原图自带透明留白，再缩一圈只会把徽记压小 */
.camp-ic {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

/* 签条一行：属性（随属性色）· 职业 · 稀有度（随档位色），全是同一套纯文字；阵营已改到名字行的图标位。
   行高 16px：11px 的字配 1.45 倍行高，单行不挤也不虚 */
.plate-meta {
  display: block;
  margin-top: 2px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: var(--fs-micro);
  line-height: 16px;
  letter-spacing: 0.08em;
  color: var(--ink-2);
}

.plate-meta > span + span::before {
  content: '·  ';
  color: var(--line-2);
}

@media (hover: hover) {
  .card:hover .card-art {
    border-color: var(--amber);
  }

  .card:hover .plate-name {
    color: var(--amber-hi);
  }

  .card:hover .plate-camp {
    color: var(--amber-hi);
  }
}

/* ---------- 骨架（加载态） ---------- */

.skel .card-art .bar {
  display: block;
  width: 100%;
  height: 100%;
}

/* ---------- 空态（沿用 CardGrid 的空态框） ---------- */

.grid-empty {
  padding: 46px 16px 50px;
  border: 1px solid var(--line-0);
  border-radius: 2px;
}
</style>
