# docs/ · AI 加载索引

本目录是**按需加载层**：全局只需读根目录 [`AGENTS.md`](../AGENTS.md)，其余按任务查表取用。
目的只有一个——用**最小的上下文**拿到**足够的约束**，避免把整站文档灌进每一轮对话。

## 什么任务读哪份

| 你要做的事 | 读这份 | 不要读 |
|---|---|---|
| 任何任务的第一步 | [`AGENTS.md`](../AGENTS.md)（含 §0 硬性禁止项） | — |
| 改数据管线 / 字段 / 图标 / 排查数据异常 | [`DATA_GUIDE.md`](../DATA_GUIDE.md) | IMG_GUIDE |
| 改目录分层 / 加新内容类型 / 判定"这段逻辑该放哪层" | [`DESIGN.md`](../DESIGN.md) + [`architecture.md`](./architecture.md) | QUALITY |
| **判断某次 import 是否越界** | [`architecture.md`](./architecture.md)（边界表） | DESIGN 全文 |
| 展示图片 / 立绘 / 头图 / 派生图档位 | [`IMG_GUIDE.md`](../IMG_GUIDE.md) | DATA_GUIDE |
| 定字段形状 / 加字段 / 改类型 | [`conventions/contracts.md`](./conventions/contracts.md) + `src/domain/schema.ts` | — |
| 命名新文件 / 新组件 / 新 composable | [`conventions/naming.md`](./conventions/naming.md) | — |
| 记游戏内术语 / 查术语边界 | [`conventions/glossary.md`](./conventions/glossary.md) | — |
| **"上次为什么不这么做？"** | [`decisions/`](./decisions/) | — |
| 验收品质指标 / 复跑审计 | [`QUALITY.md`](../QUALITY.md) + [`scripts/audits/README.md`](../scripts/audits/README.md) | — |
| 共享元素过渡 / 飞行动效 | [`src/utils/viewTransition/README.md`](../src/utils/viewTransition/README.md) | — |

## 单一事实源分区（一个事实只在一处完整定义）

| 事实类别 | 归属（唯一完整定义处） | 其它地方 |
|---|---|---|
| 工作约定 / 硬性禁止项 / AI 输出规范 | [`AGENTS.md`](../AGENTS.md) | 只引用 |
| 数据来源、表结构、图标兜底、失效信号、运维命令 | [`DATA_GUIDE.md`](../DATA_GUIDE.md) | 只引用 |
| 架构愿景、分层、目录约定、实施状态 | [`DESIGN.md`](../DESIGN.md) | 只引用 |
| **模块调用边界**（允许/严禁） | [`architecture.md`](./architecture.md) | 只引用 |
| 设计语言（档案标本）与禁令 | [`DATA_GUIDE.md`](../DATA_GUIDE.md) §10 | 其余处压缩为一句引用 |
| 图片/媒体展示技法与核验流程 | [`IMG_GUIDE.md`](../IMG_GUIDE.md) | 只引用 |
| 品质指标与复跑命令 | [`QUALITY.md`](../QUALITY.md) | 只引用 |
| 数据/类型契约的形状 | `src/domain/schema.ts`（代码即事实） | 文档只写业务意图，**不抄字段列表** |
| 游戏内术语 | [`conventions/glossary.md`](./conventions/glossary.md) | 只引用 |
| 决策理由（为什么不那样做） | [`decisions/`](./decisions/) | 只引用 |

> ⚠ 名词表 `public/data/live/noun.json` **不是**落盘位置——它是构建期由源站全量重建的生成物。
> 手写内容会被下次 `npm run sync` 覆盖。只在 `conventions/glossary.md` 里写术语。

## 本目录的书写规则

1. **约束优先于描述**：写「允许什么 / 严禁什么 / 不满足会怎样」，而不是背景介绍。
2. **不复述代码**：字段定义、枚举映射、函数签名一律指向代码文件，不在 Markdown 里抄。
3. **一事实一处**：新增前先查上表；已有归属时补进那份文档，不要新建平行文件。
4. **文件预算**：单一约定文件 ≤ 120 行。超了就说明它混了多个职责，拆开或移走。
5. **可校验**：能给出命令、路径、行号的就给，不写「应该」「大概」。

## 目录

- [`architecture.md`](./architecture.md) — 模块职责与调用边界表（可校验的越权拦截规则）
- [`conventions/`](./conventions/) — 数据契约、命名、术语表
- [`decisions/`](./decisions/) — 决策记录（Problem / Decision / Alternatives considered / Consequences）
- [`audit/`](./audit/) — 文档审核报告（一次性产物，处理完可删）
