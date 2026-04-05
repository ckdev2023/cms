import type { ProTableColumn } from '@/types/components'

/**
 * 客户列表表格列显示预设：控制 ProTable 数据列数量，与 `useCustomerListViewColumns` 的 `prop` 一致。
 */
export type CustomerListColumnPresetId = 'compact' | 'standard' | 'full'

/**
 * 客户列表全部数据列 `prop` 顺序（与 `useCustomerListViewColumns` 输出顺序一致，不含操作列）。
 */
export const CUSTOMER_LIST_TABLE_COLUMN_ORDER = [
  'customerCode',
  'customerType',
  'customerName',
  'residenceExpireDateCol',
  'personResidenceAlertCol',
  'phone',
  'serviceType',
  'ownerName',
  'status',
  'visaDerivedRisk',
  'listPrimaryCaseType',
  'listPrimaryCaseStatus',
  'listPrimaryCaseExpire',
  'listPrimaryCaseNextFollowUp',
  'listPrimaryCaseAssignee',
  'listPrimaryCaseFamily',
  'listPrimaryCaseMaterial',
  'createdAt',
] as const

/** 单列 `prop` 类型。 */
export type CustomerListTableColumnProp =
  (typeof CUSTOMER_LIST_TABLE_COLUMN_ORDER)[number]

const COMPACT_COLUMNS: readonly CustomerListTableColumnProp[] = [
  'customerCode',
  'customerType',
  'customerName',
  'phone',
  'ownerName',
  'status',
  'listPrimaryCaseStatus',
  'listPrimaryCaseExpire',
  'listPrimaryCaseNextFollowUp',
  'listPrimaryCaseAssignee',
]

const STANDARD_COLUMNS: readonly CustomerListTableColumnProp[] = [
  ...COMPACT_COLUMNS,
  'residenceExpireDateCol',
  'personResidenceAlertCol',
  'visaDerivedRisk',
  'listPrimaryCaseType',
  'serviceType',
]

const PRESET_ALLOWED: Record<
  CustomerListColumnPresetId,
  ReadonlySet<CustomerListTableColumnProp>
> = {
  compact: new Set(COMPACT_COLUMNS),
  standard: new Set(STANDARD_COLUMNS),
  full: new Set(CUSTOMER_LIST_TABLE_COLUMN_ORDER),
}

/**
 * 按客户列表列预设过滤 ProTable 列配置，并保持与传入 `columns` 相同的列顺序。
 *
 * @param columns - 完整列配置（通常来自 `useCustomerListViewColumns`）
 * @param preset - 紧凑 / 标准 / 完整
 * @returns 仅含预设允许之 `prop` 的列数组
 */
export function pickCustomerListTableColumns(
  columns: ProTableColumn[],
  preset: CustomerListColumnPresetId,
): ProTableColumn[] {
  const allowed = PRESET_ALLOWED[preset]
  return columns.filter((c) =>
    allowed.has(c.prop as CustomerListTableColumnProp),
  )
}

/**
 * 将本地存储或 query 中的原始字符串规范为客户列表列预设 ID。
 *
 * @param raw - 待解析的字符串
 * @returns 合法预设；无法识别时返回 `standard`
 */
export function normalizeCustomerListColumnPresetId(
  raw: string | null | undefined,
): CustomerListColumnPresetId {
  if (raw === 'compact' || raw === 'standard' || raw === 'full') {
    return raw
  }
  return 'standard'
}
