<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue'
import { api, locName } from '@/data/api'
import { ELEMENTS, PROFESSIONS, type AttrCode, type SpecCode } from '@/data/types'
import type { CharacterListItem } from '@/data/types'
import Tags from '@/components/Tags.vue'
import Rarity from '@/components/Rarity.vue'
import HollowImage from '@/components/HollowImage.vue'
import { iconUrl } from '@/data/api'

const items = ref<CharacterListItem[]>([])
const loaded = ref(false)
const error = ref<string | null>(null)

const attrFilter = ref<'all' | AttrCode>('all')
const profFilter = ref<'all' | SpecCode>('all')
const query = ref('')

watchEffect(async () => {
  try {
    error.value = null
    items.value = await api.characters()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loaded.value = true
  }
})

const filtered = computed(() => {
  let list = items.value
  if (attrFilter.value !== 'all') {
    list = list.filter((c) => c.element === attrFilter.value)
  }
  if (profFilter.value !== 'all') {
    list = list.filter((c) => c.type === profFilter.value)
  }
  const q = query.value.trim().toLowerCase()
  if (q) {
    list = list.filter((c) => locName(c).toLowerCase().includes(q))
  }
  return list
})

const showFilters = computed(() => items.value.length > 0)

const attrs = Object.entries(ELEMENTS) as Array<[string, { zh: string; color: string }]>
const profs = Object.entries(PROFESSIONS) as Array<[string, { zh: string }]>
</script>

<template>
  <div class="wrap page">
    <header class="page-head">
      <p class="eyebrow mono">Agents</p>
      <h1 class="page-title">代理人</h1>
      <p class="page-sub">
        新艾利都登记在册的代理人名录。可按属性、职业筛选，或输入姓名检索。
      </p>
    </header>

    <section class="toolbar">
      <div class="filters">
        <button
          class="chip"
          :class="{ on: attrFilter === 'all' }"
          @click="attrFilter = 'all'"
        >
          全部属性
        </button>
        <button
          v-for="[key, a] in attrs"
          :key="key"
          class="chip attr"
          :class="{ on: attrFilter === Number(key) }"
          :style="{ '--chip-color': a.color }"
          @click="attrFilter = attrFilter === Number(key) ? 'all' : (Number(key) as AttrCode)"
        >
          <span class="swatch" />
          {{ a.zh }}
        </button>

        <span class="sep" />

        <button
          class="chip"
          :class="{ on: profFilter === 'all' }"
          @click="profFilter = 'all'"
        >
          全部职业
        </button>
        <button
          v-for="[key, p] in profs"
          :key="key"
          class="chip"
          :class="{ on: profFilter === Number(key) }"
          @click="profFilter = profFilter === Number(key) ? 'all' : (Number(key) as SpecCode)"
        >
          {{ p.zh }}
        </button>
      </div>

      <div class="search">
        <span class="mono q-mark">⌕</span>
        <input
          v-model="query"
          type="search"
          placeholder="检索姓名…"
          aria-label="检索姓名"
        />
        <span class="mono count">{{ filtered.length }}</span>
      </div>
    </section>

    <p v-if="error" class="err mono">
      ⚠ 数据加载失败：{{ error }}
    </p>

    <section v-if="loaded && showFilters" class="list">
      <table class="hairline-table">
        <thead>
          <tr>
            <th>#</th>
            <th>代号</th>
            <th>属性</th>
            <th>职业</th>
            <th>阵营</th>
            <th class="r">稀有度</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(c, i) in filtered" :key="c.Id">
            <td class="mono idx">{{ String(i + 1).padStart(2, '0') }}</td>
            <td>
              <RouterLink :to="`/agents/${c.Id}`" class="name-cell">
                <span class="mini-icon">
                  <HollowImage
                    :src="iconUrl(String(c.icon ?? ''))"
                    :alt="locName(c)"
                    :fallback="locName(c)"
                  />
                </span>
                <span class="name-link">{{ locName(c) }}</span>
              </RouterLink>
            </td>
            <td><Tags :element="c.element" /></td>
            <td><Tags :specialty="c.type" /></td>
            <td class="camp mono">C{{ String(c.camp ?? '—').padStart(2, '0') }}</td>
            <td class="r"><Rarity :rank="c.rank" /></td>
          </tr>
        </tbody>
      </table>

      <p v-if="!filtered.length" class="empty mono">NO RECORDS</p>
    </section>

    <p v-else-if="loaded" class="empty mono">正在整理条目…</p>
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

/* ---------- toolbar ---------- */

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
  font-size: 15px;
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

/* ---------- table ---------- */

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

.name-link {
  font-size: 15px;
  letter-spacing: 0.02em;
  transition: color var(--t-fast) var(--ease);
}

.name-link:hover {
  color: var(--amber-hi);
}

.camp {
  color: var(--ink-2);
  font-size: 12px;
  letter-spacing: 0.12em;
}

.r {
  text-align: right;
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