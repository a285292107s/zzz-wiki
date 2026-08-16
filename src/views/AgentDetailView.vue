<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import { api, iconUrl } from '@/data/api'
import type { CharacterDetail } from '@/data/types'
import Tags from '@/components/Tags.vue'
import RarityStars from '@/components/RarityStars.vue'

const route = useRoute()
const detail = ref<CharacterDetail | null>(null)
const loaded = ref(false)
const error = ref<string | null>(null)

const id = computed(() => String(route.params.id))

watchEffect(async () => {
  loaded.value = false
  error.value = null
  try {
    detail.value = await api.character(id.value)
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loaded.value = true
  }
})

const stats = computed(() => {
  const d = detail.value
  if (!d) return []
  const rows: Array<[string, number | undefined]> = [
    ['生命值 HP', d.HP],
    ['攻击力 ATK', d.ATK],
    ['防御力 DEF', d.DEF],
    ['冲击力', d.Impact],
    ['暴击率', d.CritRate],
    ['暴击伤害', d.CritDMG],
    ['穿透率', d.PenRatio],
    ['异常掌控', d.AnomalyMastery],
    ['异常精通', d.AnomalyProficiency],
    ['能量自动回复', d.EnergyRegen],
  ]
  return rows.filter(([, v]) => v != null) as Array<[string, number]>
})
</script>

<template>
  <div class="wrap page">
    <RouterLink to="/agents" class="back mono">← 返回名录</RouterLink>

    <p v-if="error" class="err mono">⚠ 数据加载失败：{{ error }}</p>
    <p v-else-if="!loaded" class="loading mono">LOADING…</p>

    <template v-else-if="detail">
      <header class="head">
        <div class="id-block">
          <p class="eyebrow mono">Agent · {{ String(id).padStart(4, '0') }}</p>
          <h1 class="page-title">{{ detail.Name }}</h1>
          <div class="meta mono">
            <RarityStars :value="detail.Rarity" />
            <Tags :attribute="detail.Attribute" :profession="detail.Profession" />
            <span v-if="detail.Camp" class="camp">{{ detail.Camp }}</span>
          </div>
        </div>

        <div v-if="detail.Icon" class="portrait">
          <img :src="iconUrl(String(detail.Icon)) ?? ''" :alt="detail.Name" loading="lazy" />
        </div>
      </header>

      <section v-if="stats.length" class="block">
        <div class="section-head">
          <span class="no mono">01</span>
          <h2>基础数值</h2>
          <span class="rule" />
        </div>
        <div class="stat-grid">
          <div v-for="[label, value] in stats" :key="label" class="stat">
            <span class="k">{{ label }}</span>
            <span class="v mono">{{ value }}</span>
          </div>
        </div>
      </section>

      <section v-if="detail.SkillList?.length" class="block">
        <div class="section-head">
          <span class="no mono">02</span>
          <h2>技能</h2>
          <span class="rule" />
        </div>
        <ul class="skill-list">
          <li v-for="(s, i) in detail.SkillList" :key="s.Id ?? i" class="skill">
            <span class="skill-no mono">{{ String(i + 1).padStart(2, '0') }}</span>
            <div class="skill-body">
              <h3 class="serif">{{ s.Name ?? '未命名' }}</h3>
              <p class="skill-type mono">{{ s.Type ?? '' }}</p>
              <p v-if="s.Desc" class="desc">{{ s.Desc }}</p>
            </div>
          </li>
        </ul>
      </section>

      <section v-if="detail.TalentList?.length" class="block">
        <div class="section-head">
          <span class="no mono">03</span>
          <h2>天赋</h2>
          <span class="rule" />
        </div>
        <ul class="talent-list">
          <li v-for="(t, i) in detail.TalentList" :key="t.Id ?? i" class="talent">
            <span class="talent-no mono">{{ String(i + 1).padStart(2, '0') }}</span>
            <div>
              <h3 class="serif">{{ t.Name ?? '未命名' }}</h3>
              <p v-if="t.Desc" class="desc">{{ t.Desc }}</p>
            </div>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>

<style scoped>
.page {
  padding-top: calc(var(--pad-section) * 0.8);
}

.back {
  font-size: 12.5px;
  color: var(--ink-2);
  letter-spacing: 0.12em;
  transition: color var(--t-fast) var(--ease);
  display: inline-block;
  margin-bottom: calc(var(--pad-section) * 0.6);
}

.back:hover {
  color: var(--amber-hi);
}

/* ---------- head ---------- */

.head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 32px;
  margin-bottom: calc(var(--pad-section) * 0.8);
}

.meta {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-top: 18px;
  flex-wrap: wrap;
}

.camp {
  font-size: 12px;
  letter-spacing: 0.18em;
  color: var(--ink-1);
  border: 1px solid var(--line-1);
  padding: 3px 9px;
  border-radius: 2px;
}

.portrait {
  flex: none;
  width: min(300px, 38vw);
}

.portrait img {
  width: 100%;
  border: var(--rule);
  background: var(--bg-1);
}

/* ---------- blocks ---------- */

.block {
  margin-bottom: calc(var(--pad-section) * 0.7);
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
  gap: 1px;
  background: var(--line-1);
  border: var(--rule);
}

.stat {
  background: var(--bg-2);
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat .k {
  font-size: 12px;
  color: var(--ink-2);
  letter-spacing: 0.1em;
}

.stat .v {
  font-size: 19px;
  color: var(--ink-0);
}

/* ---------- skills ---------- */

.skill-list {
  list-style: none;
}

.skill {
  display: grid;
  grid-template-columns: 40px 1fr;
  gap: 16px;
  padding: 18px 4px;
  border-bottom: var(--rule);
}

.skill-no {
  color: var(--ink-3);
  font-size: 12px;
  padding-top: 4px;
}

.skill-body h3 {
  font-size: 18px;
  font-weight: 500;
}

.skill-type {
  font-size: 11px;
  letter-spacing: 0.18em;
  color: var(--amber);
  margin: 2px 0 8px;
}

.desc {
  color: var(--ink-1);
  font-size: 14px;
  max-width: 72ch;
}

/* ---------- talents ---------- */

.talent-list {
  list-style: none;
}

.talent {
  display: grid;
  grid-template-columns: 40px 1fr;
  gap: 16px;
  padding: 16px 4px;
  border-bottom: var(--rule);
}

.talent-no {
  color: var(--ink-3);
  font-size: 12px;
  padding-top: 2px;
}

.talent h3 {
  font-size: 16.5px;
  font-weight: 500;
  margin-bottom: 6px;
}

.err,
.loading {
  color: var(--danger);
  font-size: 12.5px;
  letter-spacing: 0.2em;
}

.loading {
  color: var(--ink-2);
}

@media (max-width: 860px) {
  .head {
    flex-direction: column-reverse;
    align-items: flex-start;
  }
  .portrait {
    width: 60vw;
  }
}
</style>