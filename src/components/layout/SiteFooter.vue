<template>
  <footer class="foot">
    <div class="wrap foot-inner">
      <p class="mono">ROPEWEB://ARCHIVE</p>
      <p>
        数据源 <a href="https://zzz.nanoka.cc" target="_blank" rel="noopener">zzz.nanoka.cc</a>
        · 与米哈游 / HoYoverse 无关
      </p>
      <RouterLink to="/style" class="style-link mono">DESIGN SYSTEM</RouterLink>
    </div>
  </footer>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router'
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
  font-size: 12.5px;
  color: var(--ink-2);
}

.foot a {
  color: var(--ink-1);
  border-bottom: 1px solid var(--line-1);
  transition: color var(--t-fast) var(--ease),
    border-color var(--t-fast) var(--ease);
}

.style-link {
  font-size: 11px;
  letter-spacing: 0.18em;
  color: var(--ink-2) !important;
  border: 1px solid var(--line-1) !important;
  padding: 4px 10px;
  border-radius: 2px;
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