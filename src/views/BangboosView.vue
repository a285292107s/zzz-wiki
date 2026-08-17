<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue'
import { api, locName } from '@/data/api'
import { iconSources } from '@/data/icons'
import type { BangbooListItem } from '@/data/types'
import Rarity from '@/components/Rarity.vue'
import HollowImage from '@/components/HollowImage.vue'

const items = ref<BangbooListItem[]>([])
const loaded = ref(false)
const error = ref<string | null>(null)
const query = ref('')

watchEffect(async () => {
  try {
    error.value = null
    items.value = await api.bangboos()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loaded.value = true
  }
})

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return items.value
  return items.value.filter((b) => locName(b).toLowerCase().includes(q))
})
</script>

<template>
  <div class="wrap page">
    <header class="page-head">
      <p class="eyebrow mono">Bangboo</p>
      <h1 class="page-title">邦布</h1>
      <p class="page-sub">空洞里的好搭档。检索型号或按稀有度浏览。</p>
    </header>

    <div class="toolbar">
      <div class="search">
        <span class="mono q-mark">⌕</span>
        <input v-model="query" type="search" placeholder="检索邦布…" aria-label="检索邦布" />
        <span class="mono count">{{ filtered.length }}</span>
      </div>
    </div>

    <p v-if="error" class="err mono">⚠ 数据加载失败：{{ error }}</p>

    <section v-if="loaded" class="list">
      <table class="hairline-table">
        <thead>
          <tr>
            <th>#</th>
            <th>型号</th>
            <th>代号</th>
            <th>稀有度</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(b, i) in filtered" :key="b.Id">
            <td class="mono idx">{{ String(i + 1).padStart(2, '0') }}</td>
            <td>
              <span class="name-cell">
                <span class="mini-icon">
                  <HollowImage
                    :srcs="iconSources({ Id: b.Id, icon: b.icon }, 'list', 'bangboo')"
                    :alt="locName(b)"
                    :fallback="locName(b)"
                  />
                </span>
                <span class="name">{{ locName(b) }}</span>
              </span>
            </td>
            <td class="code mono">{{ b.codename ?? '—' }}</td>
            <td><Rarity :rank="b.rank" /></td>
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

.name-cell {
  display: inline-flex;
  align-items: center;
  gap: 12px;
}

.mini-icon {
  width: 34px;
  height: 34px;
  flex: none;
  display: block;
}

.mini-icon :deep(.frame) {
  border-radius: 2px;
}

.name {
  letter-spacing: 0.02em;
}
.code {
  color: var(--ink-2);
  font-size: 12px;
  letter-spacing: 0.08em;
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