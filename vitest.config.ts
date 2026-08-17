import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    // 纯逻辑单测跑 node 环境；组件测试（jsdom）在引入 @vue/test-utils 用例时按环境注释
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
})