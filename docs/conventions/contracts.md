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

其余字段**原样透传**，语义见 `schema.ts`；字段清单与表结构见 [`DATA_GUIDE.md`](../../DATA_GUIDE.md) §3。

## 4. 契约变更 checklist

- [ ] 改的是 `src/domain/schema.ts`，不是 `types.ts`。
- [ ] 新字段是否需要 `catchall` 之外的显式声明？（只有**前端要消费**的字段才显式声明）
- [ ] 是否影响 `verify:data` 的四项判据？（尤其「名录 id ↔ 详情一一对应」）
- [ ] `npm run verify:data` 通过；若改了产出，`npm run data` 后产出的 JSON 一并入库。
- [ ] 富文本字段（含 `<color=#…>` / `<IconMap:…>`）在**展示层**经 `rich.ts`/`stripRichText`，
      契约层不做清洗。
