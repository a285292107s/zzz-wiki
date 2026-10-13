# 决策记录 0009：复制链接按钮整体下线

Status: implemented
Class: simplification

> 取代 [0006](./0006-share-link-is-a-page-action.md)（分享入口归页面动作行、每页一个）。
> 0006 保留为历史快照。

## Problem

站内曾有两处「复制链接」入口：名录页工具栏的「复制筛选链接」
（`hasActiveFilter || !sortIsDefault` 时出现）与详情页 `.page-actions` 行的「复制链接」
（档案就绪即出现）。两者的载荷完全相同——
`navigator.clipboard.writeText(location.href)`，写进剪贴板的是当前完整 URL
（含筛选、排序、等级、精炼等查询状态）。

问题不在摆放位置，而在**这个能力没有独占**：

- 这份 URL 全程就在地址栏里可见、可选、可复制——按钮只是把同一串字符再写一次剪贴板。
- 移动端浏览器自带分享面板（拷贝链接、直发到任意 App），而站内按钮只做「写剪贴板」这一件事，
  替代不了分享；桌面端地址栏本身就是复制入口。
- 于是它是一枚「地址栏的赝品」：两端各自都已有更顺手的原生路径。

保留它的历史理由（决策记录 0006）是「移动端地址栏被截断、复制入口埋在分享面板里」。
移动端恰恰是原生分享最强的一端：系统分享面板既能拷贝也能直发，覆盖面比「只写剪贴板」的按钮更广，
站内按钮在那里只省掉一次地址栏长按。

## Decision

**复制链接按钮整体删除**，不留显隐门禁，也不留等价入口。

- 删除 `src/components/CopyLinkButton.vue`、`src/composables/useCopyLink.ts` 与
  `src/components/index.ts` 的导出；6 个调用点一并清掉：`AgentsView` / `AgentsCardsView` /
  `WEnginesView` / `DisksView` / `BangboosView` 的名录工具栏，以及 `DetailPage` 的页面动作行。
- **「URL = 视图」不变**：筛选/排序/等级/精炼照旧写进地址栏，照旧可刷新、可前进后退、可粘贴；
  分享路径回归浏览器原生（地址栏、系统分享），站内不再有第二份实现。
- `base.css` 打印态的外壳隐藏清单、`print-mode.js` 的判据同步去掉 `.copy-link`。
- `useCatalogSort` 的 `isDefault` **保留**：它仍驱动「回到默认时移除 `?sort=&dir=`」的 URL 同步
  （`tests/catalog-sort.test.ts` 守着这条契约）；名录页不再读它做显隐。
- 随之删除的护栏：`tests/detail-share-link.test.ts` 整份；`regression-walk.js` 四项
  （`copy-hidden-when-idle` / `copy-shown-when-stateful` / `share-in-page-actions` /
  `share-stays-put-across-levels`）；`keyboard-journey.js` 一项（`kb-copy-link`）。
- `StatLevelPanel` 仍然**不设操作位插槽**：等级区块只承载「这一组数值」，动作不回到数据区块
  （0006 的这条边界继续成立）。

## Alternatives considered

- **保留但收敛到一处**（决策记录 0006 已交付的形态：详情页每页一个、名录页带状态才出现）。
  用户明确否决，理由是入口价值低——地址栏与系统分享已覆盖两端的复制/分享需求。
  0006 对「删除该功能」的保留理由（移动端价值、无使用数据）随之被推翻：移动端有系统分享面板，
  站内按钮仍只是写剪贴板。
- **改用「分享」按钮调 `navigator.share()`**、**只在移动端显示**、**先加点击埋点再据数据决定**：
  本次未逐一权衡——用户直接要求删除。若将来要重建分享类入口，这三条是应先评估的方向
  （其中 `navigator.share` 属**新增能力**，须走新决策）。

## Consequences

- 代价：站内不再有「一键拿到当前视图链接」的提示，**「链接可分享」更依赖读者自己发现**
  （地址栏里的状态本就是隐形的，这正是当初加按钮的理由）；想分享带筛选/等级的视图，
  须自行复制地址栏或走系统分享。
- 收益：少一个组件 + 一个组合式函数 + 6 处调用点 + 一份专用单测 + 5 项浏览器断言；
  名录工具栏与详情页动作行各少一个元素（详情页动作行只剩「返回」，随之少掉只为它存在的两端对齐配置）。
- 遗留缺口：**仍无点击埋点**，故「这个入口实际被用多少次、移动端占比多少」依旧无法回答——
  本次是依据「能力无独占 + 浏览器原生覆盖两端」的结构判断做的移除，不是依据使用数据。
  若将来要重建任何分享类入口，先补 `track()` 事件再谈。
