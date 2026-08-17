# agents.md · 工程约定（给 AI / 协作者）

> 本文档是**工作约定**，不是数据文档。数据细节（来源、表结构、图标兜底、失效信号）在
> [`DATA_GUIDE.md`](./DATA_GUIDE.md)；本文档只约束**怎么干活**。发现本文档与实际不符时，就地修正。
>
> 架构愿景、分层与目录约定见 [`DESIGN.md`](./DESIGN.md)——重构实施以该文档为唯一依据，结构落地后就地修正它。

## 1. 临时文件：只放 `temp/`，禁止到处塞

- 项目根目录有 `temp/` 文件夹，**已加入 `.gitignore`（`temp/` 规则），内容不入库**。
- 一切项目需要的临时文件 —— 调试脚本、一次性导出/下载、截图、验证产物、缓存中间件等 ——
  **统一放 `temp/`**，不要丢到项目根目录、`src/`、`public/` 或别处。
- `temp/` 内的东西随时可清空，不影响仓库；临时验证用的文件用完即删。
- 例外：`npm run data` 的下载缓存走约定的 `.cache/`（同样已忽略）。

## 2. Git 提交约定

- 提交前先 `git status` 检查：**误带入的临时产物不要 stage**（参考 §1）。
- `preview.log`、`_research_*`、`shots`、`.cache/`、`temp/`、`node_modules`、`dist` 均不入库
  （见 `.gitignore`；发现新类型的临时产物时，优先加 ignore 规则而不是硬提交）。
- 提交信息用仓库既有风格：`<type>: <中文摘要>`（type 如 `feat`/`fix`/`chore`/`refactor`），
  重要变更带正文要点列表。
- 数据文件 `public/data/**` 是**生成物但提交入库**（约定如此，勿删勿忽略）；改动它们时检查
  是否伴随 `scripts/build-data.mjs` 的对应升级。

## 3. 数据与前端铁律

- **运行时零外部请求**：前端只读本地 `/data`，一切数据构建期落地（`npm run data`）。
- 不要硬编码数据版本号（从 `manifest.json` 的 `zzz.latest` 动态取）。
- 图标必须走 `<HollowImage>` / `src/data/icons.ts` 候选链，**禁止直连单一外部图源**。
- 文本含 `<color=#…>`、`<IconMap:…>` 等游戏标记，展示层一律经 `src/utils/rich.ts` /
  `stripRichText` 处理，禁止裸插值。
- 设计语言："档案标本"质感 —— 1px 细线框、2px 圆角、等宽编号、纸墨配色；
  **禁止圆角卡片堆叠、渐变霓虹、投影**。

## 4. 修改数据管线时

- 跑 `npm run data`（需外网；有代理时设 `NODE_USE_ENV_PROXY=1`）→ 检查 `public/data/` 产出
  数量与字段 → 跑 `npm test`（vitest 单元测试）→ 跑 `npm run build`（含 vue-tsc 类型检查）
  → 可选 `npm run verify:icons`。
- 名录/详情数量为 0 或 404 时：先查 `DATA_GUIDE.md` §8 失效信号，别急着改前端。

## 5. 环境

- 包管理：仓库同时有 `package-lock.json` 与 `pnpm-lock.yaml`，新依赖请保持两把锁一致。
- 开发：`npm run dev`（http://localhost:5173）；构建：`npm run build`。