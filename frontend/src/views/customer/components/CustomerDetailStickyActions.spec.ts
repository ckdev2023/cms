/**
 * 客户详情底部 sticky 条：左侧状态摘要、右侧新增记录/催促补件/主 CTA 与深链（Vitest）。
 */
import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import type { Pinia } from 'pinia'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { h } from 'vue'
import type { Router } from 'vue-router'
import { createMemoryHistory, createRouter } from 'vue-router'

import { MaterialStatus, VisaCaseStatus } from '@/constants/enums'
import { P } from '@/constants/permissions'
import { i18n } from '@/i18n'
import { useUserStore } from '@/stores/user'
import type { CustomerListPrimaryVisaCaseSummary } from '@/types/customer'

import CustomerDetailStickyActions from './CustomerDetailStickyActions.vue'

/**
 * 构造主展示案件摘要最小对象。
 *
 * @param overrides - 可选字段覆盖
 * @returns 摘要对象
 */
function minimalPrimaryCase(
  overrides: Partial<CustomerListPrimaryVisaCaseSummary> = {},
): CustomerListPrimaryVisaCaseSummary {
  return {
    visaCaseId: 'vc-sticky-1',
    caseType: null,
    caseStatus: VisaCaseStatus.IN_PROGRESS,
    expireDate: null,
    nextFollowUpAt: null,
    assignedToUserId: null,
    assignedToDisplayName: null,
    isFamilyCase: false,
    familyLinkMode: null,
    familyDependentsCount: 0,
    materialStatus: MaterialStatus.PARTIAL,
    materialChecklistTotal: 0,
    materialChecklistCollected: 0,
    materialChecklistNotApplicable: 0,
    materialChecklistSuggestedStatus: MaterialStatus.PARTIAL,
    materialChecklistOutOfSync: false,
    ...overrides,
  }
}

/**
 * 初始化 Pinia 用户权限。
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
 * 挂载底部快捷条并可选监听 `router.push`。
 *
 * @param opts - 权限与 props
 * @returns wrapper、router、pushSpy
 */
async function mountSticky(opts: {
  permissions: string[]
  customerId?: string
  listPrimaryVisaCase: CustomerListPrimaryVisaCaseSummary | null
  routeQuery?: Record<string, string>
  spyPush?: boolean
}): Promise<{
  wrapper: ReturnType<typeof mount>
  router: Router
  pushSpy: ReturnType<typeof vi.spyOn> | null
}> {
  const customerId = opts.customerId ?? 'cust-sticky'
  const pinia = initPiniaWithPermissions(opts.permissions)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: '/customers/:id',
        name: 'CustomerDetailStub',
        component: { render: () => h('div') },
      },
    ],
  })
  await router.push({
    path: `/customers/${customerId}`,
    query: opts.routeQuery ?? {},
  })
  await router.isReady()
  const pushSpy = opts.spyPush ? vi.spyOn(router, 'push').mockResolvedValue(undefined) : null

  const wrapper = mount(CustomerDetailStickyActions, {
    props: {
      customerId,
      listPrimaryVisaCase: opts.listPrimaryVisaCase,
    },
    global: {
      plugins: [pinia, router, i18n, ElementPlus],
    },
  })
  await flushPromises()
  return { wrapper, router, pushSpy }
}

beforeEach(() => {
  vi.clearAllMocks()
  i18n.global.locale.value = 'zh-CN'
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('CustomerDetailStickyActions — render rules', () => {
  it('主展示案件为空时不渲染条', async () => {
    const { wrapper } = await mountSticky({
      permissions: [P.VISA_CASE_LIST],
      listPrimaryVisaCase: null,
    })
    expect(wrapper.find('.customer-detail-sticky-actions').exists()).toBe(false)
  })

  it('有案件但无任何操作权限时仍渲染条并展示左侧状态', async () => {
    const { wrapper } = await mountSticky({
      permissions: [],
      listPrimaryVisaCase: minimalPrimaryCase({
        materialChecklistTotal: 5,
        materialChecklistNotApplicable: 0,
        materialChecklistCollected: 2,
      }),
    })
    expect(wrapper.find('.customer-detail-sticky-actions').exists()).toBe(true)
    expect(wrapper.find('.customer-detail-sticky-actions__actions').exists()).toBe(false)
    const text = wrapper.find('.customer-detail-sticky-actions__status').text()
    expect(text).toContain('2/5')
    expect(text).toContain(
      String(i18n.global.t('detailViews.customer.stickyActions.caseMaterialsNarrative', { status: '进行中', materials: '2/5' })),
    )
  })
})

describe('CustomerDetailStickyActions — Stitch button row', () => {
  it('可打开案件且可写日志时渲染新增记录、催促补件与主按钮打开案件', async () => {
    const { wrapper, pushSpy } = await mountSticky({
      permissions: [P.VISA_CASE_LIST, P.VISA_CASE_LOG_CREATE],
      listPrimaryVisaCase: minimalPrimaryCase({ visaCaseId: 'vc-all' }),
      spyPush: true,
    })
    const newRec = wrapper.findAll('button').find((b) =>
      String(b.text()).includes(String(i18n.global.t('detailViews.customer.stickyActions.newRecordCta'))),
    )
    const urge = wrapper.findAll('button').find((b) =>
      String(b.text()).includes(
        String(i18n.global.t('detailViews.customer.stitchLayout.urgeSupplementCta')),
      ),
    )
    const open = wrapper.findAll('button').find((b) =>
      String(b.text()).includes(String(i18n.global.t('detailViews.customer.contextStrip.openCase'))),
    )
    expect(newRec).toBeTruthy()
    expect(urge).toBeTruthy()
    expect(open).toBeTruthy()

    await urge!.trigger('click')
    expect(pushSpy).toHaveBeenCalledWith({
      path: '/customers/cust-sticky',
      query: {
        tab: 'visa-domain',
        visaDomainBlock: 'materials',
        materialsVisaCaseId: 'vc-all',
      },
    })
  })

  it('催促补件深链合并保留 dataScope 与合法 assignedTo', async () => {
    const { wrapper, pushSpy } = await mountSticky({
      permissions: [P.VISA_CASE_LIST, P.VISA_CASE_LOG_CREATE],
      listPrimaryVisaCase: minimalPrimaryCase({ visaCaseId: 'vc-preserve' }),
      routeQuery: {
        dataScope: 'team',
        assignedTo: 'aaaaaaaa-bbbb-4ccc-8aaa-123456789012',
      },
      spyPush: true,
    })
    const urge = wrapper.findAll('button').find((b) =>
      String(b.text()).includes(
        String(i18n.global.t('detailViews.customer.stitchLayout.urgeSupplementCta')),
      ),
    )
    expect(urge).toBeTruthy()
    await urge!.trigger('click')
    expect(pushSpy).toHaveBeenCalledWith({
      path: '/customers/cust-sticky',
      query: expect.objectContaining({
        dataScope: 'team',
        assignedTo: 'aaaaaaaa-bbbb-4ccc-8aaa-123456789012',
        tab: 'visa-domain',
        visaDomainBlock: 'materials',
        materialsVisaCaseId: 'vc-preserve',
      }),
    })
  })

  it('有案件且可打开案件但不可写日志时不展示新增记录', async () => {
    const { wrapper } = await mountSticky({
      permissions: [P.VISA_CASE_LIST],
      listPrimaryVisaCase: minimalPrimaryCase(),
    })
    expect(
      wrapper.findAll('button').filter((b) =>
        String(b.text()).includes(String(i18n.global.t('detailViews.customer.stickyActions.newRecordCta'))),
      ),
    ).toHaveLength(0)
  })
})

describe('CustomerDetailStickyActions — primary CTA deep links', () => {
  it('有案件且仅有写日志权限时仅渲染主按钮写日志深链', async () => {
    const { wrapper, pushSpy } = await mountSticky({
      permissions: [P.VISA_CASE_LOG_CREATE],
      listPrimaryVisaCase: minimalPrimaryCase({ visaCaseId: 'vc-log' }),
      spyPush: true,
    })
    expect(
      wrapper.findAll('button').filter((b) =>
        String(b.text()).includes(
          String(i18n.global.t('detailViews.customer.stitchLayout.urgeSupplementCta')),
        ),
      ),
    ).toHaveLength(0)
    const btn = wrapper.findAll('button').find((b) =>
      String(b.text()).includes(String(i18n.global.t('detailViews.customer.contextStrip.writeLog'))),
    )
    expect(btn).toBeTruthy()
    await btn!.trigger('click')
    expect(pushSpy).toHaveBeenCalledWith({
      path: '/customers/cust-sticky',
      query: {
        tab: 'visa-domain',
        visaDomainBlock: 'logs',
        logVisaCaseId: 'vc-log',
        openVisaCaseLogForm: '1',
      },
    })
  })

  it('有案件且可打开案件上下文时主按钮打开案件深链', async () => {
    const { wrapper, pushSpy } = await mountSticky({
      permissions: [P.VISA_CASE_LIST],
      listPrimaryVisaCase: minimalPrimaryCase({ visaCaseId: 'vc-open' }),
      spyPush: true,
    })
    const btn = wrapper.findAll('button').find((b) =>
      String(b.text()).includes(String(i18n.global.t('detailViews.customer.contextStrip.openCase'))),
    )
    expect(btn).toBeTruthy()
    await btn!.trigger('click')
    expect(pushSpy).toHaveBeenCalledWith({
      path: '/customers/cust-sticky',
      query: {
        tab: 'visa-domain',
        openVisaCaseId: 'vc-open',
      },
    })
  })
})
