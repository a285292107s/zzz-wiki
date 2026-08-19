# agents.md · 工程约定（给 AI / 协作者）

绳网档案 —— 绝区零（ZZZ）资料档案站：Vue 3 + TS + Vite 静态站，数据在构建期拉取落地到
`public/data/`，运行时零外部请求。

> 本文档是**工作约定**，只收录「每个任务都相关」的内容；领域细节一律渐进式披露，按需取用，
> 发现与实际不符时就地修正：
>
> - 数据来源 / 表结构 / 图标兜底 / 失效信号 / 运维命令 → [`DATA_GUIDE.md`](./DATA_GUIDE.md)
> - 架构愿景、分层与目录约定 → [`DESIGN.md`](./DESIGN.md)

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

## 4. 环境与命令

- 依赖：包管理器为 npm，锁文件只维护 `package-lock.json`（勿再引入 pnpm 锁文件）；新增依赖用 `npm install <pkg>`。
- 开发 `npm run dev`（http://localhost:5173）；构建 `npm run build`（含 vue-tsc）；单测 `npm test`。
- 部署构建入口 `npm run build:ci`（Vercel 已指向）：`scripts/ci-data.ts` 数据同步（版本探测 →
  有更新才构建 → 失败回退既有产物 → 契约校验告警），再 `npm run build`。
- 改动数据管线按 DATA_GUIDE §7 顺序执行；名录/详情数量为 0 或 404 时先查 DATA_GUIDE §8
  失效信号，别急着改前端。