import { VisaCaseStatusLabel } from '@/constants/enum-labels'
import { VisaCaseStatus } from '@/constants/enums'
import type { CustomerListPrimaryVisaCaseSummary } from '@/types/customer'
import { materialChecklistApplicableTotal } from '@/utils/material-checklist-progress'

/**
 * 将可选日期字符串解析为时间戳，供摘要带「下次跟进 / 在留期限」紧迫性比较使用。
 *
 * @param dateStr - ISO 或后端日期字符串
 * @returns 毫秒时间戳，不可解析或空值时为 `null`
 */
export function parseIsoDateToMs(dateStr: string | null | undefined): number | null {
  if (!dateStr) {
    return null
  }
  const ms = new Date(dateStr).getTime()
  return Number.isNaN(ms) ? null : ms
}

/**
 * 在「下次跟进」与「在留期限」之间标出日历上更早的一栏，便于顶区扫读。
 *
 * @param pc - 主展示案件摘要；为 `null` 时双栏均不加紧迫样式
 * @returns 分别指示是否高亮跟进日与在留期限
 */
export function computeContextStripDatePriority(
  pc: CustomerListPrimaryVisaCaseSummary | null,
): { nextFollowUp: boolean; expireDate: boolean } {
  if (!pc) {
    return { nextFollowUp: false, expireDate: false }
  }
  const nextMs = parseIsoDateToMs(pc.nextFollowUpAt)
  const expireMs = parseIsoDateToMs(pc.expireDate)
  if (nextMs === null && expireMs === null) {
    return { nextFollowUp: false, expireDate: false }
  }
  if (nextMs !== null && expireMs === null) {
    return { nextFollowUp: true, expireDate: false }
  }
  if (nextMs === null && expireMs !== null) {
    return { nextFollowUp: false, expireDate: true }
  }
  if (nextMs !== null && expireMs !== null) {
  return (nextMs as number) <= (expireMs as number)
    ? { nextFollowUp: true, expireDate: false }
    : { nextFollowUp: false, expireDate: true }
  }
  return { nextFollowUp: false, expireDate: false }
}

/**
 * 汇总主展示案件材料 checklist 已收条数与适用条数，以「已收/适用」短分数展示。
 *
 * @param pc - 主展示案件摘要
 * @returns 例如 `2/3`
 */
export function materialsProgressLabel(pc: CustomerListPrimaryVisaCaseSummary): string {
  const applicable = materialChecklistApplicableTotal(pc)
  const collected = pc.materialChecklistCollected ?? 0
  return `${collected}/${applicable}`
}

/**
 * 将主展示案件状态枚举解析为当前语言下的案件状态标签文案。
 *
 * @param pc - 主展示案件摘要
 * @returns 本地化状态名；未知枚举时退回原始 `caseStatus` 字符串
 */
export function primaryCaseStatusLabel(pc: CustomerListPrimaryVisaCaseSummary): string {
  return VisaCaseStatusLabel[pc.caseStatus as VisaCaseStatus] ?? pc.caseStatus
}

/**
 * 组合案件状态、材料进度百分比与已收/适用分数，供顶区 `el-progress` 文案扫读（不含期限或 ETA 字样，遵守 docs/36）。
 *
 * @param pc - 主展示案件摘要；为 `null` 时返回空串
 * @param percentage - Element Plus 传入的 0–100 进度百分比
 * @returns 例如 `进行中 67% · 2/3`
 */
export function formatContextStripMaterialsProgressBar(
  pc: CustomerListPrimaryVisaCaseSummary | null,
  percentage: number,
): string {
  if (!pc) {
    return ''
  }
  const status = primaryCaseStatusLabel(pc)
  const frac = materialsProgressLabel(pc)
  return `${status} ${percentage}% · ${frac}`
}
