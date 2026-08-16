<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue'
import { api, locName } from '@/data/api'
import { PROFESSIONS, type SpecCode } from '@/data/types'
import type { WEngineListItem } from '@/data/types'
import Tags from '@/components/Tags.vue'
import Rarity from '@/components/Rarity.vue'

const items = ref<WEngineListItem[]>([])
const loaded = ref(false)
const error = ref<string | null>(null)

const rarityFilter = ref<'all' | 3 | 4>('all')
const specFilter = ref<'all' | SpecCode>('all')
const query = ref('')

watchEffect(async () => {
  try {
    error.value = null
    items.value = await api.wengines()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loaded.value = true
  }
})

const filtered = computed(() => {
  let list = items.value
  if (rarityFilter.value !== 'all') list = list.filter((w) => w.rank === rarityFilter.value)
  if (specFilter.value !== 'all') list = list.filter((w) => w.type === specFilter.value)
  const q = query.value.trim().toLowerCase()
  if (q) list = list.filter((w) => locName(w).toLowerCase().includes(q))
  return list
})

const profs = Object.entries(PROFESSIONS) as Array<[string, { zh: string }]>
</script>

<template>
  <div class="wrap page">
    <header class="page-head">
      <p class="eyebrow mono">W-Engines</p>
      <h1 class="page-title">音擎</h1>
      <p class="page-sub">
        与代理人配对的战斗终端。按稀有度与职业定位筛选。
      </p>
    </header>

    <section class="toolbar">
      <div class="filters">
        <button class="chip" :class="{ on: rarityFilter === 'all' }" @click="rarityFilter = 'all'">全部稀有度</button>
        <button class="chip" :class="{ on: rarityFilter === 4 }" @click="rarityFilter = rarityFilter === 4 ? 'all' : 4">S</button>
        <button class="chip" :class="{ on: rarityFilter === 3 }" @click="rarityFilter = rarityFilter === 3 ? 'all' : 3">A</button>

        <span class="sep" />

        <button class="chip" :class="{ on: specFilter === 'all' }" @click="specFilter = 'all'">全部定位</button>
        <button
          v-for="[key, p] in profs"
          :key="key"
          class="chip"
          :class="{ on: specFilter === Number(key) }"
          @click="specFilter = specFilter === Number(key) ? 'all' : (Number(key) as SpecCode)"
        >
          {{ p.zh }}
        </button>
      </div>

      <div class="search">
        <span class="mono q-mark">⌕</span>
        <input v-model="query" type="search" placeholder="检索音擎…" aria-label="检索音擎" />
        <span class="mono count">{{ filtered.length }}</span>
      </div>
    </section>

    <p v-if="error" class="err mono">⚠ 数据加载失败：{{ error }}</p>

    <section v-if="loaded" class="list">
      <table class="hairline-table">
        <thead>
          <tr>
            <th>#</th>
            <th>名称</th>
            <th>稀有度</th>
            <th>职业定位</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(w, i) in filtered" :key="w.Id">
            <td class="mono idx">{{ String(i + 1).padStart(2, '0') }}</td>
            <td class="name">{{ locName(w) }}</td>
            <td><Rarity :rank="w.rank" /></td>
            <td><Tags :specialty="w.type" /></td>
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
  flex-wrap: wrap;
  align-items: center;
  gap: 18px;
  justify-content: space-between;
  margin-bottom: 20px;
}
.filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}
.chip {
  font-size: 12.5px;
  letter-spacing: 0.08em;
  padding: 5px 12px;
  border: 1px solid var(--line-1);
  border-radius: 2px;
  color: var(--ink-1);
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: all var(--t-fast) var(--ease);
}
.chip:hover {
  border-color: var(--line-2);
  color: var(--ink-0);
}
.chip.on {
  border-color: var(--amber);
  color: var(--ink-0);
  background: var(--amber-dim);
}
.swatch {
  width: 7px;
  height: 7px;
  background: var(--chip-color, var(--ink-2));
  flex: none;
}
.sep {
  width: 1px;
  height: 18px;
  background: var(--line-1);
  margin-inline: 6px;
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