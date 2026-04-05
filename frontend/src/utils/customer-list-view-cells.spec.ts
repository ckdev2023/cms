import { describe, expect, it } from 'vitest'

import {
  CustomerStatus,
  CustomerType,
  MaterialStatus,
  ServiceType,
  VisaCaseStatus,
  VisaReminderType,
} from '@/constants/enums'
import type { CustomerItem, CustomerListPrimaryVisaCaseSummary } from '@/types/customer'

import {
  listPrimaryCaseFallbackBadgeAnchor,
  visaDerivedRiskShowPrimaryFallbackEmptyHint,
} from './customer-list-view-cells'

/** 单测用最小 `CustomerListPrimaryVisaCaseSummary` 桩（仅校验派生列提示分支）。 */
const minimalPrimarySummary = {
  visaCaseId: '00000000-0000-4000-8000-000000000001',
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
} satisfies CustomerListPrimaryVisaCaseSummary

/**
 * 构造带断言的列表行桩，避免 `CustomerItem` 全字段噪音。
 *
 * @param partial - 覆盖默认桩字段的局部
 * @returns 满足 `CustomerItem` 形状的最小行对象
 */
function makeRow(partial: Partial<CustomerItem>): CustomerItem {
  return {
    id: 'c1',
    customerCode: 'TEST-1',
    customerType: CustomerType.PERSONAL,
    customerName: 'Test',
    phone: null,
    email: null,
    wechatId: null,
    lineId: null,
    address: null,
    serviceType: ServiceType.ADMIN,
    ownerUserId: null,
    ownerName: null,
    status: CustomerStatus.ACTIVE,
    photoFileId: null,
    companyInfo: null,
    personInfo: null,
    createdAt: '',
    updatedAt: '',
    ...partial,
  }
}

describe('visaDerivedRiskShowPrimaryFallbackEmptyHint', () => {
  it('returns true when primary summary is fallback and derived bucket is empty', () => {
    expect(
      visaDerivedRiskShowPrimaryFallbackEmptyHint(
        makeRow({
          listPrimaryVisaCaseSource: 'PRIMARY_CUSTOMER_FALLBACK',
          listPrimaryVisaCase: minimalPrimarySummary,
          visaDerivedRisk: null,
        }),
      ),
    ).toBe(true)
  })

  it('returns false when source is SELF', () => {
    expect(
      visaDerivedRiskShowPrimaryFallbackEmptyHint(
        makeRow({
          listPrimaryVisaCaseSource: 'SELF',
          listPrimaryVisaCase: minimalPrimarySummary,
          visaDerivedRisk: null,
        }),
      ),
    ).toBe(false)
  })

  it('returns false when derived bucket is present', () => {
    expect(
      visaDerivedRiskShowPrimaryFallbackEmptyHint(
        makeRow({
          listPrimaryVisaCaseSource: 'PRIMARY_CUSTOMER_FALLBACK',
          listPrimaryVisaCase: minimalPrimarySummary,
          visaDerivedRisk: VisaReminderType.SUPPLEMENT,
        }),
      ),
    ).toBe(false)
  })

  it('returns false when list primary case is absent', () => {
    expect(
      visaDerivedRiskShowPrimaryFallbackEmptyHint(
        makeRow({
          listPrimaryVisaCaseSource: 'PRIMARY_CUSTOMER_FALLBACK',
          listPrimaryVisaCase: null,
          visaDerivedRisk: null,
        }),
      ),
    ).toBe(false)
  })
})

describe('listPrimaryCaseFallbackBadgeAnchor', () => {
  it('returns null when source is not fallback', () => {
    expect(
      listPrimaryCaseFallbackBadgeAnchor(
        makeRow({
          listPrimaryVisaCaseSource: 'SELF',
          listPrimaryVisaCase: { ...minimalPrimarySummary, caseType: '技人国' },
        }),
      ),
    ).toBe(null)
  })

  it('anchors to caseType when non-empty', () => {
    expect(
      listPrimaryCaseFallbackBadgeAnchor(
        makeRow({
          listPrimaryVisaCaseSource: 'PRIMARY_CUSTOMER_FALLBACK',
          listPrimaryVisaCase: { ...minimalPrimarySummary, caseType: '技人国' },
        }),
      ),
    ).toBe('caseType')
  })

  it('anchors to status when caseType empty', () => {
    expect(
      listPrimaryCaseFallbackBadgeAnchor(
        makeRow({
          listPrimaryVisaCaseSource: 'PRIMARY_CUSTOMER_FALLBACK',
          listPrimaryVisaCase: { ...minimalPrimarySummary, caseType: null },
        }),
      ),
    ).toBe('status')
  })

  it('anchors to expire when type and status columns have no visible text', () => {
    expect(
      listPrimaryCaseFallbackBadgeAnchor(
        makeRow({
          listPrimaryVisaCaseSource: 'PRIMARY_CUSTOMER_FALLBACK',
          listPrimaryVisaCase: {
            ...minimalPrimarySummary,
            caseType: null,
            caseStatus: '' as unknown as VisaCaseStatus,
            expireDate: '2026-01-01',
          },
        }),
      ),
    ).toBe('expire')
  })
})
