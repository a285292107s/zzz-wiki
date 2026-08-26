# 绝区零 (ZZZ) 数据 API 研究报告 — hakush.in / nanoka.cc / hakushin-py

> ⚠️ **本站数据管线已于 2026-08 再切换（v2）**：构建期从 **hakushin raw**（`static.nanoka.cc/zzz/…`，即本报告研究的 nanoka 家族契约）拉取
> **正式服（live）**数据 → 规整 → 生成静态 JSON（`scripts/build-data.ts` → `public/data/`），运行时零外部请求；
> 仅 live 单版本（2026-08 合规约定，`zzz.latest` 含前瞻/测试服内容不消费），入口/表结构与失效信号见 [`DATA_GUIDE.md`](./DATA_GUIDE.md)。
> 本文档保留主要作**端点契约研究参考**（v1 曾采用 Dimbreath ZenlessData 反混淆管线，已弃用；当时结论与 v2 同源，字段名以 v2 实测为准）。

> 研究时间：2026-08（以"当下"为准）；所有端点均在本机沙箱内通过代理 **实测验证**（HTTP 200 + 响应头/JSON 字段实抓），非仅凭文档转述。
> 核心结论先行：**hakush.in 已死（DNS NXDOMAIN），现役数据源是迁移后的 nanoka.cc 家族（`static.nanoka.cc` 提供 JSON，`zzz.nanoka.cc` 提供网页），CORS 全开（`access-control-allow-origin: *`），Vue 站点可浏览器直接 fetch，无需代理。**

---

## 0. 一图流：域名现状（实测）

| 域名 | 状态 | 说明 |
|---|---|---|
| `hakush.in` / `api.hakush.in` | ❌ **NXDOMAIN（域名已不存在）** | 实测 `nslookup`/`getaddrinfo` 均报 Non-existent domain |
| `static.nanoka.cc` | ✅ 200 | **现役数据 JSON CDN**（CORS `*`） |
| `zzz.nanoka.cc` | ✅ 200 | 现役 ZZZ 网页站（SvelteKit SSR；`gi/hsr/zzz/ww/nte.nanoka.cc` 为各游戏子域） |
| `nankoa.cc` | ❌ TLS 握手失败 | README 中写的是 "nankoa.cc"（疑似拼写），代码与 DNS 实际用 `nanoka.cc` |
| `hakushin-py` 源码 | ✅ | BASE_URL 已更新为 `https://static.nanoka.cc`（2026-03-09 更新） |

引用：[hakushin-py README（含 "revived version ... under nankoa.cc" 声明）](https://raw.githubusercontent.com/seriaati/hakushin-py/main/README.md)、[hakushin-py GitHub](https://github.com/seriaati/hakushin-py)、[PyPI 页面](https://pypi.org/project/hakushin-py/)

---

## 1. 端点清单（现役，全部实测 200）

`BASE = https://static.nanoka.cc`；`{version}` 从 manifest 取 `zzz.live`（当前实测值 `3.1`——本项目合规只取**正式服**版本，见 DATA_GUIDE §1；`zzz.latest` 如 `3.2.4+…` 含前瞻/测试服内容，不消费）；`{lang} ∈ en | zh | ko | ja`。

| # | 端点 | 用途 | 实测状态/规模 |
|---|---|---|---|
| 0 | `GET {BASE}/manifest.json` | 各游戏版本清单 + 新内容 id 列表 | ✅ 200；zzz.latest/live/available + `new:{character,bangboo,weapon,equipment,monster,item}` |
| 1 | `GET {BASE}/zzz/{version}/character.json` | 角色列表（id→ 对象 map） | ✅ 200，60 名（含主角 2011/2021） |
| 2 | `GET {BASE}/zzz/{version}/weapon.json` | 音擎/武器列表 | ✅ 200，100 件 |
| 3 | `GET {BASE}/zzz/{version}/bangboo.json` | 邦布列表 | ✅ 200，42 只 |
| 4 | `GET {BASE}/zzz/{version}/equipment.json` | 驱动盘（套装）列表 | ✅ 200，30 套 |
| 5 | `GET {BASE}/zzz/{version}/monster.json` | **敌人/怪物列表** | ✅ 200，306 个 |
| 6 | `GET {BASE}/zzz/{version}/boss.json` | 危局强袭战 boss 轮换（含 live_begin/end） | ✅ 200，47 条 |
| 7 | `GET {BASE}/zzz/{version}/{lang}/item.json` | 材料/道具（5771 项，体积 ~1.1MB，按语言） | ✅ 200 |
| 8 | `GET {BASE}/zzz/{version}/{lang}/noun.json` | 名词/技能术语表（68 条） | ✅ 200 |
| 9 | `GET {BASE}/zzz/{version}/{lang}/character/{id}.json` | 角色详情（技能/星魂/突破/资料） | ✅ 200（1041 示例） |
| 10 | `GET {BASE}/zzz/{version}/{lang}/weapon/{id}.json` | 音擎详情 | ✅ 200（13001 示例） |
| 11 | `GET {BASE}/zzz/{version}/{lang}/equipment/{id}.json` | 驱动盘详情 | ✅ 200（31000 示例） |
| 12 | `GET {BASE}/zzz/{version}/{lang}/bangboo/{id}.json` | 邦布详情（id 形如 53001） | 按客户端逻辑存在（用列表内 id 请求） |

- 条目 id 规律（实测）：角色 `1011/1041/2011/2021`；武器 `12001/13001/…`；邦布 `53001…`；驱动盘 `31000/31100…`；怪物 `10001/100001…`；道具 `1/462/100217/4120xxxxx`。
- 旧版（历史，勿用）：`https://api.hakush.in/zzz/data/character.json`、`/zzz/data/weapon.json`、`/zzz/data/bangboo.json`、`/zzz/new.json` —— 源自仍在生产使用的 [zzz-signal-search-export/getIdMap.py](https://git.loliquq.cn/earthjasonlin/zzz-signal-search-export/raw/commit/6b84fe8670ea23704c7a033e381f68db11438e88/tools/getIdMap.py)。域名已死，仅供对照旧字段（当时即 `CHS/EN/JA/KO/rank`）。
- 新主机上旧路径（`/zzz/character.json`、`/zzz/data/character.json`）实测 **404** —— 路由已变。

---

## 2. JSON 结构（原始字段，实测抓取）

### 2.1 角色列表项（character.json，id 1011 Anby 原始样本）
```json
{
  "code": "Anby",            // 代号
  "rank": 3,                 // int 稀有度: 3=A, 4=S（列表不含 B）
  "type": 2,                 // int 职业: 1=强攻Attack 2=击破Stun 3=异常Anomaly 4=支援Support 5=防护Defense 6=?Rupture
  "element": 203,            // int 属性: 200=物理 201=火 202=冰 203=电 204=风 205=以太
  "hit": 101,                // int 攻击类型: 101=斩击 102=打击 103=穿刺
  "camp": 1,                 // int 阵营 id
  "icon": "IconRole01",      // 图标（裸文件名）
  "potential": [],           // 影画潜能 id 列表
  "en": "Anby", "ko": "앤비", "zh": "安比", "ja": "アンビ",   // 四语言名
  "skin": {"3110110": {"name": "Anby: Street Streak", "desc": "...", "obtain_desc": "", "image": "IconRole01"}},
  "desc": "Anby, the original member of Gentle House.\n..."
}
```
注意：**玄学字段名** —— 列表用的是 `type`（职业）、`element`、`hit`；详情里换成了 `weapon_type`、`element_type`、`hit_type`（且为 `{"id":"名称"}` 单键 map，如 `{"201":"Fire"}`、`{"5":"New Eridu Defense Force"}`）。

### 2.2 角色详情（character/{id}.json，1041 = 11号）
顶层键（实测 26 个）：`id, icon, name, code_name, rarity(3|4 int), weapon_type, element_type, special_element_type, hit_type, camp, gender(1=男/2=女), partner_info, skin, stats, level, extra_level, level_exp, skill, skill_priority, skill_list, passive, talent, fairy_recommend, strategy, potential, potential_detail`

- `stats`：`{armor, armor_growth, attack, attack_growth, break_stun, crit, crit_damage, crit_res, crit_dmg_res, defence, defence_growth, ...}`（基础值 + `_growth` 成长对）
- `level` / `extra_level`：按 "1".."6" 的突破阶段对象（含 `hp_max/attack/defence/level_max/level_min/materials/extra`）
- `skill`：`{basic, dodge, special, chain, assist}`，每个 `{description:[{name,desc,potential}], material:{等级:{材料id:数量}}}`
- `passive`：`{level:{...}, materials:{...}}`；`talent`（星魂）："1".."6"
- `partner_info`：`{birthday, full_name, gender, icon_path, inter_knot_icon, impression_f, impression_m, impressions, profile_desc, role_icon, stature, unlock_condition, trust_lv}`
- ⚠️ **技能文本含富文本标记**：`<color=#FFFFFF>Fire DMG</color>`、`<IconMap:Icon_Normal>` —— wiki 渲染时必须剥离/替换成 `<span>`/图标。

### 2.3 音擎（weapon.json，12001 原始样本）
```json
{"icon":"Weapon_B_Common_01","rank":2,"type":1,"en":"[Lunar] Pleniluna","atk":475,
 "desc":"A W-Engine that prioritizes damage output...","sub":"ATK","ko":"...","zh":"「月相」-望","ja":"..."}
```
详情键：`id, code_name, name, desc, desc2, desc3, rarity, icon, weapon_type{type,name}, base_property{name,name2,format,value}, rand_property, level, stars, materials, talents{"1".."5":{name,desc}}`；稀有度 int：2=B, 3=A, 4=S。

### 2.4 邦布 / 驱动盘 / 道具 / 敌人
- 邦布：`{icon:"UI/Sprite/.../BangbooGarageRole12.png", rank, codename, en/ko/zh/ja, desc}`；详情含 `stats/level/skill{a,b,c}`
- 驱动盘：`{icon, en:{name,desc2,desc4}, ko:{...}, zh:{...}, ja:{...}}`（desc2=2 件套、desc4=4 件套效果）；详情另有 `story, icon2`
- 道具：`{icon, rank(0-5), class, name}`（`/zzz/{v}/{lang}/item.json`，5771 项）
- 敌人：`{icon:"UI/Sprite/.../Monster_ClaymoreGrey.png", tag, tag2, rarity, group, en/ko/zh/ja, desc}`

**字段速查（int→语义映射，来自 hakushin-py enums.py 源码）：** 职业 `1强攻 2击破 3异常 4支援 5防护 6裂伤`；属性 `200物理 201火 202冰 203电 204风 205以太`；攻击类型 `101斩 102击 103刺`；语言键 `en/zh/ko/ja` 恒为四个。

---

## 3. CORS 结论（实测，确凿）

对 `static.nanoka.cc` 的**每一个** JSON 响应（manifest、列表、详情、404/500 页都是）都带：
```
access-control-allow-origin: *
access-control-allow-headers: *      (manifest 上实测)
```
- 由 CDN 源站直接下发（非代理注入），且 **zzz.nanoka.cc 自己的前端就是浏览器直接 fetch 这些 URL**（页面内 `data-sveltekit-fetched data-url="https://static.nanoka.cc/zzz/3.2.1+17934514/character.json"` 可证）。
- ✅ **结论：Vue/TS 浏览器端可直接 `fetch`，不需要任何代理**；连 404 都有 ACAO `*`，前端可正常读状态码。
- 镜像站（若用）需自行验证 CORS；GitHub raw 同样放行 `*`。

---

## 4. hakushin-py 模型清单（源码逐文件核实，`hakushin/models/zzz/`）

| 模型 | 文件 | 关键字段（Pydantic） |
|---|---|---|
| `Character` / `CharacterDetail` | character.py | 列表：`id, code, rank(S/A), type(职业), element(属性), hit, icon, desc, names{en,ko,zh,ja}, skins`；详情：`stats, level, extra_level, skill, passive, talent(星魂), partner_info, potential_detail` 等 26 键 |
| `Weapon` / `WeaponDetail` | weapon.py | `id, names, specialty(type), rarity(S/A/B)`；详情：`code_name, desc/desc2/desc3, weapon_type, base_property, rand_property, level, stars, materials, talents(精炼)` |
| `Bangboo` / `BangbooDetail` | bangboo.py | `id, icon, rank, codename, names`；详情：`stats, level(突破), skill{a,b,c}` |
| `DriveDisc` / `DriveDiscDetail` | disc.py | 列表：`icon, en/ko/zh/ja: {name, desc2, desc4}`；详情：`desc2, desc4, story, icon2` |
| `Item` | items.py | `id, icon, rank(0-5), class, name` |
| `New` | new.py | manifest "new"：`character/bangboo/weapon/equipment/item` id 列表 + `version/previous` |
| `ZZZMaterial` / `ZZZExtraProp` | common.py | `{id, amount}` / `{prop, name, format, value}` |

客户端（`hakushin/clients/zzz.py`）：`fetch_characters / fetch_character_detail / fetch_weapons / fetch_weapon_detail / fetch_bangboos / fetch_bangboo_detail / fetch_drive_discs / fetch_drive_disc_detail / fetch_items`（+ `fetch_manifest`），自动排除主角 id `2011/2021`；`use_live` 参数切 live/latest 版本，内置 SQLite 缓存。
引用：[ZZZClient API 文档](https://seria.is-a.dev/hakushin-py/api_reference/clients/zzz/)、[ZZZ 模型文档](https://seria.is-a.dev/hakushin-py/api_reference/models/zzz/)、[GitHub 源码](https://github.com/seriaati/hakushin-py)

---

## 5. 图标/图片 URL 格式（重要：现状有坑）

- **hakushin-py 源码意图格式**（各模型 field_validator 硬编码）：
  `https://static.nanoka.cc/zzz/UI/{basename}.webp`
  例：`IconRole01.webp`、`IconRoleSelect01.webp`（角色头像：把 icon 里 `Role`→`RoleSelect`）、`IconRoleCrop01.webp`、`Mindscape_{id}_{1|2|3}.webp`（星魂绘）；武器 `Weapon_B_Common_01.webp`。
  规则：取 icon 字段的**去目录去扩展名 basename** + 加 `.webp`（邦布/驱动盘/武器详情的 icon 是完整路径如 `UI/Sprite/.../xxx.png` 或 `Assets/NapResources/UI/Sprite/.../xxx.png`，一律取 basename）。
- ⚠️ **实测警告**：`static.nanoka.cc` 现仅托管 JSON，**所有 `/zzz/UI/*.webp` 均 404**（连 `favicon.png` 都 404）；网页站的 og 图 `zzz.nanoka.cc/character/{id}/og.png?v={version}&lang={lang}` 当前 500。说明 **素材 CDN 正在迁移/未就绪，或路径规则尚未对齐**。生产 wiki 建议：自托管转存图片（或上线前复测），不要把素材热链作为唯一依赖。
- 角色图标字段本身是裸名 `IconRole01`；立绘类素材在 raw JSON 里以完整相对路径出现（`Assets/NapResources/UI/Sprite/...`），是游戏原始资源布局。

---

## 6. 镜像站 / 替代源 / 限速注意事项

- **现役主源**：`static.nanoka.cc`（JSON）+ `zzz.nanoka.cc`（网页），即 hakush.in 的"复活版"（README 原作名 "nankoa.cc"，实测域名为 nanoka.cc）。**hakush.in 已下线，勿再引用。**
- **ambr.top / ambr.py**：仅原神，无 ZZZ 等价物（hakushin-py README 明示："Project Ambr and Yatta has no equivalent for ZZZ"）。
- **Enka.Network**（[enkanetwork npm](https://www.npmjs.com/package/enkanetwork)）：支持 ZZZ，但属账号展示类 API（`api.enka.network`，需玩家 UID + 展示条件），可作补充，不是全量数据 wiki 源。
- **中文社区**：[NGA 帖《当下可看危局/式舆数据的网站》](https://ngabbs.com/read.php?tid=46209742&rand=271) 列了现役数据站（含 Enka、Hakush 系）——可作为竞品/字段对照参考。
- **限速/礼仪（实测推断）**：无鉴权、无观察到的硬限流；Cloudflare 缓存（manifest `Cache-Control: max-age=120`），**版本化 URL 内容不可变** → 建议：① 客户端按版本永久缓存列表/详情 JSON；② manifest 每 ≥2 分钟拉一次即可；③ 详情类接口按需懒加载、可做本地 SQLite/IndexedDB 缓存（hakushin-py 即此策略）；④ robots.txt `User-agent:* Allow:/`（search=yes，ai-train=no，use=reference），正常 wiki 抓取无碍，勿做高频轮询。

---

## 7. 给 Vue+TS wiki 的落地建议（要点）

1. 基址常量：`const HAKUSH_BASE = 'https://static.nanoka.cc'`；版本发现：先 `GET /manifest.json` 取 `zzz.live`（正式服版本；勿取 `latest`——含前瞻/测试服内容），或直接写死当前版本号做**构建期预取 + 本地静态化**（推荐：版本化 URL 不可变，非常适合构建期打包成站点内置 JSON）。
2. 直接 fetch（CORS `*` 已证实）；中文内容用 `zh` 语言路径（如 `/zzz/{v}/zh/item.json`）或 en 列表 + names.zh。
3. TS 类型：按第 2/4 节字段手写 interface（或由 hakushin-py 的 Pydantic 模型转译），注意 **int 枚举**（职业/属性/攻击类型/稀有度）映射表。
4. 富文本清洗：剥离 `<color=#...>`、`<IconMap:...>` 标记。
5. 图片：优先自托管（当前 CDN 素材 404 状态未就绪），URL 模板按第 5 节预留，上线前复测。
6. 排除主角 id `2011/2021`（如不需要两位主角）。