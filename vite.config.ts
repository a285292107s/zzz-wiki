import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import type { Connect, Plugin } from 'vite'
import { FeaturedPoolSchema } from './src/domain/featuredPool'

/** 校准数据文件（工具页经 dev 中间件读写）。 */
const POOL_FILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'src', 'data', 'featured-pool.json')
/** 双形态角色 hero 变体表（hero 预取落地名取 defaultFile）。 */
const GENDER_VARIANTS_FILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'src', 'data', 'hero-gender-variants.json')

/** 仅构建期（apply: 'build'）：首页 LCP hero 预取。
 *  预取地址由 featured-pool.json 首张入池角色推导（双形态角色经
 *  hero-gender-variants.json 取 defaultFile），池变更后重新构建即跟随，
 *  不在 index.html 写死素材路径。dev 模式不注入（无 LCP 诉求，缺图也可兜底）。 */
function heroPreloadPlugin(): Plugin {
  return {
    name: 'hero-preload-inject',
    apply: 'build',
    transformIndexHtml(html) {
      let firstId: number | undefined
      try {
        const parsed = FeaturedPoolSchema.safeParse(JSON.parse(fs.readFileSync(POOL_FILE, 'utf8')))
        if (parsed.success) firstId = parsed.data.pool[0]?.id
      } catch {
        return html // 池文件缺失/非法：跳过注入，首页 hero 走自然加载
      }
      if (firstId === undefined) return html

      let file = `Mindscape_${firstId}_2`
      try {
        const variants = JSON.parse(fs.readFileSync(GENDER_VARIANTS_FILE, 'utf8')) as Record<string, { defaultFile?: string }>
        file = variants[String(firstId)]?.defaultFile ?? file
      } catch {
        // 无变体表则用裸名规则
      }
      const tag = `<link rel="preload" as="image" href="/data/img/hero/${file}.webp" fetchpriority="high">`
      return html.replace('</title>', `</title>\n    ${tag}`)
    },
  }
}

/** 仅 dev（configureServer 只在 serve 模式挂载）：供 /calibrate 读出/写入 featured-pool.json。
 *  写前用 zod 校验，避免非法请求体污染数据文件；读时同样校验（非法回空池）。 */
function calibrateMiddleware(): Plugin {
  const EMPTY = JSON.stringify({ pool: [], calibrated: {} })
  return {
    name: 'featured-pool-fs',
    configureServer(server) {
      const handler: Connect.NextHandleFunction = (req, res, next) => {
        if (req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json')
          fsp.readFile(POOL_FILE, 'utf8')
            .then((txt) => {
              try {
                const parsed = FeaturedPoolSchema.safeParse(JSON.parse(txt))
                res.end(parsed.success ? JSON.stringify(parsed.data, null, 2) : EMPTY)
              } catch {
                res.end(EMPTY)
              }
            })
            .catch(() => res.end(EMPTY))
          return
        }
        if (req.method === 'PUT') {
          res.setHeader('Content-Type', 'application/json')
          let body = ''
          req.on('data', (c) => (body += c))
          req.on('end', () => {
            try {
              const parsed = FeaturedPoolSchema.safeParse(JSON.parse(body))
              if (!parsed.success) {
                res.statusCode = 400
                res.end(JSON.stringify({ error: 'failed schema' }))
                return
              }
              fsp.writeFile(POOL_FILE, JSON.stringify(parsed.data, null, 2) + '\n', 'utf8')
                .then(() => res.end(JSON.stringify({ ok: true })))
                .catch((e) => {
                  res.statusCode = 500
                  res.end(String(e))
                })
            } catch {
              res.statusCode = 400
              res.end(JSON.stringify({ error: 'invalid json' }))
            }
          })
          return
        }
        next()
      }
      server.middlewares.use('/__calibrate', handler)
    },
  }
}

export default defineConfig({
  plugins: [vue(), calibrateMiddleware(), heroPreloadPlugin()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
  },
})
