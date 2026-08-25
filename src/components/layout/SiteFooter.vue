<template>
  <footer class="foot">
    <div class="wrap foot-inner">
      <div class="foot-side foot-info">
        <p class="meta">
          数据源 <a href="https://zzz.nanoka.cc" target="_blank" rel="noopener">zzz.nanoka.cc</a>
        </p>
        <span class="sep" aria-hidden="true">/</span>
        <p class="updated mono">数据更新 · {{ updatedAt || '···' }}</p>
        <span class="sep" aria-hidden="true">/</span>
        <p class="disclaimer">游戏资产版权与商标归 HoYoverse 所有</p>
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

// 开发环境专属入口：仅 DEV 显示，且由 DEV_ROUTES 单一事实源派生（新增页自动出现）
const isDev = IS_DEV

// 数据抓取/更新时间（构建期落地在 manifest 的 generated，动态取，勿硬编码）
const updatedAt = ref('')
onMounted(() => {
  dataVersions()
    .then((v) => {
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
.foot {
  border-top: var(--rule);
  margin-top: calc(var(--pad-section) * 1.2);
}

.foot-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
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
.disclaimer {
  margin: 0;
}

.updated,
.disclaimer,
.meta {
  font-size: var(--fs-caption);
  letter-spacing: 0.04em;
  color: var(--ink-2);
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
}
</style>