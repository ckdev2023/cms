/**
 * 汇总系统权限编码常量并约束统一的 `module:action` 命名格式。
 *
 * 权限码须与初始化种子数据和前端权限点配置保持一致，避免路由鉴权与按钮鉴权出现漂移。
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

  VISA_CASE_LIST: 'visaCase:list',
  VISA_CASE_DETAIL: 'visaCase:detail',
  VISA_CASE_CREATE: 'visaCase:create',
  VISA_CASE_EDIT: 'visaCase:edit',
  VISA_CASE_IMPORT: 'visaCase:import',
  /** P2-S3d：行政案件→签证案件补录工具（预览/提交） */
  VISA_CASE_ADMIN_SUPPLEMENT: 'visaCase:adminCaseSupplement',

  /** P2-S2d：允许在 Query 中使用 `dataScope=all` 及案件行级「全部」可读 */
  VISA_CASE_DATA_SCOPE_ALL: 'visaCase:dataScopeAll',
  /** P2-S2d：允许 `dataScope=team` 及团队范围内案件行读写 */
  VISA_CASE_DATA_SCOPE_TEAM: 'visaCase:dataScopeTeam',
  /** P2-S2d：仅允许 `dataScope=mine` 及本人负责案件行 */
  VISA_CASE_DATA_SCOPE_MINE: 'visaCase:dataScopeMine',

  VISA_CASE_LOG_CREATE: 'visaCaseLog:create',
  VISA_CASE_LOG_EDIT: 'visaCaseLog:edit',
  VISA_CASE_LOG_DELETE: 'visaCaseLog:delete',

  CUSTOMER_FILE_PATH_LIST: 'customerFilePath:list',
  CUSTOMER_FILE_PATH_CREATE: 'customerFilePath:create',
  CUSTOMER_FILE_PATH_EDIT: 'customerFilePath:edit',
  CUSTOMER_FILE_PATH_DELETE: 'customerFilePath:delete',

  VISA_REMINDER_LIST: 'visaReminder:list',

  MATERIAL_TEMPLATE_MANAGE: 'materialTemplate:manage',
} as const;

export type PermissionCode =
  (typeof PermissionCodes)[keyof typeof PermissionCodes];
