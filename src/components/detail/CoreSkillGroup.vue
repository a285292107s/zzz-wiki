<script setup lang="ts">
import { computed, ref } from 'vue'
import { richDesc } from '@/utils/rich'
import {
  CHAR_LEVEL_MAX,
  coreEnhanceTotal,
  type CoreEnhanceBonus,
  type CoreEnhanceLevel,
  type CoreSkill,
  type PotentialCinema,
} from '@/domain/sections'
import LevelSlider from './LevelSlider.vue'

const props = defineProps<{
  row: CoreSkill
  /** 核心技强化档位（extra_level，I-VI） */
  enhance?: CoreEnhanceLevel[]
  /** 潜能影像档位（potential_detail）：潜能模式下补一行「潜能觉醒：极冰带」等强化效果 */
  cinema?: PotentialCinema[]
  /** 角色等级（1-60）：核心技强化档按此解锁（对比 unlockAt 门槛）；缺省视为满级（全部解锁） */
  charLevel?: number
}>()

/** 真实核心技等级（1..levelCount；两轮结构去重后仍为 7，而非 14 条记录数），默认满级 */
const level = ref(Math.max(1, props.row.levelCount))

const maxLevel = computed(() => Math.max(1, props.row.levelCount))

/** 潜能模式的追加效果行：取末尾（最高档）含描述的潜能影像档，如「潜能觉醒：极冰带」 */
const potBoost = computed(() => {
  const arr = props.cinema ?? []
  for (let i = arr.length - 1; i >= 0; i--) if (arr[i].desc) return arr[i]
  return undefined
})

/** 是否为「潜能觉醒」追加行存在：有潜能影像的角色必有该行，故核心技即有基础/潜能切换 */
const canVary = computed(() => !!potBoost.value)

/** 展示版本：潜能（默认态）或基础；无切换时固定为基础 */
const variant = ref<'pot' | 'base'>(canVary.value ? 'pot' : 'base')

/** 当前等级记录：两轮潜能在第二轮（levelCount 起），其余取第 1 轮；越界回退末级 */
const current = computed(() => {
  const lv = Math.min(Math.max(1, level.value), maxLevel.value)
  const offset =
    props.row.hasEnhance && variant.value === 'pot' ? props.row.levelCount : 0
  return props.row.levels[offset + lv - 1] ?? props.row.levels[props.row.levels.length - 1]
})

/** 徽标：潜能激发门控的核心技 → 「潜能I·扩展」（扩展核心被动/额外能力）；
 *  非潜能的双轮 → 「强化」；基础版为空 */
const currentBadge = computed<string>(() => {
  if (current.value.potentialTag) return `潜能${current.value.potentialTag}·扩展`
  if (current.value.enhanced) return '强化'
  return ''
})

/** 核心技强化满级累计（各档新增量合计，随每档增量展示补回总量信息） */
const enhanceTotal = computed<CoreEnhanceBonus[]>(() =>
  coreEnhanceTotal(props.enhance ?? []),
)

/** 对照用角色等级：未传入时按满级处理（保持旧行为：全解锁、末档即当前档） */
const charLv = computed(() => props.charLevel ?? CHAR_LEVEL_MAX)

/** 档位是否已解锁：角色等级 ≥ 该档解锁门槛 */
function isUnlocked(lv: CoreEnhanceLevel): boolean {
  return charLv.value >= lv.unlockAt
}

/** 已解锁档位数（标题行进度计数，随角色等级实时联动） */
const unlockCount = computed(() =>
  (props.enhance ?? []).filter((lv) => isUnlocked(lv)).length,
)
</script>

<template>
  <div class="skill-group core-skill">
    <div class="skill-kind-row">
      <span class="key-glyph">
        <span class="core-glyph" aria-hidden="true">◒</span>
        <em class="mono">CORE</em>
      </span>
      <h3 class="skill-kind serif">核心技</h3>
      <!-- 两轮核心或存在潜能影像强化时，显示「潜能激发」切换开关（默认打开） -->
      <button
        v-if="canVary"
        type="button"
        class="pot-switch mono"
        role="switch"
        aria-label="潜能激发"
        :aria-checked="variant === 'pot'"
        @click="variant = variant === 'pot' ? 'base' : 'pot'"
      >
        <span class="sw-track" :class="{ on: variant === 'pot' }"><span class="sw-thumb"></span></span>
        <span class="sw-label">潜能激发</span>
      </button>
      <!-- 等级滑块与技能名同条，靠右对齐；窄屏允许换行 -->
      <div class="level-row">
        <LevelSlider
          v-model="level"
          :min="1"
          :max="maxLevel"
          :label="`核心技等级`"
        />
        <!-- 等级标签：显示数据 level（1-7） -->
        <span class="level-val mono">Lv.{{ current.level }}</span>
      </div>
    </div>

    <ul class="action-list">
      <li class="row">
        <span class="no mono">01</span>
        <div class="body">
          <h4 class="title title-skill">
            {{ current.coreName }}<span v-if="currentBadge" class="pot-badge mono">{{ currentBadge }}</span>
          </h4>
          <p v-if="current.desc[0]" class="desc" v-html="richDesc(current.desc[0])"></p>
        </div>
      </li>
      <li class="row">
        <span class="no mono">02</span>
        <div class="body">
          <h4 class="title title-skill">
            {{ current.extraName }}<span v-if="currentBadge" class="pot-badge mono">{{ currentBadge }}</span>
          </h4>
          <p v-if="current.desc[1]" class="desc" v-html="richDesc(current.desc[1])"></p>
        </div>
      </li>
      <!-- 潜能模式：追加「潜能觉醒：极冰带」等潜能影像强化效果行 -->
      <li v-if="variant === 'pot' && potBoost" class="row">
        <span class="no mono">03</span>
        <div class="body">
          <h4 class="title title-skill">{{ potBoost.name || '潜能觉醒' }}</h4>
          <p class="desc" v-html="richDesc(potBoost.desc)"></p>
        </div>
      </li>
    </ul>

    <!-- 核心技强化：extra_level 档位（A-F），本档新增属性加成（累计值已换算为每档增量） -->
    <section v-if="enhance?.length" class="enhance" aria-label="核心技强化">
      <!-- 标题行：eyebrow + 已解锁进度计数（随角色等级实时联动） -->
      <div class="enhance-head">
        <h4 class="enhance-title mono">核心技强化</h4>
        <span
          class="enhance-count mono"
          :class="{ 'is-full': unlockCount === enhance.length }"
          :aria-label="`已解锁 ${unlockCount} 档，共 ${enhance.length} 档`"
        >{{ unlockCount }}/{{ enhance.length }}</span>
      </div>
      <!-- 档位清单：纵向一行一档（无卡片堆叠）；两态 = 已解锁（琥珀档号）/ 未解锁（弱化） -->
      <ul class="enhance-track">
        <li
          v-for="lv in enhance"
          :key="lv.no"
          class="tier"
          :class="{
            'is-unlocked': isUnlocked(lv),
            'is-locked': !isUnlocked(lv),
          }"
        >
          <span class="tier-no mono">{{ lv.no }}</span>
          <span class="tier-gate mono">Lv.{{ lv.unlockAt }}</span>
          <span class="tier-bonus">
            <template v-for="(b, bi) in lv.bonus" :key="b.name">
              <span v-if="bi" class="sep" aria-hidden="true">·</span>
              <span class="bn">{{ b.name }}</span>
              <span class="bv mono">+{{ b.text }}</span>
            </template>
          </span>
        </li>
      </ul>
      <!-- 满级累计：全部档位新增量之和，独立一行置于清单之下 -->
      <p v-if="enhanceTotal.length" class="enhance-total mono">
        <span class="total-label">满级累计</span>
        <template v-for="(t, i) in enhanceTotal" :key="t.name">
          <span v-if="i" class="sep" aria-hidden="true">·</span>
          <span class="bn">{{ t.name }}</span>
          <span class="bv mono">+{{ t.text }}</span>
        </template>
      </p>
    </section>
  </div>
</template>

<style scoped>
/* 与 SkillGroup 同源的展示语言（细线行 + 编号列 + 富文本描述），后续可抽公共 */
.core-skill {
  --label-col: 36px;
  --row-gap: 14px;
  --body-left: calc(var(--label-col) + var(--row-gap));
  margin-bottom: calc(var(--pad-section) * 0.5);
}

.skill-kind-row {
  display: flex;
  align-items: center;
  gap: var(--row-gap);
  margin-bottom: 12px;
  /* 与招式行同款 4px 左右内边：纹章列与 01/02 编号列同一纵向轴线 */
  padding: 0 4px;
  flex-wrap: wrap;
  row-gap: 10px;
}

.key-glyph {
  /* 与招式行编号列同宽：纹章与 01/02 编号纵向同一轴线 */
  width: var(--label-col);
  flex: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
}

/* 核心技纹章：◒ + CORE 键名（与 SKILL_KEYS.core 同构，无图片依赖） */
.core-glyph {
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--label-col);
  height: var(--label-col);
  font-size: var(--fs-subhead);
  color: var(--amber);
  border: 1px solid var(--line-1);
  border-radius: 2px;
  background: var(--bg-1);
}

.key-glyph em {
  font-style: normal;
  font-size: var(--fs-badge);
  letter-spacing: 0.14em;
  color: var(--ink-3);
}

.skill-kind {
  font-family: var(--serif);
  font-size: var(--fs-lead);
  font-weight: 500;
  color: var(--amber);
}

.level-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-left: auto;
  flex: 1 1 240px;
  min-width: 200px;
  max-width: 420px;
}

.level-val {
  display: flex;
  align-items: baseline;
  gap: 6px;
  font-size: var(--fs-caption);
  color: var(--amber);
  min-width: 3.4em;
  text-align: right;
  justify-content: flex-end;
}

.action-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.row {
  display: grid;
  grid-template-columns: var(--label-col) 1fr;
  gap: var(--row-gap);
  padding: var(--space-2) 4px;
  /* 与 SkillGroup 同源：行内细分隔线（串读单元不带 hover，避免假可点击暗示） */
  border-bottom: 1px solid var(--line-0);
}

.no {
  color: var(--ink-3);
  font-size: var(--fs-caption);
  padding-top: 2px;
}

.body {
  min-width: 0;
}

.title {
  font-weight: 500;
  font-size: var(--fs-lead);
  line-height: 1.4;
  margin-bottom: 6px;
  color: var(--ink-0);
}

.desc {
  color: var(--ink-1);
  font-size: var(--fs-small);
  line-height: 1.8;
  max-width: 76ch;
  white-space: pre-line;
  margin-bottom: 10px;
}

.desc:last-child {
  margin-bottom: 0;
}

/* ---------- 核心技强化（extra_level 解锁档位） ---------- */

.enhance {
  margin-top: var(--space-group);
  padding-top: var(--space-2);
  border-top: var(--rule);
}

/* 标题行：eyebrow 与解锁进度计数两端对齐 */
.enhance-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 2px;
}

.enhance-title {
  font-size: var(--fs-micro);
  font-weight: 400;
  letter-spacing: 0.22em;
  color: var(--ink-2);
}

/* 进度计数：n/总档数，随角色等级实时联动；全部解锁时转琥珀 */
.enhance-count {
  font-size: var(--fs-nano);
  letter-spacing: 0.08em;
  color: var(--ink-3);
}

.enhance-count.is-full {
  color: var(--amber);
}

/* ---------- 档位清单：纵向一行一档，无卡片堆叠 ---------- */

.enhance-track {
  list-style: none;
  margin: 0;
  padding: 0;
}

.tier {
  display: grid;
  grid-template-columns: 40px 52px 1fr;
  gap: 14px;
  align-items: baseline;
  padding: 10px 4px;
  transition: background var(--t-fast) var(--ease);
}

/* 档号：等宽大字；已解锁转琥珀，未解锁维持弱墨 */
.tier-no {
  font-size: var(--fs-subhead);
  font-weight: 500;
  line-height: 1;
  color: var(--ink-3);
  transition: color var(--t-fast) var(--ease);
}

.tier.is-unlocked .tier-no {
  color: var(--amber);
}

/* 解锁门槛刻度（角色等级） */
.tier-gate {
  font-size: var(--fs-nano);
  letter-spacing: 0.08em;
  color: var(--ink-2);
}

.tier.is-locked .tier-gate {
  color: var(--ink-3);
}

/* 档位加成：属性名弱墨 + 数值琥珀 */
.tier-bonus {
  font-size: var(--fs-caption);
  line-height: 1.65;
  color: var(--ink-1);
}

.tier-bonus .bv {
  color: var(--amber);
}

.enhance .sep {
  margin: 0 0.5em;
  color: var(--ink-3);
}

/* 未解锁档：整体弱化，加成内容保留作为升级预告，数值并入弱墨 */
.tier.is-locked .tier-bonus {
  color: var(--ink-3);
}

.tier.is-locked .bv {
  color: inherit;
}

/* 行悬停：bg-3（token 预置 hover 层级），与转置表行同力道；bg-1 仅差 5 色阶不可辨 */
.tier:hover {
  background: var(--bg-3);
}

/* 满级累计：全部档位新增量合计，实线与清单区隔 */
.enhance-total {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  row-gap: 4px;
  margin: var(--space-2) 0 0;
  padding: var(--space-2) 4px 0;
  border-top: 1px solid var(--line-1);
  font-size: var(--fs-caption);
  color: var(--ink-1);
}

.enhance-total .total-label {
  font-size: var(--fs-micro);
  letter-spacing: 0.18em;
  color: var(--ink-2);
  margin-right: 1em;
}

/* 窄屏：档号 + 解锁刻度合成首列，加成列并排居中 */
@media (max-width: 560px) {
  .tier {
    grid-template-columns: 40px 1fr;
    column-gap: 12px;
    row-gap: 2px;
  }

  .tier-no {
    grid-column: 1;
    grid-row: 1;
  }

  .tier-gate {
    grid-column: 1;
    grid-row: 2;
  }

  .tier-bonus {
    grid-column: 2;
    grid-row: 1 / span 2;
    align-self: center;
  }
}

.desc :deep(.rich-key) {
  display: inline-block;
  width: 1.15em;
  height: 1.15em;
  margin: 0 0.1em;
  vertical-align: -0.22em;
  border-radius: 1px;
  line-height: 0;
}

.desc :deep(.rich-key svg) {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
