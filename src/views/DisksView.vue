<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue'
import { api } from '@/data/api'
import type { DiskDriveListItem } from '@/data/types'
import RarityStars from '@/components/RarityStars.vue'

const items = ref<DiskDriveListItem[]>([])
const loaded = ref(false)
const error = ref<string | null>(null)
const query = ref('')

watchEffect(async () => {
  try {
    error.value = null
    items.value = await api.disks()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loaded.value = true
  }
})

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return items.value
  return items.value.filter((d) => (d.Name ?? '').toLowerCase().includes(q))
})
</script>

<template>
  <div class="wrap page">
    <header class="page-head">
      <p class="eyebrow mono">Disk Drives</p>
      <h1 class="page-title">驱动盘</h1>
      <p class="page-sub">驱动盘套装总览。套装详情页会补充分件属性与聚合效果。</p>
    </header>

    <div class="toolbar">
      <div class="search">
        <span class="mono q-mark">⌕</span>
        <input v-model="query" type="search" placeholder="检索套装…" aria-label="检索套装" />
        <span class="mono count">{{ filtered.length }}</span>
      </div>
    </div>

    <p v-if="error" class="err mono">⚠ 数据加载失败：{{ error }}</p>

    <section v-if="loaded" class="list">
      <table class="hairline-table">
        <thead>
          <tr>
            <th>#</th>
            <th>套装名称</th>
            <th>稀有度</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(d, i) in filtered" :key="d.Id">
            <td class="mono idx">{{ String(i + 1).padStart(2, '0') }}</td>
            <td class="name">{{ d.Name ?? '—' }}</td>
            <td><RarityStars :value="d.Rarity" /></td>
          </tr>
        </tbody>
      </table>
      <p v-if="!filtered.length" class="empty mono">NO RECORDS</p>
    </section>
    <p v-else class="loading mono">LOADING…</p>
  </div>
</template>

<style scoped>
.page {
  padding-top: calc(var(--pad-section) * 0.9);
}
.page-head {
  margin-bottom: var(--pad-section);
}

.toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 20px;
}
.search {
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--line-1);
  padding: 6px 12px;
  border-radius: 2px;
  min-width: 240px;
}
.search:focus-within {
  border-color: var(--line-2);
}
.q-mark {
  color: var(--ink-2);
}
.search input {
  background: none;
  border: none;
  outline: none;
  width: 100%;
  font-size: 14px;
  color: var(--ink-0);
}
.search input::placeholder {
  color: var(--ink-3);
}
.count {
  font-size: 12px;
  color: var(--ink-2);
}

.idx {
  color: var(--ink-3);
  font-size: 12px;
}
.name {
  letter-spacing: 0.02em;
}

.err {
  color: var(--danger);
  font-size: 12.5px;
  margin-bottom: 18px;
}
.empty,
.loading {
  color: var(--ink-2);
  font-size: 12.5px;
  letter-spacing: 0.2em;
  padding: 40px 0;
}
</style>