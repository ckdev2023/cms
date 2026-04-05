/**
 * 签证案件编辑对话框：EXTERNAL 家族签下展示「外部主申与本案申请人关系」表单项（Vitest）。
 */
import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  FamilyLinkMode,
  FamilyRelation,
  VisaCaseFeeStatus,
  VisaCaseStatus,
} from '@/constants/enums'
import { i18n } from '@/i18n'
import type { VisaCaseItem } from '@/types/visa-case'

import CustomerVisaCaseDialog from './CustomerVisaCaseDialog.vue'

vi.mock('@/api/system', () => ({
  getUsers: vi.fn().mockResolvedValue({
    code: 0,
    message: 'ok',
    data: { items: [], page: 1, pageSize: 200, total: 0 },
  }),
}))

vi.mock('@/api/customer', () => ({
  getCustomers: vi.fn().mockResolvedValue({
    code: 0,
    message: 'ok',
    data: { items: [], page: 1, pageSize: 20, total: 0 },
  }),
}))

vi.mock('@/api/visa-case', () => ({
  getFamilyMembers: vi.fn().mockResolvedValue({
    code: 0,
    message: 'ok',
    data: [],
  }),
}))

/**
 * 构造编辑态所需的最小 `VisaCaseItem`，仅填 EXTERNAL 家族签与关系字段相关属性。
 *
 * @param overrides - 覆盖默认字段的可选片段
 */
function minimalExternalVisaCase(
  overrides: Partial<VisaCaseItem> = {},
): VisaCaseItem {
  return {
    id: 'vc-1',
    customerId: 'cust-1',
    caseType: null,
    caseStatus: VisaCaseStatus.IN_PROGRESS,
    isFamilyCase: true,
    familyLinkMode: FamilyLinkMode.EXTERNAL,
    internalPrimaryCustomerId: null,
    internalPrimaryCustomerName: null,
    externalPrimaryName: '外部主申',
    externalPrimaryCaseType: null,
    externalPrimaryExpireDate: null,
    externalPrimaryRelationToApplicant: FamilyRelation.SPOUSE,
    assignedTo: null,
    assigneeName: null,
    expireDate: null,
    nextFollowUpAt: null,
    materialStatus: null,
    feeStatus: VisaCaseFeeStatus.NOT_BILLED,
    memo: null,
    createdBy: null,
    creatorName: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    familyMembers: [],
    ...overrides,
  }
}

describe('CustomerVisaCaseDialog (EXTERNAL primary relation UI)', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('renders external primary relation field when family case is EXTERNAL', async () => {
    i18n.global.locale.value = 'zh-CN'
    const wrapper = mount(CustomerVisaCaseDialog, {
      props: {
        visible: true,
        isEditing: true,
        initialValue: minimalExternalVisaCase(),
        familyMembers: [],
        submitting: false,
      },
      attachTo: document.body,
      global: {
        plugins: [i18n, ElementPlus],
      },
    })

    await flushPromises()
    expect(document.body.textContent ?? '').toContain(
      String(
        i18n.global.t(
          'detailViews.customer.visaCasesTab.externalPrimaryRelationToApplicant',
        ),
      ),
    )

    wrapper.unmount()
  })
})
