import { describe, expect, it } from 'vitest'

import { MaterialStatus, VisaCaseStatus } from '@/constants/enums'
import type { CustomerListPrimaryVisaCaseSummary } from '@/types/customer'

import {
  computeContextStripDatePriority,
  formatContextStripMaterialsProgressBar,
  materialsProgressLabel,
} from './customer-detail-context-strip-helpers'

/**
 * 构造 `CustomerListPrimaryVisaCaseSummary` 最小桩，供进度条与日期优先级断言使用。
 *
 * @param overrides - 可选字段覆盖
 * @returns 摘要对象
 */
function minimalPc(
  overrides: Partial<CustomerListPrimaryVisaCaseSummary> = {},
): CustomerListPrimaryVisaCaseSummary {
  return {
    visaCaseId: 'vc-1',
    caseType: null,
    caseStatus: VisaCaseStatus.IN_PROGRESS,
    expireDate: '2026-12-31',
    nextFollowUpAt: '2026-06-15',
    assignedToUserId: null,
    assignedToDisplayName: null,
    isFamilyCase: false,
    familyLinkMode: null,
    familyDependentsCount: 0,
    materialStatus: MaterialStatus.PARTIAL,
    materialChecklistTotal: 5,
    materialChecklistCollected: 2,
    materialChecklistNotApplicable: 2,
    materialChecklistSuggestedStatus: MaterialStatus.PARTIAL,
    materialChecklistOutOfSync: false,
    ...overrides,
  }
}

describe('customer-detail-context-strip-helpers', () => {
  it('formatContextStripMaterialsProgressBar 拼接状态、百分比与分数且 pc 为空时返回空串', () => {
    expect(formatContextStripMaterialsProgressBar(null, 50)).toBe('')
    const pc = minimalPc()
    expect(formatContextStripMaterialsProgressBar(pc, 67)).toMatch(/67%/)
    expect(formatContextStripMaterialsProgressBar(pc, 67)).toContain(materialsProgressLabel(pc))
  })

  it('computeContextStripDatePriority 在双日期皆空时不标紧迫', () => {
    expect(
      computeContextStripDatePriority(
        minimalPc({ nextFollowUpAt: null, expireDate: null }),
      ),
    ).toEqual({ nextFollowUp: false, expireDate: false })
  })

  it('computeContextStripDatePriority 在跟进早于在留时仅标跟进', () => {
    expect(
      computeContextStripDatePriority(
        minimalPc({ nextFollowUpAt: '2026-03-01', expireDate: '2026-12-31' }),
      ),
    ).toEqual({ nextFollowUp: true, expireDate: false })
  })
})
