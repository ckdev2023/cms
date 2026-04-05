import { describe, expect, it } from 'vitest'

import {
  FamilyLinkMode,
  FamilyRelation,
  VisaCaseFeeStatus,
  VisaCaseStatus,
} from '@/constants/enums'

import { buildVisaCasePayload } from './buildVisaCasePayload'
import type { CaseFormModel } from './types'

function baseForm(overrides: Partial<CaseFormModel> = {}): CaseFormModel {
  return {
    caseType: '',
    caseStatus: VisaCaseStatus.DRAFT,
    assignedTo: '',
    expireDate: '',
    nextFollowUpAt: '',
    materialStatus: '',
    feeStatus: '',
    isFamilyCase: false,
    familyLinkMode: '',
    internalPrimaryCustomerId: '',
    externalPrimaryName: '',
    externalPrimaryCaseType: '',
    externalPrimaryExpireDate: '',
    externalPrimaryRelationToApplicant: '',
    memo: '',
    ...overrides,
  }
}

describe('buildVisaCasePayload', () => {
  it('maps non-family case without family fields', () => {
    const payload = buildVisaCasePayload('cust-1', baseForm({ caseType: '就労' }))
    expect(payload.customerId).toBe('cust-1')
    expect(payload.caseType).toBe('就労')
    expect(payload.isFamilyCase).toBe(false)
    expect(payload.familyLinkMode).toBeUndefined()
    expect(payload.internalPrimaryCustomerId).toBeUndefined()
    expect(payload.externalPrimaryName).toBeUndefined()
  })

  it('includes internal primary when family internal mode', () => {
    const payload = buildVisaCasePayload(
      'cust-2',
      baseForm({
        isFamilyCase: true,
        familyLinkMode: FamilyLinkMode.INTERNAL,
        internalPrimaryCustomerId: 'primary-id',
      }),
    )
    expect(payload.internalPrimaryCustomerId).toBe('primary-id')
    expect(payload.externalPrimaryName).toBeUndefined()
  })

  it('includes external primary fields when family external mode', () => {
    const payload = buildVisaCasePayload(
      'cust-3',
      baseForm({
        isFamilyCase: true,
        familyLinkMode: FamilyLinkMode.EXTERNAL,
        externalPrimaryName: '山田',
        externalPrimaryCaseType: '永住',
        externalPrimaryExpireDate: '2026-01-01',
      }),
    )
    expect(payload.externalPrimaryName).toBe('山田')
    expect(payload.externalPrimaryCaseType).toBe('永住')
    expect(payload.externalPrimaryExpireDate).toBe('2026-01-01')
    expect(payload.internalPrimaryCustomerId).toBeUndefined()
  })

  it('includes external primary relation when family external mode and selected', () => {
    const payload = buildVisaCasePayload(
      'cust-3b',
      baseForm({
        isFamilyCase: true,
        familyLinkMode: FamilyLinkMode.EXTERNAL,
        externalPrimaryName: '山田',
        externalPrimaryRelationToApplicant: FamilyRelation.SPOUSE,
      }),
    )
    expect(payload.externalPrimaryRelationToApplicant).toBe(FamilyRelation.SPOUSE)
  })

  it('serializes nextFollowUpAt to ISO string when set', () => {
    const payload = buildVisaCasePayload(
      'cust-4',
      baseForm({ nextFollowUpAt: '2026-04-01T10:30' }),
    )
    expect(payload.nextFollowUpAt).toBe(new Date('2026-04-01T10:30').toISOString())
  })

  it('casts feeStatus when provided as string', () => {
    const payload = buildVisaCasePayload(
      'cust-5',
      baseForm({ feeStatus: VisaCaseFeeStatus.NOT_BILLED }),
    )
    expect(payload.feeStatus).toBe(VisaCaseFeeStatus.NOT_BILLED)
  })

  it('家庭案未选关联方式时不附带 familyLinkMode 与主申字段', () => {
    const payload = buildVisaCasePayload(
      'cust-6',
      baseForm({
        isFamilyCase: true,
        familyLinkMode: '',
        internalPrimaryCustomerId: 'should-not-leak',
        externalPrimaryName: '外部',
      }),
    )
    expect(payload.isFamilyCase).toBe(true)
    expect(payload.familyLinkMode).toBeUndefined()
    expect(payload.internalPrimaryCustomerId).toBeUndefined()
    expect(payload.externalPrimaryName).toBeUndefined()
  })
})
