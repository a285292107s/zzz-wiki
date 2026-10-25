<template>
  <footer class="foot" data-vt-hold>
    <div class="wrap foot-inner">
      <div class="foot-col">
        <div class="foot-line">
          <p class="meta">
            {{ t.footer.source }} <a href="https://zzz.nanoka.cc" target="_blank" rel="noopener">zzz.nanoka.cc</a>
          </p>
          <p class="ver mono">{{ t.footer.dataVersion }} <span class="ver-key">{{ versionLabel('LIVE') || 'LIVE ···' }}</span></p>
          <p class="updated mono">{{ t.footer.updated }} · {{ updatedAt || '···' }}</p>
        </div>
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
import { RouterLink } from 'vue-router'
import { IS_DEV, DEV_FOOTER_ROUTES } from '@/domain/devRoutes'
import { useUiText } from '@/composables/useUiText'
import { useDataVersion } from '@/composables/useDataVersion'

const { t } = useUiText()

const isDev = IS_DEV

const { updatedAt, versionLabel } = useDataVersion()
</script>

<style scoped>
.foot {
  border-top: var(--rule);
  margin-top: max(24px, calc(var(--pad-section) * 0.3));
}

.foot-inner {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-group);
  padding-block: var(--space-group);
  font-size: var(--fs-caption);
  color: var(--ink-2);
  font-variant-numeric: tabular-nums;
}

.foot-col {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  min-width: 0;
}

.foot-line {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  column-gap: var(--space-group);
  row-gap: var(--space-1);
}

.foot-line p {
  margin: 0;
  white-space: nowrap;
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
  gap: var(--space-head);
}

.updated,
.disclaimer,
.meta,
.ver {
  margin: 0;
  font-size: var(--fs-caption);
  letter-spacing: 0.04em;
  color: var(--ink-2);
}

.disclaimer {
  max-width: 62ch;
  text-wrap: balance;
}

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
  gap: var(--space-1);
}

.foot-link {
  font-size: var(--fs-micro);
  letter-spacing: 0.16em;
  color: var(--ink-1);
  border-bottom: 1px solid var(--line-1);
  display: inline-block;
  padding: var(--space-1) 0;
}

.style-link:hover {
  color: var(--amber-hi) !important;
  border-color: var(--amber) !important;
}

.foot a:hover {
  color: var(--amber-hi);
  border-color: var(--amber);
}

@media (max-width: 899px) {
  .foot-inner {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-2);
  }

  .foot-line {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-1);
  }
}
</style>
