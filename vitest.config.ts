import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  // 关闭模板里的资源 URL 转换（仅测试环境）：公共目录资源（SiteHeader 的 /logo.png）在
  // Vitest 4+ 下会被解析成 `file:///logo.png`，Windows 上无法还原成路径，导入即抛
  // 「The argument 'filename' must be a file URL object…」并使整个测试文件失败。
  // 测试断言的是运行时拼出的 /data/img/… 路径，不走模板转换，故关闭后无副作用；
  // 生产构建走 vite.config.ts，不受此处影响。
  plugins: [vue({ template: { transformAssetUrls: false } })],
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