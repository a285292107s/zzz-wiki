# 绳网档案 · 数据交接文档（面向后续 AI / 协作者）

> 本文档的目标：让你在**不超过 10 分钟**内了解本项目的全部数据来源、结构与处理管线，
> 无需从头探测。所有结论均为工程内**实测**（数据生成、URL 探测、对比 nanoka 名录），
> 非转述。读完即可上手改数据管线或前端渲染。

> **⚠️ 自迭代维护协议（重要）**：本文件是**活文档**。若你在后续工作中发现本文档与实际代码/
> 数据结构/外部服务状态不一致（例如字段名、表路径、锚点、图标 URL、版本号、枚举、命令失效），
> **你有义务就地修正本文档**，使其始终准确反映现状，而不是让它腐烂成过时记录。修正时：
> - 直接编辑本文件对应章节，保持结构与文风；
> - 若修正涉及「失效信号」或「不做的事」，一并在对应小节更新；
> - 让后续接手的 AI 永远能信任本文档。你更新的内容即成为交接给下一位的基线。

---

## 0. 一句话概览

本项目是一个**构建期静态化**的绝区零数据 wiki：

- **主数据**：构建期从 **hakushin raw**（`static.nanoka.cc`，zzz.nanoka.cc / hakush.in 站底层 CDN）
  拉取**正式服（live）**列表 + 详情 → 解析层规整 → 生成**本地静态 JSON**（`public/data/`）提交入仓。
  （合规约定 2026-08：站点只展示游戏正式服数据，不产出源站 latest——后者含前瞻/测试服内容。）
- **运行时**：前端只读本地 `/data`，**零外部接口、零 CORS**。
- **图标**：两级 CDN 兜底（本地 `/data/img/` → nanoka `/assets/zzz/` → 文字占位），永不破图。

> 历史：v1 主源为 Dimbreath ZenlessData（git.mero.moe），自研键名反混淆管线；
> v2（2026-08）切换至 hakushin raw 并重写解析层（直取 + 规整），前端契约零改动。
> 原 Dimbreath 细节移到 [§9](#9-历史数据源dimbreath-zendlessdata参考) 作参考。

---

## 1. 数据主源（唯一）

| 项 | 值 |
|---|---|
| 源 | `https://static.nanoka.cc`（zzz.nanoka.cc / hakush.in 底层静态 CDN） |
| 版本清单 | `GET /manifest.json` → `zzz.live`（当前 3.1）即数据版本（游戏正式服在线版本）；`zzz.latest`（3.2.4+…）为源站最新（含前瞻/测试服内容，**本项目不再消费**） |
| 列表（无语言） | `/zzz/{ver}/character.json` `/weapon.json` `/bangboo.json` `/equipment.json` |
| 详情（带语言） | `/zzz/{ver}/zh/character/{id}.json` `/weapon/{id}` `/bangboo/{id}` `/equipment/{id}` |
| 名词表 | `/zzz/{ver}/zh/noun.json` — 术语词典（游戏名词 title/desc），构建期全量下沉为 `noun.json`（§3/§4），供前端 TermTip 浮层 |
| 语言 | `zh`/`en`/`ja`/`ko`；本项目只取 `zh`（名录保留四语名） |
| 数据性质 | 与 Dimbreath 解包数据**同源**（nanoka 亦从之加工），但字段名已可读、多语言内嵌、更新更快（新角色/音擎/职业已收录） |

**单数据版本（合规约定 2026-08 起）**：站点只展示**正式服（live）**数据。
- `live` = 游戏在线版本数据（2026-08 为 3.1，角色 58），与玩家正式服内容对齐。
- 构建期只落地 `public/data/live/`（目录名固定，不随版本号变）；
  **不再产出 latest**——`zzz.latest` 含前瞻/测试服内容，为合规绝不拉取/降级/补位。
- live 不在源站 `available` 列表时构建**直接失败**（sync-data 判定失败则不提交，沿用仓库内既有正式服数据），拒绝用 latest 顶替。

**注意**：`item.json` 只在带语言路径（`/zzz/{ver}/zh/item.json`）存在；`monster/boss/shiyu/simul/hard`
等端点站方亦有（见 §8 扩展域），本项目当前未消费；`zh/noun.json` 名词表**已消费**（→ 各版本 `noun.json`）。

---

## 2. 解析层要点（scripts/build/，入口 build-data.ts）

数据源字段名已是可读英文，**无键名反混淆**。解析层只做规整：

- `basename()`：`icon` 若为完整资源路径（驱动盘/邦布）→ 取裸文件名（去目录/扩展名），与素材 CDN 命名规则一致；角色/音擎 icon 本身即裸名，原样保留。
- 名录：列表条目 ID 是**对象 key**（条目内部无 id 字段）→ 注入 `Id` 大写键。
- 详情：键长名与前端契约（`src/data/types.ts`）**几乎完全同构**，直接透传；仅以下值做规整：
  - `weapon_type`/`element_type`/`hit_type` 的值统一为**英文**（`{202:"Ice"}`），与旧契约一致（前端只用 key 解码，值文本不参与显示；`camp` 值保留中文）。
  - 皮肤 `image` 应用 `SKIN_IMAGE_FALLBACK`（见 §5）。
- 新增透传字段（v2 增值，前端 index signature 兼容）：`special_element_type`、`strategy`、`fairy_recommend`、`skill_list`、`skill_priority`、`passive`、`potential_detail`、`level`、`extra_level`、`level_exp`、`live2_d`。
- **特殊属性展示**：详情 `special_element_type.name`（如 星见雅→「烈霜」）在构建期同步注入名录为 `special_element` 字段；前端 `Tags` 展示属性时优先显示特殊名，无则退回 `ELEMENTS[element].zh` 基础属性。
- **名词表**：源站 `zh/noun.json` 全量下沉为 `live/noun.json`；术语名规整为带括号风格（如 `[虚曜]`）注入名录/详情，名词表自身 desc 经 `resolveTerms` 解析（`<Term:N>` 保留 ID 外壳，前端渲染为术语锚点）。
- 详情并发抓取上限 8；磁盘缓存 `.cache/hakushin-raw/`（缓存路径含版本号，同版本重复构建秒级跳过、跨版本自动全量刷新；`--force` 强制忽略缓存重拉）。
- **manifest.json 永不读缓存**：每次 `npm run data` 都实时拉取源站清单，保证版本探测不固着。

**当前版本号易变**：`manifest.zzz.available` 含历史版本；构建只取 `live`（正式服，见 §1 单版本说明）。
合规判定集中在 `scripts/build/live-target.ts` 的 `resolveLiveTarget()`（纯函数，有单测）：live 缺失 / available 缺失 /
live 不在 available 时**直接抛错**（sync-data 判定失败则不提交、沿用仓库内既有正式服数据），`npm run data` 重建即可。

---

## 3. 产出契约（public/data/）

与旧 Dimbreath 契约一致（前端 `src/data/api.ts` / `types.ts` **零改动**）：

```
public/data/
  manifest.json              版本/来源元信息 { zzz: { live, source } } + generated
  live/                       正式服数据（游戏在线版本，如 3.1；目录名固定，不随版本号变）
    character.json weapon.json bangboo.json equipment.json noun.json
    zh/character/{id}.json …（契约见下）
  img/                        图标本地化 + hero 头图（download:icons 产物）
```

> `img/` 为 `npm run download:icons` 的本地化图标（独立管理）；`npm run data`
> 的 resetOut **只清理根 manifest 与 live 目录**，不触碰 img/（曾有整体删除 OUT 目录连坐清空图标的教训）。
> `img/hero/Mindscape_{id}_2.webp` 除作角色详情页 AgentHead 头图外，也驱动首页「今日角色」
> 区块：用超宽全景图在 9:16 竖视口内做**局部遮罩**展示（纯 CSS，不产出裁切图）。选角由
> `src/data/featured-pool.json` 精选池维护（`useFeaturedAgents` 读取 `pool`；用开发校准工具 `/calibrate`
> 逐张调整并保存，见 [`IMG_GUIDE.md`](./IMG_GUIDE.md)）：每项 `{ id, pos, zoom, originY }`（`id` 角色号；
> `pos` 水平脸对焦；`zoom` 放大填满；`originY` 变换原点 Y），名字/属性运行时从名录解析；
> `useFeaturedAgents()` **每次挂载随机取 4 张轮换**。该图源带透明边（上下为 alpha 透明区）；
> **首页 hero 底图已移除**（`HomeView` `.hero` 只作文字陈列，不再加载 Mindscape 头图）。双形态切换钮改挂到
> 1551 佩洛伊斯详情页 `AgentHead.vue` 的右上档案行：仅双形态角色（`hero-gender-variants.json` 登记，当前为 1551）
> 显示，可在女性/男性双形态间切换；选择经 `useHeroForm` 全局共享 + `localStorage` 持久化
> （键 `zzz-wiki:hero-form`，默认女性），跨刷新 / 跨页保持一致。
> `img/banner/` 下的旧宣发海报当前已不再被引用（可留作素材，构建管线不会清除该目录）。
> 展示技法与公式（视口遮罩 / 放大填满 / 脸对焦 / 核验流程）总纲见 [`IMG_GUIDE.md`](./IMG_GUIDE.md)。
> 名录/详情数据量：live（3.1）角色 58/音擎 95/邦布 42/驱动盘 30。（源站 latest 的角色 60/音擎 100 含
> 前瞻/测试服内容，按合规约定不产出、不展示。）

### 名录字段
- **CharacterListItem**：`Id, code, rank, type(职业int), element(属性int), special_element(特殊属性展示名,可选), hit(攻击int), camp(阵营id), camp_name(阵营展示名,可选), icon(裸文件名), potential, skin, desc, en, zh, ja, ko`
  - `special_element`：构建期由详情 `special_element_type.name` 注入（如 星见雅→`烈霜`、仪玄→`玄墨`、叶瞬光→`凛刃`）。前端展示属性时优先显示它，无则为 `element` 基础属性。
  - `camp_name`：构建期由详情 `camp` 映射（如 `{"1":"狡兔屋"}`）注入阵营中文名。前端名录阵营列优先显示它，无则退回 `C##` 代码。
- **WEngineListItem**：`Id, icon, rank, type, atk, sub, desc, en, zh, ja, ko`
- **BangbooListItem**：`Id, icon, rank, codename, desc, en, zh, ja, ko`
- **DiskDriveListItem**：`Id, icon, en{name,desc2,desc4}, ko{…}, zh{…}, ja{…}`

### 详情字段
- **character/{id}.json**：`id, icon, name, code_name, rarity, weapon_type{int:英文}, element_type, hit_type, camp{id:中文}, gender, partner_info{full_name,gender,profile_desc,impression_f,impression_m,birthday,impressions,…}, stats, skill{basic,dodge,special,chain,assist:{description:[{name,desc,potential}]}}, talent{1..6:{level,name,desc,desc2}}, passive, skin{sid:{name,desc,obtain_desc,image}}, special_element_type{name,title,desc,icon}, skill_list, skill_priority, fairy_recommend, strategy, potential, potential_detail, level, extra_level, level_exp, live2_d`
- **weapon/{id}.json**：`id, code_name, name, desc, desc2, desc3, rarity, icon, weapon_type, base_property{name,name2,format,value}, rand_property, level, stars, materials, talents{1..5:{name,desc}}, atk_max`（`atk_max` 为构建期注入名录 `atk`，即 Lv.60 满级主属性，供详情页等级滑条插值）
- **bangboo/{id}.json**：`id, code_name, name, desc, rarity, icon, stats, level, skill{a,b,c}, skill_prop`
- **equipment/{id}.json**：`id, name, desc2(2件套), desc4(4件套), story, icon, icon2`

### 枚举映射（与 `src/data/types.ts` 一致）
- 属性 `200物理 201火 202冰 203电 204风 205以太 300流明(Lumiflux)` — 300 为蕾米埃尔(1581)等新角色属性，ZenlessData `DamageElementConfigTemplateTb` 中 `300 = ElementType_Lumen`（PFN 标志 0，标准元素；烈霜/FireFrost 为 202 变体、PFN=1，属特殊属性）
- 职业 `1强攻 2击破 3异常 4支援 5防护 6命破 7锋御(Armorer)` — **7 为 v2 新增**（1611 克拉蕾；hakushin raw 3.2.3 收录，ZenlessData 职业表暂未收录）
- 稀有度 `角色/邦布: 3=A 4=S，音擎: 2=B 3=A 4=S`
- 攻击类型 `101斩 102击 103刺`

---

## 4. 端点 → 产出映射

| hakushin raw 端点 | 用于产出 |
|---|---|
| `/manifest.json` | 版本号（live = 正式服）、new 新内容 ID 清单（latest 仅作参考，不消费） |
| `character.json` | 角色名录（code/rank/type/element/hit/camp/icon/四语名） |
| `zh/character/{id}.json` | 角色详情（数值/技能/影画/档案/皮肤/特殊属性/策略/潜能…） |
| `weapon.json` | 音擎名录（含 atk/sub/desc） |
| `zh/weapon/{id}.json` | 音擎详情（主/副属性、等级成长、精炼 1-5、突破材料） |
| `bangboo.json` | 邦布名录 |
| `zh/bangboo/{id}.json` | 邦布详情（数值/晋升/技能 a/b/c） |
| `equipment.json` | 驱动盘套装名录（四语套装名与 2/4 件套效果） |
| `zh/equipment/{id}.json` | 驱动盘详情（背景故事 story、icon2） |
| `zh/noun.json` | 名词表（术语 title/desc → `live/noun.json`，供详情页 TermTip 浮层） |

**注意**：名录的 `en`/`ja`/`ko` 字段对源站未完全本地化的极新角色可能是原始资源键，
`zh` 名正常；前端名录主显示 `zh`，不受影响。

---

## 5. 图标来源与本地优先

前端 `src/data/icons.ts` 提供 `iconSources(item, kind, category)`，返回**按优先级排列的候选 URL**：
`<HollowImage>` 依序尝试，全部失败→文字占位。

| 优先级 | 来源 | URL 模板 | 覆盖/实测 |
|---|---|---|---|
| ① | **本地化图标** | `{BASE}/data/img/{category}/{basename}.webp`（`npm run download:icons` 落地） | 角色/音擎/邦布/驱动盘/技能键位/hero 头图全量（缺 npm run data 后运行） |
| ② | nanoka 素材 CDN | `https://static.nanoka.cc/assets/zzz/{basename}.webp` | **全品类图标 100%（除空缺 icon）** |

**nanoka 命名规则**：取游戏资源路径的**裸文件名**（去目录、去扩展名）+ `.webp`。
例：`UI/Sprite/A1DynamicLoad/IconSuit/UnPacker/SuitWoodpeckerElectro.png` → `SuitWoodpeckerElectro.webp`。
角色头像 `IconRole01` 等即直接用；角色列表头像在 ICON 名里 `Role`→`RoleSelect`（`IconRoleSelect01`）。

> **本地化（Q4b）**：`npm run download:icons` 把运行时图标从 nanoka 下载到
> `public/data/img/{category}/`，使站点**运行时零外部请求**。本地文件缺失时自动落到
> ② 的 CDN 兜底，不破图。皮肤多为此类**大图**（28MB+），默认**不本地化**（`SKIN_LOCAL=1` 可开），
> 皮肤缩略图仍走 CDN→文字兜底。

> **hero 头图（AgentHead）**：角色详情页 head 的 Mindscape_{id}_2.webp 已全量本地化到
> `public/data/img/hero/`（live 58/58，正式服角色源站均已上传；下载脚本遇缺仅告警不置失败码）
> ——前端 `AgentHead.vue` 本地优先 + nanoka CDN 兜底，两级均缺时降为 --bg-0 底色，不破版。
> **双形态角色例外**：1551 佩洛伊斯（Pyrois）源站无裸名 `Mindscape_1551_2.webp`，而是按性别后缀
> 区分（`Mindscape_1551_Female_2.webp` / `Mindscape_1551_Male_2.webp`），两形态均已本地化到
> `img/hero/`。**单一事实源**：`src/data/hero-gender-variants.json` 以 `{ id: { variants, defaultFile } }`
> 列出全部双形态——`download-icons.mjs` 按 `variants` 逐个下载；`src/data/heroGenderVariants.ts` 的
> `heroVariantFile(id, form)` 取当前形态（**女性**= `defaultFile`，**男性**= `variants` 中非 `defaultFile`
> 的项，缺位回退 `defaultFile`）；`useHeroForm` 持形态状态 + `localStorage` 持久化，供
> 1551 详情页 `AgentHead.vue` 跟随用户所选形态，切换即时一致。`CalibrateView.vue`（图库校准）与
> `useFeaturedAgents`（今日角色池）经 `heroImageFile(id)` 取**默认展示（女性）版**来定档，故双形态角色
> （当前为 1551）也会出现在校准网格 / 可取图列表，无需手写 `Mindscape_…` 文件名字符串。后续新增双形态
> 角色，`variants` 按「女性(默认)/男性」顺序填、`defaultFile` 填女性即可，**只改这份 JSON** 即自动生效，
> 勿再四处手写。

> **图标兜底**：候选链末级为文字占位（`<HollowImage>` 内置），任何缺图场景都不破图；
> 实测 live 名录 icon 无空缺（角色/音擎/驱动盘全量，邦布 1 例空串走兜底）。
> honeyhunterworld 站点已从候选链移除（曾整体 521，仅角色图可用），当前唯一 CDN 兜底为 nanoka；
> 无论 nanoka 是否恢复，前端第三级（文字）兜底始终生效。

### 技能键位图标（经 rich.ts，本地 img/skill → nanoka CDN 两级兜底）
描述文本的 `<IconMap:Icon_XXX>` 标记对应游戏键位图标，由 `src/utils/rich.ts` 的
`richDesc()` 渲染为 `<img>`（经 `src/data/icons.ts` 的 `skillAssetSources()` 生成候选 URL，
`<HollowImage>` 风格的两级兜底：本地 → nanoka CDN → 文字占位）。
非键位名（如 `Icon_JoyStick`）同样进 `skillAssetSources` 候选链（本地 → nanoka CDN）。

**皮肤图回退**：`scripts/build/normalize.ts` 的 `SKIN_IMAGE_FALLBACK` 将 nanoka 未上传的
主角第 3 套皮肤立绘（`IconRole34_03`/`IconRole33_03`）回退到默认立绘，杜绝死链字段。

---

## 6. 前端渲染关键文件

| 文件 | 职责 |
|---|---|
| `src/data/api.ts` | 读本地 `/data`，内存缓存；本地化名统一由 `utils/names.ts` 的 `pickName()` 提供 |
| `src/data/types.ts` | 数据类型 + 枚举映射常量（含 300 流明、职业 7 锋御） |
| `src/data/icons.ts` | 图标候选链（本地 → nanoka CDN 两级兜底）+ 技能键位资产名映射 |
| `src/components/HollowImage.vue` | 多候选图 + `position`/`ratio` 裁切 + 文字降级 |
| `src/utils/rich.ts` | 富文本：`<IconMap:Icon_XXX>`→键位图（本地优先，`data-cdn` 属性供 main.ts 全局 error 降级）、`<color=#…>`→带色 span、`<Term:N>`→术语锚点（供 TermTip）、`{CAL:expr,scale,decimals}`→按技能等级代入求值（技能/核心技描述与数值条目，如「伤害提升18%」；需调用方传入等级，否则剥离；scale 语义按游戏实机核实：小数式 ×100 转百分比，如 月城柳 极性紊乱 满级 3200%）、LAYOUT 与 `{Skill:N,Prop:N}` 占位剥离，其余 HTML 转义防注入 |
| `src/data/terms.ts` | 术语词典：读本地 `/data/live/noun.json`（固定路径，单版本正式服），词典缺失时浮层安静隐藏 |
| `src/components/detail/TermTip.vue` | 术语悬停浮层：全局委托监听 `.rich-term`，展示名词表 title/desc |
| `src/utils/text.ts` | `stripRichText`（纯文本剥标记） |

---

## 7. 运维命令

改动数据管线的建议顺序：正式更新入口用 `npm run sync`（探测 → 重建 JSON → 图标补差 → 校验 → 汇总，
由 GitHub Actions 定时触发，工作流内 `npm run verify:data` 硬门禁通过 → 直接 commit + push 到默认分支
（master），JSON 与图标同次提交锁步；门禁不通过则 job 失败、不提交）；
仅本地改数据时 `npm run data` → `npm run verify:data` →（可选）`npm run download:icons`
→ `npm test` → `npm run build`（→ 可选 `npm run verify:icons`）。改动视觉层字体时另见
`npm run download:fonts` / `npm run verify:fonts`（§10 字体组）。各命令如下：

```bash
npm install             # 依赖（首次或变更后）
npm run data            # 拉取 hakushin raw（live = 正式服单版本）→ 规整 → 生成 public/data/live/ + manifest（需外网）
                        #   有代理时：set NODE_USE_ENV_PROXY=1
npm run data -- --check # 仅版本探测：输出 UPDATE_AVAILABLE / UP_TO_DATE，不构建（CI/定时哨兵）
npm run sync           # 数据+图标同步（正式提交入口）：探测 → 重建 JSON → 图标 --soft 补差（只补缺失、已有资源零重下）
                        #   → verify:data + 本地必须项图标齐整（告警）→ 汇总变更集；无变更不提交；由 data-sync workflow
                        #   定时触发 → 工作流内 verify:data 硬门禁通过 → 直接 commit + push 到默认分支（master）（需外网）
npm run build:ci        # Vercel 部署构建入口：npm test → verify:fonts（缺字体文件非零退出）→ npm run build；
                        #   只构建已提交快照、不在构建期重建数据（数据更新走 npm run sync）；站点因数据源故障而挂的情形由 sync 不提交规避
npm run verify:icons    # 图标校准：本地 img 差集（核心）+ nanoka 远程审计；缺失非零退出
                        #   --local 仅查本地（离线可用）；网络异常按"无法确认"以码 2 退出
npm run download:fonts  # 西文字体本地化：Google Fonts css2 → public/fonts/*.woff2（自托管、运行时零外网）；幂等；网络失败仅告警
npm run verify:fonts    # 字体存在性校验：download:fonts 声明的每个文件在 public/fonts/ 存在且非空（离线可用；build:ci 已挂）
npm run dev             # 开发 http://localhost:5173（占用自动换端口）
npm run build           # vue-tsc 类型检查 + vite 构建
npm run preview         # 预演产物
```

---

## 8. 已知缺口与失效信号（务必注意）

### 当前状态（2026-08，v2 实测）
- 正式服（live 3.1）名录 58 角色／95 音擎 / 42 邦布 / 30 驱动盘（不含主角 2011/2021——与 hakushin 名录口径一致，前端零引用主角，无影响）。
- **伊埃斯（55098）不入邦布名录展示**：它是绳匠专属的 H.D.D. 搭档，非可获取收藏型号（源站名录即空 icon / 占位 desc 的桩数据）；由 `BangboosView.vue` 的 `HIDDEN_BANGBOO_IDS` 前端策展，名录文件仍保留该条，详情页可经直接链接到达。
- **源站 latest（3.2.4+…，角色 60）含前瞻/测试服内容（1611 克拉蕾 / 1621 洛克茜，live 3.1 未收录），按合规约定不产出、不展示。**
- **站方扩展域未消费**：`monster.json`(306) / `boss.json`(47) / `shiyu.json`(62) / `simul.json`(3) / `hard.json`(1) / `zh/item.json`(5771) 全部实测 200，做怪物图鉴/式舆/以骸卡牌页时可扩展（同源 schema 见各端点返回）。

### 失效信号
1. **名录/详情数量为 0** → 版本号变更或端点改名：先看 `.cache/hakushin-raw/manifest.json` 的 `live` 是否仍可用（请求 `https://static.nanoka.cc/zzz/{live}/character.json` 必须 200）。
2. **请求 404** → 站点 schema 变更（端点改名/移动），检查 `manifest.json` 的 `available` 列表与旧端点对比。
3. **图标全文字** → `verify:icons` 先看本地 img 差集（运行时消费的是本地文件，缺失才会静默落 CDN）；nanoka `/assets/zzz/` 是主兜底，若它也挂则所有图降文字（`--local` 之外的审计会标出源站缺口）。
4. **多语言名异常** → 名录 `en`/`ja`/`ko` 对极新角色可能是原始资源键（`zh` 不受影响）；若大面积如此说明站点本地化未完成。
5. **构建失败：「live 不在可用列表」** → `npm run data` 抛错（为合规拒绝降级 latest）；源站下架/改名 live 版本时需人工确认。sync-data 判定失败则不提交、沿用仓库内既有正式服数据；部署只构建已提交快照，站点不挂。

### 不要做的事
- 不要把 hakushin raw 提为**运行时**数据源（§0 铁律：运行时零外部请求）；仅构建期拉取。
- 不要硬编码版本号（live 当前为 `3.1`，随时会变）——每次构建从 manifest 动态取 `zzz.live`。
- **不要把 latest（源站最新/含前瞻·测试服内容）引入构建或展示**——合规红线：不拉取、不降级、不补位。
- 不要依赖 `static.nanoka.cc/zzz/UI/`（旧路径）——那是 404 残留，素材在 `/assets/zzz/`。
- 不要重新引入 honeyhunterworld 作为 CDN 来源（曾整体 521，仅角色图可用，已从候选链移除）。
- 不要假设名录 `icon` 永远非空（源站个别新角色可能为空串，前端必须走兜底）。

---

## 9. 历史数据源：Dimbreath ZenlessData（参考）

v1 主源，v2 已弃用（数据更新滞后：缺 1611/1621、职业 7；键名混淆需反混淆）。保留备查：

- 仓库：`git.mero.moe/dimbreath/ZenlessData`（master 分支）
- 形态：`FileCfg/*TemplateTb.json` 表 + `TextMap/` 文本表；**字段名随机混淆**（随版本变化），
  旧管线按锚点（角色 ID=1011、名称 `Avatar_Female_Size02_Anbi` 等）反混淆；失效时名录产出 0 条。
- 参考价值：**源头数据**、无第三方依赖、可做长期自托管备份；`DamageElementConfigTemplateTb` 的
  `PFNMFGJPMDP` 标志（1=烈霜、2=AuricEther、4=ZhenZhenAssault、0=标准）可佐证特殊属性归属。
- 若重新启用：`git clone --depth 1 https://git.mero.moe/dimbreath/ZenlessData`（约 18k 文件，浅克隆即可）。

---

## 10. 视觉语言速记（改 UI 时遵循）

"档案标本"质感：1px 细线框、2px 圆角、等宽编号、纸墨配色。列表/首页图标用 34–40px 细线框小图；
**禁止圆角卡片堆叠、渐变霓虹、投影**（浮层阴影除外，见 `--shadow-pop`）。图标统一走 `HollowImage`（含兜底），
skills 描述富文本走 `richDesc`。字体族（CJK 衬线优先、sans 弃 `Inter`）与浮层阴影染 `--bg-0` 属 **token 级精修**，
唯一记录点见 `tokens.css` 注释与 `/style`（DESIGN.md §9）；本条指核心语言不变。
西文（JetBrains Mono / Public Sans）**自托管**至 `public/fonts/`，经 `@font-face` 引用、运行时零外网；
刷新用 `npm run download:fonts`，缺文件由 `verify:fonts` 门禁（含 build:ci）。