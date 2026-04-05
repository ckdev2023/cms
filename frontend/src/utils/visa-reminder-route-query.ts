import type { LocationQuery } from 'vue-router'

import { VisaReminderType } from '@/constants/enums'
import { VISA_CASE_IMPORT_LOCAL_UUID_RE } from '@/utils/visa-case-import-csv-local-helpers'

const VISA_REMINDER_TYPE_VALUES = new Set<string>(
  Object.values(VisaReminderType) as string[],
)

/**
 * 将路由 query 中的 `reminderType` 解析为受支持的提醒桶枚举；非法或缺失时返回空串表示「全部」。
 *
 * @param raw - 通常为 `route.query.reminderType`（仅接受字符串；数组等非字符串按非法处理）
 * @returns 可传入列表接口的 `VisaReminderType`，无法识别时返回空串表示不按桶筛选
 */
export function reminderTypeFromQuery(raw: unknown): VisaReminderType | '' {
  if (typeof raw !== 'string') {
    return ''
  }
  return VISA_REMINDER_TYPE_VALUES.has(raw) ? (raw as VisaReminderType) : ''
}

/**
 * 从路由 query 提取可合并进 `router.replace` 的 `dataScope` 片段，切换 `reminderType` 等参数时不丢失签证数据范围。
 *
 * @param query - 当前路由 `query`（如 `useRoute().query`）
 * @returns 仅含 `dataScope` 键的 query 片段，或空对象以便与 `reminderType` 等合并
 */
export function preserveDataScope(query: LocationQuery): Record<string, string> {
  const ds = query.dataScope
  if (typeof ds === 'string' && ds !== '') {
    return { dataScope: ds }
  }
  return {}
}

/**
 * 将路由 query 中的 `assignedTo` 解析为负责人用户 UUID；非法或缺失时返回 `undefined` 表示不按负责人筛选。
 *
 * @param raw - 通常为 `route.query.assignedTo`（仅接受字符串；数组等非字符串按非法处理）
 * @returns 可传入 `GET /visa-reminders` 的 `assignedTo`，无法识别时返回 `undefined`
 */
export function assignedToFromQuery(raw: unknown): string | undefined {
  if (typeof raw !== 'string' || raw === '') {
    return undefined
  }
  return VISA_CASE_IMPORT_LOCAL_UUID_RE.test(raw) ? raw : undefined
}

/**
 * 提取切换 `reminderType` 或外链至提醒列表时应保留的 query 片段：`dataScope` 与合法的 `assignedTo`。
 *
 * @param query - 当前路由 `query`
 * @returns 供 `router.replace` 或 `router-link` 合并的扁平对象（不含 `reminderType`）
 */
export function pickVisaReminderListQueryPreserve(query: LocationQuery): Record<string, string> {
  const out: Record<string, string> = { ...preserveDataScope(query) }
  const at = assignedToFromQuery(query.assignedTo)
  if (at) {
    out.assignedTo = at
  }
  return out
}
