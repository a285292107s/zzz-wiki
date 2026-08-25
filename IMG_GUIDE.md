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

### `object-fit` 的关键约束

对 9:16 竖框配 2.36:1 横图，`cover` 是**高度填满、宽度溢出（只露出约 23.5% 宽）**。因此：

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
- 比例型 `zoom/pos` 与视口无关：桌面 4 格一排、手机横向胶片条（`scroll-snap`）用同一套相对构图。

## 当前使用

- 「今日角色」卡：精选池存于 `src/data/featured-pool.json`（`{ pool, calibrated }`；`useFeaturedAgents.ts` 读
  `pool`，**每次挂载随机取 4 张轮换**）。参数不再手写进代码，而是用开发的**校准工具路由 `/calibrate`**
  逐张调整并保存（仅开发环境；页面拖全景图上的 9:16 取景框 + 滑杆，经 `vite.config.ts` 的 dev 中间件
  `GET/PUT /__calibrate` 读写该 JSON，`src/utils/cameraRect.ts` 负责取景框与参数的映射）。
- 角色详情页 `AgentHead` 移动端头图：`src/data/heroCalibration.ts` 读 `featured-pool.json` 的 `calibrated` 全表
  （`{ pos, zoom, originY }`），移动断点（≤860px）下套到 `.hero-bg img`（CSS 自定义属性透传，见该组件样式）。
  三者是源图相对构参数（水平焦点 / 放满消透明边 / 内容垂直居中），可直接复用；移动端 hero 比 9:16 卡更宽，
  横向上下文更多，非逐帧等价。未校准（无 hero 图角色）回落居中取景；双形态 1551 现可经
  `heroImageFile` 取默认（女性）版校准，移动端头图按 `heroVariantFile(id, heroForm)` 跟随用户所选形态，
  视图共用同一套 `{ pos, zoom, originY }` 于两形态（校准在默认版上校准，切换形态后构图可能略有偏移，
  形态选择见 `useHeroForm`）。
- 素材：`img/hero/Mindscape_{id}_2.webp`（本地化、双版本共用；nanoka CDN 兜底见 [`DATA_GUIDE.md`](./DATA_GUIDE.md) §5）。
