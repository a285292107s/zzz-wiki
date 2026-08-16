<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue'
import { api } from '@/data/api'
import { ATTRIBUTES, type Attribute } from '@/data/types'
import type { BangbooListItem } from '@/data/types'
import Tags from '@/components/Tags.vue'
import RarityStars from '@/components/RarityStars.vue'

const items = ref<BangbooListItem[]>([])
const loaded = ref(false)
const error = ref<string | null>(null)

const attrFilter = ref<'all' | Attribute>('all')
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
  let list = items.value
  if (attrFilter.value !== 'all') list = list.filter((b) => b.Attribute === attrFilter.value)
  const q = query.value.trim().toLowerCase()
  if (q) list = list.filter((b) => (b.Name ?? '').toLowerCase().includes(q))
  return list
})

const attrs = Object.entries(ATTRIBUTES) as Array<[Attribute, { zh: string }]>
</script>

<template>
  <div class="wrap page">
    <header class="page-head">
      <p class="eyebrow mono">Bangboo</p>
      <h1 class="page-title">邦布</h1>
      <p class="page-sub">空洞里的好搭档。按属性筛选，或直接检索型号。</p>
    </header>

    <section class="toolbar">
      <div class="filters">
        <button class="chip" :class="{ on: attrFilter === 'all' }" @click="attrFilter = 'all'">全部</button>
        <button
          v-for="[key, a] in attrs"
          :key="key"
          class="chip attr"
          :class="{ on: attrFilter === key }"
          :style="{ '--chip-color': ATTRIBUTES[key].color }"
          @click="attrFilter = attrFilter === key ? 'all' : key"
        >
          <span class="swatch" />{{ a.zh }}
        </button>
      </div>

      <div class="search">
        <span class="mono q-mark">⌕</span>
        <input v-model="query" type="search" placeholder="检索邦布…" aria-label="检索邦布" />
        <span class="mono count">{{ filtered.length }}</span>
      </div>
    </section>

    <p v-if="error" class="err mono">⚠ 数据加载失败：{{ error }}</p>

    <section v-if="loaded" class="list">
      <table class="hairline-table">
        <thead>
          <tr>
            <th>#</th>
            <th>型号</th>
            <th>属性</th>
            <th>稀有度</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(b, i) in filtered" :key="b.Id">
            <td class="mono idx">{{ String(i + 1).padStart(2, '0') }}</td>
            <td class="name">{{ b.Name ?? '—' }}</td>
            <td><Tags :attribute="b.Attribute" show-zh /></td>
            <td><RarityStars :value="b.Rarity" /></td>
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
.chip.attr.on {
  border-color: var(--chip-color);
  color: var(--chip-color);
}
.swatch {
  width: 7px;
  height: 7px;
  background: var(--chip-color, var(--ink-2));
  flex: none;
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