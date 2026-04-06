/**
 * 客户详情页眉紧凑摘要条：无 Stitch 顶区、仍含主展示案件操作（Vitest）。
 */
import type { VueWrapper } from '@vue/test-utils'
import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import type { Pinia } from 'pinia'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { h } from 'vue'
import type { Router } from 'vue-router'
import { createMemoryHistory, createRouter } from 'vue-router'

import {
  CustomerStatus,
  CustomerType,
  MaterialStatus,
  VisaCaseStatus,
} from '@/constants/enums'
import { P } from '@/constants/permissions'
import { i18n } from '@/i18n'
import { useUserStore } from '@/stores/user'
import type { CustomerListPrimaryVisaCaseSummary } from '@/types/customer'

import CustomerDetailContextStripCompact from './CustomerDetailContextStripCompact.vue'

/**
 * 构造列表主展示案件摘要的最小可用对象。
 *
 * @param overrides - 可选字段覆盖
 * @returns 摘要对象
 */
function minimalListPrimaryVisaCase(
  overrides: Partial<CustomerListPrimaryVisaCaseSummary> = {},
): CustomerListPrimaryVisaCaseSummary {
  return {
    visaCaseId: 'vc-compact-1',
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

/**
 * 使用给定权限初始化 Pinia 用户态。
 *
 * @param permissions - 权限码列表
 * @returns Pinia 实例
 */
function initPiniaWithPermissions(permissions: string[]): Pinia {
  const pinia = createPinia()
  setActivePinia(pinia)
  useUserStore(pinia).$patch({
    userInfo: {
      id: 'u1',
      username: 't',
      displayName: 'T',
      email: 't@t.jp',
      roles: [],
      permissions,
      status: 'ACTIVE',
    },
  })
  return pinia
}

/**
 * 创建客户详情用记忆路由。
 *
 * @returns 路由器
 */
function createCustomerDetailRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: '/customers/:id',
        name: 'CustomerDetailStub',
        component: { render: () => h('div') },
      },
    ],
  })
}

/**
 * 挂载页眉紧凑摘要条。
 *
 * @returns wrapper 与 router
 */
async function mountCompactStrip(): Promise<{
  wrapper: VueWrapper
  router: Router
}> {
  const customerId = 'cust-compact-1'
  const pinia = initPiniaWithPermissions([P.VISA_CASE_DETAIL])
  const router = createCustomerDetailRouter()
  await router.push({ path: `/customers/${customerId}`, query: {} })
  await router.isReady()

  const wrapper = mount(CustomerDetailContextStripCompact, {
    props: {
      customerId,
      customerName: '紧凑页眉客户',
      customerCode: 'C-COMP',
      customerType: CustomerType.PERSONAL,
      customerStatus: CustomerStatus.ACTIVE,
      listPrimaryVisaCase: minimalListPrimaryVisaCase(),
      listPrimaryVisaCaseSource: null,
      primaryCustomerIdForListFallback: null,
    },
    attachTo: document.body,
    global: {
      plugins: [pinia, router, i18n, ElementPlus],
    },
  })
  await flushPromises()
  return { wrapper, router }
}

beforeEach(() => {
  i18n.global.locale.value = 'zh-CN'
  vi.clearAllMocks()
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('CustomerDetailContextStripCompact', () => {
  it('不渲染 Stitch 顶区且仍展示姓名与打开案件', async () => {
    const { wrapper } = await mountCompactStrip()

    expect(wrapper.find('.customer-detail-context-strip--compact').exists()).toBe(true)
    expect(wrapper.find('.customer-detail-stitch-hero').exists()).toBe(false)
    expect(document.body.textContent ?? '').toContain('紧凑页眉客户')
    expect(document.body.textContent ?? '').toContain(
      String(i18n.global.t('detailViews.customer.contextStrip.openCase')),
    )

    wrapper.unmount()
  })
})
