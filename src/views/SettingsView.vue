<script setup lang="ts">
/* 设置页：本机偏好的唯一改动入口。
 *
 * 这里的每一项都是**本机偏好**——只写 localStorage，不进 URL、不随分享链接传播。
 * 故本页刻意不做「保存」按钮：点选即生效、当即落盘，读者不必猜改动有没有被记住。
 *
 * 展示语言也归这里（2026-10，决策记录 0010）：它同样是本机偏好；且站头工具的宽度账很紧
 * （见 SiteHeader 的断点空间账，320 档只剩 18px 余量），摆过去要把那份账重算一遍。
 * ⚠ 代价是「不懂中文的读者要在设置页找语言」——故选项标签用**各语言自称**
 * （中文 / English / 日本語 / 한국어），不译成中文；本页其余文案（2026-10，决策记录 0011）
 * 随展示语言切换：它已是全员都要读的界面文案，不再属于「界面外壳中文」的范围。
 *
 * 选型控件用**选项板**：一组选项并排成方角板，板上压一张迷你样张（版本组画陈列骨架——
 * 卡片版画 9:16 立绘格、表格版画发丝行；形态组用真立绘 + 详情页头图的文字骨架），
 * 选中态由三处同时表态——整板琥珀描边 + 板头实心 ◈ + 「已选」角标，
 * 未选只有 ◇ 与发丝线。原生 radio 铺满整板当命中区（不用 .sr-only：1×1 的隐藏控件在
 * 320px 重排与触屏命中区审计里都是过小目标）。样张与标记皆 aria-hidden，可访问名走
 * input 的 aria-label，一句说明挂 aria-describedby。
 *
 * 标记取 ◇ / ◈（同形空心↔实心，且两字都在既有 CJK 分片的 unicode-range 里）；
 * 更眼熟的实心圆 ● 不在已子集化的分片内，写了 verify:fonts:cjk 会失败，而补字要重下重切
 * 全部字体分片，与本改动不成比例（同决策记录 0004 拒绝写「韩」字的理由）。
 *
 * 入口在站头导航第 06 位与首页目录的「06 设置」——档案图谱原先占着这个导航位，
 * 该页使用价值低、已整页下线，位置让给设置；导航仍是 ADR 0004 的六项预算。
 * 页脚只保留「数据说明」一处出处链接，不再重复指路本页。 */

import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { usePageMeta } from '@/composables/usePageMeta'
import { useAgentsViewVersion } from '@/composables/useAgentsViewVersion'
import type { AgentsViewVersion } from '@/composables/useAgentsViewVersion'
import { useLocale } from '@/composables/useLocale'
import { useUiText } from '@/composables/useUiText'
import { fmt } from '@/domain/uiText'
import { LANGS, LANG_META } from '@/domain/lang'
import { useHeroForm } from '@/composables/useHeroForm'
import { heroFileForForm } from '@/data/heroGenderVariants'
import type { HeroForm } from '@/data/heroGenderVariants'
import { heroGridSources } from '@/data/heroImageSources'
import { ListPage } from '@/components'
import HollowImage from '@/components/HollowImage.vue'

usePageMeta()

const { agentsViewVersion, setAgentsViewVersion } = useAgentsViewVersion()
const { heroForm, setHeroForm } = useHeroForm()
const { lang, setLang } = useLocale()
const { t } = useUiText()

/** 形态组样张的角色：佩洛伊斯（1551）——当前唯一登记了双形态立绘的角色
 *  （src/data/hero-gender-variants.json），只有它换形态真的换图。 */
const SPECIMEN_ID = 1551

/** 版本组样张的陈列骨架：卡片名录画 9:16 立绘格 + 图下签条，表格名录画发丝行三段。 */
const GRID_TILES = 8
const TABLE_ROWS = 5

type VersionOption = {
  value: AgentsViewVersion
  label: string
  hint: string
  shot: 'grid' | 'rows'
}

/** 选项表：值 + 玩家侧说法（标签与一句说明）+ 样张骨架 */
const VERSIONS = computed<VersionOption[]>(() => [
  {
    value: 'cards',
    label: t.value.settings.cards,
    hint: t.value.settings.cardsHint,
    shot: 'grid',
  },
  {
    value: 'table',
    label: t.value.settings.table,
    hint: t.value.settings.tableHint,
    shot: 'rows',
  },
])
const FORMS = computed<{ value: HeroForm; label: string; hint: string }[]>(() => [
  { value: 'female', label: t.value.settings.formFemale, hint: t.value.settings.formFemaleHint },
  { value: 'male', label: t.value.settings.formMale, hint: t.value.settings.formMaleHint },
])

/** 形态样张的候选链：取卡片档（card/ 800×392），按需再取原图，末位才是同源 CDN 兜底。
 *  样张只有 62 CSS px 宽，DPR 2 下也只需 124px，没必要拉 wide/ 档。 */
function formShotSources(form: HeroForm) {
  return heroGridSources(heroFileForForm(SPECIMEN_ID, form), { retina: false })
}
</script>

<template>
  <ListPage>
    <header v-reveal class="page-head">
      <p class="eyebrow mono">Settings</p>
      <h1 class="page-title">{{ t.settings.title }}</h1>
      <p class="page-sub">
        {{ t.settings.intro }}
      </p>
    </header>

    <section v-reveal="90" class="group">
      <h2 class="group-title mono">{{ t.settings.agentsView }}</h2>
      <p class="group-note">{{ t.settings.agentsViewNote }}</p>
      <div class="plates">
        <label
          v-for="opt in VERSIONS"
          :key="opt.value"
          class="plate"
          :class="{ on: agentsViewVersion === opt.value }"
        >
          <span class="plate-shot" aria-hidden="true">
            <span v-if="opt.shot === 'grid'" class="shot-grid">
              <span v-for="n in GRID_TILES" :key="n" class="shot-cell">
                <span class="shot-tile"></span>
                <span class="shot-sign"></span>
              </span>
            </span>
            <span v-else class="shot-rows">
              <span v-for="n in TABLE_ROWS" :key="n" class="shot-row">
                <span class="shot-no"></span>
                <span class="shot-name"></span>
                <span class="shot-tag"></span>
              </span>
            </span>
          </span>
          <span class="plate-head">
            <span class="plate-mark" aria-hidden="true">
              {{ agentsViewVersion === opt.value ? '◈' : '◇' }}
            </span>
            <span class="plate-label">{{ opt.label }}</span>
            <span class="plate-flag" aria-hidden="true">{{ t.common.selected }}</span>
          </span>
          <span :id="`hint-view-${opt.value}`" class="plate-hint">{{ opt.hint }}</span>
          <input
            class="plate-input"
            type="radio"
            name="agents-view"
            :value="opt.value"
            :checked="agentsViewVersion === opt.value"
            :aria-label="opt.label"
            :aria-describedby="`hint-view-${opt.value}`"
            @change="setAgentsViewVersion(opt.value)"
          />
        </label>
      </div>
    </section>

    <section v-reveal="140" class="group">
      <h2 class="group-title mono">{{ t.settings.heroForm }}</h2>
      <p class="group-note">{{ t.settings.heroFormNote }}</p>
      <div class="plates">
        <label
          v-for="opt in FORMS"
          :key="opt.value"
          class="plate"
          :class="{ on: heroForm === opt.value }"
        >
          <span class="plate-shot" aria-hidden="true">
            <span class="shot-head">
              <span class="shot-portrait">
                <HollowImage
                  :srcs="formShotSources(opt.value)"
                  ratio="9 / 16"
                  fit="cover"
                  alt=""
                />
              </span>
              <span class="shot-lines">
                <span class="shot-line l1"></span>
                <span class="shot-line l2"></span>
                <span class="shot-chips">
                  <span class="shot-chip"></span>
                  <span class="shot-chip"></span>
                  <span class="shot-chip"></span>
                </span>
              </span>
            </span>
          </span>
          <span class="plate-head">
            <span class="plate-mark" aria-hidden="true">{{ heroForm === opt.value ? '◈' : '◇' }}</span>
            <span class="plate-label">{{ opt.label }}</span>
            <span class="plate-flag" aria-hidden="true">{{ t.common.selected }}</span>
          </span>
          <span :id="`hint-form-${opt.value}`" class="plate-hint">{{ opt.hint }}</span>
          <input
            class="plate-input"
            type="radio"
            name="hero-form"
            :value="opt.value"
            :checked="heroForm === opt.value"
            :aria-label="opt.label"
            :aria-describedby="`hint-form-${opt.value}`"
            @change="setHeroForm(opt.value)"
          />
        </label>
      </div>
    </section>

    <section v-reveal="180" class="group">
      <h2 class="group-title mono">{{ t.settings.lang }}</h2>
      <p id="lang-note" class="group-note">
        {{ t.settings.langNote }}

      </p>
      <div class="plates">
        <label
          v-for="l in LANGS"
          :key="l"
          class="plate"
          :class="{ on: lang === l }"
        >
          <span class="plate-head">
            <span class="plate-mark" aria-hidden="true">{{ lang === l ? '◈' : '◇' }}</span>
            <!-- 自称按各自语言标记（读屏会切到对应语音），而不是按当前展示语言 -->
            <span class="plate-label" :lang="LANG_META[l].htmlLang">{{ LANG_META[l].endonym }}</span>
            <span class="plate-flag" aria-hidden="true">{{ t.common.selected }}</span>
          </span>
          <input
            class="plate-input"
            type="radio"
            name="display-lang"
            :value="l"
            :checked="lang === l"
            :aria-label="LANG_META[l].endonym"
            aria-describedby="lang-note"
            @change="setLang(l)"
          />
        </label>
      </div>
      <p class="group-note lang-current">
        {{ fmt(t.settings.currentLang, { name: LANG_META[lang].endonym, tag: LANG_META[lang].htmlLang }) }}
      </p>
    </section>

    <p v-reveal="220" class="foot-note">
      <RouterLink class="foot-link" to="/agents">{{ t.settings.toAgents }}</RouterLink>
    </p>
  </ListPage>
</template>

<style scoped>
.group {
  margin-top: 34px;
}

.group:first-of-type {
  margin-top: 26px;
}

/* 组标题：与全站的类目小标同族（等宽、字距拉开、小号） */
.group-title {
  font-size: var(--fs-micro);
  font-weight: 400;
  letter-spacing: 0.24em;
  text-transform: uppercase;
  color: var(--ink-1);
}

.group-note {
  margin-top: 6px;
  font-size: var(--fs-caption);
  color: var(--ink-2);
}

/* 当前语言回执：与选项板拉开一档，读到「已生效的是哪一个」不被板面吃掉 */
.lang-current {
  margin-top: 14px;
  letter-spacing: 0.02em;
}

/* ---------- 选项板：整板即控件 ---------- */

/* 两项以上才并排；不足一板宽（<260px）时塌成单列。
   用 auto-fit 而非写死两列：选项数变化时列数自己跟着变，不会留空格 */
.plates {
  margin-top: 16px;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 12px;
}

.plate {
  position: relative;
  display: block;
  padding: 14px 16px 16px;
  border: 1px solid var(--line-1);
  border-radius: 2px;
  cursor: pointer;
  transition:
    border-color var(--t-fast) var(--ease),
    background-color var(--t-fast) var(--ease);
}

/* 选中：整板琥珀描边 + 极浅琥珀底（--amber-dim 在打印态自动转透明） */
.plate.on {
  border-color: var(--amber);
  background-color: var(--amber-dim);
}

/* 按压：描边先转琥珀，与选中态同色——「按下即选上」 */
.plate:active {
  border-color: var(--amber);
  background-color: var(--bg-2);
}

/* 样张窗：比板面低一档的取景框（--bg-0 是页面地面色，暗档下即凹陷感）。
   高度定死、内容居中——四块板的样张窗因此逐一对齐，不会因骨架行高不同而参差 */
.plate-shot {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 140px;
  padding: 12px;
  border: 1px solid var(--line-0);
  background-color: var(--bg-0);
}

/* 卡片名录样张：一行 9:16 立绘格 + 图下签条（骨架只表陈列形态，不放真立绘）。
   格宽取等分余宽、整行封顶 460px：宽屏上样张不会拉成一排巨型色块，窄屏上也不会溢出 */
.shot-grid {
  width: 100%;
  max-width: 460px;
  display: flex;
  gap: 6px;
}

.shot-cell {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.shot-tile {
  aspect-ratio: 9 / 16;
  border: 1px solid var(--line-2);
  background-color: var(--bg-2);
}

.shot-sign {
  height: 3px;
  background-color: var(--line-2);
}

/* 表格名录样张：发丝行 + 编号／代号／签条三段（与卡片样张同宽同封顶，两块的取景框等大） */
.shot-rows {
  width: 100%;
  max-width: 460px;
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.shot-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--line-1);
}

.shot-row:last-child {
  padding-bottom: 0;
  border-bottom: none;
}

.shot-no {
  flex: none;
  width: 12px;
  height: 6px;
  background-color: var(--line-2);
}

/* 代号格吃掉余宽：桌面宽板下这一行才不会左右两截断开 */
.shot-name {
  flex: 1;
  min-width: 0;
  height: 6px;
  background-color: var(--line-2);
}

.shot-tag {
  flex: none;
  width: 24px;
  height: 9px;
  border: 1px solid var(--line-2);
  border-radius: 2px;
}

/* 形态样张：真立绘取 9:16 竖格（与名录卡片同构图参数，未校准角色即居中取景），
   右侧补上详情页头图的文字骨架——这一形态就是用在头图、首页今日角色与名片上的 */
.shot-head {
  width: 100%;
  max-width: 460px;
  display: flex;
  align-items: center;
  gap: 14px;
}

.shot-portrait {
  flex: none;
  width: 62px;
}

.shot-lines {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* 高度 5px 而非 3px：3px 的纯底色块会被版式审计当作「一根线」参与相邻线对判定 */
.shot-line {
  height: 5px;
  background-color: var(--line-2);
}

.shot-line.l1 {
  width: 46%;
}

.shot-line.l2 {
  width: 28%;
}

.shot-chips {
  display: flex;
  gap: 6px;
  margin-top: 2px;
}

.shot-chip {
  width: 26px;
  height: 10px;
  border: 1px solid var(--line-2);
  border-radius: 2px;
}

.plate-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 12px;
}

/* 标记：20×20 控件窗（与全站方角开关同族），窗内 ◇ 空心=未选 / ◈ 实心=选中。
   走衬线子集而非等宽——等宽字族里未必有这两个字形 */
.plate-mark {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border: 1px solid var(--line-2);
  border-radius: 2px;
  font-family: var(--serif);
  font-size: var(--fs-caption);
  line-height: 1;
  color: var(--ink-3);
  transition:
    color var(--t-fast) var(--ease),
    border-color var(--t-fast) var(--ease),
    background-color var(--t-fast) var(--ease);
}

.plate-label {
  flex: 1;
  min-width: 0;
  font-family: var(--serif);
  font-size: var(--fs-lead);
  letter-spacing: 0.02em;
  color: var(--ink-0);
  transition: color var(--t-fast) var(--ease);
}

/* 角标：只有选中板才挂「已选」，未选用 visibility 收掉（仍占位，板头不因此错位） */
.plate-flag {
  flex: none;
  padding: 2px 5px 3px;
  border: 1px solid var(--amber);
  border-radius: 2px;
  font-family: var(--serif);
  font-size: var(--fs-micro);
  line-height: 1;
  letter-spacing: 0.06em;
  color: var(--amber);
  visibility: hidden;
}

.plate-hint {
  display: block;
  margin-top: 6px;
  font-size: var(--fs-caption);
  color: var(--ink-2);
}

.plate.on .plate-mark {
  border-color: var(--amber);
  background-color: var(--amber-dim);
  color: var(--amber);
}

.plate.on .plate-label {
  color: var(--amber-hi);
}

.plate.on .plate-flag {
  visibility: visible;
}

/* 原生 radio 抹掉控件本体（选中态由描边、标记与角标表达），但**铺满整板**：
   整板都是它的命中区（触屏上不必去戳 1×1 的控件），键盘焦点也自然落在板框上 */
.plate-input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  appearance: none;
  background: none;
  border: 0;
  cursor: pointer;
}

/* 焦点画在整块板上（板是控件的落点），挂 :focus-visible 而非 :focus-within：
   键盘进来才有环，鼠标点选不留一圈残留 */
.plate-input:focus-visible {
  outline: 1px solid var(--focus);
  outline-offset: 2px;
}

@media (hover: hover) {
  .plate:hover {
    border-color: var(--line-2);
    background-color: var(--bg-2);
  }

  .plate:hover .plate-label {
    color: var(--amber-hi);
  }

  .plate.on:hover {
    border-color: var(--amber-hi);
    background-color: var(--amber-dim);
  }
}

.foot-note {
  margin-top: 30px;
}

.foot-link {
  display: inline-block;
  padding: 3px 0;
  font-size: var(--fs-caption);
  letter-spacing: 0.08em;
  color: var(--ink-1);
  text-decoration: none;
  border-bottom: 1px solid var(--line-1);
  transition:
    color var(--t-fast) var(--ease),
    border-color var(--t-fast) var(--ease);
}

@media (hover: hover) {
  .foot-link:hover {
    color: var(--amber-hi);
    border-bottom-color: var(--amber);
  }
}
</style>
