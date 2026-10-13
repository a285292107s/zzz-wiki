# 决策记录 0007：换行符由 .gitattributes 钉死为 LF

Status: implemented
Class: process

## Problem

仓库此前**没有** `.gitattributes`，且本机 `core.autocrlf=false` —— 换行符完全取决于
「当时用的是哪个编辑器」，实际已经漂移。实测 509 个文本文件里：

| 换行 | 数量 | 例 |
|---|---|---|
| LF | 491 | 多数源码 |
| **CRLF** | 15 | `src/components/detail/DetailPage.vue`、`tests/contrast.test.ts`、`.gitignore` |
| **mixed**（同一文件内混用） | 2 | `src/components/index.ts`、`tests/hero-image-sources.test.ts`（各含 1 个多余的 CRLF 空行） |
| 空文件 | 1 | `src/vite-env.d.ts` |

危害不是「难看」，而是**假改动淹没真问题**：`git diff --check` 会对既有文件报出几十条
trailing whitespace（实测 HEAD 提交自身即 55 条），而文件本身没有任何问题——只是行尾的
`\r` 被当成了空白。真问题落在同一份清单里就看不见了。

另外两处具体代价：

1. **同一份代码在不同机器上 diff 不同**。没有 `eol` 声明时，工作区换行随
   `core.autocrlf` / `core.eol` 走，同一个提交在两台机器上可能是「无改动」或「全文件重写」。
2. **本地跑数据同步会伪造数据变更**。`pnpm run sync` 在 Windows 上产出的 JSON 若带 CRLF，
   会与 `data-sync.yml` 在 ubuntu 上产出的 LF 版本产生纯行尾差异，被当成数据更新提交。

## Decision

**新增根级 `.gitattributes`，文本一律 LF；二进制资产显式声明。**

```gitattributes
* text=auto eol=lf
public/data/**/*.json text eol=lf
*.webp  binary
*.woff2 binary
*.png   binary
*.ico   binary
```

- **用 `eol=lf` 而非只写 `text=auto`**：后者只保证**入库**为 LF，工作区换行仍随
  `core.autocrlf` 走。本仓库 96% 的文本文件本来就是 LF，钉死 LF 后 autocrlf 的设置彻底无关紧要。
- **敢全仓 LF 的依据**：仓库里没有 `.bat` / `.cmd` / `.ps1`（只有那些才需要 CRLF）；
  也没有任何脚本对**文本源文件**做哈希或字节大小校验——`scripts/**` 里的
  `createHash` / `statSync` 只作用于字体分片与 `dist` 产物（已逐个确认）。
- **二进制显式声明**：自动探测对 webp / woff2 目前判得对，但那些是 `public/` 下的美术与
  字体资源，一旦被判成文本就是资源损坏。显式钉死，代价为零。

同一次改动内执行了归一化：`git add --renormalize .`，17 个文件（15 个 CRLF + 2 个 mixed）
入库，工作区同步重写为 LF。逐个核对过：**索引 blob 等于 HEAD blob 去掉全部 `\r`**，
即纯换行归一化、内容零改动。

### ⚠ 规则顺序是硬约束（本文档最重要的一条）

`.gitattributes` **后写的规则覆盖先写的**。落地过程中真踩了一次：

首版把 `public/data/** text eol=lf` 写在 `*.webp binary` **之后**，于是那 4 条 binary 声明
被通配规则覆盖，`public/data/img/**` 下 **232 张 webp 被判成文本**，
`--renormalize` 随即按 CRLF→LF 改写它们的 blob —— 若直接提交就是真实的美术资源损坏。
（工作区文件本身没坏，坏的是索引；已 `git reset` 回滚并从索引重写工作区。）

故本文件内维持两条不变量，改它之前必须重读：

1. **二进制声明排在所有文本通配之后**；
2. **文本规则一律限定到具体扩展名或具体子路径，绝不用 `**` 覆盖 `public/data`**
   —— 那个目录 913 个文件里 675 个是 webp / woff2。

用 `git check-attr text eol -- <路径>` 可即时验证判定（图片应为 `text: unset`）。

## Alternatives considered

- **什么都不做，靠各人编辑器设置**。这正是漂移的成因：约束不在仓库里，就只存在于每台机器的
  历史里，无法评审、无法继承。
- **只写 `* text=auto`（不指定 eol）**。能修「入库换行」，修不了「工作区换行随机器变」，
  而后者才是「同一提交在两台机器上 diff 不同」的直接原因。
- **保持现状，把 CRLF 定为标准**。仓库 96% 的文本文件已是 LF，且 `data-sync.yml` 在 ubuntu 上
  生成 JSON；改押 CRLF 会让生成物与多数源码一起翻一遍，方向反了。
- **顺带加 `.editorconfig`**。编辑器层面的同一件事，且 `eol=lf` 已在检出时强制工作区换行，
  属重复保险。未采纳，避免一次改动夹带两套机制。
- **只归一化、不加 `.gitattributes`**。一次性的：下次在 Windows 编辑器里保存就又漂回去，
  且没有任何东西会拦住它。

## Consequences

- 代价：17 个文件的 blob 被重写，`git blame` 会在这一提交上断一次；历史提交里的 CRLF
  不会被追溯修复（本文件只约束**今后**的检出与提交）。
- 收益：`git diff --check` 从 55 条噪声变为**完全干净**，真问题不再被淹没；
  换行不再依赖任何人的机器配置；`pnpm run sync` 在 Windows 与 ubuntu 上产出一致；
  二进制资产由显式规则保护，不再依赖自动探测的运气。
- 遗留缺口：**`.gitattributes` 不会被任何 CI 门禁守护**——规则被改错（尤其顺序）
  要到下次 `--renormalize` 或提交时才发现。本仓库无分支保护、门禁靠 review，
  故把这个坑写进文件头的警示块与本文档，而不是假装有自动拦截。
