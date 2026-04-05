import { FamilyLinkModeLabel, VisaAlertLevelLabel } from '@/constants/enum-labels'
import {
  CustomerStatus,
  CustomerType,
  FamilyLinkMode,
  ServiceType,
  VisaAlertLevel,
  VisaCaseStatus,
  VisaReminderType,
} from '@/constants/enums'
import type { CustomerItem } from '@/types/customer'
import { narrowVisaReminderType } from '@/utils/visa-reminder-type-ui'

/** 客户类型列 `el-tag` 配色映射。 */
export const customerListCustomerTypeTagType: Record<
  string,
  'success' | 'info' | 'warning' | 'danger' | 'primary'
> = {
  [CustomerType.COMPANY]: 'primary',
  [CustomerType.PERSONAL]: 'success',
}

/** 客户主档状态列 `el-tag` 配色映射。 */
export const customerListStatusTagType: Record<
  string,
  'success' | 'info' | 'warning' | 'danger' | 'primary'
> = {
  [CustomerStatus.ACTIVE]: 'success',
  [CustomerStatus.INACTIVE]: 'info',
}

/** 服务线列 `el-tag` 配色映射。 */
export const customerListServiceTagType: Record<
  string,
  'success' | 'info' | 'warning' | 'danger' | 'primary'
> = {
  [ServiceType.ADMIN]: 'primary',
  [ServiceType.TAX]: 'warning',
  [ServiceType.BOTH]: 'success',
}

/** 主展示案件状态列 `el-tag` 配色映射。 */
export const customerListPrimaryCaseStatusTagType: Record<
  string,
  'success' | 'info' | 'warning' | 'danger' | 'primary'
> = {
  [VisaCaseStatus.DRAFT]: 'info',
  [VisaCaseStatus.IN_PROGRESS]: 'primary',
  [VisaCaseStatus.SUBMITTED]: 'primary',
  [VisaCaseStatus.SUPPLEMENT]: 'warning',
  [VisaCaseStatus.APPROVED]: 'success',
  [VisaCaseStatus.REJECTED]: 'danger',
  [VisaCaseStatus.COMPLETED]: 'success',
  [VisaCaseStatus.CANCELLED]: 'info',
}

const VISA_CASE_STATUS_VALUE_SET = new Set<string>(Object.values(VisaCaseStatus))

const VISA_ALERT_LEVEL_VALUE_SET = new Set<string>(Object.values(VisaAlertLevel))

export type VisaDerivedRiskVisual =
  | { state: 'tag'; bucket: VisaReminderType }
  | { state: 'unknown'; raw: string }
  | { state: 'empty' }

/**
 * 将列表行 `visaDerivedRisk` 格式化为单元格展示形态（与 `GET /customers` DTO 一致）。
 *
 * @param row - 客户列表行
 * @returns 标签态 / 未知原文 / 空占位
 */
export function visaDerivedRiskVisual(row: CustomerItem): VisaDerivedRiskVisual {
  const raw = row.visaDerivedRisk
  const bucket = narrowVisaReminderType(raw ?? undefined)
  if (bucket) {return { state: 'tag', bucket }}
  if (raw !== null && raw !== undefined) {return { state: 'unknown', raw: String(raw) }}
  return { state: 'empty' }
}

/**
 * 判断客户列表派生提醒列是否在空桶时展示「主案件摘要或来自主客户」的短说明（docs/31 §5.3）。
 *
 * @param row - 客户列表行
 * @returns 主案件摘要为主客户回退且本人名下派生桶为空时为 true
 */
export function visaDerivedRiskShowPrimaryFallbackEmptyHint(row: CustomerItem): boolean {
  if (row.listPrimaryVisaCaseSource !== 'PRIMARY_CUSTOMER_FALLBACK') {
    return false
  }
  if (!row.listPrimaryVisaCase) {
    return false
  }
  return visaDerivedRiskVisual(row).state === 'empty'
}

/**
 * 将接口返回的案件状态字符串收窄为前端枚举，便于标签与文案映射。
 *
 * @param value - `listPrimaryVisaCase.caseStatus` 原始值
 * @returns 是否为已知 `VisaCaseStatus`
 */
export function isListPrimaryVisaCaseStatus(value: string): value is VisaCaseStatus {
  return VISA_CASE_STATUS_VALUE_SET.has(value)
}

/**
 * 将主展示案件的家族签模式格式化为可读标签。
 *
 * @param mode - `familyLinkMode` 原始值
 * @returns 本地化标签或原文
 */
export function familyLinkModeListLabel(mode: string): string {
  return FamilyLinkModeLabel[mode as FamilyLinkMode] ?? mode
}

export type ListPrimaryCaseStatusCell =
  | { kind: 'empty' }
  | { kind: 'tag'; status: VisaCaseStatus }
  | { kind: 'raw'; text: string }

/**
 * 主案件摘要来自主客户回退时，`el-tag` 应锚定的列表列（docs/31 §5.5：类型列或首列有摘要的单元格）。
 */
export type ListPrimaryCaseFallbackBadgeAnchor =
  | 'caseType'
  | 'status'
  | 'expire'
  | 'nextFollowUp'
  | 'assignee'
  | 'family'
  | 'material'

/**
 * 判断主案件状态列在列表上是否有可见内容（非空占位）。
 *
 * @param row - 客户列表行
 * @returns 是否展示状态标签或原文
 */
function listPrimaryCaseStatusColumnVisible(row: CustomerItem): boolean {
  const cell = listPrimaryCaseStatusCell(row)
  if (cell.kind === 'tag') {
    return true
  }
  if (cell.kind === 'raw') {
    return Boolean(String(cell.text ?? '').trim())
  }
  return false
}

/**
 * 将客户列表行的主展示案件状态格式化为单元格展示形态。
 *
 * @param row - 客户列表行
 * @returns 空占位 / 枚举标签 / 未知原文
 */
export function listPrimaryCaseStatusCell(row: CustomerItem): ListPrimaryCaseStatusCell {
  const pc = row.listPrimaryVisaCase
  if (!pc) {return { kind: 'empty' }}
  if (isListPrimaryVisaCaseStatus(pc.caseStatus)) {return { kind: 'tag', status: pc.caseStatus }}
  return { kind: 'raw', text: pc.caseStatus }
}

/**
 * 当 `listPrimaryVisaCaseSource` 为主客户回退时，返回「主客户案件」标签应出现的列锚点；否则为 `null`。
 *
 * @param row - 客户列表行
 * @returns 锚点列键或 null
 */
export function listPrimaryCaseFallbackBadgeAnchor(
  row: CustomerItem,
): ListPrimaryCaseFallbackBadgeAnchor | null {
  if (
    row.listPrimaryVisaCaseSource !== 'PRIMARY_CUSTOMER_FALLBACK' ||
    !row.listPrimaryVisaCase
  ) {
    return null
  }
  const pc = row.listPrimaryVisaCase
  if (pc.caseType && String(pc.caseType).trim()) {
    return 'caseType'
  }
  if (listPrimaryCaseStatusColumnVisible(row)) {
    return 'status'
  }
  if (pc.expireDate) {
    return 'expire'
  }
  if (pc.nextFollowUpAt) {
    return 'nextFollowUp'
  }
  if (pc.assignedToDisplayName && String(pc.assignedToDisplayName).trim()) {
    return 'assignee'
  }
  if (pc.isFamilyCase) {
    return 'family'
  }
  if (pc.materialChecklistTotal > 0) {
    return 'material'
  }
  if (pc.materialStatus && String(pc.materialStatus).trim()) {
    return 'material'
  }
  return 'caseType'
}

/**
 * 将接口返回的主档在留提醒等级收窄为已知枚举。
 *
 * @param value - `personInfo.alertLevel` 原始值
 * @returns 是否为已知 `VisaAlertLevel`
 */
export function isPersonResidenceAlertLevel(value: string): value is VisaAlertLevel {
  return VISA_ALERT_LEVEL_VALUE_SET.has(value)
}

/**
 * 格式化客户行主档在留提醒等级为可读标签。
 *
 * @param row - 客户列表行
 * @returns 本地化标签或占位符
 */
export function personResidenceAlertLabel(row: CustomerItem): string {
  const raw = row.personInfo?.alertLevel
  if (raw === null || raw === undefined) {return '—'}
  if (isPersonResidenceAlertLevel(raw)) {return VisaAlertLevelLabel[raw] ?? raw}
  return String(raw)
}

/** 主档在留提醒列 `el-tag` 的 type；NORMAL 使用自定义浅色样式（与详情 Tab 一致）。 */
export const personResidenceAlertElTagType: Partial<
  Record<VisaAlertLevel, 'danger' | 'warning' | 'info'>
> = {
  [VisaAlertLevel.EXPIRED]: 'danger',
  [VisaAlertLevel.URGENT]: 'danger',
  [VisaAlertLevel.HIGH]: 'warning',
}

export type PersonResidenceAlertCell =
  | { kind: 'empty' }
  | { kind: 'tag'; level: VisaAlertLevel }
  | { kind: 'raw'; text: string }

/**
 * 将客户列表行主档在留 `alertLevel` 格式化为可挂载 `el-tag` 的单元格形态。
 *
 * @param row - 客户列表行
 * @returns 空占位 / 已知等级标签 / 未知原文
 */
export function personResidenceAlertCell(row: CustomerItem): PersonResidenceAlertCell {
  const raw = row.personInfo?.alertLevel
  if (raw === null || raw === undefined) {
    return { kind: 'empty' }
  }
  if (isPersonResidenceAlertLevel(raw)) {
    return { kind: 'tag', level: raw }
  }
  return { kind: 'raw', text: String(raw) }
}

/**
 * 将主档在留剩余自然日格式化为列表副行文案（正数剩余、负数按逾期天数）。
 *
 * @param daysLeft - `personInfo.daysLeft`（与后端 `calendarDaysLeft` 一致）
 * @param t - i18n `t` 函数（global scope）
 * @returns 空字符串或一行短文案
 */
export function formatPersonResidenceDaysLeftLine(
  daysLeft: number | null | undefined,
  t: (key: string, params?: Record<string, unknown>) => string,
): string {
  if (daysLeft === null || daysLeft === undefined || !Number.isFinite(daysLeft)) {
    return ''
  }
  if (daysLeft < 0) {
    return t('pages.customers.residenceOverdueDaysShort', { n: -daysLeft })
  }
  return t('pages.customers.residenceRemainingDaysShort', { n: daysLeft })
}
