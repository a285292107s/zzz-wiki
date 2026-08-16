import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'
import AgentsView from '@/views/AgentsView.vue'
import AgentDetailView from '@/views/AgentDetailView.vue'
import WEnginesView from '@/views/WEnginesView.vue'
import BangboosView from '@/views/BangboosView.vue'
import DisksView from '@/views/DisksView.vue'

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  scrollBehavior: () => ({ top: 0 }),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/agents', name: 'agents', component: AgentsView },
    { path: '/agents/:id', name: 'agent-detail', component: AgentDetailView, props: true },
    { path: '/w-engines', name: 'w-engines', component: WEnginesView },
    { path: '/bangboos', name: 'bangboos', component: BangboosView },
    { path: '/disks', name: 'disks', component: DisksView },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})