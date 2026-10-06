/* ============================================================
 * heroCatalog — 校准工具可列角色号（单一事实源：live 代理人名录）。
 * 替代 CalibrateView 内硬编码 HERO_IDS：数据同步（npm run sync）写入新的
 * live/character.json 后，/calibrate 网格自动出现新角色，无需再改源码。
 * 纯函数、无 Vue 依赖，可单测。双形态角色文件名仍由 heroImageFile 解析。
 * ============================================================ */

/** 从代理人名录条目提取可校准角色号（升序、去重；非法 Id 丢弃）。 */
export function heroIdsFromList(list: ReadonlyArray<{ Id?: unknown }>): number[] {
  const ids = new Set<number>()
  for (const item of list) {
    const n = Number(item.Id)
    if (Number.isFinite(n)) ids.add(n)
  }
  return [...ids].sort((a, b) => a - b)
}
