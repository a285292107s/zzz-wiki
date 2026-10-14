# 决策记录 0010：多语言只覆盖游戏内容，界面外壳保持中文

Status: implemented
Class: feature

> ⚠ 本文的「**界面外壳保持中文**」部分已被 [0011](./0011-multilingual-ui-copy.md) 取代：
> 界面短文案（导航、按钮、区块标题、筛选标签、页面 meta 等）现在也随展示语言切换。
> 本文余下内容（四语数据面落在 `public/data/live/{lang}/`、切换入口在设置页、语言不进 URL、
> 名录按语言复制而非四语字典）仍然有效，保留备查、不就地改写。

> 落地 [DESIGN.md](../../DESIGN.md) ADR-004 预留的「入口以后加」：ADR-004 定下「预留 lang 参数、默认 zh、
> 本重构轮不做切换 UI」，本次把切换入口与四语数据面一起补上。ADR-004 是重构期的历史决策，
> 保留备查，不就地改写。

## Problem

数据源四语齐全（`static.nanoka.cc` 的 `/zzz/{ver}/{lang}/…` 详情端点 zh/en/ja/ko 均 200，名词表同样四语），
但站点只构建与展示中文：`scripts/build/domains.ts` 把 `zh/character` 这类路径写死，`public/data/live/` 下
只有根下一份名录/词典 + 一个 `zh/` 详情目录，`src/data/api.ts` 虽有 `Lang` 类型与 `detail(kind, id, lang)` 参数，却没有任何调用点
传过非默认值，也没有任何切换入口。

而「做多语言」其实是两条完全不同的路，代价差一个量级：

- **内容多语言**——游戏文本（角色/音擎/邦布/驱动盘的名称、技能、描述、术语释义）跟随官方本地化。
  源站按语言提供，是**官方译文**，不引入任何翻译工作。
- **界面多语言**——把站点自己的文案（导航、按钮、区块标题、筛选标签、页面 meta）翻成四语。
  这条路在本仓库撞一条硬红线：[QUALITY.md](../../QUALITY.md) 的「多语言质量 = 无机器翻译痕迹」。
  界面文案全部是人工撰写的中文（54 个 `.vue`），没有任何译文来源；机器翻译会把这条质量项直接打红，
  人工翻译则是另一项内容工程。

约束两条：**运行时零外部请求**（数据面硬约束）→ 四语内容必须构建期全部落地；
`public/data/**` **约定入库** → 体积与 diff 噪声要记账。

## Decision

**语言只切换游戏内容，界面外壳保持中文。**

### 数据面

每种语言一套完整数据面，位于 `public/data/live/{lang}/`：

```
live/{lang}/{character,weapon,bangboo,equipment}.json   名录
live/{lang}/noun.json                                  术语词典（浮层释义 + 术语名解析）
live/{lang}/{character,weapon,bangboo,equipment}/{id}.json   详情
manifest.json                                           根下唯一文件（版本元信息，与语言无关）
```

- **名录按语言重建，而不只是详情**：源站名录是**单份**（`/zzz/{ver}/{lang}/character.json` 全 404；
  `/zzz/{ver}/character.json` 是英文底本 + zh/en/ja/ko 名字字段），而构建期要往名录注入本地化文本——
  角色的阵营名与特殊属性名、音擎的效果名/正文与主副属性名（`scripts/build/domains.ts`）。
  故「该语言的名录」＝ 用**该语言详情**注入后的名录。好处是前端所有名录消费点**字段形状不变**
  （`camp_name` 仍是字符串，只是取值随语言），只有取数路径变。
- **语言集单一事实源**：`src/domain/langs.json`（`["zh","en","ja","ko"]`）。TS 侧经 `src/domain/lang.ts`
  （类型、自称标签、`<html lang>` 映射、守卫），纯 `.mjs` 构建脚本经 `scripts/build/langs.mjs` 读同一份文件
  ——构建期两条工具链都要消费它，所以语言集落在 JSON 而不是 TS。
- **术语表按语言抓取**：`<Term:N>` 的名称取该语言的 `noun.json`（中文术语名不能出现在英文正文里）。
- **阵营细分只对中文生效**：`src/data/camp-supplement.json` 是中文策展的展示名（源站对细分阵营没有四语名）。
  套到非中文名录会得到「英文条目里混中文阵营名」；只借其中的数字码再配源站粗粒度名，则多个细分码会同名
  （筛选下拉出现重复项）。故非中文一律走源站粗粒度阵营，各语言内部自洽。
- **校验**：`pnpm run verify:data` 升级为「四语 × 契约 + 完整性 + **同源**」——名录由同一份源站名录派生，
  `scripts/verify-data.ts` 因此逐类目断言四语的名录 id 集合一致，**并且**断言四语的详情文件 id 集合
  也一致（只查名录会放过「名录齐、详情缺」）；某语言目录漏写/写坏直接失败，不靠人工比对四个目录。

### 前端

- `src/composables/useLocale.ts` 持有当前语言：模块级状态 + `localStorage` 的 `zzz-wiki:lang`，
  并在切换时同步 `<html lang>`（启动时 `main.ts` 调 `bootstrapLocale()`）。
- `listFor(entry, lang)` / `detailFor(entry, id, lang)` 的 `lang` 是**必填**参数——漏传即类型报错，
  不靠「记得传」。
- `useAsyncResource` 的 `watchEffect` 追踪 fetcher 内的 `lang.value`，故语言一变列表与详情**自动重新取数**，
  不需要任何手写监听。
- `pickName(item, lang)` 的回退序改为「当前语言 → 其余语言（按 `LANGS` 次序）→ `code`/`codename`」；
  语言无关的代号永远排在所有语言之后。不传语言时等价于默认语言，与历史行为逐字一致。
- 驱动盘名录的 `zh`/`en`/`ja`/`ko` 是 `{ name, desc2, desc4 }` **子对象**而不是名字字符串，
  故 `src/utils/names.ts` 另出 `pickLocaleInfo`；`pickName` 同时收字符串与 `{name}` 两种形态
  （顺手修掉一处既有缺陷：`DiskDetailView` 的翻页标签传的是 `pickName`，它逐个跳过对象 → 标签恒为「—」）。
- **界面外壳一律不动**，仍是中文：导航、按钮、区块标题、筛选标签、元素/职业标签（`domain/enums.ts` 的人工标签）、
  页面 meta、sitemap、逐路由静态 HTML。搜索索引的**匹配面**（`hay`）仍是四语合并串（与展示语言无关），
  只有展示用的 `label` 随语言。

### 入口

设置页 `/settings` 新增「展示语言」选项板（与代理人名录版式、佩洛伊斯立绘形态并列），
选项标签用各语言**自称**（中文 / English / 日本語 / 한국어），按各自语言标记 `lang`，不译成中文。
语言**不进 URL**。

## Alternatives considered

- **界面文案也做多语言**：与 QUALITY.md「无机器翻译痕迹」冲突；人工翻译 54 个 `.vue` 的界面文案是另一项
  内容工程，且会把 SEO 的单地址模型（sitemap / canonical / `generate-route-html` 的 237 份静态 HTML）
  改成多地址模型。按用户确认的范围只做内容多语言。
- **名录保持单份，把本地化注入字段改成四语字典**（`camp_name` → `camp_names: { zh, en, … }`）：
  名录不必按语言复制、切语言不重取名录。败在改动面——每个消费点都要改取值方式（含
  `domain/sections` 的音擎属性面板），字段形状全线变化；而按语言复制名录让「一种语言一套数据面」
  这条规则统一，代价只是三份副本里每份约 0.3MB（见 Consequences）。
- **语言进 URL**（`?lang=en` 或 `/{lang}/…` 路径）：分享链接能带语言、SEO 能有多语地址。
  败在同一页面会出现多个 URL，而 sitemap / canonical / 逐路由静态 HTML 都按单地址生成
  （要按语言各生成一份，237 → 948 份；sitemap 的 238 条 URL 含根页，同样要 ×语言数）。语言是本机偏好而非页面身份，与名录版式、立绘形态同类。
- **按 `navigator.language` 自动选语言**：能免去非中文读者找入口。败在会让「浏览器语言不是中文」的读者
  一进来就看到另一种语言，与「默认 zh」的既有约定相悖；而切换入口是可见的。
- **切换器放站头工具区**：可见性最好，非中文读者一进来就能换。败在站头有一份写死的宽度空间账
  （见 `SiteHeader.vue` 的断点注释：320 档余量仅 18px），加一个带文字的控件要把那份账重算一遍；
  且设置页自称「本机偏好的唯一改动入口」。故放设置页，发现成本记在 Consequences。
- **`index.html` 的静态名录 preload 改由 JS 按已存语言注入**：能让非中文读者也命中预取。
  败在要为一个预取把数据 URL 的构造暴露到启动路径上，且非中文读者仍会先收到那份 zh 预取
  （同源、可压缩、可缓存），收益不足以抵掉这条跨层耦合。

## Consequences

- 代价：`public/data/live/` 从一份变四份，入库体积 **5.7MB → 24.2MB**（实测：zh 5.67 / en 5.88 / ja 6.39 /
  ko 6.22 MB，各 237 个文件 = 232 份详情 + 4 份名录 + 1 份词典）；每次数据同步的抓取量与 diff 规模约 4 倍
  （`.cache/hakushin-raw` 同样变四份，单版本清理逻辑不变）。
- 代价：**非中文读者要在设置页找语言**（导航第 06 位「设置」、首页目录的「06 设置」），站头没有语言入口
  ——这是为了不动站头的宽度空间账。
- 代价：`index.html` 的名录预取只能按默认语言落一份静态 `preload`；非中文读者多耗一份同源、可压缩、
  可缓存的请求。
- 代价：**CJK 衬线字体的语料随数据面变宽**——`scripts/build/charset.mjs` 采集的是 `public/data/**.json`
  全量，数据面一变四语，必要字符集从 3851 涨到 5446 码点（其中 728 个是中文语料里没有的日文汉字）。
  已按新语料重切字体（251 片 / 1218KB，`noto-serif-sc.css` gzip 12.3 → 14.7KB，预算 40KB）；
  **此后每次数据同步只要引入新字，都要重跑 `pnpm run fonts:cjk`**，否则 `verify:fonts:cjk` 会红
  （`build:ci` 已挂这道门禁，故漏跑会在部署构建里暴露）。
- 代价：**谚文没有衬线字形**——Noto Serif SC 不含 한글，韩文正文按既有规则回退系统字体
  （`verify:fonts:cjk` 的「字体本就不含」那一路，非裁剪缺口）。韩文可读，但与站内衬线不同族。
- 收益：**既有布局不变量零重算**——切换入口不进站头，故 ADR-0004 的六项导航预算与站头宽度空间账
  （320 档余量 18px）都不必改动；站头、导航、页脚三处一行为零改动。
- 收益：游戏内容四语可用（全部来自官方本地化，无机器翻译），切换后列表与详情自动重取，
  运行时仍是零外部请求；名录消费点字段形状未变，`domain/sections.ts` 等纯逻辑零改动。
- 收益：`verify:data` 多守一条「四语同源」契约；`domain/search.ts` 里那份与 `pickName` 重复的名称提取
  被删除（改为复用 `utils/names`，并因此新增一条 `domain → utils` 依赖，已登记在
  [`docs/architecture.md`](../architecture.md) §4）。
- ~~遗留缺口：非中文界面下**元素 / 职业标签仍是中文**~~ **已由 0011 解决**：`domain/enums.ts` 的
  `label` 现在是四语 `Loc`（取自源站官方值域，见 0011 的锚点表），`Tags` 等消费点按当前语言取值。
  站内只对**中文**保留「火/冰/电/风」短式。
- 遗留缺口：**构建期产物**仍是中文单语——`generate-sitemap.mjs` 与 `generate-route-html.mjs` 固定读
  `DEFAULT_LANG`（首位语言）、产出 237 份静态 HTML 与 238 条 sitemap URL，未按语言翻倍。
  运行时**页面 meta 已随语言**（`usePageMeta` 解析四语 `Loc` 的 `route.meta.title`），
  故差别只在「爬虫/分享抓到的静态 HTML 是哪门语言」。
  若要静态产物也分语，这两处要一起改（并把 URL 空间 ×语言数）。
