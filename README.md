# 绳网档案 · Ropeweb Archive

绝区零（Zenless Zone Zero）数据展示型 wiki。以「空洞数据终端」的档案化视觉呈现代理人、音擎、邦布与驱动盘数据。设计取向：**约束、排印、纸墨质感**——拒绝渐变霓虹与圆角卡片堆叠的模板感。

> 📋 **文档地图**（各有专属主题，按需取用）：
> - **给 AI / 协作者的工作约定** → [`agents.md`](./agents.md)（临时文件、提交、数据与前端铁律、命令）
> - **数据交接** → [`DATA_GUIDE.md`](./DATA_GUIDE.md)（来源、表结构、图标兜底、失效信号、运维命令）
> - **架构设计** → [`DESIGN.md`](./DESIGN.md)（分层、数据契约单一事实源、测试策略、路线图）
> - **图片展示** → [`IMG_GUIDE.md`](./IMG_GUIDE.md)（超宽/透明底/人像立绘如何展示得好、公式与核验）

## 技术栈

- **Vue 3** + **TypeScript** + **Vite 6** + **vue-router 4**
- 零 UI 框架：纯手写设计系统（CSS 变量 + 细线 + 等宽数据数字）
- 数据为**构建期生成的静态 JSON**（`public/data/`），运行时零外部请求
- 图标、西文字体本地化（`public/data/img/`、`public/fonts/`），运行时零外网
- **zod** 数据契约（校验在构建/CI 侧，不进前端热路径）；**vitest** 单测/组件测试

## 本地开发

数据已提交在 `public/data/`，日常开发/部署**无需重跑**：

```bash
npm install
npm run dev          # http://localhost:5173（端口占用自动换）
npm run build        # vue-tsc 类型检查 + 构建
npm run preview      # 预演产物
npm test             # vitest 单元/组件测试
```

需要新数据时（详见 [`DATA_GUIDE.md`](./DATA_GUIDE.md) §7）：

- `npm run sync` — 数据+图标同步（**唯一自动化写入入口**：探测 → 重建 → 图标补差 → 校验 → 汇总）
- `npm run data` — 仅数据本地重建（`--check` 只探测版本 / `--force` 忽略缓存）
- `npm run verify:data` / `npm run verify:icons` / `npm run verify:fonts` — 契约 / 图标 / 字体校验
- `npm run download:icons` / `npm run download:fonts` — 图标 / 字体本地化落地

> 上述需网络访问 `static.nanoka.cc`；有代理时设 `NODE_USE_ENV_PROXY=1`。

## 数据源

构建期从 **hakushin raw**（`static.nanoka.cc`，zzz.nanoka.cc / hakush.in 站底层 CDN）拉取**正式服（live）**名录与详情，规整为静态 JSON 提交入仓；运行时前端只读本地 `/data`（零外部请求、零 CORS）。

站点**只展示 live**（不产出源站 latest——含前瞻/测试服内容，合规约定 2026-08 起），版本号从 `manifest.json` 的 `zzz.live` 动态取，**禁止硬编码**。

- 管线入口 `scripts/build-data.ts` → 模块 `scripts/build/`（`io` / `normalize` / `domains` / `live-target` / `index`）→ 产出 `public/data/live/`
- 数据契约、字段约定、图标兜底链（本地 → nanoka CDN → 文字占位）见 [`DATA_GUIDE.md`](./DATA_GUIDE.md) §3、§5

## 部署（Vercel）

1. 推送仓库到 GitHub。
2. 在 [vercel.com/new](https://vercel.com/new) 导入——`vercel.json` 已声明框架、构建命令（`npm run build:ci`：测试 + 字体校验 + 构建）、产物目录及 headers/rewrites，无需额外配置。
3. 部署后访问 `https://<你的项目>.vercel.app`。

> **数据新鲜度依赖 `data-sync` 定时任务**：部署的 `build:ci` **只构建已提交快照**、不在构建期重建数据；数据更新由
> `.github/workflows/data-sync.yml`（每日 cron 跑 `npm run sync`：探测 → 重建 JSON → 图标补差 → **`verify:data` 硬门禁** → 提交）
> 承担，二者经提交锁步。门禁通过才 commit + push 到默认分支 `master` → 触发部署；不通过则 job 失败、不提交，站点沿用既有快照不挂。
> 若生产数据滞旧：先确认该 workflow 最近是否成功 / Actions 配额，再手动 `npm run sync` 后提交。**生产分支须为 `master`（仓库默认分支）。**

## 目录结构

```
src/
  domain/        # 单一事实源：枚举 / 类目元信息 / zod 契约 / 详情区块类型 / dev 页面元数据
  data/          # 请求层（api）+ 类别表驱动（resources）+ 类型派生（types）+ 图标候选（icons）
                 # + 校准数据（精选池 / hero） + 战斗公式图文源（formulaGuide）
  composables/   # 异步状态 / 列表 / 排序 / 路由参数 / 页元信息 / 详情导航 / 精选池 / hero 形态 / 滚动监听
  components/    # layout / list / state / detail 区块 + Rarity / Tags / HollowImage / FormulaEq / TermTip
  views/         # 页面（薄组装层；含 /formulas，dev-only /style、/calibrate）
  utils/         # 纯函数：text / rich / names / contrast / cameraRect（无组件、无状态，可单测）
  styles/        # 设计 token + 基样式
  router/        # 懒加载路由 + meta（dev-only 路由由 devRoutes 派生，构建级排除）
scripts/
  build/         # 数据管线模块（io / normalize / domains / live-target / index + download-icons / download-fonts）
  build-data.ts  # 数据管线入口（npm run data）
  sync-data.ts   # 数据+图标同步（唯一写者，npm run sync；由 data-sync workflow 触发并提交）
  verify-data.ts # zod 契约校验（npm run verify:data）
tests/           # vitest 单元/组件测试
public/
  data/          # 生成的静态 JSON + 本地化图标（提交入库）
  fonts/         # 本地化西文字体（运行时零外网）
```

> 分层与依赖规则、重构路线见 [`DESIGN.md`](./DESIGN.md)；组件/设计 token 速查见站内 `/style` 设计系统页（**dev-only**，生产构建不打包，`/calibrate` 同理）。

## 版权

社区爱好者制作，与米哈游 / HoYoverse 无关；数据版权归原作者（Dimbreath 解包数据 / miHoYo）所有。
