import {
  buildVisibleCustomerCenterSidebarGroups,
  type CustomerCenterTabDef,
  listNonEmptyCustomerCenterTabGroups,
} from '@/layouts/customer-center-tabs.config'

/**
 * 客户中心根路径 `/customers` 与默认入口 replace 的协同：从子路径切回列表根或已停留在该根时不再 replace，避免与侧栏选中态冲突。
 */

/**
 * 解析 `/customers` 默认 `replace` 目标路径，与 `CustomerCenterLayout` 左侧侧栏**首项**一致（`buildVisibleCustomerCenterSidebarGroups` 首个非空分组的第一条菜单 path）。
 *
 * 当全部可见 Tab 均不出现在侧栏（例如仅「全表」签证提醒一项且 `showInCustomerCenterSidebar:false`）时，回退为 Hub 一级分组顺序下首个非空分组的第一个可见 Tab，与旧顶栏 Tab 扁平顺序一致。
 *
 * @param visibleTabs - 已按权限与 `visaUiVisaMergedSidebarChildVisible` 过滤后的 Tab 列表（顺序与静态表一致）
 * @returns 无可见 Tab 或无法解析时返回 null
 */
export function resolveDefaultCustomerCenterHubEntryFullPath(
  visibleTabs: readonly Pick<CustomerCenterTabDef, 'fullPath' | 'group' | 'showInCustomerCenterSidebar'>[],
): string | null {
  if (visibleTabs.length === 0) {
    return null
  }
  const asDefs = visibleTabs as readonly CustomerCenterTabDef[]
  const sidebarGroups = buildVisibleCustomerCenterSidebarGroups(asDefs)
  const firstSidebar = sidebarGroups[0]?.items[0]
  if (firstSidebar) {
    return firstSidebar.fullPath
  }
  const hubGroups = listNonEmptyCustomerCenterTabGroups(visibleTabs)
  const firstHubGroup = hubGroups[0]
  if (!firstHubGroup) {
    return null
  }
  const tab = visibleTabs.find((t) => t.group === firstHubGroup)
  return tab?.fullPath ?? null
}

/**
 * 判断是否应跳过「从 `/customers` 默认 replace 到侧栏默认首项路径」。
 *
 * - 从 `/customers/...` 子路径切回裸 `/customers` 时跳过，保留用户意图（侧栏「客户列表」等与默认首项不一致时避免被拉回工作台）。
 * - 上一次已是 `/customers` 时跳过，避免 `visibleTabs` 重算导致反复 replace 回默认首项。
 *
 * @param previousPath - 本次 `watch` 周期之前记录的客户中心相关 `route.path`；首次进入布局为 `null`
 * @returns 应跳过默认入口重定向时返回 true
 */
export function shouldSkipDefaultCustomerCenterWorkbenchRedirect(
  previousPath: string | null,
): boolean {
  if (previousPath === null) {
    return false
  }
  if (previousPath === '/customers') {
    return true
  }
  return previousPath.startsWith('/customers/') && previousPath !== '/customers'
}
