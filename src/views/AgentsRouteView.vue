<script setup lang="ts">
/* /agents 的版本外壳：按读者在本机的偏好（设置页可改）渲染表格版或卡片版。
 *
 * 两版都用**静态 import**：本页是代理人名录的唯一入口，切版本是读者自己的选择，
 * 不该出现「先空一帧再弹出」的观感；两版的取舍与几何见各自文件头。
 * 偏好只在 setup 读一次——在别的标签页改了设置，导航回本页即生效。
 *
 * 版本**不进 URL**：贴在聊天里的 /agents?attr=201 链接在任何读者那里都只带筛选，
 * 不会因为对方上次选的是哪个版本而改变内容。 */

import { useAgentsViewVersion } from '@/composables/useAgentsViewVersion'
import AgentsView from '@/views/AgentsView.vue'
import AgentsCardsView from '@/views/AgentsCardsView.vue'

const { agentsViewVersion } = useAgentsViewVersion()
</script>

<template>
  <AgentsCardsView v-if="agentsViewVersion === 'cards'" />
  <AgentsView v-else />
</template>
