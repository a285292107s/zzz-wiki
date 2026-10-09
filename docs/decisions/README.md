# 决策记录（Decision Records）

**用途**：记录「**为什么不用方案 B**」。防止后来者（尤其是 AI）把已经被踩过、被否决的方案
重新提一遍——这是本项目最贵的一类返工。

只有当「这个决定容易被后来者推翻、且否决理由不是一眼可见」时才写。**不是每个改动都要写。**

## 文件与编号

```
docs/decisions/
  README.md            # 本文件（规范）
  0001-<topic>.md      # 已交付
  proposed/            # 已评审、尚未建成
  rejected/            # 已否决（仅在理由仍能阻止一个诱人的错误时保留）
```

- **编号全局递增、不复用**（`NNNN`，4 位）。文件名用英文 kebab-case。
- 状态由**所在目录 + 头部 `Status:`** 共同表达，两者必须一致。

## 头部块（前三行固定）

```markdown
# 决策记录 NNNN：<一句话标题>

Status: implemented
```

`Status` 三选一，**不带日期、不带括号**：`proposed` / `implemented` / `rejected — <一行理由>`。
日期与历史由 git 承载。

## 类别（封闭集，六选一）

写在头部下一行 `Class: <值>`。**增加新类别必须同时改本表。**

| Class | 覆盖 |
|---|---|
| `feature` | 新的面向用户或面向模型的能力 |
| `bug-fix` | 修复缺陷，或关闭复盘暴露的缺口 |
| `simplification` | 删除代码/行为/表面积，且**不新增能力** |
| `architecture` | 关于**已交付源码**的结构性决策（包怎么关联、运行时词汇） |
| `process` | **围绕**代码的工具、政策、工作流（门禁、包管理器、文档） |
| `testing` | 测试基础设施与策略 |

判别线：
- **architecture vs process** → 对象是「我们交付的源码」还是「代码周边的工具与流程」。
- **simplification vs refactor** → 判据是「**可观察行为是否改变**」。`refactor` **故意不设**：
  它被 `simplification` 的判别问题覆盖。

## 正文骨架（强制）

```markdown
## Problem
<要解决的问题与约束。不看 Decision 也能读懂。写「现状为什么不能忍」，不写方案。>

## Decision
<已交付的现实，**现在时**。路径、名字、契约、默认值、不变量。>

…（可选：按需的专用小节，如「包拓扑」「wire 契约」「不变量」）…

## Alternatives considered
<**强制**。每个真正被权衡过的选项一段：它是什么、为什么输。>

## Consequences
- 代价：<换出去了什么>
- 收益：<换来了什么>
- 遗留缺口：<已知未覆盖的部分，点名>
```

**红线**：
1. `## Problem` 必须是第一节。
2. `## Alternatives considered` **必须有**——没有「被击败的选项」，后人就会重新提一遍。
   但**只记录真正权衡过的**，绝不编造；确实没记录过就写「未记录」。
3. `implemented` 里**不得**出现 `## Proposal` / `## Plan` / `## Migration plan` / `## Acceptance criteria`
   ——那些是提案期口吻，已交付的记录只描述现实。
4. 一条记录**不得被编辑成另一个决策**——用新记录取代，并双向互链。
5. `implemented` 记录要**随实现保持最新**：路径/名字/默认值变了**就地改**（改的是事实，不是决策）。
6. 决策本身要反转 → 新建记录，不要改写旧的。

## 生命周期迁移（同一次改动内完成）

- `proposed/ → implemented/`：`## Proposal` 改写成现在时 `## Decision`；把
  `## Acceptance criteria` / `## Risks` 折进 `## Consequences`；**删掉计划，只留已交付**。
- `proposed/ → rejected/`：只在 `Status:` 行加理由，正文**冻结**。

## Review checklist（代替门禁）

> ⚠ **本仓库没有校验脚本**——`.agents/notes/` 里那三套门禁
> （`verify-agent-note-format.ts` 等）属于另一个项目，本项目不引入。因此：
> **规范的正确性由 review 保证，不由 CI 保证。漂移是需要人守的。**

新增/修改记录时逐条过：

- [ ] 文件名 `NNNN-kebab-topic.md`，编号未复用。
- [ ] 目录与 `Status:` 一致；`Status` 无日期无括号。
- [ ] `Class:` 在六类封闭集内。
- [ ] 第一节是 `## Problem`，且脱离 `## Decision` 可独立读懂。
- [ ] `## Alternatives considered` 存在，且没有编造。
- [ ] `implemented` 记录里没有 `## Proposal`/`## Plan`/`## Acceptance criteria`。
- [ ] `## Consequences` 同时写了**代价**与**收益**。
- [ ] 涉及取代时，新旧记录**双向互链**。
- [ ] 引用的路径/文件确实存在（别把不存在的文件写进记录）。
