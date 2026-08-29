# agents.md · 工程约定（给 AI / 协作者）

绳网档案 —— 绝区零（ZZZ）资料档案站：Vue 3 + TS + Vite 静态站，数据在构建期拉取落地到
`public/data/`，运行时零外部请求。

> 本文档是**工作约定**，只收录「每个任务都相关」的内容；领域细节一律渐进式披露，按需取用，
> 发现与实际不符时就地修正：
>
> - 数据来源 / 表结构 / 图标兜底 / 失效信号 / 运维命令 → [`DATA_GUIDE.md`](./DATA_GUIDE.md)
> - 架构愿景、分层与目录约定 → [`DESIGN.md`](./DESIGN.md)
> - 图片/媒体展示技法（超宽/透明底/人像立绘如何展示得好 → 公式与核验流程）→ [`IMG_GUIDE.md`](./IMG_GUIDE.md)

## 1. 临时文件：只放 `temp/`

- 一切临时产物（调试脚本、一次性导出/下载、截图、验证中间件）统一放 `temp/`（已 gitignore、
  随时可清空、用完即删）；下载缓存走 `.cache/`。禁止丢进根目录、`src/`、`public/`。

## 2. Git 提交约定

- 提交前 `git status` 检查：临时产物不入库；发现新类型临时产物时**优先加 `.gitignore` 规则**。
- 提交信息用仓库既有风格：`<type>: <中文摘要>`（feat/fix/chore/refactor），重要变更带正文要点。
- `public/data/**` 是生成物但**约定入库**（勿删勿忽略）；改动数据文件时检查是否伴随构建脚本升级。

## 3. 数据与前端铁律

- **运行时零外部请求**：前端只读本地 `/data`；数据版本号从 `manifest.json` 动态取，禁止硬编码。
- 图标一律经 `<HollowImage>` 图标候选链，**禁止直连单一外部图源**（工具清单见 DATA_GUIDE §6）。
- 游戏标记文本（`<color=#…>`、`<IconMap:…>`）展示层一律经富文本工具处理，禁止裸插值（见 DATA_GUIDE §6）。
- 设计语言："档案标本"质感 —— 1px 细线框、2px 圆角、等宽编号、纸墨配色；**禁止圆角卡片堆叠、
  渐变霓虹、投影**（速记见 DATA_GUIDE §10）。
- 设计基调：优雅、克制，一切以"不 AI 味"为准——当产出像常见模板站（圆角 + 渐变 + 投影 +
  满屏卡片）时，宁可返工。

## 4. 环境与命令

- 依赖：包管理器为 npm，锁文件只维护 `package-lock.json`（勿再引入 pnpm 锁文件）；新增依赖用 `npm install <pkg>`。
- 开发 `npm run dev`（http://localhost:5173）；构建 `npm run build`（含 vue-tsc）；单测 `npm test`。
- 部署构建入口 `npm run build:ci`（Vercel 已指向）：`npm test` → `verify:fonts` → `npm run build`；
  **只构建已提交快照，不在构建期重建数据**（数据更新走 `npm run sync`，见下）。
- **数据+图标同步入口 `npm run sync`**（`scripts/sync-data.ts`）：唯一自动化写入 `public/data/` 的入口——
  探测新版本 → 重建 JSON → 图标 `--soft` 补差（只补缺失、已有美术资源零重下）→ 校验（告警）→ 汇总变更集。
  由 `.github/workflows/data-sync.yml` 定时触发并走【工作流内硬门禁】：`npm run verify:data` 通过 → 直接
  commit + push 到默认分支（master）→ 触发 Vercel 部署；不通过则 job 失败、不提交。无变更不提交。
  仓库为私有 + 免费套餐，分支保护不可用，故门禁在 workflow 内实现。`npm run data` 仅作数据-only 用途。
- 改动数据管线按 DATA_GUIDE §7 顺序执行；名录/详情数量为 0 或 404 时先查 DATA_GUIDE §8
  失效信号，别急着改前端。