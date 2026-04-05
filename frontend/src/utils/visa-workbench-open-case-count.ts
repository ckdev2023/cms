import { VisaCaseStatus } from '@/constants/enums'
import type { VisaCaseStatusCountItem } from '@/types/visa-case'

/** 与 `loadDomainStatsOpenCaseSegment` 一致：未完结且未取消（`COMPLETED` / `CANCELLED` 除外）。 */
const TERMINAL_VISA_CASE_STATUSES: ReadonlySet<VisaCaseStatus> = new Set([
  VisaCaseStatus.COMPLETED,
  VisaCaseStatus.CANCELLED,
])

/**
 * 将 `caseStatusCounts` 中开放状态（非完结、非取消）的件数求和，作为工作台「在办合计」展示值。
 *
 * @param rows - `VisaDomainStats.caseStatusCounts` 全枚举轴计数行
 * @returns 开放案件件数合计
 */
export function sumVisaOpenCaseCountFromStatusCounts(rows: VisaCaseStatusCountItem[]): number {
  return rows.reduce((acc, row) => {
    if (TERMINAL_VISA_CASE_STATUSES.has(row.caseStatus)) {
      return acc
    }
    return acc + row.count
  }, 0)
}
