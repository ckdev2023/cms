import { P } from '@/constants/permissions'
import { visaUiVisaMergedSidebarChildVisible } from '@/utils/visa-ui-feature-flags'

/**
 * 客户中心 Hub 一级分组：今日待办（期限/待办向）、客户与签证案件（列表+案件台账）、导入与行政案件（历史导入/行政补充/行政案件列表）。
 */
export type CustomerCenterTabGroup = 'todayOps' | 'master' | 'registryTools'

/**
 * Hub 一级分组在 Segmented 中的固定顺序；权限裁剪后仅展示仍含至少一个可见 Tab 的分组。
 */
export const customerCenterTabGroupOrder: readonly CustomerCenterTabGroup[] = [
  'todayOps',
  'master',
  'registryTools',
] as const

/**
 * 客户中心顶栏 Tab 定义：与旧侧栏 hub 子项权限、副标题、灰度 path 一致，仅 `fullPath` 统一挂在 `/customers` 下。
 */
export interface CustomerCenterTabDef {
  /** 完整路径（与 `routes` 子路由一致） */
  fullPath: string
  /** Hub 一级分组，供两级导航与「工作模式」聚合 */
  group: CustomerCenterTabGroup
  titleKey: string
  menuSubtitleKey?: string
  menuTooltipKey?: string
  permissions?: string[]
  /**
   * 客户中心左侧主导航是否展示该项；为 false 时仍保留在 Hub 顶栏 Tab（如「全表」签证提醒列表）。
   *
   * @default true
   */
  showInCustomerCenterSidebar?: boolean
}

/**
 * 客户中心侧栏分组：与 `customerCenterTabGroupOrder` 中非空分组顺序一致，组内顺序与 `customerCenterTabDefs` 声明顺序一致。
 */
export interface CustomerCenterSidebarGroup {
  /** 与 Hub 一级分组 id 一致 */
  group: CustomerCenterTabGroup
  /** 分组标题 i18n key（与顶栏 Segmented 使用同一套 `layout.customerCenterGroup.*`） */
  titleKey: string
  /** 已按权限、`visaUiVisaMergedSidebarChildVisible` 与 `showInCustomerCenterSidebar` 过滤后的子项 */
  items: CustomerCenterTabDef[]
}

/**
 * 客户中心整合页顶栏 Tab 静态顺序：客户列表 → 签证主路径 → 在留主档 → 行政并列域。
 */
export const customerCenterTabDefs: readonly CustomerCenterTabDef[] = [
  {
    fullPath: '/customers',
    group: 'master',
    titleKey: 'routes.customerList',
    permissions: [P.CUSTOMER_LIST],
  },
  {
    fullPath: '/customers/workbench/visa',
    group: 'todayOps',
    titleKey: 'routes.workbenchVisa',
    menuSubtitleKey: 'routes.workbenchVisaMenuSubtitle',
    menuTooltipKey: 'layout.menuWorkbenchVisaTooltip',
    permissions: [P.VISA_REMINDER_LIST, P.VISA_CASE_LIST],
  },
  {
    fullPath: '/customers/visa-reminders',
    group: 'todayOps',
    titleKey: 'routes.visaReminders',
    menuSubtitleKey: 'routes.visaRemindersMenuSubtitle',
    menuTooltipKey: 'layout.menuVisaRemindersTooltip',
    permissions: [P.VISA_REMINDER_LIST],
    showInCustomerCenterSidebar: false,
  },
  {
    fullPath: '/customers/visa-cases',
    group: 'master',
    titleKey: 'routes.visaCaseRegistry',
    menuSubtitleKey: 'routes.visaCaseRegistryMenuSubtitle',
    menuTooltipKey: 'layout.menuVisaCaseRegistryTooltip',
    permissions: [P.VISA_CASE_LIST],
  },
  {
    fullPath: '/customers/visa-case-import',
    group: 'registryTools',
    titleKey: 'routes.visaCaseImport',
    menuSubtitleKey: 'routes.visaCaseImportMenuSubtitle',
    menuTooltipKey: 'layout.menuVisaCaseImportTooltip',
    permissions: [P.VISA_CASE_IMPORT],
  },
  {
    fullPath: '/customers/admin-case-visa-supplement',
    group: 'registryTools',
    titleKey: 'routes.adminCaseVisaSupplement',
    menuSubtitleKey: 'routes.adminCaseVisaSupplementMenuSubtitle',
    menuTooltipKey: 'layout.menuAdminCaseVisaSupplementTooltip',
    permissions: [P.VISA_CASE_ADMIN_SUPPLEMENT],
  },
  {
    fullPath: '/customers/residence-reminders',
    group: 'todayOps',
    titleKey: 'routes.residenceReminders',
    menuSubtitleKey: 'routes.residenceRemindersMenuSubtitle',
    menuTooltipKey: 'layout.menuResidenceRemindersTooltip',
    permissions: [P.CUSTOMER_LIST],
  },
  {
    fullPath: '/customers/admin-cases',
    group: 'registryTools',
    titleKey: 'routes.adminCases',
    menuSubtitleKey: 'routes.adminCasesMenuSubtitle',
    menuTooltipKey: 'layout.menuAdminCasesTooltip',
    permissions: [P.ADMIN_CASE_LIST],
  },
]

/**
 * 与内层 `keep-alive` `include` 对齐的客户中心子页组件 `name`（与各 `*View.vue` 的 `defineOptions.name` 一致）。
 */
export const customerCenterKeepAliveViewNames: readonly string[] = [
  'CustomerListView',
  'VisaWorkbenchView',
  'VisaReminderListView',
  'VisaCaseRegistryView',
  'VisaCaseImportView',
  'AdminCaseVisaSupplementView',
  'AdminCaseListView',
]

/**
 * 按权限与签证主路径构建期开关过滤客户中心 Tab，供侧栏扁平化后的整合顶栏复用。
 *
 * @param defs - 静态 Tab 定义表
 * @param hasMenuPermission - 与侧栏一致的「任一端权限命中」判断
 * @returns 当前用户可见且未被灰度隐藏的 Tab 列表
 */
export function filterVisibleCustomerCenterTabs(
  defs: readonly CustomerCenterTabDef[],
  hasMenuPermission: (perms?: string[]) => boolean,
): CustomerCenterTabDef[] {
  return defs.filter((tab) => {
    if (!hasMenuPermission(tab.permissions)) {
      return false
    }
    return visaUiVisaMergedSidebarChildVisible(tab.fullPath)
  })
}

/**
 * 根据当前可见 Tab 推导非空一级分组列表，顺序与 `customerCenterTabGroupOrder` 一致。
 *
 * @param visibleTabs - 已按权限与灰度过滤后的 Tab（仅需 `group` 字段）
 * @returns 至少包含一个 Tab 的分组 id 列表
 */
export function listNonEmptyCustomerCenterTabGroups(
  visibleTabs: readonly Pick<CustomerCenterTabDef, 'group'>[],
): CustomerCenterTabGroup[] {
  const present = new Set(visibleTabs.map((tab) => tab.group))
  return customerCenterTabGroupOrder.filter((group) => present.has(group))
}

/**
 * 返回客户中心侧栏分组标题的 i18n key（与 `CustomerCenterLayout` 一级 Segmented 标签同源）。
 *
 * @param group - Hub 一级分组 id
 * @returns `layout.customerCenterGroup.<group>` 形式的翻译键
 */
export function customerCenterSidebarGroupTitleKey(group: CustomerCenterTabGroup): string {
  return `layout.customerCenterGroup.${group}`
}

/**
 * 将已过滤的 Hub Tab 列表聚合为侧栏分组：剔除 `showInCustomerCenterSidebar === false` 的项，并去掉无子项的分组。
 *
 * @param visibleTabs - 通常来自 `filterVisibleCustomerCenterTabs`（已含权限与 `visaUiVisaMergedSidebarChildVisible`）
 * @returns 侧栏分组列表，顺序为 `customerCenterTabGroupOrder` 与 `customerCenterTabDefs` 的稳定交集
 */
export function buildVisibleCustomerCenterSidebarGroups(
  visibleTabs: readonly CustomerCenterTabDef[],
): CustomerCenterSidebarGroup[] {
  const sidebarTabs = visibleTabs.filter((tab) => tab.showInCustomerCenterSidebar !== false)
  const byGroup = new Map<CustomerCenterTabGroup, CustomerCenterTabDef[]>()
  for (const g of customerCenterTabGroupOrder) {
    byGroup.set(g, [])
  }
  for (const tab of sidebarTabs) {
    const list = byGroup.get(tab.group)
    if (list) {
      list.push(tab)
    }
  }
  return customerCenterTabGroupOrder
    .filter((group) => (byGroup.get(group)?.length ?? 0) > 0)
    .map((group) => ({
      group,
      titleKey: customerCenterSidebarGroupTitleKey(group),
      items: byGroup.get(group) ?? [],
    }))
}

/**
 * 一键解析当前用户可见的客户中心侧栏分组（权限 + 签证主路径灰度 + 侧栏显隐位）。
 *
 * @param hasMenuPermission - 与 Hub 一致的「任一端权限命中」判断
 * @returns 非空分组及其子项列表
 */
export function resolveVisibleCustomerCenterSidebarGroups(
  hasMenuPermission: (perms?: string[]) => boolean,
): CustomerCenterSidebarGroup[] {
  const visible = filterVisibleCustomerCenterTabs(customerCenterTabDefs, hasMenuPermission)
  return buildVisibleCustomerCenterSidebarGroups(visible)
}
