# 命名与目录约定

先说结论：**本项目的命名基本可以「看邻居照着起」**——本文件只固化那些**看邻居看不出来**、
或者**已经出现过不一致**的点。不确定时按目录里多数文件的写法走。

## 1. 按目录的命名（实测现状）

| 位置 | 约定 | 实例 |
|---|---|---|
| `src/components/**` | **PascalCase** `.vue`，按职责分组子目录 | `layout/SiteHeader.vue`、`list/CatalogTable.vue`、`list/NameCell.vue`、`state/DetailSkeleton.vue`、`detail/DetailPage.vue` |
| `src/composables/**` | **`useXxx`** `.ts`（camelCase） | `useAsyncResource.ts`、`useCatalogList.ts`、`useDetailPrefetch.ts`、`useHeroForm.ts` |
| `src/domain/**` | **camelCase** `.ts`（领域名词，不加前缀） | `enums.ts`、`catalog.ts`、`schema.ts`、`sections.ts`、`skillFormula.ts`、`signatureEngine.ts` |
| `src/data/**` | **camelCase** `.ts` + **kebab-case** `.json` | `api.ts`、`icons.ts`、`resources.ts`、`heroImageSources.ts`；`filter-assets.json`、`camp-supplement.json`、`known-missing-assets.json` |
| `src/utils/**` | **camelCase** `.ts`，纯函数 | `text.ts`、`rich.ts`、`names.ts`、`contrast.ts`、`cameraRect.ts` |
| `src/views/**` | **PascalCase** `XxxView.vue` | `HomeView.vue`、`AgentsView.vue`、`CalibrateView.vue` |
| `src/router/**`、`src/directives/**` | camelCase `.ts` | `router/index.ts`、`router/views.ts`；`directives/reveal.ts` |
| `scripts/**` 入口与校验 | **kebab-case** `.ts`/`.mjs`，`<动词>-<对象>` | `build-data.ts`、`sync-data.ts`、`verify-data.ts`、`generate-sitemap.mjs`、`download-icons.mjs` |
| `scripts/build/**` 模块 | camelCase `.ts`（模块）/ kebab-case `.mjs`（生成器） | `io.ts`、`normalize.ts`、`domains.ts`、`index.ts`；`hero-cards.mjs`、`icon-thumbs.mjs` |
| `scripts/audits/**` | **kebab-case** `.js`（playwright-cli 按文件名加载） | `axe-a11y.js`、`regression-walk.js`、`viewport-overflow.js` |
| `tests/**` | **kebab-case** `.test.ts` | `rich.test.ts`、`scrollspy.test.ts`、`styleguide-colors.test.ts` |
| CSS | kebab-case 类名；token 用 `--kebab-case` | `.card-grid`、`.skel`；`--fs-*`、`--pad-*`、`--ink-2` |
| 文档 | 根目录**大写** `.md`；`docs/` 内 kebab-case 或小写 | `AGENTS.md`、`DATA_GUIDE.md`；`docs/architecture.md`、`docs/decisions/0001-….md` |

## 2. 已知例外（**不要"顺手修正"**）

- `src/composables/anchorOffset.ts` **没有 `use` 前缀**——它不是组合式函数，是普通模块
  （被 router 的 `scrollBehavior` 与吸顶横条共用），刻意如此。
- `src/utils/viewTransition/` **不是纯函数**：它有状态、依赖 Vue 与上层模块。放在 `utils/` 下
  名不副实，属**已知并登记的例外**（见 [`docs/architecture.md`](../architecture.md) §4）。
  在拍板迁出之前，不要按「utils 必须纯」去改它。

## 3. 命名时要做的判断

1. **新文件先问它在哪一层**——层决定了前缀与目录（见 [`docs/architecture.md`](../architecture.md)）。
2. **不要为「看起来整齐」改名现有文件**——改名会打断 import 面与文档引用；
   除非有明确收益并同步更新全部引用。
3. **组件名要说出它是什么，不要说出它在哪**——`NameCell`（名录名单元格）好过 `AgentsTableName`。
4. **面向玩家的名字不要工程黑话**——站内文案不出现 harness 层术语（见 [`AGENTS.md`](../../AGENTS.md) §5.1）。
5. 私有名词（组件、数据键、工具函数）在**面向读者的文字**里首次出现要带括号注释业务含义。

## 4. 待澄清

- `src/domain/` 里像 `compare.ts`、`search.ts`、`heroCatalog.ts` 这类模块的边界是否清晰，
  是否需要按「纯逻辑 / 元信息」再分子目录——**尚未拍板**，先不动。
