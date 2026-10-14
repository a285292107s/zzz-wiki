<template>
  <!-- data-vt-hold：站尾与站头同属「终端外壳」（跨路由不重建），永不参与退场/入场编排 ——
       见 utils/viewTransition/chrome.ts 的三条硬规则。 -->
  <footer class="foot" data-vt-hold>
    <div class="wrap foot-inner">
      <div class="foot-side foot-info">
        <p class="meta">
          {{ t.footer.source }} <a href="https://zzz.nanoka.cc" target="_blank" rel="noopener">zzz.nanoka.cc</a>
        </p>
        <span class="sep" aria-hidden="true">/</span>
        <p class="ver mono">{{ t.footer.dataVersion }} <span class="ver-key">LIVE {{ version || '···' }}</span></p>
        <span class="sep" aria-hidden="true">/</span>
        <p class="updated mono">{{ t.footer.updated }} · {{ updatedAt || '···' }}</p>
        <span class="sep" aria-hidden="true">/</span>
        <p class="disclaimer">{{ t.footer.copyright }}</p>
      </div>
      <div class="foot-side foot-links">
        <RouterLink to="/about" class="foot-link mono">{{ t.footer.colophon }}</RouterLink>
      </div>
      <div v-if="isDev" class="foot-actions">
        <RouterLink
          v-for="r in DEV_FOOTER_ROUTES"
          :key="r.path"
          :to="r.path"
          class="style-link mono"
        >{{ r.footerLabel }}</RouterLink>
      </div>
    </div>
  </footer>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { dataVersions } from '@/data/api'
import { IS_DEV, DEV_FOOTER_ROUTES } from '@/domain/devRoutes'
import { useUiText } from '@/composables/useUiText'

const { t } = useUiText()

// 开发环境专属入口：仅 DEV 显示，且由 DEV_ROUTES 单一事实源派生（新增页自动出现）
const isDev = IS_DEV

// 数据版本与抓取时间（构建期落地在 manifest，动态取，勿硬编码）。
// **全站唯一的数据出处**：内容页不再各印一份（详情页内容末原有「数据版本」行，
// 与本站尾相隔约 100px 重复了同一批事实，已移除并集中到此处）。
const version = ref('')
const updatedAt = ref('')
onMounted(() => {
  dataVersions()
    .then((v) => {
      version.value = v.live
      const t = v.generated ? new Date(v.generated) : null
      if (t && !Number.isNaN(t.getTime()))
        updatedAt.value = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(
          t.getDate(),
        ).padStart(2, '0')}`
    })
    .catch(() => {
      // manifest 缺失时不展示时间，不阻断站点
    })
})
</script>

<style scoped>
/* 线上方的留白与**自身内边距**（26px）取同一量级，发丝线才落在「页脚的开头」而不是
   飘在远处；留白偏大时会与页脚底色连成一片，读起来像页脚头上顶着一块空地。
   0.3 倍在桌面 ≈26px，窄屏 --pad-section 收到 40px 时只有 12px，故兜底 24px。 */
.foot {
  border-top: var(--rule);
  margin-top: max(24px, calc(var(--pad-section) * 0.3));
}

.foot-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-head);
  padding-block: 26px;
  font-size: var(--fs-caption);
  color: var(--ink-2);
}

.foot a {
  color: var(--ink-1);
  border-bottom: 1px solid var(--line-1);
  transition: color var(--t-fast) var(--ease),
    border-color var(--t-fast) var(--ease);
}

.foot-side {
  display: flex;
  align-items: center;
  gap: 14px;
}

.sep {
  color: var(--line-2);
  font-size: var(--fs-micro);
}

.foot-info .meta,
.updated,
.ver,
.disclaimer {
  margin: 0;
}

.updated,
.disclaimer,
.meta,
.ver {
  font-size: var(--fs-caption);
  letter-spacing: 0.04em;
  color: var(--ink-2);
}

/* 数据版本是全站唯一的那一项事实（内容页不再各印一份），给它一处极轻的强调：
   读者一眼能定位「这批数据是哪一版」 */
.ver-key {
  color: var(--amber);
}

.style-link {
  font-size: var(--fs-micro);
  letter-spacing: 0.18em;
  color: var(--ink-2) !important;
  border: 1px solid var(--line-1) !important;
  padding: 4px 10px;
  border-radius: 2px;
}

.foot-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* 站内常规入口：数据说明（出处）。
   它不进站头导航——站头预算见 ADR 0004，页脚是它的落点。 */
.foot-link {
  font-size: var(--fs-micro);
  letter-spacing: 0.16em;
  color: var(--ink-1);
  border-bottom: 1px solid var(--line-1);
  /* 命中区补到 ≥24px（WCAG 2.5.8）：页脚导航链接不在句子里，不适用行内豁免。
     加的是垂直内边距，下划线仍在文字下方，视觉几乎不变。 */
  display: inline-block;
  padding: 3px 0;
}

.style-link:hover {
  color: var(--amber-hi) !important;
  border-color: var(--amber) !important;
}

.foot a:hover {
  color: var(--amber-hi);
  border-color: var(--amber);
}

@media (max-width: 720px) {
  .foot-inner {
    flex-direction: column;
    align-items: flex-start;
  }

  /* 出处三件横排会挤成「标签 / 值」两行：390px 下三列各只有 83/83/121px，
     「数据更新 · 2026-10-07」与版权行都被折断，斜杠分隔符正好落在断行的夹缝里。
     窄屏改为逐条成行 —— 三行各自单行放得下，分隔符（原本只为横排省空间）随之撤掉。 */
  .foot-info {
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
  }

  .foot-info .sep {
    display: none;
  }
}
</style>