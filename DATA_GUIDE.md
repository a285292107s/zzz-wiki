# 绳网档案 · 数据指南

> 数据面的单一事实源：来源、解析、产出契约、图标与媒体资产、运维命令、失效信号、视觉语言。
> 读者是改数据管线 / 图标资产 / 前端渲染的协作者（含 AI）。
> 相关文档：架构 [DESIGN.md](./DESIGN.md)、调用边界 [docs/architecture.md](./docs/architecture.md)、
> 图片展示技法 [IMG_GUIDE.md](./IMG_GUIDE.md)、品质门禁 [QUALITY.md](./QUALITY.md)、
> 数据契约 [docs/conventions/contracts.md](./docs/conventions/contracts.md)。
>
> 这是活文档：发现与代码、数据或源站不符（字段、路径、锚点、URL、命令失效），就地修正对应小节。

## 0. 概览

| 面 | 事实 |
|---|---|
| 构建期 | 从 hakushin raw 拉正式服列表与详情 → 规整 → 生成 `public/data/` 静态 JSON 并入库 |
| 运行时 | 前端只读本地 `/data`，数据面零外部请求、零 CORS |
| 图标 | 本地 `/data/img/` → nanoka CDN → 文字占位，缺图不破版 |
| 语言 | `zh` / `en` / `ja` / `ko` 四语各一套数据面（§1）；界面短文案另有站内文案表 |
| 合规 | 只展示正式服（live）；源站 latest 含前瞻/测试服内容，不拉取、不降级、不补位 |

历史：v1 主源是 Dimbreath ZenlessData（键名混淆、更新滞后），2026-08 起换为 hakushin raw 并重写解析层，
前端契约未变。旧源只留参考价值，见 §9。

## 1. 数据主源

| 项 | 值 |
|---|---|
| 源 | `https://static.nanoka.cc`（zzz.nanoka.cc / hakushin.in 的底层静态 CDN） |
| 版本清单 | `GET /manifest.json` → `zzz.live` 即正式服数据版本；**具体值以 `public/data/manifest.json` 为准，本文不写死**（源站另有 `zzz.latest`，含前瞻/测试服内容，本项目不消费） |
| 列表（单份，无语言段） | `/zzz/{ver}/character.json`、`weapon.json`、`bangboo.json`、`equipment.json`——名录只有单份（`/{lang}/character.json` 全 404）；以英文为底本，条目内嵌 `zh`/`en`/`ja`/`ko` 名字字段（驱动盘是 `{name,desc2,desc4}` 子对象） |
| 详情（带语言） | `/zzz/{ver}/{lang}/character/{id}.json`、`/weapon/{id}`、`/bangboo/{id}`、`/equipment/{id}` |
| 名词表 | `/zzz/{ver}/{lang}/noun.json`——术语词典（title/desc），构建期按语言全量下沉为 `live/{lang}/noun.json` |
| 语言 | 四语全取（见下「四语数据面」）；界面文案与两篇中文长文不进数据面 |
| 数据性质 | 与 Dimbreath 解包数据同源加工，但字段名可读、多语言内嵌、更新更快 |

**只取正式服（live）**

- `live` = 游戏在线版本。版本号与名录数量一律从 `manifest.json` 与名录文件读，本文不写死。
- 构建只落地 `public/data/live/`（目录名固定，不随版本号变）；**不产出 latest**。
- `live` 不在源站 `available` 列表时构建抛错；`sync` 失败则不提交，站点留在旧快照，拒绝用 latest 顶替。

**四语数据面**

- `live/{lang}/` = 名录 + 详情 + 名词表；根下只留 `manifest.json`。语言集单一事实源 `src/domain/langs.json`
  （`scripts/build/langs.mjs` 与它共用一份）。
- 名录按语言重建（用该语言详情注入本地化展示字段），故前端名录消费点字段形状不变、只有取数路径变。
- 界面短文案（导航/按钮/标题/标签/空错态/设置页）是站内自撰文案表 `src/domain/uiText.*.json`，不属于数据面；
  `/about`、`/formulas` 两篇中文长文不翻译。见 [决策记录 0010](./docs/decisions/0010-multilingual-game-content.md)
  与 [0011](./docs/decisions/0011-multilingual-ui-copy.md)。
- 语言切换入口在设置页，语言不进 URL（决策 0010）。

**端点现状**：`{lang}/item.json` 只在带语言路径存在；`monster`/`boss`/`shiyu`/`simul`/`hard` 站方亦有，
本项目未消费；`{lang}/noun.json` 已消费（→ `live/{lang}/noun.json`）。

## 2. 解析层

入口是 `scripts/build/index.ts` 的 `main()`，被 `pnpm run data`（本地）与 `pnpm run sync`（正式更新）共用
（`sync-data.ts` 内以 `buildAll` 为本地别名）。源站字段已是可读英文，**无键名反混淆**，解析层只做规整：

- **图标基名**（`basename()`）：`icon` 为完整资源路径（驱动盘/邦布）时取裸文件名（去目录与扩展名），与素材 CDN
  命名规则一致；角色/音擎 icon 本就是裸名。
- **名录 ID**：列表条目 ID 是对象 key（条目内无 id 字段）→ 注入大写 `Id`。
- **详情透传**：键名与 `src/data/types.ts` 几乎同构，只规整三处——`weapon_type`/`element_type`/`hit_type` 的值
  统一为英文（`{202:"Ice"}`，前端只解码 key、值文本不参与显示）；`camp` 保留该语言的源站文本；皮肤 `image`
  过 `SKIN_IMAGE_FALLBACK`（§5.10）。其余新字段原样透传（前端 index signature 兼容）。
- **特殊属性**：详情 `special_element_type.name`（如 星见雅→「烈霜」）同步注入该语言名录的 `special_element`；
  前端 `Tags` 展示属性时优先特殊名，无则退回当前语言的基础属性标签（四语取源站官方译名，站内只对中文保留
  「火/冰/电/风」短式）。
- **阵营细分**：源 `camp` 是粗粒度阵营，构建期按 `src/data/camp-supplement.json` 把已知角色细分到下属组织
  （15 角色 → 7 子阵营，码 18 起），由 `domains.ts` 的 `applyCampSupplement()` 注入。只覆写名录 `camp`/`camp_name`，
  详情 `camp` 保持源数据；上游原生提供细分后删对应条目即回归。**只对中文生效**：该表是中文策展，源站对细分阵营
  没有四语名——套到非中文会得到「英文条目混中文阵营名」，只借数字码再配粗粒度名又会让多个细分码同名（筛选下拉
  重复），故非中文走源站粗粒度阵营。
- **名词表**：`{lang}/noun.json` 全量下沉为 `live/{lang}/noun.json`；术语名规整为带括号风格（如 `[虚曜]`）注入
  该语言名录/详情；desc 经 `resolveTerms` 解析（`<Term:N>` 保留 ID 外壳，前端渲染为术语锚点）。**逐语言解析**：
  中文术语名不得出现在英文正文里。
- **抓取**：详情并发上限 8；磁盘缓存 `.cache/hakushin-raw/`（路径含版本号，同版本重复构建秒级跳过、跨版本自动
  全量刷新；`--force` 忽略缓存）。`manifest.json` 永不读缓存，每次实时拉取，保证版本探测不固着。
- **合规判定**：`scripts/build/live-target.ts` 的 `resolveLiveTarget()`（纯函数，有单测）；live 缺失 / `available`
  缺失 / live 不在 `available` 时直接抛错。

## 3. 产出契约

```
public/data/
  manifest.json          { zzz: { live, source }, generated }（与语言无关）
  live/{lang}/           zh / en / ja / ko 各一套完整数据面
    character.json weapon.json bangboo.json equipment.json noun.json
    character/{id}.json weapon/{id}.json bangboo/{id}.json equipment/{id}.json
  img/                   图标、hero、产品图、动画、壁纸（§5）
```

- 形状定义在 `src/domain/schema.ts`，前端只经 `src/data/api.ts` 读取。本文件只记读代码看不出的产出规则。
- `pnpm run data` 的 `resetOut` **只清理根 manifest 与 `live/`**，不触碰 `img/`——曾有整体删除 OUT 目录
  连坐清空图标的教训。
- `img/` 由 `download:icons` / `sync` 落地；`img/banner/` 的旧宣发海报已无引用，管线不会清除该目录。
- 首页「今日角色」：选角与取景参数在 `src/data/featured-pool.json`（`inPool` + 按画幅的取景参数，含可选 `flipH`），
  `useFeaturedAgents` 按**当天日期**确定性取 4 张（同日恒定、跨日换批，当天生日者排最前）。生日由详情
  `partner_info.birthday` 在构建期派生到 `src/data/featured-birthdays.json`；特殊形态缺生日按
  `src/data/birthday-supplement.json` 继承本体（如 星徽·比利 → 比利）。取景、画幅与档位见 IMG_GUIDE。
- 名录/详情数量随版本增长，**核对时直接数文件**；2026-10 实测值见 §8。

### 名录字段

> 随语言变化的只有：`camp_name`、`special_element`、音擎的 `base_property`/`rand_property`/`effect_name`/`effect_desc`。
> 其余字段（id、码、icon、数值）四语一致。前端名录阵营列优先显示 `camp_name`，无则退回 `C##` 代码。
> 构建期注入规则见 [contracts.md](./docs/conventions/contracts.md) §3，本节不重复。

- **CharacterListItem**：`Id, code, rank, type(职业int), element(属性int), special_element?(特殊属性名), hit(攻击int), camp, camp_name?, icon(裸文件名), potential, skin, desc, en, zh, ja, ko`
- **WEngineListItem**：`Id, icon, rank, type, atk(满级基础攻击力), sub(副属性英文名), desc, en, zh, ja, ko`；
  另有可选的 `base_property`/`rand_property`（展示子集：`name` + `value`(Lv.1) + `format`）与
  `effect_name`/`effect_desc`/`effect_refine`（音擎效果，通常 1 阶）。三者缺失时名录仍合法，卡片对应块不渲染；
  效果正文含 `<color=#…>` 富文本，展示层须经 `stripRichText`。
- **BangbooListItem**：`Id, icon, rank, codename, desc, en, zh, ja, ko`
- **DiskDriveListItem**：`Id, icon, en{name,desc2,desc4}, ko{…}, zh{…}, ja{…}`

### 详情字段

结构以 `schema.ts` 为准。构建期只做三件代码看不出来的事：

- 音擎详情注入 `atk_max`（Lv.60 满级主属性），名录 `atk` 取它，名录卡片按它插值出与详情同口径的满级面板。
- `potential_detail`（潜能影像／觉醒，6 档）的档位标记随语种：中/英/日是 ASCII `I–VI`，韩文是 CJK 兼容罗马数字
  `Ⅰ–Ⅵ`（U+2160–217F）。`buildPotentialCinema` 把 `no` 归一为 ASCII（展示仍用原文 `mark`），否则韩文页的档 I
  概述匹配不上技能门控（档 I 的 `name`/`desc` 源数据为空）。
- `potential_detail` 与核心技强化（`extra_level`）是两个系统，勿混用。

### 枚举映射

- **属性**：`200物理 201火 202冰 203电 204风 205以太 300流明`。300 为蕾米埃尔等新角色属性
  （ZenlessData `DamageElementConfigTemplateTb` 中 `300 = ElementType_Lumen`，标准元素）；烈霜等是 202 的变体
  （PFN=1），走 `special_element_type`。
- **职业**：`1强攻 2击破 3异常 4支援 5防护 6命破 7锋御（Armorer）`
- **阵营**：`1狡兔屋 2维多利亚家政 3白祇重工 4卡吕冬之子 5新艾利都防卫军 6对空洞特别行动部第六课 7新艾利都治安局
  8天琴座 9反舌鸟 10云岿山 11怪啖屋 12坎卜斯黑枝 13妄想天使 14未使用 15法厄同 16罗斯凯利法 17达识结社`；
  防卫军/治安局/罗斯凯利法在名录中细分为 18–24（§2），父级码保留作未来新角色兜底。
- **稀有度**：角色/邦布 `3=A 4=S`；音擎 `2=B 3=A 4=S`。
- **攻击类型**：`101斩 102击 103刺`

## 4. 端点 → 产出

| 端点 | 产出 |
|---|---|
| `/manifest.json` | 版本号、new 清单（latest 仅参考，不消费） |
| `/zzz/{ver}/character.json` / `/zzz/{ver}/{lang}/character/{id}.json` | 角色名录（四语名 + 该语言注入的 camp_name/special_element）/ 详情 |
| `/zzz/{ver}/weapon.json` / `/zzz/{ver}/{lang}/weapon/{id}.json` | 音擎名录（atk/sub/desc）/ 详情（主副属性、等级成长、精炼、突破材料） |
| `/zzz/{ver}/bangboo.json` / `/zzz/{ver}/{lang}/bangboo/{id}.json` | 邦布名录 / 详情（数值、晋升、技能 a/b/c） |
| `/zzz/{ver}/equipment.json` / `/zzz/{ver}/{lang}/equipment/{id}.json` | 驱动盘名录（四语套装名 + 2/4 件套）/ 详情（story、icon2） |
| `/zzz/{ver}/{lang}/noun.json` | 名词表（供详情页 TermTip 浮层） |

名录用单份（无语言段，见 §1）；详情才带语言。极新角色的 `en`/`ja`/`ko` 名可能是原始资源键，`zh` 正常。名录条目都带
这四个名字字段，前端按当前语言取，缺该语言回退其余语言（`utils/names.pickName`）。

## 5. 图标与媒体资产

### 5.1 候选链

`src/data/icons.ts` 的 `iconSources(item, category?, variant?)`（第二参＝类目；`'thumb'` 走名录小图）返回按优先级
排列的候选 URL，`<HollowImage>` 依次尝试，全部失败降为文字占位。

| 优先级 | 来源 | URL |
|---|---|---|
| ① | 本地图标 | `{BASE}/data/img/{category}/{basename}.webp` |
| ② | nanoka 素材 CDN | `https://static.nanoka.cc/assets/zzz/{basename}.webp` |

nanoka 命名 = 游戏资源路径的**裸文件名** + `.webp`：
`…/Packer/SuitWoodpeckerElectro.png` → `SuitWoodpeckerElectro.webp`。名录 `icon` 即裸名（如 `IconRoleGeneral01`）。

本地缺失才回源 CDN；**不得新增直连外部图源，也不得把兜底当主源**。例外：属性/职业/阵营/稀有度/特殊属性这类
**本地界面小图标**由 `src/domain/filterIcons.ts` 映射，消费方（`FilterDropdown` 的三组筛选项、`AgentHead` 封面的
身份图标）直接渲染本地 `iconUrl`，不经候选链、不发外部请求。

### 5.2 本地化与解包导入

- `pnpm run download:icons`：把运行时图标从 nanoka 下载到 `public/data/img/{category}/`；幂等，已存在跳过；
  `--soft` 缺口仅告警、`--dry` 只看差集。下载清单由**本地名录**推导，须在 `pnpm run data` / `pnpm run sync`
  之后跑，否则会静默少取。
- `node scripts/build/import-assets.mjs --dump <解包根>`：从解包重转全部光栅资产（头像/皮肤/音擎/邦布/驱动盘/界面
  小图标/键位图标/hero 头图/产品图/觉醒图）。参数：`--only=` 选类目、`--dry` 看差集、`--force` 重转、
  `--quality`/`--max-edge` 覆盖档位、`--max-diff` 同名异物阈值（默认 14，仅 filter/skill 校验）。
- 编码参数见 `scripts/build/to-webp.mjs`（沿用 PicList 参数：质量档、去 EXIF、保透明；`--trim-left` 按宽度比例裁
  左侧）。档位按用途：小图标 q95、皮肤 q88、产品图 q85。
- 已导入清单 `scripts/build/dump-import-manifest.json` 记「文件 → 解包源路径 + 源字节数 + 转换签名」；重跑跳过未
  变更项。解包换版本后重跑，只补差异；改 `RULES`/`TRIM_LEFT` 会给新条目换签名，只影响之后导入的条目。清单里的
  `rule` 字段缺省时按「已同步」放行——升级判据不该把整仓重编码一遍（已入库图标是老编码器产物，重转会改字节）。
- 导完补派生：`node scripts/build/icon-thumbs.mjs`（音擎/邦布小图）；导了产品图再跑
  `node scripts/build/product-art-cards.mjs`（列表档）。

### 5.3 界面小图标（属性 / 职业 / 阵营 / 稀有度 / 特殊属性）

- 解包文件名与站点资产名**不总是同名同图**（`IconAttack` 在解包里有 4 处不同美术、`IconPhysical` 没有同名文件），
  故在 `import-assets.mjs` 的 `SOURCE_OVERRIDES.filter` 里逐条写死，不靠裸名猜。
- 例：`IconPhysical ← IconBuff_Chaos`、`IconIce ← IconRamenType/IconIce`、`IconLumen ← IconBuff_Lumiflux`、
  职业 7 枚 ← `Role/IconClass/Packer/`、稀有度 3 枚 ← `IconRoleRarity/Packer/IconRole{S|A|B}Small`、
  特殊属性 3 枚 ← `IconGeneralBuff/Packer/Icon{Frost|AuricInk|HonedEdge}`（仅角色带 `special_element_type` 时启用，
  现覆盖 烈霜/玄墨/凛刃）。
- 资产清单单一事实源 `src/data/filter-assets.json`（构建期 `icon-inventory.mjs` 读同一份下载/导入）。当前属性 7/7、
  职业 7/7、稀有度 3/3、特殊属性 3/3、阵营 22 个码有图；16 号（罗斯凯利法父级）无图，名录已细分到 22–24。
  无专用图的码返回 `null`，前端用文字/SVG 占位。
- 其中一部分是**纯本地资产**（源站无此文件，`download:icons` 补不到、远程审计按「本地已兜住」降级告警）：
  `IconLumen`、`IconArmorer`、`IconRole{S|A|B}Small`、`Icon{Frost|AuricInk|HonedEdge}` 与 8 个阵营徽标
  （法厄同/达识结社/白银小队/刑侦特勤组/都市秩序部/外务筹策局/空域巡戍局/弗林特工坊）。清空 `img/` 或换机器后
  须从解包导入或从备份恢复（8 个阵营徽标不在解包里）。
- `skill`/`filter` 两类按基名可能撞不同美术（实测 `IconAttack` 与解包同名文件像素差 119/255），导入时做相似度
  校验，不合的跳过并打印，不盲替。

### 5.4 hero 头图

- `public/data/img/hero/Mindscape_{id}_2.webp`（2026-10 实测 63 张：62 角色 + 1551 双形态多一张；宽 1326–2580、
  高 834–1080）。同时供详情页 `AgentHead` 与首页「今日角色」。
- 前端本地优先 → nanoka CDN → `--bg-0` 底色；下载脚本遇缺仅告警，两级皆缺也不破版。
- **双形态**：1551 佩洛伊斯源站无裸名，按性别后缀分 `Mindscape_1551_Female_2` / `_Male_2`。单一事实源
  `src/data/hero-gender-variants.json`（`{ id: { variants, defaultFile } }`）：`heroVariantFile(id, form)` 取当前形态，
  `useHeroForm` 持状态并持久化到 localStorage。切换入口**只在设置页**，详情头图/首页卡面/名录卡片都跟随，不各摆
  切换钮；新增双形态只改这份 JSON（`variants` 按女/男顺序填，`defaultFile` 填女性）。
- 校准工具与 `useFeaturedAgents` 经 `heroImageFile(id)` 取默认（女性）版，故双形态角色也会出现在校准网格。
- **换图**：hero 母版从解包重转（贴边，无 CDN 的透明垫边），画布尺寸随之变化，9:16 取景必须在 `/calibrate` 重算
  到 `modes['9:16']`，其余画幅由它派生（见 IMG_GUIDE）。hero 丢文件用 `import-assets.mjs --only hero` 补，
  **不要**用 `download:icons`——那会落回 CDN 垫边版，校准又得重来。

### 5.5 潜能影像（觉醒）立绘

- `AvatarSpecialAwakenBg_{image}` → `public/data/img/awaken/`，q88、最长边 ≤1600；当前 11 张共 1.18MB
  （1596–2112×1080）。文件名后缀取自详情 `potential_detail[*].image`（如 `Nekomiya`），与解包同名，不手写映射；
  只有持有 `potential_detail` 的角色才有这张图——潜能影像是给老角色补强的系统，多数角色尚未实装。
- 该类**只能从解包导入**（nanoka 没有这个资产族）：清单条目带 `dumpOnly`，下载器不进队、远程审计不探测
  （否则每张都会记成「源站缺口」噪音）。本地缺失按**可容忍缺口**告警（新角色先有数据、解包资料后到时不该阻断
  部署），补跑 `import-assets.mjs --only awaken` 即可。
- 同目录还收三类界面件（同为 `dumpOnly`）：`AvatarSpecialAwakenBg_{image}Text`（角色拉丁名美术字，按 `image`
  逐角色）、`ASA_01–06`（档位序号牌）、`EF_BG`（展开面板暗纹），常量清单 `AWAKEN_CHROME`。它们是**必须项**
  （`optionalLocal: false`）：解包里有源，缺了就是导入没跑。
- `EF_BG` 导入时按 `TRIM_LEFT` 裁掉左侧 5.75%：原图那段是给游戏内「贴立绘融边」的透明渐隐，本站没有可融对象，
  整幅铺开会留一道暗竖条。这是转换期裁切，改比例要同步改那张表；裁切值不写进清单、也不由前端猜。
- 展示规则（4:5 逐图裁剪、铭牌/序号牌的用法）见 [IMG_GUIDE.md](./IMG_GUIDE.md) §6。

### 5.6 音擎与邦布产品图

**音擎产品图（详情 + 名录共用）**

- 解包 `Weapon_S_{id}_GachaEF.png` → `public/data/img/weapon-art/{code_name}_GachaEF.webp`，q85。源文件分散两处，
  靠 `import-assets.mjs` 的基名索引自动找到（新版本多在 `GaCha/UnPacker/GaChaPhase01/`，个别在 `ui/Sprite/`），
  **不要按目录硬编码**；历史别名（`Weapon_S_1401GachaEF` 等）按带下划线的规范名取。
- **只能从解包导入**（nanoka 对 `_GachaEF` 一族 404），且是必须项：清单 `src/data/weapon-art.json` 是一串
  `code_name`，前端 `src/data/weaponArt.ts` 与 `icon-inventory.mjs` 共读。换素材 = 导一张 + 登记一行，缺一不可
  （只有文件没登记 → 页面静默用回图标；只有登记没文件 → `verify:icons --local` 失败）。
- 覆盖 S 级 **42/49**。缺的 7 把不是漏导：`1021/1041/1101/1141/1181/1211` 解包只有图标与立绘，公共池
  `Weapon_S_Common_04` 本来就没有抽卡大图。清单外回落名录图标，**不做 404 探测**。
- 单独占 `weapon-art/` 而不并进 `weapon/`：后者会被 `icon-thumbs.mjs` 全量派生 38×38 小图，产品大图用不上、
  还会留下死文件。
- 列表档 `weapon-art/card/{同名}.webp`（≤800px / q72）由 `product-art-cards.mjs` 生成，`sync` 调用（单一写入者）：
  幂等补差、跟随原图、清孤儿、软失败。**规格是展示格的函数**——改栅格列宽/画幅/断点必须重算，否则又会糊。
  前端候选链 `weaponArtCardSources` = `card → 原图`；详情页仍取原图。名录行 `icon` 基名即 `code_name`
  （源站命名约定见 `src/domain/signatureEngine.ts`），不额外注入字段。

**音擎图标母版**

- `IconWeapon/UnPacker/Weapon_{rarity}_{id}.png`（350–400px）是存量图标族里最清晰的一份；`1631/1641` 与
  `A_Common_22` 在 `ui/Sprite/` 补，合计覆盖站点 **103/103**。**`ItemIconWeapon/UnPacker` 是 128–156 的物品栏小图，不要当母版**
  （同名字既有大图也有小图时，认目录而不是认文件名）。
- ⚠ `import-assets.mjs` 的基名索引**先走 `ui/Sprite`**，同名小版会抢先命中（`1581/1591` 已在
  `SOURCE_OVERRIDES.weapon` 指回母版）。再出现「小图同名占坑」照此加覆盖，**别改索引顺序**——那顺序是给
  「同一张图多档位」用的。
- 详情页策略固定：有产品图用产品图（5:4 宽幅），没有用图标母版（1:1 / 280px 框、不放大），候选链「产品图 → 图标」。

**邦布产品图（名录卡）**

- 解包 `BangbooGarageRole{NN}_GaChaEF.png` → `public/data/img/bangboo-art/{icon}_GaChaEF.webp`，q85。清单
  `src/data/bangboo-art.json` 存名录 `icon` 基名，前端 `src/data/bangbooArt.ts` 与 `icon-inventory.mjs` 共读，
  同样是 `dumpOnly` 必须项、只从解包导入。
- 覆盖恰好 S 级 **21/21**；A 级 21 把没有这一族素材（GaChaEF 只画抽卡产出的 S 级邦布），故名录卡必然两种态并存
  （有图 5:4，无图回落到同一个盒子里的图标）。列表档与音擎共用生成器，前端候选链 `bangbooArtCardSources`。

### 5.7 驱动盘套装动画

- 来源：米游社绳网情报站词条「基本信息」里的动画（animated WebP，300–480²、5–20MB、约 20fps、整盘转一轮
  15–30s）。源链接单一事实源 `src/data/disc-gifs.json`（键=`Id`，值 `{ contentId, url }`），前端 `discGif.ts` 与
  `icon-inventory.mjs` 共读；逐条直链留档 [docs/disc-gif-sources.md](./docs/disc-gif-sources.md)。
- **不直连**（单条可达 7.7MB，且运行时零外部请求）：`pnpm run download:disc-gifs`（`scripts/build/disc-gifs.mjs`）
  把原片缓存到 `.cache/disc-gifs/`，重编码为 `public/data/img/disc-gif/{Id}.webp`（**先保帧率**：目标 20fps / q58，
  超 1600KB 按 20fps/q50 → 15 → 12 → 10 → 8fps 逐档降，最长边 420）与 `poster/{Id}.webp`（取梯度最高帧、q80；
  个别套用 `POSTER_FRAME_OVERRIDES`）。当前 30 套动画约 34.6MB。
- **动画必须逐帧关键帧**，不能交给 libwebp 做帧间预测：慢速旋转攒到 200 帧后，平坦区（如白色内页）会漂成 8×8
  马赛克；这不是质量档不够（q90 照样复现）。故 `animated-webp.mjs` 逐帧编 still、自封装 RIFF/ANMF，体积与帧间版
  几乎相同。该模块另提供 `sampleFrames`（按目标 fps 在源时间轴均匀取帧，不是整除数跳帧）与 `downscale`，
  两个动画导入脚本共用。
- 详情页候选链「动画 → 静帧 → 名录图标」；由 `MotionFigure.vue` 渲染（**不带框**），右下角暂停/播放，
  `prefers-reduced-motion` 默认静帧；逐路由 `og:image` 改用静帧。
- 一次性本地导入，不挂 `build`/`build:ci`/`sync`；产物直接进 `public/`，dev 立刻可见。新增驱动盘 = 在
  `disc-gifs.json` 加一条 → 跑命令 → 提交 `public/data/img/disc-gif/**` 与 `scripts/build/disc-gifs-import.json`。
  未登记 Id 静默回落图标，不报错。调档参数在脚本顶部的 `ATTEMPTS` / `TARGET_BYTES`；`verify-icons --local` 把动画
  与静帧都记为必须项。

### 5.8 音擎装备动画

- 同样是绳网情报站，取音擎词条轮播的第二档「装备动画」（圆形转动的产品演示，480×471 上下、1.4–17.5MB、
  帧延时 10–90ms 不等、**背景透明**）。源链接 `src/data/wengine-gifs.json`（键=`Id`），前端 `wengineGif.ts` 与
  `icon-inventory.mjs` 共读；逐条直链留档 [docs/wengine-gif-sources.md](./docs/wengine-gif-sources.md)。
- `pnpm run download:wengine-gifs`（`scripts/build/wengine-gifs.mjs`，`--jobs=N` 并发）缓存到 `.cache/wengine-gifs/`，重编码为
  `public/data/img/wengine-gif/{Id}.webp`（目标 = 源帧率，超 1900KB 按 30 → 20 → 15 → 12 → 10 → 8 → 6fps 逐档降、
  q55，末两档 q50；最长边 **440**，在 280 CSS px 头图盒上仍是 DPR2 的 0.79×）与 `poster/{Id}.webp`。
  当前 102 台动画约 151.5MB。本地 103 台音擎里 `14163 禁罪囚笼` 在绳网情报站尚无词条、未登记。
- 编码器与驱动盘共用 `animated-webp.mjs`（逐帧关键帧）。一次性本地导入，不挂构建链；新增音擎 = 加一条 JSON →
  跑命令 → 提交产物与 `scripts/build/wengine-gifs-import.json`；未登记静默回落产品图/图标。
- 头图优先级 **动画 > 解包产品图 > 图标**；动画与图标是 1:1、产品图 5:4，有动画时右栏不再放宽。播放/暂停与
  减动效规则同驱动盘，共用 `MotionFigure`（**不带框**：透明底套 `HollowImage` 边框会凭空多出一个方框）。
- 分享卡片**不**用这套静帧：透明底 WebP 在多数平台的白底上会露白边，仍用名录图标。

### 5.9 技能键位图标与已知缺口

- 描述里的 `<IconMap:Icon_XXX>` 由 `src/utils/rich.ts` 的 `richDesc()` 渲染为 `<img>`，候选 URL 由
  `src/data/icons.ts` 的 `skillAssetSources()` 生成：本地 → nanoka CDN → 文字占位。
- 两端皆缺的资产清单在 `src/data/known-missing-assets.json`（当前 1 条：`Icon_SpecialReady_Ep`，影响克拉蕾技能描述
  3 处），前端与 `verify-icons.mjs` 共读：前端直接渲染文字键位（`.rich-keylabel`，如「EP」），不发请求、不留虚线
  空洞；门禁记为「已记录缺口」而非失败，仍逐条打印。
  新增条目必须写明依据（实测时间、探测过的 URL 与状态码、本地是否存在）——这是记录事实，不是「缺失就忽略」的抽屉。

### 5.10 皮肤立绘

- 落 `public/data/img/character/{IconRole*}.webp`——与名录头像同目录，因为详情页皮肤区按 `character` 类目取图
  （`img/skin/` 无人读取）。原生尺寸转 webp q88；`SKIN_LOCAL=0` 表示不本地化（缺失仅告警）。
- `scripts/build/normalize.ts` 的 `SKIN_IMAGE_FALLBACK` 把源站未上传的主角第 3 套皮肤（`IconRole34_03`/`IconRole33_03`）
  回退到默认立绘，杜绝死链字段。

### 5.11 兜底与禁令

- 候选链末级是文字占位（`<HollowImage>` 内置），任何缺图都不破版；live 名录 icon 基本无空缺（个别新角色可能为空串，
  前端必须走兜底）。
- honeyhunterworld 已从候选链移除（曾整体 521、仅角色图可用）；当前唯一 CDN 兜底是 nanoka，它挂了就全部降文字。
- 不要依赖 `static.nanoka.cc/zzz/UI/`（旧路径，404 残留）——素材在 `/assets/zzz/`。

## 6. 前端渲染关键文件

| 文件 | 职责 |
|---|---|
| `src/data/api.ts` | 读本地 `/data`、内存缓存；本地化名经 `utils/names.pickName()` |
| `src/data/types.ts` | 类型别名（由 `schema.ts` 的 `z.infer` 派生）+ 对外 import 面；枚举常量在 `src/domain/enums.ts` |
| `src/data/icons.ts` | 图标候选链 + 技能键位资产名映射 |
| `src/components/HollowImage.vue` | 多候选图 + `position`/`ratio` 裁切 + 文字降级 |
| `src/utils/rich.ts` | 富文本渲染（见下） |
| `src/data/terms.ts` | 术语词典：读 `live/{lang}/noun.json`；缺失时浮层安静隐藏 |
| `src/components/detail/TermTip.vue` | 术语悬停浮层：委托监听 `.rich-term`，展示 title/desc |
| `src/utils/text.ts` | `stripRichText`（纯文本剥标记） |

`rich.ts` 处理的标记：

- `<IconMap:Icon_XXX>` → 键位图标（本地优先；`data-cdn` 供 `main.ts` 全局 error 降级）
- `<color=#…>` → 带色 span
- `<Term:N>` → 术语锚点（供 TermTip）
- `{CAL:expr,scale,decimals}` → 按技能等级代入求值（调用方须传等级，否则剥离）。scale 语义按实机核实：小数式
  ×100 转百分比（如 月城柳 极性紊乱 满级 3200%）。
- `LAYOUT`、`{Skill:N,Prop:N}` 占位剥离；其余 HTML 转义防注入。

## 7. 运维命令

正式更新只走 `pnpm run sync`（GitHub Actions 每日触发；工作流随后重跑 `fonts:cjk`、`verify:data`、图标本地门禁、
字体覆盖门禁与生日表对账，全过才 commit + push 到默认分支 `master`，JSON 与图标同次提交锁步）。本地改数据按
`data` → `verify:data` →（可选）图标 → `pnpm test` → `pnpm run build`。

```bash
pnpm install
pnpm run data                 # 拉 live（四语详情较慢；同版本走 .cache 秒级跳过；代理设 NODE_USE_ENV_PROXY=1）
pnpm run data -- --check      # 仅版本探测：UPDATE_AVAILABLE / UP_TO_DATE
pnpm run data -- --force      # 忽略缓存全量重拉
pnpm run sync                 # 正式入口：探测 → 重建 JSON → 图标/派生图补差 → 门禁 → 汇总；失败非零退出且不提交
pnpm run sync -- --allow-probe-failure   # 仅排障：确认源站临时故障、本次沿用旧快照
pnpm run verify:data          # 数据契约：四语名录非空、名录 id ↔ 详情一一对应、extra_level 单调
pnpm run verify:icons         # 本地差集 + nanoka 远程审计；--local 仅本地（离线，build:ci 已挂）；网络异常以码 2 退出
pnpm run download:icons       # 图标本地化；--soft 缺口仅告警、--dry 只看差集
pnpm run download:disc-gifs   # 驱动盘动画 → img/disc-gif（一次性本地导入，不挂构建链）
pnpm run download:wengine-gifs # 音擎动画 → img/wengine-gif（同上，--jobs=N 并发）
node scripts/build/import-assets.mjs --dump <解包根>   # 解包重转；--only/--dry/--force/--quality/--max-diff
node scripts/build/icon-thumbs.mjs                     # 名录小图派生（导入图标后）
node scripts/build/product-art-cards.mjs               # 产品图列表档派生（导入产品图后）
node scripts/build/to-webp.mjs <src...> --out <dir>    # 单文件转 webp（--max-edge / --trim-left）
pnpm run download:fonts && pnpm run verify:fonts       # 西文自托管 + 存在性门禁
pnpm run download:fonts:cjk   # CJK 原始分片 → .cache/cjk-raw/（不入库；失败仅告警）
pnpm run subset:fonts:cjk     # 按站内字符集裁剪 → public/fonts/noto-serif-sc/ + CSS + 清单
pnpm run fonts:cjk            # 上两步串联（字符集变化后跑这个）
pnpm run verify:fonts:cjk     # CJK 分片完整性 + 字符集覆盖
pnpm run build:ci             # 部署入口（完整链路以 package.json 为准）：资产门禁 → 数据 → 类型 → 构建 → sitemap/路由 HTML/预算/缓存头
pnpm run sitemap              # 生成 dist/sitemap.xml；域名取 VITE_SITE_ORIGIN，部署环境缺该变量直接失败
pnpm run route-html           # 逐路由静态 HTML（build:ci 内紧随 sitemap）
pnpm run og:cards             # 62 张代理人社交卡 → public/og/agents/（需全局 playwright-cli，产物入库）
pnpm run verify:budget        # 体积预算 + sitemap origin 一致性 + 路由 HTML 数量
pnpm run verify:vercel        # 缓存策略与安全响应头不变量
pnpm run dev                  # http://localhost:5173
pnpm run build                # 类型检查 + 构建
pnpm run preview              # 预演产物
```

`route-html` 的产出契约：`og:image` 按类目选（角色=按 `featured-pool.json` 的 hero 校准（2.8:1）生成的社交卡 `og/agents/{id}.webp`，缺图回落 `hero/card` 派生图；音擎/邦布=thumb 图标、名录/静态页=站点社交卡片 `og-card.png`），
宽高由 sharp 读实际文件；Vercel 静态文件优先于 rewrites，故社交爬虫与搜索引擎拿到的是逐页元信息；生成器内置
自校验（任一页字段未替换即失败）。

## 8. 已知缺口与失效信号

### 现状（2026-10 实测）

| 项 | 值 |
|---|---|
| live 版本 | 读 `public/data/manifest.json` 的 `zzz.live`（不写死） |
| 名录 | 每语 62 角色 / 103 音擎 / 42 邦布 / 30 驱动盘；四语详情共 948 份 |
| 产品图 | 音擎 42/49 个 S 级；邦布 21/21 个 S 级 |
| 动画 | 驱动盘 30 套；音擎 102 台 |
| 头图 | hero 63 张（含 1551 双形态） |

- **名录不含主角 2011/2021**（与 hakushin 名录口径一致，前端零引用，不影响页面）。
- **伊埃斯（55098）不入邦布名录展示**：它是绳匠专属的 H.D.D. 搭档，非可获取收藏型号（源站名录即空 icon/占位 desc
  的桩数据）。由 `BangboosView` 的 `HIDDEN_BANGBOO_IDS` 前端策展，名录文件仍保留该条，详情页可经直接链接到达。
- **源站 latest 含前瞻/测试服内容**（如 live 未收录的新角色），按合规约定不产出、不展示。
- **站方扩展域未消费**：`{lang}/monster.json`、`boss.json`、`shiyu.json`、`simul.json`、`hard.json`、
  `{lang}/item.json` 均实测可用，做怪物图鉴/式舆/以骸卡牌页时再扩展（schema 同源）。

### 失效信号

1. **名录/详情数量为 0** → 版本号变更或端点改名：先看 `.cache/hakushin-raw/manifest.json` 的 `live`，再直接请求
   `https://static.nanoka.cc/zzz/{live}/character.json` 是否 200。
2. **请求 404** → schema 变更（端点改名/移动）：核对 `manifest.json` 的 `available` 列表与旧端点。
3. **图标全文字** → 先跑 `verify:icons --local` 看本地差集（运行时读本地，缺失才落 CDN）；nanoka 挂则全部降文字。
4. **多语言名异常** → 极新角色的 `en`/`ja`/`ko` 可能是原始资源键，`zh` 正常；前端按语言取、缺则回退，单语缺名
   不破版。另注意：**谚文没有自托管衬线字形**（Noto Serif SC 不含 한글），韩文正文按预期回退系统字体，不是缺字 bug。
5. **构建失败「live 不在可用列表」** → 合规拒绝降级 latest；源站下架/改名 live 时需人工确认。sync 失败不提交，
   部署只构建已提交快照，站点不挂。
6. **图标带源站水印**（如驱动盘 `SuitThornedRose` 的 DEMO 字样）→ 水印烙在 nanoka 源资产里，「零重下」幂等差集
   不会随上游替换自动更新。人工确认干净资产后覆盖对应本地文件（或删本地文件后重跑 `sync` 补差），勿整批重下。

### 不要做的事

- 不把 hakushin raw 提为**运行时**数据源（运行时零外部请求）；只在构建期拉取。
- 不硬编码版本号（从 manifest 的 `zzz.live` 取）。
- 不引入 latest（含前瞻/测试服内容）——合规红线：不拉取、不降级、不补位。
- 不依赖 `static.nanoka.cc/zzz/UI/`（404 残留），素材在 `/assets/zzz/`。
- 不重新引入 honeyhunterworld 作为 CDN 来源。
- 不假设名录 `icon` 永远非空。

## 9. 历史数据源：Dimbreath ZenlessData

v1 主源，v2 起弃用（更新滞后：曾缺 1611/1621 与职业 7；字段名随机混淆，需按锚点反混淆）。
保留两点参考价值：

- 仓库 `git.mero.moe/dimbreath/ZenlessData`（`FileCfg/*TemplateTb.json` + `TextMap/`）。
- `DamageElementConfigTemplateTb` 的 PFN 标志（1=烈霜、2=AuricEther、4=ZhenZhenAssault、0=标准）可佐证特殊属性
  归属——这是 §3 里 300/202 口径的来源。

## 10. 视觉语言

### 核心

「档案标本」：1px 细线框、2px 圆角、等宽编号、纸墨配色。列表/首页图标用 34–40px 细线框小图；
**禁止圆角卡片堆叠、渐变霓虹、投影**（浮层阴影 `--shadow-pop` 除外）。图标走 `HollowImage`，技能描述富文本走
`richDesc`。token 级精修（字体族、浮层阴影）的记录点是 `tokens.css` 与 `/style`（DESIGN §9），不在禁令之列。

### 布局容器术语

描述页面结构只用这四个词：

- **内容胶囊**：内容页（名录/详情/404）中间承载全部正文的容器 `<div class="wrap page">`（`.wrap.page`）。
  特征：版心宽 + 纸纹 `--paper-noise` + 抬升底色 `--bg-1` + 上下各一条发丝线收口。**边界**：不是「版心」
  （只管宽度、无面色无边线，站头/站尾也用），不是「主内容区」（`<main id="main">`，还含返回链接、区块索引、
  翻页），也不是「标本板」——那个词专指首页「今日角色」的 2.36:1 陈列框（`FeaturedDeck`，共享元素飞行的起飞端）。
- **版心**：`--wrap-max` 的宽度约束（`clamp(1120px, 78vw, 1760px)`）；详情页改由
  `--page-content-max: 1120px` 收口。只有宽度语义。
- **主内容区**：`<main id="main">`，胶囊的**外层**。
- **区块**：`DetailSection` 渲染的编号小节（01 档案详情、02 角色介绍…），是胶囊的**内件**。

### 区块分隔与区块头

**常态边界不画线**：相邻区块之间只有留白 + 编号 + 标题层级。纵向节奏分三档（`tokens.css`）：

| 档 | 令牌 | 用在哪 |
|---|---|---|
| 收紧 | `--space-section-tight`（`--space-section × 0.8`） | 详情页页头（`AgentHead` / `DetailHead`）的下边距，即页头之后的首块 |
| 常规 | `--space-section`（`--pad-section × 1.3`） | 相邻区块的默认边界 |
| 放宽 | `--space-section-loose`（`--space-section × 1.4`） | 断层边界（`.block.seam`） |

- 相邻块的间距由**上一块的 `margin-bottom`** 给出；断层块另加 `margin-top`，两者折叠取**较大者**，
  故 `.block.seam` 的 `margin-top` 写的是**最终间距本身**——写差值会被折叠吃掉，间距退回常规档。
  首块（`.block:first-of-type`）的上边距固定为 0，间距由页头自己的下边距决定。
- **换册处（断层）只画一条齐版心细线，不画装饰件**：`.block.seam .section-head` 取 `border-top: var(--rule)`
  ＋ `padding-top: clamp(20px, 2vw, 28px)`，线落在区块头自己的上缘——读作「新一册的起边」，
  与内容胶囊边线、页头下缘线同一条发丝线口径。首块恰好是断层时不再叠第二条线。
  落点：详情页「文字档案 → 数据」（`stats`）与「玩法 → 藏品」（`skins`），音擎「背景故事 → 参数」（`props`），
  关于页「管线 → 交互」（`shortcuts`）与「站点 → 法务」（`rights`）。**单页 ≤2 处，且只用于 ≥3 个区块的页面**
  （降频判据见 [0024](./docs/decisions/0024-section-seam-frequency.md)）。
- **区块头 = 编号 + 名称 + 分类码**，三件落在同一条视觉中线上：
  - `.no`：等宽琥珀 13px（`--fs-small`）+ `align-self: center`；12px 时它会读作标题的下标；
  - `h2`：宋体 500、`--fs-section`（`clamp(26px, 2.6vw, 36px)`，桌面上限 36）——标题自己承担「新区块开始」
    的信号，与正文 15px 构成 2.4 倍层级；
  - `.en`：右端英文注记，等宽 10px、字距 0.22em、`--ink-2`，`align-self: center` 与编号同一根视觉中线，
    靠 `margin-left: auto` 与标题两端对齐。**不画连接用的点线**：标题放大后两端对齐自身成立，
    36px 标题旁的点线会读成目录行。点线 / 虚线 / 实线的语义分工（引导 / 缺失 / 结构）不变，见
    [0019](./docs/decisions/0019-title-leader-dotted.md)。
- ≤400px 时标题不比桌面缩得更多（clamp 下限 26px），日文长标题（「キャラクター紹介」8 字）到 320 档会把
  英文注记挤出容器：`.section-head` 在该断点允许换行，放不下时注记整件落到第二行、仍贴右；
  标题不缩字号、不裁字（`scripts/probes/i18n-geometry.js` 四语 × 320/360/389/390 零溢出）。
- 边界靠三样东西成立、缺一不可：留白（@1440 常规 112px / 换册 157px）、字号层级（36 vs 15）、编号（与左侧索引同源）。
- 高对比度模式：换册细线由系统强制色接管（边框自动换 `CanvasText`），不另写覆写；打印态换 `--line-2`
  （纸上细线要略深于屏幕）。
- 审计：`composition-audit` 的 `headRule` 判「非 seam 头部无上边线；seam 头部必须有 1px solid 上边线；
  头部内不得有 `.leader` / `.section-mark`；h2 ≥25px；单页 seam ≤2」，且
  **整轮一个 `.seam` 都没扫到也判失败**——判据不许靠「找不到就通过」空转。


### 详情页阅读宽度

详情页内容胶囊在 `DetailPage` 内收口到 `--page-content-max: 1120px`（名录页仍用 `--wrap-max` 的
1760px 满版心）。`.wrap.page` 的 `max-width` 与左侧区块导航的 `left` **都读这个变量**，两者必须继续同源：
胶囊一旦退回满版心，侧栏就会落进胶囊的纸纹里。

技能区块两栏固定为 480px 说明 + 弹性间隔 + 300px 账本贴胶囊右缘（间隔实测约 170px，
账本右缘与分割线右端差 4px 行内边距）。账本**不要**放宽回 420px（中间留白被挤掉、行内跨度回到 420px），
也**不要**改成左排紧凑（实测 374px 观感过挤）——两种都试过、均已否。

### 墨色分层（契约）

`--ink-2` 及更亮承载信息（对 bg-0/bg-1 ≥4.5:1，AA）；`--ink-3` 是**装饰层**（不承载信息、不要求 AA），只能用于
纯序号、分隔符、占位字形，且应 `aria-hidden`。`pnpm run audit` 里的 `color-audit` 会按元素实测并报出违规用法。

### 等距地图（`/architecture`）

站内唯一的立体图装置：一张可拖拽缩放的**分层地图**（`src/views/ArchitectureView.vue` +
`components/iso/AtlasMap.vue` + `src/utils/isoAtlas.ts`），数据（层、模块、连线）在 `src/domain/atlas.ts`。
四条判据：

- **尺寸是量出来的，不是排出来的**：台子长度看这一层的代码体量，房子的占地看这一组的体量档（四档），
  楼层数看它接进来的连线数。所以「核心」最长（三列并排）、「入口与壳」最短；「界面文案表」最窄却和
  路由表一样高。不要为了排满而把房子改成等大——那正是这张图要避免的读法。体量用**四档**而不是行数，
  是因为行数每次提交都在漂。
- **拟物只做到「一眼认得出是房子」为止**：每栋房子有屋顶面、四面山墙的明暗分档、等距的楼层窗带、
  底部基座与屋顶女儿墙，占地够宽的那几栋再叠一层退台的塔冠。**不画投影、不加渐变、不做光照、
  不画窗格细节之外的任何东西**——立体感全部由「同一中性色的几档明度 + 1px 描边」给出来。
  楼层线是几何的一部分，所以留在 SVG 里（它们本来就该跟着投影一起变形）。
- **这张图是一个舞台，不是一张插图**：整片场景上方压着琥珀色的环境光，
  每栋房子受光的一侧有一道自上而下的白色渐变——这三样都是**投影里的光**，不是界面的装饰。它们允许出现，
  是因为它们只存在于这个三维空间内部；离开舞台（面板、列表、正文）一律回到零投影的纸面规则。
  选中时房子会「亮起来」：楼层窗带点亮成琥珀、脚下一圈脉冲光环、一条铅垂线吊起引线；全图其余部分降为底噪。
- **楼与层的分工要能一眼读出来**：宅地宽 = 体量档，楼层数 = 依赖线条数，台基长度 = 该层总容量，台基高低 = 层的顺序。
  四件事分别由四样东西承担，读者不需要背图例。
- **zoom 是镜头，不是缩放**：< 55% 只看街区轮廓（无英文、无楼层窗带），55–90% 出英文与层名英文，
  ≥ 90% 出模块两位编号并点亮楼层窗带。细节按缩放分层出现，别一次性全画上（85% 的初始视图会糊成噪点）。
- **先给路径，再给细节**：图上方有三条「跟随一条路」（打开一个详情页 / 在名录里筛一下 / 半夜自动更新），
  选中一条就把这条链按 1→N 编号点亮、镜头自动框到链的范围内、其余降为底噪。
  **这是给第一次打开这一页的人唯一的入口**——三十四个模块一次性摊开时，没有人会从「读图例」开始；
  但「点开一个角色时发生了什么」是所有读者都有的具体经验。新增 journey 必须保证链上相邻两点在图里**真有连线**，
  否则编号会停在一条不存在的路上——`tests/iso-atlas.test.ts` 有一条单测守这条不变量。
- **镜头会自己动，但只在两处**：切 journey 时框到那条链；取消时回到全图。「适应」始终可手动回到全图。
  除此之外不要加自动镜头——每一次自作聪明的平移都会让读者的空间记忆失效。
- **台子只靠面色分档**：台子顶面 / 正面 / 侧面各取一档中性面色加 1px 描边，**不画投影、不加渐变、
  不做光照**。每层台子前沿留一条**刻字带**（比台面深一档）放房子名，每个房子配一条
  极淡的引线回指屋基。**层名是一面插在台子上的旗**：杆基落在台面左端的刻字带上（就是原来刻层名的那一条），
  杆高 62 单位，旗面挂在杆顶下方、朝左飞（左端是燕尾缺口、右缘贴着杆），杆顶有尖顶，杆脚压一枚**等距小旗座**。
  层名比房子名高一级，塞进台面里会把整条楼梯读糊；做成旗之后它自己就是一条与楼梯同向的斜轴，
  既指出这一层从哪开始，又完全不压任何一栋房子——而且"插旗标定领地"这件事本身就在说"这一层是它管的"。
  旗座不是装饰：只有一个小圆点时，读者在初始缩放里找不到杆脚落在哪块台子上。要表达「不属本站」时用线框无填充。
- **地面是一块地板，不是一片虚空**：最低一层台子的底面以下铺一整块等距地板，轮廓跟着台子的阶梯走
  （每层只比自己的台子宽 8 单位，层与层之间的缺口按 ±12 单位对上），所以它既不会在台子旁边戳出多余的大三角，
  也不会露出一条莫名其妙的边。地板不画网格、不画投影：靠一道由后向前变亮的线性光、**前沿一道 12 单位厚的基座立面**、
  以及立面上沿那条压了三成琥珀的「台口线」交代它是一块板——立面与台子的立面同族但更暗，否则读者会把它当成第七级台子。
  **它进包围盒**——`fit` 按宽度收敛，为地面多留的每 10 单位都要从初始缩放里扣，边距开到「看得出是一块面」就停。
- **连线画成架空线，方向藏在动里**：每条线从楼顶中心**竖直起飞**、跨一道拱、再竖直落回另一座楼的楼顶中心
  （三次贝塞尔的两个控制点就压在两端正上方），所以拱顶永远高于两端的屋顶，小跨度上也不会戳出尖顶。
  静止时线只交代「哪里连着哪里」：装配是细实线、读取本地是唯一的琥珀实线、站外取源更淡、构建产出更粗，
  与图例的颜色 + 粗细同一口径——**不要改用虚线区分类别**，虚线在站内属缺失语义。
  悬停或选中一座楼时，挂在它身上的线亮起来，光珠从起点跑向终点，落点先亮一枚朝下的小箭头、再点一枚细环：
  于是「它调用谁」与「谁调用它」不看文字就分得开，静止的截图里箭头也仍指着下游。
  箭头只画在点亮的几条上——五十五条全带箭头，静止时就成了一片噪点。
  **点亮的线浮到所有房子之上**：静止时线留在房子下层，被挡住的段落自然被房子切掉（那就是等距遮蔽）；
  可一旦点中一座楼，它身上的线就整根搬到最上层、不再被任何房子挡住——关系被切断就失去意义，
  遮挡的优先级在「点亮」这一态里让位给可读性。层间切换用同一个状态联动，点亮的线在底层设为全透明，
  只在上层画一遍，避免重影；上层两个分组必须关掉指针命中（透明不改变命中测试，上层的线正好压在屋顶中心，
  会抢走房子的悬停并造成闪烁）。
- **文字一律直立、且不进 SVG**：SVG 只画几何（`aria-hidden`），所有字都是 HTML 覆盖层，按算好的
  世界坐标绝对定位。SVG 里的 `<text>` 一个都不要有：不可复制、不可聚焦、字号随视口失控，读屏也读不到。
- **窄屏换装置，不缩图**：<1024px 不挂地图，换成竖列清单（层头可折叠 + 内联详情）。地图挂
  `touch-action: none`，手机上会把整页滚动一起吃掉——所以窄屏不是「缩一缩」，是「换一个」。
  标签避让按世界坐标估盒（`zh.length * 12 + 8` × 17），改字号必须同时改这两个数字，否则标签会悄悄叠在一起。

为什么不用流程图 / 3D 库 / CSS 3D，以及「为什么核心那一层画成三列而不是三级」，见
[决策记录 0027](./docs/decisions/0027-architecture-page-as-zoomable-atlas.md)（它取代了 0025 / 0026）。

### 字体

- 西文（JetBrains Mono / Public Sans）自托管到 `public/fonts/`，经 `@font-face` 引用、运行时零外网；刷新用
  `download:fonts`，`verify:fonts` 门禁（build:ci 已挂）。
- CJK 衬线 Noto Serif SC **500 单档**，按站点字符集裁剪后自托管到 `public/fonts/noto-serif-sc/`：
  `download:fonts:cjk` 把 Google 官方分片拉到 `.cache/cjk-raw/`（不入库），`subset:fonts:cjk` 用
  `scripts/build/charset.mjs` 采集的字符集逐片裁剪，产物才进 `public/`（内容寻址命名）。生成物
  `noto-serif-sc.css` 勿手改；`verify:fonts:cjk` 守完整性 + **字符集覆盖**（字体能提供的字符必须全部已声明，
  缺一即字形混排）。官方分片按编码区切、单片 20–80KB，故产物按 `CJK_TARGET_KB`（默认 5）细分；Google 现行分片是
  **静态实例（无 fvar 轴）——不要钉可变轴**（harfbuzz 会报 axis 不存在）。字体对首屏 LCP 的制约见
  [QUALITY.md](./QUALITY.md) §1。
- 字符集采集面四项：`public/data/**.json`、`index.html`（剔注释）、`src/**.{ts,vue}`（剔注释）、
  `src/**.json`（界面文案表）；单一事实源是 `charset.mjs` 的 `collectCharset()`。**语言或文案一变就必须重跑
  `pnpm run fonts:cjk` 并提交新清单**，否则新字静默回退系统字体。当前字符集规模以
  `scripts/build/cjk-fonts-manifest.json` 的 `charsetSize` 为准，本文不抄数值。
- 韩文（한글）不在 Noto Serif SC 字形集内，按既有规则回退系统字体（`verify:fonts:cjk` 的「字体本就不含」那一路，
  不是裁剪缺口）。
- ⚠ 分片内部名会误导诊断：CSS 交付的 family 内部名固定为 `Noto Serif SC ExtraLight…`，CDP
  `CSS.getPlatformFontsForNode` 报的就是它，**不代表实际字重**（现行片 OS/2 usWeightClass=500）。判据与复跑
  脚本 `scripts/audits/font-weight-calibration.js`。

### 触屏交互

- **按压反馈**：`:active { filter: brightness(0.82) }`——**不用 opacity**（`.reveal` 的显现动画占用 opacity，
  叠加会互相打断）；不做 `@media (hover: none)` 分支，桌面点按同样应答，交互语义统一且可自动化验证。
- **关闭默认点按高亮**（`-webkit-tap-highlight-color: transparent`）——前提是上一条自绘反馈已就位，否则触屏失去
  全部点按反馈。
- `text-size-adjust: 100%`：关掉 iOS 横屏的文字自动放大（会打破既定排版比例）。
- 横向滚动容器（`.sn-list` 等）加 `overscroll-behavior-x: contain`：滑到两端不触发浏览器「后退」手势。
- **「还能横滑」如何表达**：`.sn-list` 才是滚动容器（两端 `mask-image` 淡出），`.sn-scroll-btn` 是它的兄弟、
  绝对定位压在右端尾窗上。按钮留在轨道外是必要的：留在轨道内就得 sticky + 让位，会挤走可用宽度并压住条目文字。
  蒙版分「斜坡 + 全透明尾窗」两段，尾窗宽度须 ≥ 按钮宽度，否则文字压在雪佛龙上（`section-nav.js` 审这一条）。
  两侧都只在确实还有内容时出现（`.at-start` / `.at-end`）。
