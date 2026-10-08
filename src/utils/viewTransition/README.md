# 共享元素过渡（View Transitions API）

首页「今日角色」牌堆里的立绘 → 代理人详情页头图，两块用的是同一张
`Mindscape_{id}_2.webp`。让**那张画自己飞过去**（首页陈列框 1029×430 → 详情整栏
1168×413，位移与缩放同时发生），这就是 Web 版的 flutter `Hero`。

```
首页                                        代理人详情
┌ .deck-frame ───────────┐   点卡     ┌ .ahead ─────────────────┐
│ ┌ .deck-item ─────────┐│ ───────→ │  .hero-bg ← 共享元素    │
│ │  画  ← 共享元素     ││  返程     │   (zoom 校准含在其中)   │
│ └─────────────────────┘│ ←───────  │  压暗面 / 四角标 / 文字 │
│  标本签 / 座次刻度      │           └─────────────────────────┘
└────────────────────────┘
        └──── view-transition-name: deck-frame ────┘
```

## 为什么挂在「裁切容器」上

名字的落点选错过两次，教训都留在代码注释里：

| 挂在哪 | 结果 |
|---|---|
| 装裱框 `.deck-frame` | 框与详情头图尺寸本来就接近，挂框只会「整块面板挪一下」——**看不出是飞行** |
| `<img>` 本体（`vt-name` prop，已回退） | `<img>` 带 zoom 校准 transform，渲染盒比可视区域大 28%；带名元素的快照不含祖先的 `overflow: hidden` 裁切，**起飞瞬间凭空放大一圈** |
| ✅ 可视裁切容器：`.deck-item` / `.hero-bg` | 各自 `overflow: hidden`，快照=用户看到的画面；起飞盒与落点盒的几何差即观感 |

## 一次飞行的时序

```
点击 <RouterLink> → vue-router 导航
   beforeEach            回程判定（服务 App.vue 的页面过渡让位）
   beforeResolve         「首页 ↔ 代理人详情」才起跳，其余一律走普通导航
     ├ 登记起飞卡         rememberDeckCard(params.id) —— 回程落回同一张
     ├ 预热降落端头图      详情档地址（与首页卡片不同档、不同缓存）
     ├ startViewTransition(更新回调)
     └ await 更新回调已开始  ← 旧状态此刻才进快照，这里放行导航
         └ 更新回调         放行 → 路由落定 → nextTick → 挂 vt-landing → 等画可绘制 → 让出宏任务
         导航落定后 DOM 更新 → 浏览器采样新状态 → 伪元素上插值（400ms）
     finished              撤 vt-active / vt-landing；vt-landed 交给自己 900ms 的定时器
```

## 六个不显眼但会致命的地方

1. **守卫必须等「更新回调已开始」才放行导航**（双向闸门）。
   浏览器在**下一次渲染时机**拍旧状态，而 vue-router 的 DOM 更新在微任务里 —— 放行早了
   旧快照拍到的就是**已经切完的画面**：两端几何完全相同，整段飞行退化成一次看不见的
   交叉溶解。实测数据：group 盒从第一次采样起就是落点尺寸 `1168×413 @ (136,285)`，
   而正确实现是 `1029×430 @ (205,207)` 逐帧收敛到落点。
   反向的坑同样致命：守卫里 `await` 整段过渡 → 导航等不到放行、回调等不到 DOM，
   两张快照都拍旧页面（同样是空转）。
2. **更新回调里不能用 `requestAnimationFrame` 等「一帧」**：浏览器在跑更新回调期间会
   暂停渲染循环（实测 Chrome 整整 4s 不派发，直到它自己的 *DOM update timed out*
   把过渡判废）。必须用微任务/定时器级别的让出（`settleAfterPaint`）。
3. **每一次等待都要有上限**：路由落定 `NAV_SETTLE_MS`、图画可绘制 `SHARED_READY_MS`、
   起飞前预热 `LANDING_PREWARM_MS`。超时**不是错误**：放行、照常播，绝不把
   `vt-active` 永久挂在 `html` 上（那是「页面过渡被永久停用」的事故）。
4. **新状态那端的画必须先就绪**：首页卡片走 `card/wide` 派生档，详情按 DPR 走原图或
   `mobile/` 派生 —— **地址不同、缓存不共享**。不预热/不等待，浏览器采样到的是空画布：
   实测帧序列里 320ms 全黑、随后硬切到详情页（「看不出动画」的真身）。
   预热地址与渲染地址共用 `data/heroImageSources.ts` 一份规则，算错档位等于白下一张。
5. **`mode="out-in"` 与共享元素互斥**：新视图的 DOM 更新会被压后 260ms，采样要么拿到旧
   画面、要么拿到全透明新页。根类 `vt-active` 期间停用页面过渡（App.vue）。
6. **root 组的整页交叉溶解必须等长线性互补**（old 1→0 与 new 0→1 同步、透明度和恒为 1）：
   只给 0s 时长不给 fill-mode 时，旧页快照以 `opacity: 1` 盖到飞行结束，结尾「啪」地硬切；
   两段时长不等时 `plus-lighter` 和≠1，中段会提亮。

## 编排：三拍，不是一次交叉溶解

节奏收在 `src/styles/base.css` 的 `::view-transition-*` 与 `vt-plate-in`：

| 时间 | 发生什么 | 归属 |
|---|---|---|
| 0–400ms | 画从陈列框长到整栏（expo-out：起步快、尾段长减速） | `::view-transition-group` |
| 140–310ms | 两个裁切快照等长线性互补交换（不劈在中段，藏在收尾里） | `::view-transition-old/new` |
| 0–240ms | 两端页面其余部分交叉溶解（旧标本签随之退场） | `::view-transition-old/new(root)` |
| 采样时 | 目的页文字层**不进新快照**（`vt-landing`） | `html.vt-landing` |
| 250–640ms | 框标 → 档案行 → 身份块逐条就位（`vt-plate-in`） | `html.vt-landed` |

回程同理，且**落回起飞的那张卡**：起飞时登记卡片 id，首页牌堆挂载时取走一次
（`consumeDeckCard`）——否则 A 的画会飞进 B 的框里（两个角色的交叉溶解，比不飞更糟）。
牌堆自己的「标本装匣」入场编排在这趟里让位（见 FeaturedDeck 的 `is-mounting`）。

## 名字挂在哪 / 标记挂在哪

| 用途 | 元素 | 何时 |
|---|---|---|
| 共享元素名（浏览器读） | 首页活动卡 `.deck-item`、详情 `.hero-bg` | 常驻（仅活动卡）；四张都挂会重复名，浏览器跳过整次过渡 |
| 端点标记 `data-vt-shared`（运行时读） | 同上 | 常驻；回调用它找到**新状态那端的画**并等它可绘制 |
| `vt-active` | `html` | 起飞前 → finished（页面过渡让位） |
| `vt-landing` | `html` | 采样前挂、finished 撤（把文字层挡在新快照之外） |
| `vt-landed` | `html` | 采样后挂、900ms 后自撤（落地编排的开关） |

## 怎么降级

| 情况 | 行为 |
|---|---|
| 浏览器无 `document.startViewTransition`（Firefox < 144 等） | 不注册守卫、不加根类、不发内联名；导航与页面过渡完全退回原样（启动时无 `[viewTransition]` 日志） |
| `prefers-reduced-motion: reduce` | 安装期就短路（伪元素不在 base.css 那条全局降速的 `*` 作用域里）；牌堆入场编排也不启动（全局只归零时长、不归零延迟） |
| 别的一对路由（名录 ↔ 详情、同类目详情互跳、其它页） | 判据直接跳过，不调 API |
| 飞行中再次导航 | 并进同一次过渡，不叠第二次 `startViewTransition`；导航被打断也照常撤标记（实测点卡后 120ms 再点名录：落在 /agents，无残留类） |
| 键盘激活（焦点 + Enter） | 与点击同一条路径，飞行照常（实测 group 逐帧收敛） |

排查「没看到动画」：控制台看有没有 `[viewTransition] 共享元素过渡已启用`。
没有这行 = 浏览器不支持该 API，或用户在系统里开了「减少动态效果」。

## 怎么复验

飞行是**采样时刻**的事，无头截屏拍不到飞行中的伪元素（会拍到只剩背景的黑帧），
判定一律用「读伪元素的计算几何」：

```js
// 注入 6× 慢放后逐帧读 ::view-transition-group(deck-frame) 的 width/height/transform
// 正确：从起飞盒逐帧收敛到落点盒；错误（旧实现的空转）：第一帧就是落点盒
::view-transition-group(deck-frame) { animation-duration: 1920ms !important }
```

## 文件

- `config.ts` — 路由判据、名字/标记常量、起飞登记、`waitUntil` / `awaitSharedEndImage`（纯逻辑，可单测）
- `index.ts` — vue-router 守卫、双向闸门、飞行生命周期、`useViewTransition`（页面过渡让位）
- `src/styles/base.css` — `::view-transition-*` 的节奏与 `vt-landed` 编排
- `src/data/heroImageSources.ts` — 详情 hero 候选链（渲染与预热共用的单一事实源）
- `src/components/home/FeaturedDeck.vue` — 起飞端 / 降落端、预热触发、装匣入场编排
- `src/components/detail/AgentHead.vue` — 降落端 / 起飞端
- `src/App.vue` — `vt-active` 期间停用页面过渡
