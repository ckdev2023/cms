import { describe, expect, it } from 'vitest'

import { VisaCaseStatus } from '@/constants/enums'
import type { VisaCaseStatusCountItem } from '@/types/visa-case'

import { sumVisaOpenCaseCountFromStatusCounts } from './visa-workbench-open-case-count'

describe('sumVisaOpenCaseCountFromStatusCounts', () => {
  it('sums counts excluding COMPLETED and CANCELLED', () => {
    const rows: VisaCaseStatusCountItem[] = [
      { caseStatus: VisaCaseStatus.IN_PROGRESS, count: 3 },
      { caseStatus: VisaCaseStatus.COMPLETED, count: 10 },
      { caseStatus: VisaCaseStatus.CANCELLED, count: 2 },
      { caseStatus: VisaCaseStatus.DRAFT, count: 1 },
    ]
    expect(sumVisaOpenCaseCountFromStatusCounts(rows)).toBe(4)
  })

  it('returns 0 for empty rows', () => {
    expect(sumVisaOpenCaseCountFromStatusCounts([])).toBe(0)
  })
})
