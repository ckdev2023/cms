import { Folder, Money, Monitor, Setting, Tickets, User } from '@element-plus/icons-vue'

import { P } from '@/constants/permissions'

import type { MenuItem } from './main-layout-menu.types'

/**
 * 侧栏菜单静态定义；客户中心为单叶子 `/customers`（签证/在留/行政等子功能在整合页顶栏 Tab 切换）。
 */
export const allMenuItems: Readonly<MenuItem[]> = [
  { path: '/dashboard', titleKey: 'routes.dashboard', icon: Monitor, permissions: [P.DASHBOARD_VIEW] },
  {
    path: '/customers',
    titleKey: 'routes.customers',
    icon: User,
    permissions: [
      P.VISA_REMINDER_LIST,
      P.VISA_CASE_LIST,
      P.VISA_CASE_IMPORT,
      P.VISA_CASE_ADMIN_SUPPLEMENT,
      P.CUSTOMER_LIST,
      P.ADMIN_CASE_LIST,
    ],
  },
  { path: '/tax-contracts', titleKey: 'routes.taxContracts', icon: Tickets, permissions: [P.TAX_LIST] },
  {
    path: '/finance',
    titleKey: 'routes.finance',
    icon: Money,
    permissions: [P.FINANCE_LIST],
    children: [
      { path: '/finance/invoices', titleKey: 'routes.invoices', permissions: [P.FINANCE_LIST] },
      { path: '/finance/payments', titleKey: 'routes.payments', permissions: [P.FINANCE_LIST] },
      { path: '/finance/deposits', titleKey: 'routes.deposits', permissions: [P.FINANCE_LIST] },
    ],
  },
  { path: '/files', titleKey: 'routes.files', icon: Folder, permissions: [P.FILE_LIST] },
  {
    path: '/system',
    titleKey: 'routes.system',
    icon: Setting,
    permissions: [P.SYSTEM_USER_MANAGE, P.SYSTEM_ROLE_MANAGE, P.SYSTEM_DICT_MANAGE, P.LOG_LIST],
    children: [
      { path: '/system/users', titleKey: 'routes.systemUsers', permissions: [P.SYSTEM_USER_MANAGE] },
      { path: '/system/roles', titleKey: 'routes.systemRoles', permissions: [P.SYSTEM_ROLE_MANAGE] },
      { path: '/system/dictionaries', titleKey: 'routes.systemDictionaries', permissions: [P.SYSTEM_DICT_MANAGE] },
      { path: '/system/audit-logs', titleKey: 'routes.auditLogs', permissions: [P.LOG_LIST] },
      { path: '/system/login-logs', titleKey: 'routes.loginLogs', permissions: [P.LOG_LIST] },
      { path: '/system/export-logs', titleKey: 'routes.exportLogs', permissions: [P.LOG_LIST] },
    ],
  },
]
