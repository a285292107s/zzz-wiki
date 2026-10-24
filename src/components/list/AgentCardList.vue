<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { CharacterListItem } from '@/data/types'
import { useUiText } from '@/composables/useUiText'
import AgentCardGrid from './AgentCardGrid.vue'

const props = defineProps<{
  items: readonly CharacterListItem[]
  base: string
  emptyText?: string
  showClear?: boolean
}>()

const emit = defineEmits<{ (e: 'clear'): void }>()

const { t } = useUiText()

const PAGE_SIZE = 18
const shown = ref(PAGE_SIZE)
const visibleItems = computed(() => props.items.slice(0, shown.value))
const hasMore = computed(() => shown.value < props.items.length)

watch(
  () => props.items,
  () => {
    shown.value = PAGE_SIZE
  },
)

function loadMore(): void {
  shown.value += PAGE_SIZE
}

const canAutoLoad = typeof IntersectionObserver === 'function'
const sentinel = ref<HTMLElement | null>(null)
let io: IntersectionObserver | null = null

watch(
  sentinel,
  (el) => {
    io?.disconnect()
    io = null
    if (!canAutoLoad || !el) return
    io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) loadMore()
      },
      { rootMargin: '400px' },
    )
    io.observe(el)
  },
  { flush: 'post' },
)

onBeforeUnmount(() => {
  io?.disconnect()
  io = null
})
</script>

<template>
  <div class="card-list">
    <AgentCardGrid
      :items="visibleItems"
      :base="props.base"
      :show-clear="props.showClear"
      :empty-text="props.emptyText"
      @clear="emit('clear')"
    />

    <div v-if="hasMore" ref="sentinel" class="more">
      <button v-if="!canAutoLoad" type="button" class="more-btn mono" @click="loadMore">
        {{ t.list.loadMore }}
      </button>
      <p v-else class="more-count mono" aria-live="polite">
        {{ visibleItems.length }} / {{ props.items.length }}
      </p>
    </div>
  </div>
</template>

<style scoped>
.more {
  display: flex;
  justify-content: center;
  padding: 26px 0 6px;
}

.more-btn {
  padding: 8px 18px;
  background: none;
  border: 1px solid var(--line-1);
  border-radius: 2px;
  color: var(--ink-1);
  font-size: var(--fs-caption);
  letter-spacing: 0.12em;
  cursor: pointer;
  transition: color var(--t-fast) var(--ease), border-color var(--t-fast) var(--ease);
}

@media (hover: hover) {
  .more-btn:hover {
    color: var(--amber-hi);
    border-color: var(--amber);
  }
}

.more-btn:focus-visible {
  outline: 1px solid var(--focus);
  outline-offset: 2px;
}

.more-count {
  font-size: var(--fs-micro);
  letter-spacing: 0.16em;
  color: var(--ink-2);
}
</style>
