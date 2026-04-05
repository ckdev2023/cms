import { VisaReminderType } from '@/constants/enums'

/**
 * 开放案件四桶的固定展示顺序，与客户列表筛选、`/visa-reminders` 单选筛选、登记册 `reminderBucket` 下拉、
 * `VisaCaseRegistryStatsPanel` KPI 卡片顺序一致；横向对账见 Phase C Task C4（`docs/25` §4.2 / §12.5）。
 * 统计分桶仍以 `resolveReminderBucket` / `applyGlobalReminderBucketFilter` 为准。
 */
export const VISA_REMINDER_BUCKET_DISPLAY_ORDER: readonly VisaReminderType[] = [
  VisaReminderType.SUPPLEMENT,
  VisaReminderType.TODAY_FOLLOW_UP,
  VisaReminderType.EXPIRING_7_DAYS,
  VisaReminderType.EXPIRING_2_MONTHS,
]

/**
 * `VisaReminderType` 与 Element Plus `el-tag` 的 `type` 映射，与 `GET /customers` 的 `visaDerivedRisk`、
 * `GET /visa-reminders` 的 `reminderType` 展示对齐（`docs/25` §12.4 S4g）。
 */
export const VISA_REMINDER_TYPE_EL_TAG_TYPE: Record<
  VisaReminderType,
  'danger' | 'warning' | 'info'
> = {
  [VisaReminderType.SUPPLEMENT]: 'danger',
  [VisaReminderType.TODAY_FOLLOW_UP]: 'warning',
  [VisaReminderType.EXPIRING_7_DAYS]: 'danger',
  [VisaReminderType.EXPIRING_2_MONTHS]: 'info',
}

/**
 * 将 API 返回的提醒桶字符串收窄为 `VisaReminderType`。
 *
 * @param raw - `visaDerivedRisk` 等原始字段
 * @returns 已知枚举或 `undefined`
 */
export function narrowVisaReminderType(
  raw: string | null | undefined,
): VisaReminderType | undefined {
  if (raw === null || raw === undefined || raw === '') {return undefined}
  return (Object.values(VisaReminderType) as string[]).includes(raw)
    ? (raw as VisaReminderType)
    : undefined
}
