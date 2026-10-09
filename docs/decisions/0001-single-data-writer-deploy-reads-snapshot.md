# 决策记录 0001：数据由单一写入者更新，部署只读

Status: implemented
Class: architecture

## Problem

数据更新与部署如果都写 `public/data/**`，会出现两个后果：一是站点会因为**数据源故障而整体挂掉**
（构建期拉不到数据 → 部署失败 → 线上没版本可发）；二是 `public/data/**` 是**约定入库的生成物**，
两个写入者会让「仓库里的快照到底是哪次生成的」无法回答，门禁也失去唯一裁决点。

另外 `public/data/` 下的**内容 JSON** 与**美术资产**（图标、头图派生档）风险等级不同：内容缺一个字段
就是数据错误，资产缺一张图只是展示降级。

## Decision

**更新链与部署链分离，部署只读已提交快照。**

- `scripts/sync-data.ts`（`npm run sync`）是 **CI/定时侧唯一写入者**：探测版本 → 重建 JSON →
  图标 `--soft` 补差 → 派生图档位（hero card/wide、hero mobile、名录小图 thumb）→ 汇总变更集。
  由 `.github/workflows/data-sync.yml` 每日 cron 触发，**工作流内**跑 `npm run verify:data` 作硬门禁；
  通过 → commit + push 默认分支 `master` → 触发 Vercel 部署；不通过 → job 失败、**不提交**，
  站点沿用既有快照。无变更不提交。
- 部署入口 `npm run build:ci` **只构建已提交快照**，不在构建期重建数据。
- 门禁口径：`verify:data` = 契约形状 + 名录非空 + **名录 id ↔ 详情文件一一对应** + `extra_level` 单调。
- **JSON 严格 / 图标宽松**：内容缺一即阻断提交；展示资产缺失则降级（CDN → 文字占位）并自愈，不阻塞提交。

**还有其它会写 `public/data/**` 的入口**（本条只约束「自动化更新」这一路，不要误读为「只有 sync 能写」）：

| 写入者 | 写什么 | 场景 |
|---|---|---|
| `npm run data` | 内容 JSON + manifest | 本地数据重建 |
| `npm run download:icons` | `img/**` 图标与头图 | 资产本地化（sync 内部也会调） |
| `scripts/build/hero-cards.mjs` / `hero-mobile.mjs` / `icon-thumbs.mjs` | 派生图档位 | 由 sync 在图标下载后调用 |

手工直接改 `public/data/**` **禁止**——重建时会被覆盖（见 `AGENTS.md` §0.7）。

## Alternatives considered

**在部署构建里重建数据（即 `build:ci` 内跑数据管线）。** 否决：这正是被移除的旧做法。数据源抖动会
直接让部署失败、线上无法发版；且每次部署的产物对应哪个数据版本不可复现。

**Vercel 构建时实时拉数据。** 否决：构建时长不可控 + 引入外部依赖 + 与「运行时零外部请求」的
工程取向背道而驰。

**允许手工编辑 `public/data/**` 作为快速修数据的手段。** 否决：下次任何一次 sync/data 重建都会
整体覆盖，人工修正会静默消失（这正是「术语不要写进 `noun.json`」那条禁令的同源教训）。

**在仓库级做分支保护来当门禁。** 否决：仓库为私有 + 免费套餐，**分支保护不可用**，故门禁实现在
workflow 内部。

## Consequences

- **代价**：生产数据刷新**依赖 cron 健康度**；部署不再自愈数据问题。若源站**持续**缺详情，
  `verify:data` 会一直标红 → 更新被冻结，需人工介入（「可用性让位于完整性」）。
- **收益**：部署永不因数据源故障而挂；每次线上产物都对应一个**已提交、已过门禁**的快照；
  「仓库快照是谁生成的」有唯一答案。
- **遗留缺口**：sync 与 cron 的健康度没有外部告警；`data-sync` 失败只体现在 Actions 里，
  需人工去查（`README.md` 部署节给了排查顺序）。
