import type { VisaWorkbenchAggregate } from '@/types/visa-case'

/**
 * 判断工作台聚合响应是否为「接口成功但业务全域空」：KPI 与四分桶计数均为 0、无正向状态分布、四类预览均无行。
 *
 * @param aggregate - `GET /workbench/visa` 成功体
 * @returns 满足上述条件时返回 true，用于展示信息态空说明而非加载失败
 */
export function isVisaWorkbenchAggregateBusinessEmpty(aggregate: VisaWorkbenchAggregate): boolean {
  const { stats, reminderPreviews } = aggregate
  const rb = stats.reminderBuckets
  if (
    stats.unassignedCount !== 0 ||
    stats.expiringWithin7DaysWindow !== 0 ||
    stats.todayFollowUpCount !== 0 ||
    stats.supplementRelatedCount !== 0
  ) {
    return false
  }
  if (
    rb.supplement !== 0 ||
    rb.todayFollowUp !== 0 ||
    rb.expiring7Days !== 0 ||
    rb.expiring2Months !== 0 ||
    rb.noBucket !== 0
  ) {
    return false
  }
  if (stats.caseStatusCounts.some((row) => row.count > 0)) {
    return false
  }
  const keys: (keyof typeof reminderPreviews)[] = [
    'supplement',
    'todayFollowUp',
    'expiring7Days',
    'expiring2Months',
  ]
  for (const key of keys) {
    if (reminderPreviews[key].length > 0) {
      return false
    }
  }
  return true
}
