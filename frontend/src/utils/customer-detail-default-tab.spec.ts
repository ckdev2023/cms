import { describe, expect, it } from 'vitest'

import { MaterialStatus, VisaCaseStatus } from '@/constants/enums'
import { customerDetailPrefersVisaDomainTab } from '@/utils/customer-detail-default-tab'

describe('customerDetailPrefersVisaDomainTab', () => {
  it('returns false when listPrimaryVisaCase is absent', () => {
    expect(customerDetailPrefersVisaDomainTab({})).toBe(false)
    expect(customerDetailPrefersVisaDomainTab({ listPrimaryVisaCase: null })).toBe(
      false,
    )
  })

  it('returns true for draft and in-progress primary case statuses', () => {
    expect(
      customerDetailPrefersVisaDomainTab({
        listPrimaryVisaCase: {
          visaCaseId: 'x',
          caseType: null,
          caseStatus: VisaCaseStatus.DRAFT,
          expireDate: null,
          nextFollowUpAt: null,
          assignedToUserId: null,
          assignedToDisplayName: null,
          isFamilyCase: false,
          familyLinkMode: null,
          familyDependentsCount: 0,
          materialStatus: null,
          materialChecklistTotal: 0,
          materialChecklistCollected: 0,
          materialChecklistNotApplicable: 0,
          materialChecklistSuggestedStatus: MaterialStatus.NOT_RECEIVED,
          materialChecklistOutOfSync: false,
        },
      }),
    ).toBe(true)
    expect(
      customerDetailPrefersVisaDomainTab({
        listPrimaryVisaCase: {
          visaCaseId: 'x',
          caseType: null,
          caseStatus: VisaCaseStatus.IN_PROGRESS,
          expireDate: null,
          nextFollowUpAt: null,
          assignedToUserId: null,
          assignedToDisplayName: null,
          isFamilyCase: false,
          familyLinkMode: null,
          familyDependentsCount: 0,
          materialStatus: null,
          materialChecklistTotal: 0,
          materialChecklistCollected: 0,
          materialChecklistNotApplicable: 0,
          materialChecklistSuggestedStatus: MaterialStatus.NOT_RECEIVED,
          materialChecklistOutOfSync: false,
        },
      }),
    ).toBe(true)
  })

  it('returns false for completed or cancelled primary case', () => {
    expect(
      customerDetailPrefersVisaDomainTab({
        listPrimaryVisaCase: {
          visaCaseId: 'x',
          caseType: null,
          caseStatus: VisaCaseStatus.COMPLETED,
          expireDate: null,
          nextFollowUpAt: null,
          assignedToUserId: null,
          assignedToDisplayName: null,
          isFamilyCase: false,
          familyLinkMode: null,
          familyDependentsCount: 0,
          materialStatus: null,
          materialChecklistTotal: 0,
          materialChecklistCollected: 0,
          materialChecklistNotApplicable: 0,
          materialChecklistSuggestedStatus: MaterialStatus.NOT_RECEIVED,
          materialChecklistOutOfSync: false,
        },
      }),
    ).toBe(false)
  })
})
