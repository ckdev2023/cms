import { describe, expect, it } from 'vitest'

import { FamilyLinkMode, VisaCaseStatus } from '@/constants/enums'

import type { CaseFormModel } from './types'
import { canProceedVisaWizardStep1 } from './wizardStepValidation'

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

describe('canProceedVisaWizardStep1', () => {
  it('allows proceed when not a family case', () => {
    expect(canProceedVisaWizardStep1(baseForm({ isFamilyCase: false }))).toBe(true)
  })

  it('blocks when family case but link mode empty', () => {
    expect(
      canProceedVisaWizardStep1(baseForm({ isFamilyCase: true, familyLinkMode: '' })),
    ).toBe(false)
  })

  it('blocks internal mode without primary customer id', () => {
    expect(
      canProceedVisaWizardStep1(
        baseForm({
          isFamilyCase: true,
          familyLinkMode: FamilyLinkMode.INTERNAL,
          internalPrimaryCustomerId: '',
        }),
      ),
    ).toBe(false)
  })

  it('allows internal mode with primary customer id', () => {
    expect(
      canProceedVisaWizardStep1(
        baseForm({
          isFamilyCase: true,
          familyLinkMode: FamilyLinkMode.INTERNAL,
          internalPrimaryCustomerId: 'p1',
        }),
      ),
    ).toBe(true)
  })

  it('blocks external mode without external name', () => {
    expect(
      canProceedVisaWizardStep1(
        baseForm({
          isFamilyCase: true,
          familyLinkMode: FamilyLinkMode.EXTERNAL,
          externalPrimaryName: '',
        }),
      ),
    ).toBe(false)
  })

  it('allows external mode with external name', () => {
    expect(
      canProceedVisaWizardStep1(
        baseForm({
          isFamilyCase: true,
          familyLinkMode: FamilyLinkMode.EXTERNAL,
          externalPrimaryName: '名前',
        }),
      ),
    ).toBe(true)
  })

  it('家庭案 INTERNAL 时主申 ID 为非空字符串（含仅空白）当前视为已填写', () => {
    expect(
      canProceedVisaWizardStep1(
        baseForm({
          isFamilyCase: true,
          familyLinkMode: FamilyLinkMode.INTERNAL,
          internalPrimaryCustomerId: '   ',
        }),
      ),
    ).toBe(true)
  })
})
