import { describe, expect, it } from 'vitest'

import { VisaCaseStatus, VisaReminderType } from '@/constants/enums'
import type { VisaReminderItem, VisaWorkbenchAggregate } from '@/types/visa-case'

import { isVisaWorkbenchAggregateBusinessEmpty } from './visa-workbench-aggregate-empty'

const baseEmpty: VisaWorkbenchAggregate = {
  stats: {
    caseStatusCounts: [],
    reminderBuckets: {
      supplement: 0,
      todayFollowUp: 0,
      expiring7Days: 0,
      expiring2Months: 0,
      noBucket: 0,
    },
    expiringWithin7DaysWindow: 0,
    todayFollowUpCount: 0,
    supplementRelatedCount: 0,
    unassignedCount: 0,
  },
  reminderPreviews: {
    supplement: [],
    todayFollowUp: [],
    expiring7Days: [],
    expiring2Months: [],
  },
}

describe('isVisaWorkbenchAggregateBusinessEmpty', () => {
  it('returns true for all-zero stats and empty preview arrays', () => {
    expect(isVisaWorkbenchAggregateBusinessEmpty(baseEmpty)).toBe(true)
  })

  it('returns false when any preview row exists', () => {
    const row: VisaReminderItem = {
      id: 'vc1',
      customerId: 'c1',
      customerName: 'A',
      caseType: null,
      caseStatus: VisaCaseStatus.DRAFT,
      assignedTo: null,
      assigneeName: null,
      expireDate: null,
      nextFollowUpAt: null,
      materialStatus: null,
      reminderType: VisaReminderType.SUPPLEMENT,
      daysLeft: null,
    }
    const payload: VisaWorkbenchAggregate = {
      ...baseEmpty,
      reminderPreviews: {
        ...baseEmpty.reminderPreviews,
        supplement: [row],
      },
    }
    expect(isVisaWorkbenchAggregateBusinessEmpty(payload)).toBe(false)
  })
})
