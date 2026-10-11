# 决策记录 0005：包管理器改用 pnpm，锁文件唯一为 pnpm-lock.yaml

Status: implemented
Class: process

## Problem

此前约定「包管理器为 npm，锁文件只维护 `package-lock.json`」（AGENTS.md §4、DESIGN.md §10.8）。
npm 的扁平 `node_modules` 会把未声明的传递依赖也解析到，**依赖是否真的声明过**只有换到严格布局才暴露；
跨机器的下载缓存也无法在仓库层面声明。用户决定改用 pnpm，并要求先出风险评估。

难点不在「能不能装」。实测中会**硬性失败或静默出错**的地方有三处：

1. pnpm 默认 `strictDepBuilds: true`：依赖的安装脚本未经审批时 `pnpm install` **非零退出**
   （`ERR_PNPM_IGNORED_BUILDS`），不是警告。本仓库的 `esbuild`（vite 与 tsx 两条链上各一份）正属此列。
2. 不做版本对齐就迁移，会顺手把依赖升一批——而本仓库有体积预算与类型门禁（`verify:budget`），
   失败原因将无法归因到「迁移」还是「升级」。
3. Vercel 按锁文件识别包管理器；两套锁文件并存时由谁取胜不可控。

## Decision

- 包管理器为 pnpm；版本钉在 `package.json` 的 `packageManager`（CI 与 Vercel 都读这一处，避免两处各自漂移）。
- 锁文件唯一：`pnpm-lock.yaml`。它由 `pnpm import` 从既有 `package-lock.json` 转换而来，
  **直接依赖 15/15 版本逐一相同**；传递依赖 285/290 相同，另 5 个为同 semver 区间内的补丁级差异
  （`@jridgewell/sourcemap-codec` 1.5.5→1.6.0、`glob` 10.4.5→10.5.0、`source-map-js` 1.2.1→1.2.2、
  `tinyspy` 4.0.4→4.0.6、`vscode-uri` 3.1.0→3.2.0，全为构建/测试工具内部依赖，不进产物）。
- `pnpm-workspace.yaml` 是 pnpm 配置的唯一归属地（v11 起 `package.json` 的 `pnpm` 字段不再被读取）。
  其中 `allowBuilds: { esbuild: true }` 逐个审批需要运行安装脚本的依赖——**map 形式**，写成列表无效；
  旧键 `onlyBuiltDependencies` 在 v11 已移除。不使用 `dangerouslyAllowAllBuilds`，审批面保持最小。
- CI（`.github/workflows/data-sync.yml`：`pnpm/action-setup` + `cache: pnpm` + `--frozen-lockfile`）
  与 `vercel.json` 的 `buildCommand` 同步改为 pnpm 命令；`package.json` 脚本内部不再调用 npm。

## Alternatives considered

- **继续用 npm**：改动面最小，但幽灵依赖不可见、缓存不可声明，且用户已决定迁移，故否。
- **pnpm + `shamefullyHoist`（或 `nodeLinker: hoisted`）模拟 npm 扁平布局**：兼容性风险最低，
  但同时放弃严格布局唯一带来的收益（暴露未声明依赖），等于只为提速迁移，故否。
- **迁移同时把依赖升到最新**：少一次动作，但把「换包管理器」与「升依赖」混进一个改动，
  门禁失败将无法归因，违反 AGENTS.md §0.4「不夹带重构」，故否。
- **`overrides` 强制 5 个传递依赖回到 npm 锁里的旧版**：能让整图完全一致，但为补丁级差异引入
  长期维护的强制项，收益为零，故否——改为在此记录差异。

## Consequences

- 代价：多一份必须维护的配置（`pnpm-workspace.yaml`）；本机 `node_modules` 需整份重装（新旧布局不可混用）；
  以后新增带 postinstall 的依赖会**先安装失败**，需显式加进 `allowBuilds`。
- 收益：未声明的依赖不再被悄悄解析；包管理器版本与锁文件都由仓库声明，本地/CI/Vercel 行为可复现；
  依赖与迁移前基本一致，门禁结果不因迁移而变（`pnpm run build:ci` 全绿）。
- 遗留缺口：`docs/audit/2026-10-doc-audit.md` 是带日期的历史快照，其中 `npm run …` 字样按「历史记录不改写」原样保留；
  `pnpm import` 期间若 `node_modules/.pnpm/lock.yaml` 有残留，会污染转换结果（曾导致 3 个直接依赖被静默降级），
  故转换前须先清干净虚拟存储。
