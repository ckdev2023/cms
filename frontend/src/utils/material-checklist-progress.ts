/**
 * 计算主展示案件 checklist 的适用项总数（含 NOT_COLLECTED + COLLECTED，不含 NOT_APPLICABLE）。
 *
 * @param summary - 列表或详情主展示案件摘要上的 checklist 计数字段
 * @param summary.materialChecklistTotal - checklist 条目总数
 * @param summary.materialChecklistNotApplicable - 标记为不适用的条目数
 * @returns 非负整数；无清单项时为 0
 */
export function materialChecklistApplicableTotal(summary: {
  materialChecklistTotal: number
  materialChecklistNotApplicable: number
}): number {
  return Math.max(
    0,
    summary.materialChecklistTotal - summary.materialChecklistNotApplicable,
  )
}
