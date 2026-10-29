<template>
  <div class="detail">
    <div class="head">
      <p class="kicker mono">{{ module.no }} · {{ layer.zh }} / {{ layer.en }}<template v-if="cluster"> · {{ cluster }}列</template></p>
      <h3 class="title">{{ module.zh }}<span class="en mono">{{ module.en }}</span></h3>
      <dl class="stats">
        <div class="stat">
          <dt>楼层</dt>
          <dd class="mono">{{ floors }}</dd>
        </div>
        <div class="stat">
          <dt>占地</dt>
          <dd class="mono">{{ weight }} 档</dd>
        </div>
        <div class="stat">
          <dt>上游</dt>
          <dd class="mono">{{ up.length }}</dd>
        </div>
        <div class="stat">
          <dt>下游</dt>
          <dd class="mono">{{ down.length }}</dd>
        </div>
      </dl>
      <p class="note">{{ module.note }}</p>
    </div>

    <div class="block">
      <p class="sub mono">路径</p>
      <p v-for="path in module.paths" :key="path" class="path mono">{{ path }}</p>
      <button v-if="showBack" type="button" class="back mono" @click="emit('close')">← 返回总览</button>
    </div>

    <div class="block">
      <div v-if="up.length" class="links-block">
        <p class="sub mono">上游</p>
        <div class="links">
          <button
            v-for="item in up"
            :key="item.id"
            type="button"
            class="link mono"
            @click="emit('select', item.id)"
          >{{ item.zh }}</button>
        </div>
      </div>
      <div v-if="down.length" class="links-block">
        <p class="sub mono">下游</p>
        <div class="links">
          <button
            v-for="item in down"
            :key="item.id"
            type="button"
            class="link mono"
            @click="emit('select', item.id)"
          >{{ item.zh }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { AtlasLayer, AtlasModule } from '@/domain/atlas'

defineProps<{
  module: AtlasModule
  layer: AtlasLayer
  cluster?: string
  floors: number
  weight: number
  up: readonly AtlasModule[]
  down: readonly AtlasModule[]
  showBack: boolean
}>()

const emit = defineEmits<{ select: [id: string]; close: [] }>()
</script>

<style scoped>
.detail {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr) minmax(0, 1fr);
  gap: 6px 32px;
}

.head {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.kicker {
  margin: 0;
  font-size: var(--fs-nano);
  letter-spacing: 0.14em;
  color: var(--amber);
}

.title {
  margin: 0;
  font-family: var(--serif);
  font-weight: 500;
  font-size: var(--fs-subhead);
  color: var(--ink-0);
}

.title .en {
  margin-left: 10px;
  font-size: var(--fs-nano);
  letter-spacing: 0.18em;
  color: var(--ink-2);
  vertical-align: 2px;
}

.stats {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 20px;
  margin: 8px 0 2px;
  padding: 8px 0;
  border-top: 1px solid var(--line-0);
  border-bottom: 1px solid var(--line-0);
}

.stat {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.stat dt {
  font-size: var(--fs-nano);
  letter-spacing: 0.16em;
  color: var(--ink-2);
}

.stat dd {
  margin: 0;
  font-size: var(--fs-lead);
  color: var(--amber-hi);
}

.note {
  margin: 2px 0 0;
  font-size: var(--fs-small);
  line-height: 1.85;
  color: var(--ink-1);
}

.block {
  border-top: 1px solid var(--line-0);
  padding-top: 10px;
}

.sub {
  margin: 0 0 6px;
  font-size: var(--fs-nano);
  letter-spacing: 0.18em;
  color: var(--ink-2);
}

.path {
  margin: 0 0 3px;
  font-size: var(--fs-caption);
  letter-spacing: 0.02em;
  color: var(--ink-0);
  overflow-wrap: anywhere;
}

.links-block + .links-block {
  margin-top: 12px;
}

.links {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.link {
  padding: 2px 8px;
  font-size: var(--fs-nano);
  letter-spacing: 0.06em;
  color: var(--ink-1);
  border: 1px solid var(--line-1);
  border-radius: 2px;
  transition: color var(--t-fast) var(--ease), border-color var(--t-fast) var(--ease);
}

.link:hover {
  color: var(--amber-hi);
  border-color: var(--amber);
}

.back {
  margin-top: 10px;
  padding: 3px 0;
  font-size: var(--fs-nano);
  letter-spacing: 0.14em;
  color: var(--ink-2);
}

.back:hover {
  color: var(--amber-hi);
}

@media (max-width: 900px) {
  .detail {
    grid-template-columns: minmax(0, 1fr);
    gap: 10px;
  }
}
</style>
