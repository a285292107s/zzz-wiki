<script setup lang="ts">
import { computed } from 'vue'
import { HIT_TYPES } from '@/domain/enums'
import type { AttrCode, HitCode, SpecCode } from '@/domain/enums'
import { catalogEntry } from '@/domain/catalog'
import type { CharacterDetail, WEngineListItem } from '@/data/types'
import { iconSources } from '@/data/icons'
import { pickName } from '@/utils/names'
import { heroVariantFile, heroFileForForm } from '@/data/heroGenderVariants'
import { heroDetailSources } from '@/data/heroImageSources'
import { getHeroCalibration, type HeroCalibration } from '@/data/heroCalibration'
import { useHeroForm } from '@/composables/useHeroForm'
import { useMediaQuery } from '@/composables/useMediaQuery'
import HollowImage from '@/components/HollowImage.vue'
import Tags from '@/components/Tags.vue'
import Rarity from '@/components/Rarity.vue'
import SignatureRef from '@/components/detail/SignatureRef.vue'

const props = defineProps<{
  detail: CharacterDetail
  /** 专属音擎（签名 W-Engine）：由上级（AgentDetailView）经武器名录解析后传入。
   *  缺失时 hero 不展示专属音擎卡片（可能非法条目 / 名录未覆盖）。 */
  signatureEngine?: WEngineListItem | null
}>()

const attrCode = computed<AttrCode | null>(() => {
  const el = props.detail.element_type
  const key = el ? Object.keys(el)[0] : null
  return key ? (Number(key) as AttrCode) : null
})

/** 特殊属性展示名：有 special_element_type（如 星见雅→烈霜）时优先展示 */
const specialElementName = computed<string | null>(() => {
  const sp = props.detail.special_element_type
  return sp?.name ? String(sp.name) : null
})

const specCode = computed<SpecCode | null>(() => {
  const w = props.detail.weapon_type
  const key = w ? Object.keys(w)[0] : null
  return key ? (Number(key) as SpecCode) : null
})

const hitZh = computed<string | null>(() => {
  const h = props.detail.hit_type
  const key = h ? Object.keys(h)[0] : null
  return key ? (HIT_TYPES[Number(key) as HitCode]?.zh ?? null) : null
})

const codeName = computed(() => props.detail.code_name?.toUpperCase() ?? '')

/** 专属音擎：名录条目（含 Id / icon / 四语名）。命名约定 + 覆盖表见 domain/signatureEngine.ts */
const signature = computed(() => props.signatureEngine ?? null)
/** 专属音擎详情页路由：`/w-engines/{Id}`（路径由 catalog 派生，单一事实源） */
const signatureTo = computed(() =>
  signature.value ? `${catalogEntry('/w-engines').path}/${signature.value.Id}` : '',
)
/** 专属音擎图标候选链（本地化 + nanoka CDN 两级兜底） */
const signatureIconSrcs = computed(() =>
  signature.value ? iconSources(signature.value, 'weapon') : [],
)
/** 专属音擎展示名（zh → en → … 回退） */
const signatureName = computed(() => (signature.value ? pickName(signature.value) : ''))

/**
 * 双形态角色 hero 头图：源站未提供裸名 Mindscape_{id}_2.webp，而是按性别后缀区分
 * （Mindscape_{id}_Female_2 / _Male_2）。单一事实源在 src/data/hero-gender-variants.json；
 * 当前形态经 useHeroForm 选中（详情页形态切换钮 + localStorage 持久化），其余 id 仍按裸名规则。
 */
const { heroForm, toggleHeroForm } = useHeroForm()

/** 双形态角色（hero-gender-variants.json 登记且确有异于默认的另一形态；当前为 1551 佩洛伊斯）才显示形态切换钮 */
const isDualForm = computed(() => {
  const female = heroVariantFile(props.detail.id, 'female')
  const male = heroVariantFile(props.detail.id, 'male')
  return female != null && male != null && female !== male
})

/** Mindscape 场景图：以角色编号（id）命名的背景立绘，作整栏 hero 底图。
 *  本地化优先（img/hero，运行时零外部请求），CDN 兜底；两级均缺时降为 --bg-0 底色 */
const heroBase = computed(() => {
  const id = props.detail.id
  return heroFileForForm(id, heroForm.value)
})

/** 窄屏判定（<=860px 与 tokens.css / SearchField 断点一致）：hero 盒手机仅 ~350 CSS px
 *  可见窗，原图 2552px 超采约 2 倍 → 走 1400w 派生（45-71KB vs 原图 221-310KB）。
 *  在 setup 期同步求值，首帧即选中正确分支（免「先请求原图再切换」的双下载）。 */
const narrow = useMediaQuery('(max-width: 860px)')

/** 高密度屏判定：宽屏下 hero 盒约 1168 CSS px，DPR 1 只需 ~1168px 图，而原图 2552px
 *  是 2.2 倍超采（311KB）——Lighthouse 桌面（DPR 1）LCP 因此被图片拖住。故宽屏也按
 *  DPR 分支：DPR < 1.5 用 1400w 派生（46KB，仍 ≥1168px 不放大），DPR ≥ 1.5 才用原图
 *  （真需要 ~2336px）。
 *  **阈值必须与逐路由 HTML 的预载 media 条件一致**（generate-route-html.mjs 的
 *  max-resolution/min-resolution 分支），否则预载与实取错位、白下一份。 */
const retina = useMediaQuery('(min-resolution: 1.5dppx)')

const heroSrcs = computed(() =>
  // 候选链构造收在 data/heroImageSources（与首页「今日角色」的起飞前预热共用一份）：
  // 两处算错档位之一就等于白下一份 hero 原图（46KB vs 311KB），且过渡会等错图。
  heroDetailSources(heroBase.value, { narrow: narrow.value, retina: retina.value }),
)

/** 复用「今日角色」校准构图（featured-pool.json calibrated 表）：水平脸对焦 + 放大消透明边。
 *  仅移动端应用；未校准（如无 hero 图角色）回落 null，保持居中取景。
 *  双形态角色（如 1551）按默认（女性）版校准，两形态共用同一套参数。 */
const heroCal = computed<HeroCalibration | null>(() => getHeroCalibration(props.detail.id))

/** 把校准参数以 CSS 自定义属性透传给移动端构图（desktop 不消费，保持满栏横幅）。 */
const heroCalStyle = computed<Record<string, string> | undefined>(() =>
  heroCal.value
    ? {
        '--hero-pos': heroCal.value.pos,
        '--hero-zoom': String(heroCal.value.zoom),
        '--hero-originY': `${heroCal.value.originY}%`,
      }
    : undefined,
)
</script>

<template>
  <!-- div 而非 header：页面 banner landmark 唯一（SiteHeader role=banner），
       此处是内容区的档案封面块，不是页面级页眉——避免屏幕阅读器出现双 banner。
       tabindex="-1"：区块索引「00 封面」是 hash 直达（#head），路由层要把焦点落进来
       （读屏随之播报本块内容）；-1 不进 Tab 序，不影响键盘遍历。 -->
  <div class="ahead" tabindex="-1">
    <!-- 取景框：桌面是满盒底图（文字浮于其上，右侧留白）；手机是独立的 4:5 竖幅一格，
         文字整体落到它下方——**作品不被遮挡**（见 IMG_GUIDE.md「信息一律在图下」，
         与首页「今日角色」手机端同一策略）。两种断点只差这一格的盒模型，图本身不换、不裁。
         共享元素名挂在 .hero-bg（见 style）：它是这张画的**裁切容器**，盒子=可见画面 -->
    <span class="hero-frame">
      <span class="hero-bg" aria-hidden="true" data-vt-shared="hero">
        <HollowImage
          unframed
          loading="eager"
          fetchpriority="high"
          :srcs="heroSrcs"
          :img-style="heroCalStyle"
        />
        <!-- 存档面（压暗层）**必须在共享元素内部**：它是这张画的一部分观感。
             放在 .hero-bg 外面时它属于「页面」快照，而具名组的伪元素画在根快照之上 ——
             飞行期间那张画把压暗层盖住，落地那一刻才露出来，观感就是「飞完突然变暗」（实测）。
             放进来后，压暗随共享元素的新旧快照交叉溶解逐步加上去，落地即最终态、无跳变。 -->
        <span class="scrim" data-vt-skip />
      </span>
      <!-- 四角琥珀定位标：档案标本的对位框，非投影非霓虹，纯线框语言。
           框的是**这张画的裁切格**（跟随 .hero-frame），不是整个区块——手机上图与文分开后，
           若仍按整块描边，框会跑到文字外面，「对位」语义就丢了。 -->
      <span class="marks" aria-hidden="true" data-vt-block><i /><i /><i /><i /></span>
    </span>

    <div class="file-row" data-vt-block>
      <p class="eyebrow">AGENT FILE · NO.{{ String(detail.id ?? '').padStart(4, '0') }}</p>
      <!-- 双形态切换钮：仅双形态角色（当前为 1551 佩洛伊斯）显示；切换 hero 头图形态，localStorage 持久化 -->
      <button
        v-if="isDualForm"
        class="form-toggle mono"
        type="button"
        @click="toggleHeroForm"
      >
        <!-- 可访问名从内容派生（「形态 Female」）＋ sr-only 操作说明：
             aria-label 与可见文本不一致会触发 axe label-content-name-mismatch -->
        <span class="t-label">形态</span>
        <span class="t-val">{{ heroForm === 'female' ? 'Female' : 'Male' }}</span>
        <span class="sr-only">，点按切换性别形态</span>
      </button>
    </div>

    <div class="main" data-vt-block>
      <div class="id-block">
        <p v-if="codeName" class="ghost mono">{{ codeName }}</p>
        <h1 class="page-title">{{ detail.name ?? '—' }}</h1>
        <div class="meta">
          <!-- 稀有度置于标签组首位：与属性/职业并列，避免档案行右侧孤悬 -->
          <Rarity :rank="detail.rarity" />
          <Tags :element="attrCode" :element-label="specialElementName" :specialty="specCode" />
          <span v-if="hitZh" class="tag mono">{{ hitZh }}</span>
        </div>

        <!-- 专属音擎（签名 W-Engine）· 边缘注记式交叉引用：点击跳转对应音擎详情页。
             复用共享组件 SignatureRef 的 marginalia 语言（与 W-Engine head 反向引用同一套）。 -->
        <SignatureRef
          v-if="signature"
          :to="signatureTo"
          label="专属音擎"
          :name="signatureName"
          :icon-srcs="signatureIconSrcs"
          :aria-label="`专属音擎：${signatureName}，前往音擎详情`"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.ahead {
  position: relative;
  overflow: hidden;
  /* 与主页 hero 同一横幅图式：不堆超高柱，文字块在曝光区内纵向居中 */
  min-height: clamp(360px, 46vh, 560px);
  background: var(--bg-0); /* 图片缺失/加载前也保有存档底色 */
  margin-bottom: calc(var(--pad-section) * 0.8);
  border-bottom: var(--rule);
}

/* ---------- 取景框 ---------- */

/* 桌面：取景框即整个 .ahead（inset:0），文字绝对浮于其上——右侧 76ch 之外是画，
   文字实际只压住左半边。手机断点会把它改成独立的 4:5 一格（见文件末的媒体查询）。 */
.hero-frame {
  position: absolute;
  inset: 0;
  z-index: 0;
  display: block;
  overflow: hidden;
}

/* ---------- 底图 ---------- */

/* 共享元素过渡的降落端（回程是起飞端）：名字挂这个**裁切容器**而不是 <img>——
   <img> 在移动端带 zoom 缩放，渲染盒比可视区域大 1.28×；带名元素的快照不含祖先裁切，
   直接挂会起飞/着陆在一圈放大的画面上（实测的「起飞瞬间凭空放大」）。
   .hero-bg 自己 overflow: hidden，快照=可见画面，与首页 .deck-item 同一策略。
   静态声明安全：全站只有这一个元素持有该名（首页那头在 FeaturedDeck 的活动卡上）。 */
.hero-bg {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
  view-transition-name: deck-frame;
}
.hero-bg img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
  /* 与主页一致：居中取景，场景横幅完整占据版面 */
  object-position: center;
}

/* ---------- 存档面：与主页同一向纵向曝光｜顶部透出场景，底部深掩埋保障可读 ----------
   色阶统一取 --scrim-*（以 bg-0 为基色），禁止手写 rgba。
   它是 .hero-bg 的子元素（同 inset:0，几何与放在外面完全一致），理由见 template 注释：
   压暗层必须属于共享元素的快照，否则落地那一刻才出现。 */

.scrim {
  position: absolute;
  inset: 0;
  z-index: 1;
  background:
    linear-gradient(180deg,
      var(--scrim-1) 0%,
      var(--scrim-2) 30%,
      var(--scrim-3) 60%,
      var(--scrim-4) 100%);
  pointer-events: none;
}

/* ---------- 四角定位标（纯线框：无圆角、无发光、无投影） ---------- */

.marks {
  position: absolute;
  inset: 16px;
  z-index: 1;
  pointer-events: none;
}

.marks i {
  position: absolute;
  width: 14px;
  height: 14px;
  border: 0 solid var(--amber);
  opacity: 0.85;
}

.marks i:nth-child(1) { top: 0; left: 0; border-top-width: 1px; border-left-width: 1px; }
.marks i:nth-child(2) { top: 0; right: 0; border-top-width: 1px; border-right-width: 1px; }
.marks i:nth-child(3) { bottom: 0; left: 0; border-bottom-width: 1px; border-left-width: 1px; }
.marks i:nth-child(4) { bottom: 0; right: 0; border-bottom-width: 1px; border-right-width: 1px; }

/* ---------- 档案编号行 ---------- */

.file-row {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-head);
  /* 与下方详情区版心同对齐；顶留一份呼吸空间，配合四角定位标内框 */
  padding: 18px var(--pad-page) 15px;
}

/* 双形态切换钮（档案标本：1px 细线框、2px 圆角、等宽字形） */
.form-toggle {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: var(--bg-0);
  border: 1px solid var(--line-1);
  border-radius: 2px;
  font-size: var(--fs-caption);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--ink-2);
  cursor: pointer;
  transition: border-color var(--t-fast) var(--ease), color var(--t-fast) var(--ease);
}

@media (hover: hover) {
  .form-toggle:hover {
    border-color: var(--line-2);
    color: var(--amber);
  }
}

.form-toggle .t-label {
  color: var(--ink-2);
}

.form-toggle .t-val {
  color: var(--amber);
}

/* ---------- 主体：沉底单栏，置于暗面保障可读 ---------- */

.main {
  position: relative;
  z-index: 2;
  /* 纵向上居中：不吃满下缘，与主页 hero 的横幅图式呼应 */
  margin-top: auto;
  margin-bottom: auto;
  padding: clamp(30px, 4vw, 54px) var(--pad-page);
  /* 标题行宽：64ch 下内容区仅 ~451px，最大字号（64px）时 8 字符名
     （如「奥菲丝&「鬼火」」）恰好溢出 1px 被挤成两行；放宽到 76ch
     可容 8~9 字符单行，更长名仍由 text-wrap: balance 均衡断行 */
  max-width: 76ch;
}

/* hero 专属标题尺度：比全局 page-title 更果断，字距微收以衬 CID 衬线气质；
   极端长名必须断行时 balance 均衡两行，避免孤字。
   尺度本身收在 tokens.css 的 --fs-name（含 64px 上限的校准依据）——
   站内最醒目的排印元素不该游离在尺度之外（2026-10 排印合规审计发现）。 */
.main .page-title {
  font-size: var(--fs-name);
  line-height: 1.04;
  letter-spacing: -0.01em;
  text-wrap: balance;
}

/* 代号作标题上方 kicker：mono + 琥珀细线引导，与顶部 eyebrow 同属档案语言 */
.ghost {
  display: inline-flex;
  align-items: center;
  gap: var(--space-inline);
  margin-bottom: 14px;
  font-size: clamp(12px, 1.4vw, 15px);
  font-weight: 400;
  letter-spacing: 0.34em;
  text-transform: uppercase;
  color: var(--amber);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ghost::before {
  content: '';
  flex: none;
  width: 22px;
  height: 1px;
  background: var(--amber);
}

.meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-inline);
  margin-top: 22px;
}

/* ---------- 移动端：图与文分离（作品不被遮挡） ----------
   桌面是「满栏底图 + 文字浮于左半」，靠的是 1168px 宽、76ch 上限让右侧留白给画；
   手机 353px 宽时同一套窄不下（76ch 等于没约束），实测文字块占盒宽 89%、盒高 61%，
   名字正压在人脸上——不是压暗不够，是版式把字放在了画上。
   故手机改为**上下两段**：4:5 竖幅取景框在上，信息整体落到图下。
   依据 IMG_GUIDE.md「信息一律在图下」，与首页「今日角色」手机端同一策略。 */
@media (max-width: 860px) {
  /* 容器改为纵向流：取景框不再铺底，而是流内的一格 */
  .ahead {
    min-height: 0;
    /* 图与文共用一个框，故不能再 overflow:hidden 裁到 .marks 的描边 */
    display: flex;
    flex-direction: column;
    padding: 0 var(--pad-page);
  }

  /* 取景框：占据流内位置，4:5 竖幅（超宽全景进横框只露一条横带，竖幅能收进更多角色本体）。
     aspect-ratio 定高，宽度随容器；与首页手机端 4:5 同一坐标系，
     pos/zoom/originY 三个校准参数原样复用（IMG_GUIDE.md：比例型 zoom/pos 与视口无关）。 */
  .hero-frame {
    position: relative;
    inset: auto;
    /* 竖幅取景：图与文分离后，画必须自己撑起这一格 */
    aspect-ratio: 4 / 5;
    width: 100%;
    border: 1px solid var(--line-1);
    border-radius: 2px;
  }

  /* 四角定位标内缩，贴住取景框内缘 */
  .marks {
    inset: 10px;
  }

  /* 复用「今日角色」校准构图：水平脸对焦（pos）+ 放大消透明边（zoom/originY），
     与 9:16 卡同一套相对构参数（见 IMG_GUIDE.md）；未校准（--hero-* 缺失）回落居中取景 */
  .hero-bg img {
    object-position: var(--hero-pos, center);
    transform-origin: 50% var(--hero-originY, 50%);
    transform: scale(var(--hero-zoom, 1));
  }

  /* 压暗层退化为「只为收口」的轻渐隐：画上已经没有文字，不再需要为可读性压暗整幅。
     上下各留一点，把取景格与黑底的交界收干净（硬边会让透明底素材显得像被切了一刀）。 */
  .scrim {
    background: linear-gradient(
      180deg,
      var(--scrim-2) 0%,
      transparent 22%,
      transparent 78%,
      var(--scrim-3) 100%
    );
  }

  /* 编号行移到取景框**上方**：黑底承载，不压画；与首页标本签的「编号在图上」相反，
     因为详情页这行还兼作形态切换钮的落点，放图上会与小尺寸取景框抢注意力。 */
  .file-row {
    order: -1;
    padding: 14px 0 10px;
  }

  /* 信息块：正常文档流，落在图下；不再 margin:auto 居中、不再吃 max-width:76ch */
  .main {
    margin: 0;
    padding: 18px 0 22px;
    max-width: none;
  }

  /* 图下信息区：字号略收，标题保持档案分量但不至于压满 */
  .main .page-title {
    font-size: clamp(30px, 9vw, 40px);
  }

  .ghost {
    margin-bottom: 10px;
  }

  .meta {
    margin-top: 16px;
  }
}

/* ---------- 中宽以上（>430，含手机横屏与平板）----------
   4:5 只在**真正的手机竖屏**宽度下成立（≤430 时取景格 240–438px 高，图与文一起进一屏）。
   再宽一寸就会算出过高的一格：560px 时 470×588、768px 时 645×806——名字被推出屏幕，
   「图与文分离」就做成了「只剩图」。故 >430 改用**高度封顶**的画幅：
   取景格高度由 vh 定，宽度随栏宽（超宽全景进这种横框反而更合，与首页桌面端同一取景逻辑）。 */
@media (min-width: 431px) and (max-width: 860px) {
  .hero-frame {
    aspect-ratio: auto;
    height: clamp(260px, 42vh, 420px);
  }
}
</style>
