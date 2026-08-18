# 空洞档案 · 数据交接文档（面向后续 AI / 协作者）

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
  拉取列表 + 详情 → 解析层规整 → 生成**本地静态 JSON**（`public/data/`）提交入仓。
- **运行时**：前端只读本地 `/data`，**零外部接口、零 CORS**。
- **图标**：三级 CDN 兜底（honeyhunterworld → nanoka `/assets/zzz/` → 文字占位），永不破图。

> 历史：v1 主源为 Dimbreath ZenlessData（git.mero.moe），自研键名反混淆管线；
> v2（2026-08）切换至 hakushin raw 并重写解析层（直取 + 规整），前端契约零改动。
> 原 Dimbreath 细节移到 [§9](#9-历史数据源dimbreath-zendlessdata参考) 作参考。

---

## 1. 数据主源（唯一）

| 项 | 值 |
|---|---|
| 源 | `https://static.nanoka.cc`（zzz.nanoka.cc / hakush.in 底层静态 CDN） |
| 版本清单 | `GET /manifest.json` → `zzz.latest`（当前 3.2.3+18259966）即数据版本；`zzz.live` 为在线版本 |
| 列表（无语言） | `/zzz/{ver}/character.json` `/weapon.json` `/bangboo.json` `/equipment.json` |
| 详情（带语言） | `/zzz/{ver}/zh/character/{id}.json` `/weapon/{id}` `/bangboo/{id}` `/equipment/{id}` |
| 语言 | `zh`/`en`/`ja`/`ko`；本项目只取 `zh`（名录保留四语名） |
| 数据性质 | 与 Dimbreath 解包数据**同源**（nanoka 亦从之加工），但字段名已可读、多语言内嵌、更新更快（新角色/音擎/职业已收录） |

**注意**：`item.json` 只在带语言路径（`/zzz/{ver}/zh/item.json`）存在；`monster/boss/shiyu/simul/hard`
等端点站方亦有（见 §8 扩展域），本项目当前未消费。

---

## 2. 解析层要点（scripts/build-data.mjs）

数据源字段名已是可读英文，**无键名反混淆**。解析层只做规整：

- `basename()`：`icon` 若为完整资源路径（驱动盘/邦布）→ 取裸文件名（去目录/扩展名），与素材 CDN 命名规则一致；角色/音擎 icon 本身即裸名，原样保留。
- 名录：列表条目 ID 是**对象 key**（条目内部无 id 字段）→ 注入 `Id` 大写键。
- 详情：键长名与前端契约（`src/data/types.ts`）**几乎完全同构**，直接透传；仅以下值做规整：
  - `weapon_type`/`element_type`/`hit_type` 的值统一为**英文**（`{202:"Ice"}`），与旧契约一致（前端只用 key 解码，值文本不参与显示；`camp` 值保留中文）。
  - 皮肤 `image` 应用 `SKIN_IMAGE_FALLBACK`（见 §5）。
- 新增透传字段（v2 增值，前端 index signature 兼容）：`special_element_type`、`strategy`、`fairy_recommend`、`skill_list`、`skill_priority`、`passive`、`potential_detail`、`level`、`extra_level`、`level_exp`、`live2_d`。
- **特殊属性展示**：详情 `special_element_type.name`（如 星见雅→「烈霜」）在构建期同步注入名录为 `special_element` 字段；前端 `Tags` 展示属性时优先显示特殊名，无则退回 `ELEMENTS[element].zh` 基础属性。
- 详情并发抓取上限 8；磁盘缓存 `.cache/hakushin-raw/`（`--force` 强制刷新）。

**当前版本号易变**：`manifest.zzz.available` 含历史版本，URL 一律用 `latest`（数据最全）；
若站点回滚 latest，`npm run data` 重建即可。

---

## 3. 产出契约（public/data/）

与旧 Dimbreath 契约一致（前端 `src/data/api.ts` / `types.ts` **零改动**）：

```
public/data/
  manifest.json              版本/来源元信息 { zzz: { latest, live, source } } + generated
  character.json             { [Id]: CharacterListItem }    （60 名，含 1581/1611/1621，不含主角）
  zh/character/{id}.json     角色详情 CharacterDetail        （60 份）
  weapon.json                { [Id]: WEngineListItem }      （100 件）
  zh/weapon/{id}.json        音擎详情 WEngineDetail          （100 份）
  bangboo.json               { [Id]: BangbooListItem }      （42 只）
  zh/bangboo/{id}.json       邦布详情 BangbooDetail          （42 份，v2 新增）
  equipment.json             { [Id]: DiskDriveListItem }    （30 套）
  zh/equipment/{id}.json     驱动盘详情 DiskDriveDetail       （30 份，v2 新增）
```

### 名录字段
- **CharacterListItem**：`Id, code, rank, type(职业int), element(属性int), special_element(特殊属性展示名,可选), hit(攻击int), camp(阵营id), camp_name(阵营展示名,可选), icon(裸文件名), potential, skin, desc, en, zh, ja, ko`
  - `special_element`：构建期由详情 `special_element_type.name` 注入（如 星见雅→`烈霜`、仪玄→`玄墨`、叶瞬光→`凛刃`）。前端展示属性时优先显示它，无则为 `element` 基础属性。
  - `camp_name`：构建期由详情 `camp` 映射（如 `{"1":"狡兔屋"}`）注入阵营中文名。前端名录阵营列优先显示它，无则退回 `C##` 代码。
- **WEngineListItem**：`Id, icon, rank, type, atk, sub, desc, en, zh, ja, ko`
- **BangbooListItem**：`Id, icon, rank, codename, desc, en, zh, ja, ko`
- **DiskDriveListItem**：`Id, icon, en{name,desc2,desc4}, ko{…}, zh{…}, ja{…}`

### 详情字段
- **character/{id}.json**：`id, icon, name, code_name, rarity, weapon_type{int:英文}, element_type, hit_type, camp{id:中文}, gender, partner_info{full_name,gender,profile_desc,impression_f,impression_m,birthday,impressions,…}, stats, skill{basic,dodge,special,chain,assist:{description:[{name,desc,potential}]}}, talent{1..6:{level,name,desc,desc2}}, passive, skin{sid:{name,desc,obtain_desc,image}}, special_element_type{name,title,desc,icon}, skill_list, skill_priority, fairy_recommend, strategy, potential, potential_detail, level, extra_level, level_exp, live2_d`
- **weapon/{id}.json**：`id, code_name, name, desc, desc2, desc3, rarity, icon, weapon_type, base_property{name,name2,format,value}, rand_property, level, stars, materials, talents{1..5:{name,desc}}`
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
| `/manifest.json` | 版本号（latest）、live、new 新内容 ID 清单 |
| `character.json` | 角色名录（code/rank/type/element/hit/camp/icon/四语名） |
| `zh/character/{id}.json` | 角色详情（数值/技能/影画/档案/皮肤/特殊属性/策略/潜能…） |
| `weapon.json` | 音擎名录（含 atk/sub/desc） |
| `zh/weapon/{id}.json` | 音擎详情（主/副属性、等级成长、精炼 1-5、突破材料） |
| `bangboo.json` | 邦布名录 |
| `zh/bangboo/{id}.json` | 邦布详情（数值/晋升/技能 a/b/c） |
| `equipment.json` | 驱动盘套装名录（四语套装名与 2/4 件套效果） |
| `zh/equipment/{id}.json` | 驱动盘详情（背景故事 story、icon2） |

**注意**：名录的 `en` 字段对未完全本地化的新角色（1611/1621）可能是原始资源键（如
`Avatar_Female_Size02_Claret`），`zh` 名正常；前端名录主显示 `zh`，不受影响。

---

## 5. 图标来源与三级兜底

前端 `src/data/icons.ts` 提供 `iconSources(item, kind, category)`，返回**按优先级排列的候选 URL**：
`<HollowImage>` 依序尝试，全部失败→文字占位。

| 优先级 | 来源 | URL 模板 | 覆盖/实测 |
|---|---|---|---|
| ① | honeyhunterworld | 角色 `https://zzz.honeyhunterworld.com/img/character/{id}-char_icon.webp`；立绘 `{id}-char_role_icon.webp` | 角色头像/立绘 55/60 |
| ② | nanoka 素材 CDN | `https://static.nanoka.cc/assets/zzz/{basename}.webp` | **全品类图标 100%（除空缺 icon）** |

**nanoka 命名规则**：取游戏资源路径的**裸文件名**（去目录、去扩展名）+ `.webp`。
例：`UI/Sprite/A1DynamicLoad/IconSuit/UnPacker/SuitWoodpeckerElectro.png` → `SuitWoodpeckerElectro.webp`。
角色头像 `IconRole01` 等即直接用；角色列表头像在 ICON 名里 `Role`→`RoleSelect`（`IconRoleSelect01`）。

> **已知图标空缺（v2 实测）**：1611 克拉蕾 / 1621 洛克茜 的名录 icon 与详情 icon 均为**空串**
> （hakushin raw 未含），其皮肤立绘名存在（`IconRole1611` 等）但主头像素材未上传；
> 前端自动降级为文字占位，不破图。
> honeyhunterworld 站点**前端整体当前 521**（Cloudflare 源站故障），仅角色图可用。无论其是否恢复，
> 前端第三级（文字）兜底始终生效。

### 技能键位图标（本地矢量字形，优先）
描述文本的 `<IconMap:Icon_XXX>` 标记对应游戏键位图标，**页面展示默认走本地 SVG 重绘**
（`src/data/skillGlyphs.ts`，零外部请求）：

| 槽位/标记 | 资产名 | 字形（本地 SVG 重绘，参照 temp/ 原版图标逐像素分析） |
|---|---|---|
| 普通攻击 | `Icon_Normal` | 三爪（顶帽 + 三斜爪 + 横档 + 底汇） |
| 闪避 | `Icon_Evade` | 双层 ∧ chevron（弧臂外鼓） |
| 特殊技 | `Icon_Special`（nanoka 404） | 沿用同族 `Icon_SpecialReady` 字形：紫色菱形 + 四角斜条 |
| 强化特殊技 | `Icon_SpecialReady` | 同上（紫色） |
| 连携触发 | `Icon_QTE` | X 斜条 + 中央横六边形 |
| 终结技 | `Icon_UltimateReady` | 橙色四芒爆星（上下尖锥 + 左右弧臂） |
| 支援/切换 | `Icon_Switch` | 拱顶三柱 + 交叉斜撑 |
| 核心技 | `Icon_CoreSkill` | 细外环 + 六辐 + 独立中心盘 |

- `SkillIcon.vue`（详情页技能组头）与 `richDesc` 内联图标均由 `renderSkillGlyph()`
  渲染同一套本地 SVG；非键位名（如 `Icon_JoyStick`）回退到 nanoka 素材直链。
- 重绘规格与迭代工具在 `temp/icon_proto.py`（IoU 比对）、`temp/icon_components.py`
  （连通域/主轴向分析）、`temp/icon_grid.py`（像素坐标网格）。

**皮肤图回退**：`scripts/build-data.mjs` 的 `SKIN_IMAGE_FALLBACK` 将 nanoka 未上传的
主角第 3 套皮肤立绘（`IconRole34_03`/`IconRole33_03`）回退到默认立绘，杜绝死链字段。

---

## 6. 前端渲染关键文件

| 文件 | 职责 |
|---|---|
| `src/data/api.ts` | 读本地 `/data`，内存缓存；`locName()` 取本地化名 |
| `src/data/types.ts` | 数据类型 + 枚举映射常量（含 300 流明、职业 7 锋御） |
| `src/data/icons.ts` | 图标候选链 + 技能图标资产名映射（页面内技能键位用本地字形，见下） |
| `src/data/skillGlyphs.ts` | 技能键位本地 SVG 字形 + `renderSkillGlyph()`（零外部请求） |
| `src/components/HollowImage.vue` | 多候选图 + `position`/`ratio` 裁切 + 文字降级 |
| `src/components/SkillIcon.vue` | 详情页技能组头键位图标（v-html 渲染本地 SVG 字形） |
| `src/utils/rich.ts` | 富文本：`<IconMap>`→内联键位 SVG（未知键位回退 CDN）、`<color=#…>`→带色 span，其余 HTML 转义防注入 |
| `src/utils/text.ts` | `stripRichText`（纯文本剥标记） |

---

## 7. 运维命令

```bash
npm install             # 依赖（首次或变更后）
npm run data            # 拉取 hakushin raw → 规整 → 生成 public/data/（需外网）
                        #   有代理时：set NODE_USE_ENV_PROXY=1
npm run verify:icons    # 校验全部图标可达性，失败非零退出（可挂 CI）
npm run dev             # 开发 http://localhost:5173（占用自动换端口）
npm run build           # vue-tsc 类型检查 + vite 构建
npm run preview         # 预演产物
```

---

## 8. 已知缺口与失效信号（务必注意）

### 当前状态（2026-08，v2 实测）
- 名录 60 角色（**含 1581 蕾米埃尔 / 1611 克拉蕾 / 1621 洛克茜**，不含主角 2011/2021——与 hakushin 名录口径一致，前端零引用主角，无影响）／100 音擎 / 42 邦布 / 30 驱动盘。
- 1611/1621 的 icon 为空串（上文 §5）。
- **站方扩展域未消费**：`monster.json`(306) / `boss.json`(47) / `shiyu.json`(62) / `simul.json`(3) / `hard.json`(1) / `zh/item.json`(5771) 全部实测 200，做怪物图鉴/式舆/以骸卡牌页时可扩展（同源 schema 见各端点返回）。

### 失效信号
1. **名录/详情数量为 0** → 版本号变更或端点改名：先看 `.cache/hakushin-raw/manifest.json` 的 `latest` 是否仍可用（请求 `https://static.nanoka.cc/zzz/{latest}/character.json` 必须 200）。
2. **请求 404** → 站点 schema 变更（端点改名/移动），检查 `manifest.json` 的 `available` 列表与旧端点对比。
3. **图标全文字** → `verify:icons` 能看到哪个 CDN 挂；nanoka `/assets/zzz/` 是主兜底，若它也挂则所有图降文字。
4. **多语言名异常** → 名录 `en`/`ja`/`ko` 对极新角色可能是原始资源键（`zh` 不受影响）；若大面积如此说明站点本地化未完成。

### 不要做的事
- 不要把 hakushin raw 提为**运行时**数据源（§0 铁律：运行时零外部请求）；仅构建期拉取。
- 不要硬编码版本号 `3.2.3+18259966`——每次构建从 manifest 动态取 `latest`。
- 不要依赖 `static.nanoka.cc/zzz/UI/`（旧路径）——那是 404 残留，素材在 `/assets/zzz/`。
- 不要热链 honeyhunterworld 作为唯一来源（会 521 / 限速）。
- 不要假设名录 `icon` 永远非空（1611/1621 为空串，前端必须走兜底）。

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
**禁止圆角卡片堆叠、渐变霓虹、投影**。图标统一走 `HollowImage`（含兜底），skills 描述富文本走 `richDesc`。