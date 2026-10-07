# IMG_GUIDE.md · 图片展示规范（参考）

> 本文档是**参考**（按需查用），不是教程。它回答一个问题：本站如何把「超宽 / 透明底 / 人像立绘」这类
> 素材，在"档案标本"设计语言里**展示得好看**。与 [`DATA_GUIDE.md`](./DATA_GUIDE.md)（数据事实）、
> [`DESIGN.md`](./DESIGN.md)（架构）并列。

## 适用素材的特征

这类素材（典型：`public/data/img/hero/Mindscape_{id}_2.webp`）：

- **超宽全景**，约 2.36:1（如 2552×1080）。
- **带透明通道（RGBA）**：上下多为 **alpha=0 的透明边**，不是不透明黑条——在深色页底透出底色。
- 单个角色，**宽姿态**，头部常偏向画面一角。

> 展示前先摸清素材（尺寸、是否有 alpha），再定方案；透明底就别叠暗色 scrim，会发糊。

## 展示技法：视口遮罩（不裁图）

用"视口 + 遮罩"裁局部，**不产出裁切图、不改原图**：

```css
.container {           /* 视口 */
  aspect-ratio: 9 / 16;
  overflow: hidden;
  border: 1px solid var(--line-1);
  border-radius: 2px;
}
.container img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
```

### 首页「今日角色」：标本陈列（`FeaturedDeck.vue`）

**一次一张**，装在同一个 hairline 装裱框里：立绘 → 标本签（编号/属性/中英名）→ 座次 + 刻度。
信息一律在**图下**，不叠在画面上（作品不被遮挡）。两个断点各取一个画幅：

| 断点 | 画幅 | 高度 | 说明 |
| --- | --- | --- | --- |
| 桌面（>860） | `aspect-ratio: 2.36`（Mindscape 全景原生比例） | 由比例定 | 整幅展示、不裁上下；宽度 = `min(栏宽, 高度上限 × 2.36)` |
| 手机（≤860） | `aspect-ratio: 4 / 5` | 由比例定 | 超宽全景放进横框只露一条横带（旧版 16:9 即如此，再被信息条压掉半个画面）；竖幅收进更多角色本体 |

实现要点：

- **同一套校准参数三处复用**：`pos / zoom / originY` 是源图相对构图，换画幅不用重算。
  纵向取景 = `源高 / zoom`，在 2.36 与 4:5 下**完全一致**（两者都是高度受限的 cover），
  差别只在横向上下文：2.36 见全宽、4:5 见中段、9:16 只露脸（详情页 AgentHead）。
- **比例与 48vh 高度上限不打架**：装裱宽度取 `min(栏宽, clamp(240px,48vh,560px) × 2.36)` 并居中。
  直接铺满栏宽会把 2.36 压成 2.7:1（上下被裁）；宽度不定死又会被 `aspect-ratio + min-height`
  以高反推宽（320 视口下横向溢出 20px，违反 WCAG 1.4.10，`reflow-spacing` 审计在盯）。
- **居中不需要任何测量**：一次只展示一张，槽位绝对定位在 `left: s·100%`，轨道只平移
  `−active·100%`。上一版「多卡并排 + 露邻卡」需要量步长/卡宽/偏移父级，这一版全都不需要。
- **头图档位由展示格的物理像素需求反推，用 srcset 交给浏览器选**：
  - 桌面：取景框最宽 1322 CSS px（高度上限 560px × 2.36），乘逐图 `zoom`（1.05–1.49）
    ⇒ 绘制宽 1565–1970 CSS px，故候选链是 `hero/card(800w) + hero/wide(1600w) + 原图`
    的 srcset → CDN 兜底（曾经的 `card/` 一档是按旧的 9:16 标本卡 ≤320 CSS px 定的，
    改版后没跟着涨 → 首页首屏发糊，见下文「头图派生档位」）。
  - 手机：竖幅会把超宽源图**放大**取中段，故 `sizes` 不能用布局宽（350px），
    要用「等效源宽」520px：DPR1 → card（0.97×，~30KB）、DPR2/3 → wide（0.97×/1.46×，~84KB），
    避免落回 ~350KB 原图。见 `useFeaturedAgents.deckSizes`。
  - 不再走 `mobile/`（那是详情页窄屏专用的）。
- **切卡动效克制**：轨道平移 `--t-med`；图下标本签按 `:key="active"` 重挂、`--t-fast` 轻淡入
  （reduced-motion 由 base.css 的全局规则压成 0.01ms）。

### `object-fit` 的关键约束

对竖框配 2.36:1 横图，`cover` 是**高度填满、宽度溢出**（9:16 只露出约 23.5% 宽、4:5 约 27%）。因此：

- `object-position` 的**水平值能移焦点**；**垂直值无效**（高度已占满，无可偏移）。
- 顶/底透明边默认会进框（透出深色页底）。

## 要"放满"又要"保眼睛"：两个杠杆 + 一个对焦

三个参数都做成**逐图常量**（见 `src/composables/useFeaturedAgents.ts` 的 `FEATURED_POOL`）：

### 1. 放大填满（消掉上下透明边）

`transform: scale(<zoom>)`，其中 `zoom ≈ 源高 / 内容纵向高度`。

只放大还不够：内容常**不垂直居中**，居中缩放会在偏上/偏下的那一侧内容里留暗带。

### 2. 变换原点对准内容中心（消掉残带）

`transform-origin: 50% <originY>%`，其中 `originY ≈ 上边距 / (上边距 + 下边距) × 100`（按内容纵向包围盒算）。
让内容上下都贴到框边，透明边被 `overflow:hidden` 裁掉。

### 3. 水平焦点对准"脸"（保眼睛）

放大填满会**横向裁掉身体两侧**；宽姿态角色的头偏向一角，焦点若对准"整张图/身体"，脸就会被推向边缘。
`object-position` 的 `pos` 要对准**脸**，让裁掉的是身体/背景，保住双眼。

> ⚠️ `pos` **无法可靠自动计算**：内容包围盒中心、头 35% 质心、头冠 12% 质心三种启发式都与手工校准值
> 偏差很大（会把角色推到边缘、画面大片空白）。必须按下面的核验流程，用 pos 扫描逐张目检挑选。

### 4. 逐图常量

```ts
// { id, pos, zoom, originY }；名字/属性仍从名录解析（单一事实源），换角色只改这一行
{ id: 1011, pos: '50%', zoom: 1.3,  originY: 49.8 },
{ id: 1331, pos: '40%', zoom: 1.2,  originY: 47   },
{ id: 1371, pos: '40%', zoom: 1.2,  originY: 30.2 },
{ id: 1051, pos: '64%', zoom: 1.22, originY: 61.4 },
```

## 核验流程

1. 用一次性脚本（放 `temp/`）按**内容包围盒**（非透明像素的上/下界）算 `zoom`、`originY`。
2. **忠实复刻整条 CSS 管线**（`object-fit → object-position → transform-origin scale`）渲染预览，
   逐张核对脸/眼睛与边缘。
3. 改完在**真实站点复核**。近似渲染是近似，可能误判（例如把没裁到眼睛的图当成裁到），
   以真实页面为准，保持改动最小（每张就一两个数字）。

## 与设计语言的契合

- 深色纸墨主题 + 透明底立绘 → 角色浮在深色底上，**无需 scrim**；透明底上再叠暗色阶会发糊。
- 1px 细线框、2px 圆角、无阴影 / 渐变 / 圆角卡片堆叠。
- 比例型 `zoom/pos` 与视口无关：同一套相对构图在单卡牌堆（`FeaturedDeck.vue`）与详情页 `AgentHead` 上通用。

## 当前使用

- 「今日角色」卡：精选池存于 `src/data/featured-pool.json`（`{ pool, calibrated }`；`useFeaturedAgents.ts` 读
  `pool`，按**当天日期**确定性取 4 张，见下）。参数不再手写进代码，而是用开发的**校准工具路由 `/calibrate`**
  逐张调整并保存（仅开发环境；页面拖全景图上的 9:16 取景框 + 滑杆，经 `vite.config.ts` 的 dev 中间件
  `GET/PUT /__calibrate` 读写该 JSON，`src/utils/cameraRect.ts` 负责取景框与参数的映射）。
  校准网格角色号由 **live 代理人名录**派生（`src/domain/heroCatalog.ts` 的 `heroIdsFromList`），
  数据同步落地新角色后 `/calibrate` 自动出现，无需再改源码；`pos` 仍须目检后入池。
- 角色详情页 `AgentHead` 移动端头图：`src/data/heroCalibration.ts` 读 `featured-pool.json` 的 `calibrated` 全表
  （`{ pos, zoom, originY }`），移动断点（≤860px）下套到 `.hero-bg img`（CSS 自定义属性透传，见该组件样式）。
  三者是源图相对构参数（水平焦点 / 放满消透明边 / 内容垂直居中），可直接复用；移动端 hero 比 9:16 卡更宽，
  横向上下文更多，非逐帧等价。未校准（无 hero 图角色）回落居中取景；双形态 1551 现可经
  `heroImageFile` 取默认（女性）版校准，移动端头图按 `heroVariantFile(id, heroForm)` 跟随用户所选形态，
  视图共用同一套 `{ pos, zoom, originY }` 于两形态（校准在默认版上校准，切换形态后构图可能略有偏移，
  形态选择见 `useHeroForm`）。
- 素材：`img/hero/Mindscape_{id}_2.webp`（本地化；nanoka CDN 兜底见 [`DATA_GUIDE.md`](./DATA_GUIDE.md) §5）。
- 页面地面壁纸：`public/page-bg.png`（绳网情报站 wiki 官方背景同款 `pc-page-bg.png`，1920×1231 / 95KB，
  深炭底 + 斜向 ZZZ 水印纹理、向下渐隐近黑，与 `--bg-0` 同域色）。经 `tokens.css` 的 `--page-bg-image`
  单一事实源取用，`base.css` 的 `body::before` 固定视口层（fixed + cover）铺装在页面地面之上、内容之下，
  长页无接缝；**不用** `background-attachment: fixed`——iOS Safari 降级为滚动铺装时 cover 会放大到整文档高，纹理糊掉。
- 首页 hero 壁纸：`public/home-bg.webp`（绳网情报站 wiki 首页 banner 同款全幅背景，2400×1080 / 213KB，
  ZENLESS 描边字 + BANGBOO:NET 斜向字带 + 撕纸边缘拼贴；原图 1.1MB 经 OSS `quality,q_80` + webp 转码）。
  经 `tokens.css` 的 `--home-bg-image` 取用，`HomeView.vue` 的 `.home-backdrop` 铺装。**固定视口层**
  （`position: fixed; inset: 0`，不随页滚动，手法同 body::before；实底页头 62px 自行遮住视口顶，
  无需让位）。铺装规则**实测复刻原站**：图恒以 2400:1080 比例、高度撑满视口（`background-size:
  auto 100%`）水平居中，common 桌面两侧出血 ≈1.25×；压暗用 scrim token（`--scrim-3` 叠层，
  禁止手写 rgba）；图自带向下渐隐、fixed 层永不露边，故**无需** mask 渐隐（曾用的
  `background-attachment: fixed`/随文档滚动两版均已废弃）——首页特异性壁纸，内页仍是上一条的
  `--page-bg-image`。

## 体积预算与压缩分级（2026-09 实测）

`public/data/img/` 全量 26.3MB，其中 hero 一类占 20.0MB（59 张、均值 348KB、峰值 570KB），
是仓库历史 blob 与克隆体积的主导项（`.git` ≈29MB）。数据 JSON 仅 ~5MB。首页首屏的 4 张
头图按派生档位加载（见下节：手机 ~120KB / 桌面 DPR1 ~320KB / DPR≥2 落原图 ~1.4MB），
运行时按需加载其余——带宽侧无问题；
压力在**仓库增长**：每次换图/新增角色都把整张 webp 沉入 git 历史（派生档每档再 +1/3 体积，
仍远优于压缩原图路径的全量 blob 重写）。

处理分级（按投入产出排序）：

1. **维持现状可接受**：当前年增量约数 MB（每版本新增角色 + 偶发重校准），且
   `verify:icons --local` 已守住「清单内零缺失」，不会无声劣化。
2. **若决定压缩**：只压 hero 一级即可回收 ~80% 收益——目标质量 q≈80（webp 有损）
   或限宽 ≤1600px，预期均值降至 ~120KB（总量 20→7MB）。校准参数是相对构图
   （pos/zoom/originY），压缩不破坏既有校准；但**已入库文件被覆盖会产生新的全量
   blob**（老版本仍在历史里），一次性收缩只影响未来。
3. **不建议现在做**：Git LFS（需先验证 Vercel 构建兼容）、有损转 avif（收益相近但
   生态与校准工具截图流程多一层转换）。

压缩落地路径：在 `scripts/build/download-icons.mjs` 落盘前接 sharp 处理 hero 类别 +
`npm run download:icons` 幂等重跑；执行后跑一轮 `/calibrate` 目检每张构图的透明边/眼部位置。

### 头图派生档位（card + wide，2026-10 落地 / 2026-10-07 改为两档 + srcset）

权衡结论：**不压缩原图、按用途另派生小图**。原图保持全分辨率（详情页 AgentHead 满栏底图
在桌面 DPR2 下正需要它：hero 盒 1168×497 → 需 ~2336px，原图 2552px 合适），为更小的展示格
另派生等比变体：

- 生成器 `scripts/build/hero-cards.mjs`（sharp）：`public/data/img/hero/{card,wide}/{同名}.webp`。
  **档位规格由展示格的物理像素需求反推**（规格是展示格的函数，改布局必须重算）：
  - `card` **≤800px / q68**：窄屏取景框 100vw（390 宽 → 350 CSS px）× 逐图 zoom ≤1.49
    ⇒ 绘制 ≤448 CSS px，DPR2 需求 ~897px（留余量）；同日兼作详情页 `og:image`
    （800px 的 16:9 派生图天然适合卡片，见 `generate-route-html.mjs`）。
  - `wide` **≤1600px / q72**：桌面取景框最宽 = 高度上限 560px × 2.36 = **1322 CSS px**，
    乘逐图 zoom（1.05–1.49）⇒ 绘制宽 1565–1970 CSS px。1920×1080 桌面的实际需求是
    1223×1.28 = 1565px，故 1600px 恰好 1:1。
  - 幂等补差、原图 mtime 更新后自动重派生、孤儿清理；由 `npm run sync` 在图标下载后调用
    （单一写入者），派生图随 `public/data` 约定入库（部署只构建已提交快照）。
- 前端用 **srcset 让浏览器按 DPR 自己选档**（`useFeaturedAgents.ts` 的 `heroSources`）：
  `card 800w, wide 1600w, 原图 1920w` + `sizes` = 挂载期取景框宽（`deckSizes()`，纯 px、
  上界 `DECK_MAX_WIDTH = 1322`）⇒ 手机/DPR≤2 取 card（~30KB）、桌面 DPR1 取 wide（~81KB）、
  DPR≥1.21 落回原图（~350KB）。
  原图放**末档**并声明全池原图宽的下界 1920：它已是最后一档，w 描述符取值不影响选档结果
  （浏览器只在前几档密度都 < DPR 时才落回它）。`sizes` 刻意不用 `100vw`/媒体查询：
  挂载期 `img.decode()` 预热用的是**脱离文档**的 `new Image()`，它求不了媒体查询与 vw
  （实测会落到末条 → 手机上错选 wide，白拉 4 张 ~84KB）；纯 px 让预热探针与真实 `<img>`
  必然同档。预热走**同一份 srcset + sizes**——自己猜 DPR 会挑错档，白拉一张比不预热更糟。
- **为什么会有这一改（2026-10-07）**：首页「今日角色」改版成整栏宽 2.36:1 横幅后，展示格从
  ~320 CSS px 涨到 1020–1322 CSS px（再乘 zoom），而 `card/` 仍是按旧 9:16 标本卡定的 800px
  ⇒ 实测 1920×1080 桌面把 800px 放大 **1.96×**、DPR2 下 **3.9×**，首页第一屏肉眼发糊。
  加 `wide` 档后同一场景回到 1:1。**派生档位与展示格脱节就会糊**，这是本次的教训。
- 等比缩放不改构图坐标系：`featured-pool.json` 的 `pos/zoom/originY` 与详情页校准**原样复用**，
  无需重算或目检。
- 实测：61 张 card 1.95MB（均值 ~32KB）、61 张 wide ~5MB（均值 ~81KB）vs 原图均值 ~351KB；
  首页首屏 4 张按档位 120KB（手机）～320KB（桌面 DPR1）～1.4MB（DPR≥2 落原图）。
  （曾有的构建期池首 `<link rel=preload>` 已移除：61 选 4 的随机池里命中率仅 ~6.5%，
  白拉一张 + console 警告；挂载即执行的预热是确定性机制，先于卡片区渲染。）
- **hero 窄屏派生**（`scripts/build/hero-mobile.mjs`）：`public/data/img/hero/mobile/{同名}.webp`，
  ≤1400px / q62。详情页 hero 在手机上可见窗仅 ~350 CSS px（cover 缩放后源图等效需求 ~1300px），
  2552px 原图超采约 2 倍。前端按视口选路（`AgentHead.vue` + `useMediaQuery('(max-width: 860px)')`，
  在 setup 期同步求值以免「先请求原图再切分支」的双下载），候选链
  `hero/mobile → hero 原图 → CDN`，派生缺失自动回退不破图。
  实测：详情页图片载荷 370KB → 105KB，LCP 9.2s → 7.6s。

### 名录图标小图（thumb 变体，2026-10）

音擎/邦布图标原图 400-512px（均值 33-50KB），而**名录行展示格只有 38×38 CSS px**
（DPR3 亦只需 ~114px）；详情页展示 278×278 仍需原图，故按用途派生：

- 生成器 `scripts/build/icon-thumbs.mjs`：`public/data/img/{weapon,bangboo}/thumb/{同名}.webp`，
  最长边 ≤128px、q80（实测 3.5-5.1KB，约原图 1/10），幂等补差 + 原图更新跟随 + 孤儿清理；
  由 `npm run sync` 在图标下载后调用。
- 前端：`iconSources(item, cat, 'thumb')` 把小图置于候选链首（缺失自动回退原图）；
  名录行（`WEnginesView` / `BangboosView`）与检索面板结果行传 `'thumb'`，
  **详情页不传**（用原图）。character 图标（180×64 圆头像，均值 6KB）不派生。
- 实测：`/w-engines` 图片载荷 **1045KB → 140KB**（整页 1306 → 401KB），
  `/bangboos` 图片 105KB；perf 分不变（本就懒加载），但真实带宽省约 87%。

上一节「压缩分级」里覆盖原图的路径**不再执行**（会产生新全量 blob 且破坏详情页满栏底图清晰度），
以本节的派生方案为准。
