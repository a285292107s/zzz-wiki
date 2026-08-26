/* ============================================================
 * live-target.ts — 合规版本选择（纯函数，无 IO，可单测）。
 *
 * 站点只发布**正式服（live）**数据。此处集中「版本合法化」的
 * 全部合规判定：live 缺失 / available 缺失 / live 不在可用列表
 * 均直接抛错（拒绝构建），绝不以 latest（含前瞻/测试服内容）
 * 降级、补位。
 * ============================================================ */

export interface ZzzManifest {
  latest?: string
  live?: string
  available?: string[]
}

/** 合规校验：返回正式服版本号；任一条合规红线被触犯即抛错（build 失败，由 ci-data 回退既有数据）。 */
export function resolveLiveTarget(zzz: ZzzManifest): string {
  const ver = zzz.live
  if (!ver) throw new Error('manifest.json 缺 zzz.live（源站 schema 变更？），拒绝构建')
  if (!Array.isArray(zzz.available)) {
    throw new Error('manifest.json 缺 zzz.available 列表（源站 schema 变更？），拒绝构建')
  }
  if (!zzz.available.includes(ver)) {
    throw new Error(
      `live=${ver} 不在源站可用列表（available: ${zzz.available.join(', ')}）；` +
        '为合规不降级取 latest，请人工确认源站 live 版本后重试',
    )
  }
  return ver
}