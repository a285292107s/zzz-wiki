# 绳网档案 · Ropeweb Archive

绝区零（Zenless Zone Zero）数据展示型 wiki。以「空洞数据终端」的档案化视觉呈现代理人、音擎、邦布与驱动盘数据。设计取向：**约束、排印、纸墨质感**——拒绝渐变霓虹与圆角卡片堆叠的模板感。

> 📄 给后续 AI / 协作者的**数据交接文档**见 [`DATA_GUIDE.md`](./DATA_GUIDE.md)——数据来源、表结构、反混淆锚点、图标兜底、已知缺口与失效信号都在这里，无需从头探测。
>
> 🏗️ **架构设计**（分层、数据契约单一事实源、测试策略、路线图）见 [`DESIGN.md`](./DESIGN.md)。
>
> 🖼️ **图片展示规范**（超宽/透明底/人像立绘如何展示得好、公式与核验流程）见 [`IMG_GUIDE.md`](./IMG_GUIDE.md)。

## 技术栈

- **Vue 3** + **TypeScript** + **Vite 6**
- **vue-router 4**
- 零 UI 框架：纯手写设计系统（CSS 变量 + 细线 + 等宽数据数字）
- 数据为**构建期生成的静态 JSON**（`public/data/`），运行时零外部请求

## 本地开发

```bash
npm install
npm run data         # 生成静态数据（拉取 Dimbreath ZenlessData → 反混淆 → 拼装）
npm run verify:icons # （可选）校验全部图标资源可达性，失败非零退出
npm run dev          # http://localhost:5173
npm run build
npm run preview
```

> `npm run data` 需要网络访问 `git.mero.moe`（有代理时设 `NODE_USE_ENV_PROXY=1`）；
> 数据已提交在 `public/data/`，日常开发/部署无需重跑。更新数据：重跑该脚本。

## 部署（Vercel）

1. 将本仓库推送到 GitHub。
2. 在 [vercel.com/new](https://vercel.com/new) 导入该仓库。
3. 无需任何配置——`vercel.json` 已声明 Vite 框架与输出目录，仅含 SPA 路由 rewrite。
4. 部署后访问 `https://<你的项目>.vercel.app`。

## 数据源

构建期从 **hakushin raw**（`https://static.nanoka.cc`，zzz.nanoka.cc / hakush.in 站底层 CDN）拉取，
解析层直取 + 规整（v2，2026-08 切换；v1 为 Dimbreath ZenlessData 反混淆管线，已弃用，见 `DATA_GUIDE.md` §9）。

- `scripts/build/`（入口 `scripts/build-data.ts`）负责：读取 `manifest.json` 取版本（`zzz.live` = 正式服）→ 抓取角色/音擎/邦布/驱动盘名录与中文详情 → 规整（icon 裸名、枚举英文值、皮肤回退）→ 输出到 `public/data/live/`。
- 产出（`public/data/`，运行时本地 fetch，无 CORS）：

| 路径 | 说明 |
| --- | --- |
| `/data/manifest.json` | 版本/来源元信息（`zzz.live` / `source`） |
| `/data/live/…` | 正式服名录与详情：`character.json`（58 名）、`zh/character/{id}.json`（数值/技能/影画/档案/皮肤/特殊属性/策略/潜能）、`weapon.json`（95 件）、`zh/weapon/{id}.json`、`bangboo.json`（42 只）、`zh/bangboo/{id}.json`、`equipment.json`（30 套）、`zh/equipment/{id}.json` |

**字段约定**：属性 `200物理 201火 202冰 203电 204风 205以太 300流明(Lumiflux)`；职业 `1强攻 2击破 3异常 4支援 5防护 6命破 7锋御(Armorer)`；稀有度 `角色/邦布: 3=A 4=S，音擎: 2=B 3=A 4=S`。技能/影画/档案文本含 `<color=#…>` 等游戏标记，站点已做剥离清洗。

> 数据版本说明：站点**只展示正式服（live）数据**（合规约定 2026-08 起，此前曾有 live/latest 双版本切换，已移除）。
> live = 游戏在线版本数据（2026-08 为 3.1，与正式服内容对齐）；源站最新 latest（含前瞻/测试服内容）不产出、不展示。
> 版本号从 `manifest.json` 的 `zzz.live` 动态获取，重跑 `npm run data` 即跟随站点最新正式服数据。

### 图片素材（两级兜底）

按优先级依次尝试，全部失败后显示档案式文字占位（代号首两字）：

1. **本地化图标**：`/data/img/{category}/{basename}.webp`（`npm run download:icons` 落地，构建期拉取）
2. **static.nanoka.cc** 素材 CDN：`https://static.nanoka.cc/assets/zzz/{basename}.webp`（全品类已实测可用）
3. 文字占位（`<HollowImage>` 内置）

**素材 CDN 解析（与 zzz.nanoka.cc 同源）**：该站页面数据全部来自 `static.nanoka.cc/zzz/{ver}/{lang}/…` JSON；图片素材另有独立的 `static.nanoka.cc/assets/zzz/` CDN——命名规则为**取游戏资源路径的裸文件名**（如 `UI/Sprite/A1DynamicLoad/IconSuit/UnPacker/SuitWoodpeckerElectro.png` → `SuitWoodpeckerElectro.webp`），角色头像 `IconRole01` 等即直接可用。本项目 `src/data/icons.ts` 完全复刻这套规则。

**可用性现状（2026-08 实测）**：
- nanoka 素材 CDN：项目全部 **303 个图标资源**（live 名录 224 + 皮肤立绘 79）**100% 可达**（`npm run verify:icons` 可复核，失败即非零退出，可挂 CI）
- 技能键位图标：资产名取自描述文本的 `<IconMap:Icon_XXX>` 标记（`Icon_Normal`/`Icon_Evade`/`Icon_SpecialReady`/`Icon_UltimateReady`/`Icon_QTE`/`Icon_Switch` 均 200），由前端 `icons.ts` + `rich.ts` 渲染——技能组头图标经 `<HollowImage>` 加载（含几何字符兜底），描述内联键位图（`<IconMap>`）直接嵌入富文本
- honeyhunterworld：已从候选链移除（曾整体返回 Cloudflare 521，仅角色图可用），当前唯一 CDN 兜底为 nanoka
- 已知提供方缺口：主角「哲/铃」第 3 套皮肤的立绘（`IconRole34_03` / `IconRole33_03`）nanoka 未上传，构建管线已将其回退到默认立绘（`scripts/build/normalize.ts` 的 `SKIN_IMAGE_FALLBACK`），杜绝死链字段

## 目录结构

```
src/
  domain/        # 单一事实源：枚举 / 类目元信息 / zod 契约 / 详情区块类型
  data/          # 请求层（api）+ 类别表驱动（resources）+ 类型派生（types）+ 图标候选（icons）
  composables/   # useAsyncResource / useCatalogList / useRouteParam / usePageMeta
  components/    # layout / list / state / detail 区块 + Rarity / Tags / HollowImage / SkillIcon
  views/         # 页面（薄组装层）
  styles/        # 设计 token + 基样式
  router/        # 懒加载路由 + meta
scripts/
  build/         # 数据管线模块（io / normalize / domains / index，tsx 运行）
  build-data.ts  # 数据管线入口（npm run data）
  verify-data.ts # zod 契约校验（npm run verify:data，可挂 CI）
  verify-icons.mjs # 图标资源可达性校验
tests/           # vitest 单元/组件测试
public/
  data/          # 生成的静态 JSON（提交入库）
```

> 架构分层、依赖规则与重构路线见 `DESIGN.md`；组件/设计 token 速查见站内 `/style` 设计系统页。

> 项目为社区爱好者制作，与米哈游 / HoYoverse 无关；数据版权归原作者（Dimbreath 解包数据 / miHoYo）所有。