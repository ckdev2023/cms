/**
 * Unified permission code constants.
 * Convention: `module:action` — keep in sync with seed data.
 */
export const PermissionCodes = {
  CUSTOMER_LIST: 'customer:list',
  CUSTOMER_DETAIL: 'customer:detail',
  CUSTOMER_CREATE: 'customer:create',
  CUSTOMER_EDIT: 'customer:edit',
  CUSTOMER_DELETE: 'customer:delete',

  ADMIN_CASE_LIST: 'admin_case:list',
  ADMIN_CASE_DETAIL: 'admin_case:detail',
  ADMIN_CASE_CREATE: 'admin_case:create',
  ADMIN_CASE_EDIT: 'admin_case:edit',
  ADMIN_CASE_DELETE: 'admin_case:delete',

  TAX_LIST: 'tax:list',
  TAX_DETAIL: 'tax:detail',
  TAX_CREATE: 'tax:create',
  TAX_EDIT: 'tax:edit',
  TAX_DELETE: 'tax:delete',

  FINANCE_LIST: 'finance:list',
  FINANCE_DETAIL: 'finance:detail',
  FINANCE_CREATE: 'finance:create',
  FINANCE_EDIT: 'finance:edit',
  FINANCE_DELETE: 'finance:delete',
  FINANCE_VOID: 'finance:void',

  FILE_LIST: 'file:list',
  FILE_UPLOAD: 'file:upload',
  FILE_DOWNLOAD: 'file:download',
  FILE_DELETE: 'file:delete',

  SYSTEM_USER_MANAGE: 'system:user_manage',
  SYSTEM_ROLE_MANAGE: 'system:role_manage',
  SYSTEM_DICT_MANAGE: 'system:dict_manage',

  LOG_LIST: 'log:list',

  DASHBOARD_VIEW: 'dashboard:view',
} as const

export type PermissionCode =
  (typeof PermissionCodes)[keyof typeof PermissionCodes]
