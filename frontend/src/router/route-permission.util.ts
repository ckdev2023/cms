/**
 * 将路由 `meta.permissions` 与用户权限集合对齐，供全局守卫与验收用例复用。
 */

/**
 * 判断当前用户是否满足路由在 `meta.permissions` 上声明的访问条件（「命中任一则通过」）。
 *
 * 与 `docs/21_签证客户中心P0验收与Rollout说明.md` §14.1 一致：如旧在留 B4 仅依赖 `customer:list`、行政列表 B8 仅依赖 `admin_case:list`、工作台需 `visaReminder:list` 与 `visaCase:list` 之一。
 *
 * @param required - 自 `meta.permissions` 归一化得到的非空权限码列表
 * @param hasPermission - 与用户 Store 一致的权限判断回调
 * @returns 列表为空时放行；否则任一权限命中即返回 true
 */
export function routePermissionsGranted(
  required: readonly string[],
  hasPermission: (code: string) => boolean,
): boolean {
  if (required.length === 0) {
    return true
  }
  return required.some((p) => hasPermission(p))
}
