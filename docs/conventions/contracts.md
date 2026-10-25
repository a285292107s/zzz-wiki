# 数据契约约定

**形状的唯一事实源是代码**：`src/domain/schema.ts`（zod）。**本文件不抄字段列表**——
抄了就会漂移。这里只写**代码里看不出来的业务意图与边界**。

## 1. 契约的归属与流向

```
src/domain/schema.ts   ← 唯一形状定义（zod）
        │ z.infer
        ▼
src/data/types.ts      ← 类型别名 + 对外 import 面（**只再导出，不新增定义**）
        │ import
        ├──▶ scripts/build/  构建期产出时校验（parse 收集错误）
        └──▶ scripts/verify-data.ts  对 public/data/ 跑 safeParse
```

- **改字段只改 `schema.ts` 一处**，`types.ts` 自动跟随。
- 枚举常量（属性/职业/攻击类型/稀有度/阵营）在 `src/domain/enums.ts`，**不在 `types.ts`**。
- 前端不引入 zod（校验在构建/CI 侧，不进运行时热路径）。

## 2. 校验门禁的口径（`scripts/verify-data.ts`）

「可提交」的判据是四项，**不是形状全对**：

1. 契约形状合法（`safeParse` 通过）；
2. **名录非空**；
3. **名录 id ↔ 详情文件一一对应**（缺一个即失败）；
4. `extra_level` **单调**。

> ⚠ **未知键不会失败**：所有 schema 都追加 `.catchall(z.unknown())`。这是**故意的**——
> 源站会静默新增透传字段，严格拒绝会让站点因上游加字段而无法更新。
> 所以「多了字段」不是 bug，**不要"顺手"把 catchall 删掉**。

## 3. 构建期注入字段（唯一需要文档解释的部分）

这些字段**不是源站原样给的**，而是构建期算出来的——所以它们的语义必须写下来：

| 字段 | 注入规则 |
|---|---|
| `Id`（名录） | 源站列表的 key 即 id，条目内部无 id 字段 → 注入大写 `Id` |
| `special_element` | 详情 `special_element_type.name` → 名录；前端展示属性时优先用它 |
| `camp_name` | 详情 `camp` 映射出中文名；随后应用 `camp-supplement.json` 的细分覆盖 |
| `atk`（音擎名录） | 详情 `atk_max`，即 Lv.60 满级主属性，供等级滑条插值 |
| `base_property` / `rand_property` | 详情同名对象 → 名录的**展示子集**（`name` 中文名 + `value` Lv.1 值 + `format`） |
| `effect_name` / `effect_desc` / `effect_refine` | 详情 `talents` → 音擎效果（通常取 1 阶） |

其余字段**原样透传**，语义见 `schema.ts`；名录字段与产出目录见 [`DATA_GUIDE.md`](../../DATA_GUIDE.md) §3，
详情结构以 `schema.ts` 为准。

## 4. 契约变更 checklist

- [ ] 改的是 `src/domain/schema.ts`，不是 `types.ts`。
- [ ] 新字段是否需要 `catchall` 之外的显式声明？（只有**前端要消费**的字段才显式声明）
- [ ] 是否影响 `verify:data` 的四项判据？（尤其「名录 id ↔ 详情一一对应」）
- [ ] `pnpm run verify:data` 通过；若改了产出，`pnpm run data` 后产出的 JSON 一并入库。
- [ ] 富文本字段（含 `<color=#…>` / `<IconMap:…>`）在**展示层**经 `rich.ts`/`stripRichText`，
      契约层不做清洗。

## 5. 渲染不变量（改首页牌堆 / 详情 hero 前必读）

这几条**读代码看不出来**，违反时不会报错，只会悄悄劣化观感或稳定性：

- **hero 的版本位必须常驻渲染**（`HomeView` 的 `VER …` 槽位）：版本号未就绪时渲染占位
  `VER ···`，就绪后替换文本，**不得改成 `v-if` 条件渲染**。占位是首页 CLS 0.023 的唯一来源——
  条件渲染会让整行在数据到达时折行推版，把 CLS 从「几乎为零」推回可测量区间。
- **装匣入场动的是 `.deck-figure`，不是 `<img>`**（`FeaturedDeck`）：`<img>` 自带逐图校准的
  内联 `transform`/`object-position`，动它会把取景一起翻掉（画面跳一格）；入场编排只允许改
  外层容器的 `transform`/`opacity`/`border-color`。
- **详情页桌面 hero 的垂直预算就是「栏宽 / 2.8」的盒高**（`AgentHead`）：≥1200 视口下横幅画幅
  定死（与取景校准同一比例），信息块（代号 + 名 + 稀有度/属性/职业图标 + 底部专属音擎注记）
  必须一起收进盒内；`min-height: fit-content` 实测挡不住裁切。封面不再放档案编号行——纯编号
  对识别没有增量，只占一行垂直预算；攻击类型归 `AgentDetailView` 的档案详情区块（01 档案详情）。
  往 hero 里加内容或加行距前先量总高，超出时下缘会静默裁掉最后一行（专属音擎注记会最先贴底被裁）。
- **翻转是成品镜像、取景参数不动**（`featured-pool.json` 的 `flipH`）：取景 transform 一律经
  `cameraRect.framingTransform()` 生成，`scale` 与 `scaleX` 两个函数必须同时在场——牌堆起飞前变形在
  `transform` 上过渡，手写单函数 transform 会退化成矩阵插值（旋转/压扁）；反过来 `/calibrate` 在翻转时
  必须镜像全景与取景框，否则「校准所见即页面所见」不成立。
- **等级滑条的滑钮尺寸只许写在 `.level-slider` 上**（`LevelSlider` 的 `--thumb-size`）：`.mark`
  刻度位置用同一变量算行程（刻度中心 = 滑钮中心），一旦把变量改写在 `input.level-range` 上，
  刻度仍按外层旧值定中心，触屏两端刻度会各偏半个差值（18px 时代实测偏 3.5px）。
  触屏与桌面的差别只有两处：这枚变量与 input 的**透明内边距**——命中带 ≥24px 靠 padding 撑，
  不靠把钮做大，所以缩钮不会缩小可拖区域（判据由 `reflow-spacing.js` 守）。
- **钮的形状按轴的性质分**：连续轴（属性等级 / 精炼 / 邦布等级）用方钮，分段档（技能招式与核心技的
  等级尺）用菱形，菱形是同一尺寸方钮的内接形（边长 × 0.7071，外接框仍等于 `--thumb-size`）——
  **边长不得写成整钮尺寸**，旋转 45° 后外接框会涨到 1.41 倍，短轨道上直接变成一块压过发丝线的色块。
