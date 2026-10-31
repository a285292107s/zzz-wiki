<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { CATALOG, NAV_ENTRIES } from '@/domain/catalog'
import { pickText } from '@/domain/lang'
import { useBottomBar } from '@/composables/useBottomBar'
import { useMediaQuery } from '@/composables/useMediaQuery'
import { useQuickSearch } from '@/composables/useQuickSearch'
import { useUiText } from '@/composables/useUiText'
import { useLocale } from '@/composables/useLocale'

const { t } = useUiText()
const { lang } = useLocale()
const route = useRoute()
const { phase: searchPhase } = useQuickSearch()
const { barHidden, moreOpen } = useBottomBar()

const primary = computed(() =>
  CATALOG.map((c) => ({
    no: c.no,
    to: c.path,
    label: pickText(c.tabLabel, lang.value),
  })),
)

const secondary = computed(() =>
  NAV_ENTRIES.slice(CATALOG.length).map((e) => ({
    no: e.no,
    to: e.to,
    label: pickText(e.label, lang.value),
  })),
)

function isActive(to: string): boolean {
  return route.path === to || (to !== '/' && route.path.startsWith(to))
}

const moreActive = computed(() => secondary.value.some((e) => isActive(e.to)))

const narrow = useMediaQuery('(max-width: 999px)')
const barEl = ref<HTMLElement | null>(null)
const moreToggleEl = ref<HTMLButtonElement | null>(null)

let lastY = 0
let baselineReady = false

function syncBaseline(): void {
  baselineReady = false
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      lastY = window.scrollY
      baselineReady = true
    })
  })
}

function keyboardFocusInBar(): boolean {
  const el = document.activeElement
  return !!el && !!barEl.value?.contains(el) && el.matches(':focus-visible')
}

function onScroll(): void {
  if (!narrow.value) return
  const y = Math.max(0, window.scrollY)
  if (!baselineReady) {
    lastY = y
    return
  }
  if (keyboardFocusInBar()) {
    barHidden.value = false
    lastY = y
    return
  }
  if (moreOpen.value) moreOpen.value = false
  const atBottom = y + window.innerHeight >= document.documentElement.scrollHeight - 2
  if (y < 28 || atBottom) {
    barHidden.value = false
    lastY = y
    return
  }
  const delta = y - lastY
  if (Math.abs(delta) < 6) return
  barHidden.value = delta > 0
  lastY = y
}

function toggleMore(): void {
  moreOpen.value = !moreOpen.value
  barHidden.value = false
}

function closeSheetOnLinkClick(e: MouseEvent): void {
  const link = (e.target as Element | null)?.closest('a')
  if (!link) return
  const fromSheet = link.closest('#tabbar-more') != null
  moreOpen.value = false
  if (fromSheet) moreToggleEl.value?.focus()
}

function onDocPointerDown(e: PointerEvent): void {
  if (!moreOpen.value) return
  const target = e.target as Node | null
  if (target && barEl.value?.contains(target)) return
  moreOpen.value = false
}

function onDocKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape' && moreOpen.value && !e.isComposing) {
    moreOpen.value = false
    moreToggleEl.value?.focus()
    return
  }
  if (e.key === 'Tab' && barHidden.value) barHidden.value = false
}

watch(moreOpen, (open) => {
  if (open) barHidden.value = false
})

watch(
  () => searchPhase.value === 'closed',
  (closed) => {
    if (!closed) moreOpen.value = false
  },
)

watch(
  () => route.fullPath,
  () => {
    moreOpen.value = false
    barHidden.value = false
    if (narrow.value) syncBaseline()
  },
)

watch(narrow, (isNarrow) => {
  if (!isNarrow) {
    moreOpen.value = false
    barHidden.value = false
    return
  }
  syncBaseline()
})

onMounted(() => {
  syncBaseline()
  document.addEventListener('pointerdown', onDocPointerDown)
  document.addEventListener('keydown', onDocKeydown)
  window.addEventListener('scroll', onScroll, { passive: true })
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocPointerDown)
  document.removeEventListener('keydown', onDocKeydown)
  window.removeEventListener('scroll', onScroll)
  moreOpen.value = false
  barHidden.value = false
})
</script>

<template>
  <div ref="barEl" class="bottom-bar" :class="{ 'is-hidden': barHidden }" :inert="barHidden" data-vt-hold>
    <nav class="bottom-nav" :aria-label="t.header.mainNav" @click="closeSheetOnLinkClick">
      <RouterLink
        v-for="item in primary"
        :key="item.to"
        :to="item.to"
        class="tab"
        :class="{ active: isActive(item.to) }"
        :aria-current="isActive(item.to) ? 'page' : undefined"
      >
        <span class="tab-no mono">{{ item.no }}</span>
        <span class="tab-label">{{ item.label }}</span>
      </RouterLink>

      <button
        ref="moreToggleEl"
        type="button"
        class="tab tab-more"
        :class="{ active: moreActive, open: moreOpen }"
        :aria-expanded="moreOpen"
        aria-controls="tabbar-more"
        @click="toggleMore"
      >
        <span class="tab-no tab-dots" aria-hidden="true">
          <i /><i /><i />
        </span>
        <span class="tab-label">{{ t.header.more }}</span>
      </button>
    </nav>

    <nav
      v-show="moreOpen"
      id="tabbar-more"
      class="more-panel"
      :aria-label="t.header.siteNav"
      @click="closeSheetOnLinkClick"
    >
      <RouterLink
        v-for="item in secondary"
        :key="item.to"
        :to="item.to"
        class="more-item"
        :class="{ active: isActive(item.to) }"
        :aria-current="isActive(item.to) ? 'page' : undefined"
      >
        <span class="no mono">{{ item.no }}</span>
        <span class="label">{{ item.label }}</span>
      </RouterLink>
    </nav>
  </div>
</template>

<style scoped>
.bottom-bar {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: var(--z-nav);
  display: none;
  background: var(--bg-0);
  border-top: var(--rule);
  padding-bottom: var(--tabbar-inset);
  transition: transform var(--t-med) var(--ease), visibility 0s linear 0s;
}

.bottom-bar.is-hidden {
  transform: translateY(calc(100% + 1px));
  visibility: hidden;
  transition: transform var(--t-med) var(--ease), visibility 0s linear var(--t-med);
}

.bottom-nav {
  display: flex;
  align-items: stretch;
  height: var(--tabbar-h);
  padding-inline: var(--pad-page);
}

.tab {
  position: relative;
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  padding: 0 2px;
  border: 0;
  background: none;
  color: var(--ink-1);
  font: inherit;
  cursor: pointer;
  touch-action: manipulation;
  transition: color var(--t-fast) var(--ease), filter var(--t-fast) var(--ease);
}

.tab::before {
  content: '';
  position: absolute;
  top: -1px;
  right: 0;
  left: 0;
  height: 1px;
  background: var(--amber);
  opacity: 0;
  transition: opacity var(--t-fast) var(--ease);
}

.tab-no {
  font-size: var(--fs-badge);
  line-height: 1;
  letter-spacing: 0.14em;
  color: var(--ink-2);
  transition: color var(--t-fast) var(--ease);
}

.tab-dots {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
  height: var(--fs-badge);
  font-size: 0;
  letter-spacing: 0;
}

.tab-dots i {
  display: block;
  width: 2px;
  height: 2px;
  background: currentColor;
}

.tab-label {
  max-width: 100%;
  font-size: var(--fs-micro);
  line-height: 1;
  letter-spacing: 0.04em;
  white-space: nowrap;
}

@media (hover: hover) {
  .tab:hover {
    color: var(--ink-0);
  }
}

.tab:active {
  filter: brightness(0.82);
}

.tab:focus-visible {
  outline: 1px solid var(--amber);
  outline-offset: -3px;
}

.tab.active {
  color: var(--ink-0);
}

.tab.active .tab-no {
  color: var(--amber);
}

.tab.active::before {
  opacity: 1;
}

.tab-more.open {
  color: var(--ink-0);
}

.tab-more.open .tab-no {
  color: var(--amber);
}

.more-panel {
  position: absolute;
  right: 0;
  bottom: 100%;
  left: 0;
  display: flex;
  flex-direction: column;
  padding: 4px var(--pad-page) 8px;
  background: var(--bg-0);
  border-top: var(--rule);
  animation: more-panel-in var(--t-med) var(--ease);
}

.more-item {
  display: flex;
  align-items: baseline;
  gap: var(--space-inline);
  min-height: 48px;
  padding: 12px 2px;
  border-bottom: 1px solid var(--line-0);
  color: var(--ink-1);
  transition: color var(--t-fast) var(--ease);
}

.more-item:last-child {
  border-bottom: none;
}

.more-item .no {
  font-size: var(--fs-micro);
  color: var(--ink-2);
}

.more-item .label {
  font-size: var(--fs-body);
  letter-spacing: 0.06em;
}

.more-item:active {
  filter: brightness(0.82);
}

.more-item:focus-visible {
  outline: 1px solid var(--amber);
  outline-offset: -3px;
}

@media (hover: hover) {
  .more-item:hover {
    color: var(--ink-0);
  }
}

.more-item.active {
  color: var(--ink-0);
}

.more-item.active .no {
  color: var(--amber);
}

@keyframes more-panel-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
}

@media (max-width: 999px) {
  .bottom-bar {
    display: block;
  }
}

@media (prefers-reduced-motion: reduce) {
  .bottom-bar,
  .bottom-bar.is-hidden,
  .tab,
  .tab::before,
  .more-item {
    transition: none;
  }

  .more-panel {
    animation: none;
  }
}
</style>
