import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
import fs from 'node:fs/promises'
import path from 'node:path'
import type { Connect, Plugin } from 'vite'
import { FeaturedPoolSchema } from './src/domain/featuredPool'

/** 校准数据文件（工具页经 dev 中间件读写）。 */
const POOL_FILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'src', 'data', 'featured-pool.json')

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
          fs.readFile(POOL_FILE, 'utf8')
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
              fs.writeFile(POOL_FILE, JSON.stringify(parsed.data, null, 2) + '\n', 'utf8')
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
  plugins: [vue(), calibrateMiddleware()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
  },
})
