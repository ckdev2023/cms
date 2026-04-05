/**
 * 客户详情摘要带（主展示案件）：挂载、空态与深链 `router.push` 参数（Vitest）。
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

import { MaterialStatus, VisaCaseStatus } from '@/constants/enums'
import { P } from '@/constants/permissions'
import { i18n } from '@/i18n'
import { useUserStore } from '@/stores/user'
import type {
  CustomerListPrimaryVisaCaseSummary,
  ListPrimaryVisaCaseSource,
} from '@/types/customer'
import { CUSTOMER_DETAIL_RETURN_QUERY_KEY } from '@/utils/customer-detail-return-navigation'

import CustomerDetailContextStrip from './CustomerDetailContextStrip.vue'

/**
 * 构造列表主展示案件摘要的最小可用对象，供摘要带展示与按钮深链使用。
 *
 * @param overrides - 覆盖默认字段的可选片段
 * @returns 与 `GET /customers/:id` `listPrimaryVisaCase` 对齐的摘要对象
 */
function minimalListPrimaryVisaCase(
  overrides: Partial<CustomerListPrimaryVisaCaseSummary> = {},
): CustomerListPrimaryVisaCaseSummary {
  return {
    visaCaseId: 'vc-strip-1',
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
 * 使用给定权限初始化 Pinia 用户态并设为当前 store。
 *
 * @param permissions - 模拟用户权限码列表
 * @returns 已 `setActivePinia` 的 Pinia 实例
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
 * 创建仅含客户详情路径的记忆路由，供 `useRoute` / `useRouter` 注入。
 *
 * @returns 未 `push` 初始地址的路由器实例
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

type StripMountOpts = {
  permissions: string[]
  customerId?: string
  listPrimaryVisaCase: CustomerListPrimaryVisaCaseSummary | null
  listPrimaryVisaCaseSource?: ListPrimaryVisaCaseSource
  primaryCustomerIdForListFallback?: string | null
  routeQuery?: Record<string, string>
}

/**
 * 挂载摘要带组件并完成初始路由 `push` / `isReady`，可选 spy `router.push`。
 *
 * @param opts - 权限、props 与初始 query
 * @param options.spyPush - 为 true 时对 `router.push` 打桩并返回 spy
 * @returns wrapper、router 与可选的 pushSpy
 */
async function mountContextStrip(
  opts: StripMountOpts,
  options?: { spyPush?: boolean },
): Promise<{ wrapper: VueWrapper; router: Router; pushSpy: ReturnType<typeof vi.spyOn> | null }> {
  const customerId = opts.customerId ?? 'cust-1'
  const pinia = initPiniaWithPermissions(opts.permissions)
  const router = createCustomerDetailRouter()
  await router.push({
    path: `/customers/${customerId}`,
    query: opts.routeQuery ?? {},
  })
  await router.isReady()
  const pushSpy = options?.spyPush
    ? vi.spyOn(router, 'push').mockResolvedValue(undefined)
    : null

  const wrapper = mount(CustomerDetailContextStrip, {
    props: {
      customerId,
      listPrimaryVisaCase: opts.listPrimaryVisaCase,
      listPrimaryVisaCaseSource: opts.listPrimaryVisaCaseSource ?? null,
      primaryCustomerIdForListFallback: opts.primaryCustomerIdForListFallback ?? null,
    },
    attachTo: document.body,
    global: {
      plugins: [pinia, router, i18n, ElementPlus],
    },
  })
  await flushPromises()
  return { wrapper, router, pushSpy }
}

/**
 * 在摘要带内按 i18n 文案匹配并点击第一个按钮。
 *
 * @param wrapper - 已挂载的摘要带 wrapper
 * @param messageKey - `detailViews.customer.contextStrip` 下的子键
 */
async function clickContextStripButton(
  wrapper: VueWrapper,
  messageKey: string,
): Promise<void> {
  const label = String(
    i18n.global.t(`detailViews.customer.contextStrip.${messageKey}`),
  )
  await wrapper
    .findAll('button')
    .find((b) => (b.text() ?? '').includes(label))
    ?.trigger('click')
  await flushPromises()
}

beforeEach(() => {
  i18n.global.locale.value = 'zh-CN'
  vi.clearAllMocks()
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('CustomerDetailContextStrip — render', () => {
  it('有主展示案件时展示标题、材料进度与操作入口', async () => {
    const { wrapper } = await mountContextStrip({
      permissions: [P.VISA_CASE_DETAIL, P.VISA_CASE_LOG_CREATE],
      listPrimaryVisaCase: minimalListPrimaryVisaCase(),
    })

    const title = i18n.global.t('detailViews.customer.contextStrip.title')
    expect(document.body.textContent ?? '').toContain(title)
    expect(document.body.textContent ?? '').toContain('2/3')
    expect(document.body.textContent ?? '').toContain(
      String(i18n.global.t('detailViews.customer.contextStrip.openCase')),
    )
    expect(document.body.textContent ?? '').toContain(
      String(i18n.global.t('detailViews.customer.contextStrip.viewAllVisaCases')),
    )
    expect(document.body.textContent ?? '').toContain(
      String(i18n.global.t('detailViews.customer.contextStrip.unassigned')),
    )

    wrapper.unmount()
  })

  it('有主展示案件且已指定担当时展示担当姓名', async () => {
    const { wrapper } = await mountContextStrip({
      permissions: [P.VISA_CASE_DETAIL],
      listPrimaryVisaCase: minimalListPrimaryVisaCase({
        assignedToDisplayName: '  山田太郎  ',
      }),
    })

    expect(document.body.textContent ?? '').toContain('山田太郎')

    wrapper.unmount()
  })

  it('适用清单项为 0 时展示 0/0 与无适用项短文案（tooltip 说明勿误读为已齐套）', async () => {
    const { wrapper } = await mountContextStrip({
      permissions: [P.VISA_CASE_DETAIL],
      listPrimaryVisaCase: minimalListPrimaryVisaCase({
        materialChecklistTotal: 0,
        materialChecklistCollected: 0,
        materialChecklistNotApplicable: 0,
      }),
    })

    const shortLabel = String(
      i18n.global.t('detailViews.customer.contextStrip.materialsProgressNoApplicable'),
    )
    const tooltipExpected = String(
      i18n.global.t('detailViews.customer.contextStrip.materialsProgressNoApplicableTooltip'),
    )
    expect(document.body.textContent ?? '').toContain(shortLabel)
    expect(document.body.textContent ?? '').toContain('0/0')
    const tip = wrapper.findComponent({ name: 'ElTooltip' })
    expect(tip.exists()).toBe(true)
    expect(tip.props('content')).toBe(tooltipExpected)

    wrapper.unmount()
  })

  it('下次跟进早于在留期限时仅为跟进日期加紧迫样式类', async () => {
    const { wrapper } = await mountContextStrip({
      permissions: [P.VISA_CASE_DETAIL],
      listPrimaryVisaCase: minimalListPrimaryVisaCase({
        nextFollowUpAt: '2026-03-01',
        expireDate: '2026-12-31',
      }),
    })

    const priority = wrapper.findAll('.customer-detail-context-strip__v--date-priority')
    expect(priority).toHaveLength(1)
    expect(priority[0]?.text()).toMatch(/2026/)

    wrapper.unmount()
  })

  it('在留期限早于下次跟进时仅为在留期限加紧迫样式类', async () => {
    const { wrapper } = await mountContextStrip({
      permissions: [P.VISA_CASE_DETAIL],
      listPrimaryVisaCase: minimalListPrimaryVisaCase({
        nextFollowUpAt: '2026-12-31',
        expireDate: '2026-03-01',
      }),
    })

    const priority = wrapper.findAll('.customer-detail-context-strip__v--date-priority')
    expect(priority).toHaveLength(1)

    wrapper.unmount()
  })
})

describe('CustomerDetailContextStrip — openPrimaryCase', () => {
  it('push 签证域 tab 并带上 openVisaCaseId 与 hub 保留 query', async () => {
    const { wrapper, pushSpy } = await mountContextStrip(
      {
        permissions: [P.VISA_CASE_DETAIL],
        listPrimaryVisaCase: minimalListPrimaryVisaCase({ visaCaseId: 'vc-target' }),
        routeQuery: { dataScope: 'team' },
      },
      { spyPush: true },
    )

    await clickContextStripButton(wrapper, 'openCase')
    expect(pushSpy).toHaveBeenCalledWith({
      path: '/customers/cust-1',
      query: expect.objectContaining({
        dataScope: 'team',
        tab: 'visa-domain',
        openVisaCaseId: 'vc-target',
      }),
    })

    wrapper.unmount()
  })
})

describe('CustomerDetailContextStrip — openMaterials', () => {
  it('push visaDomainBlock=materials 与 materialsVisaCaseId', async () => {
    const { wrapper, pushSpy } = await mountContextStrip(
      {
        permissions: [P.VISA_CASE_DETAIL],
        listPrimaryVisaCase: minimalListPrimaryVisaCase(),
      },
      { spyPush: true },
    )

    await clickContextStripButton(wrapper, 'materials')
    expect(pushSpy).toHaveBeenCalledWith({
      path: '/customers/cust-1',
      query: expect.objectContaining({
        tab: 'visa-domain',
        visaDomainBlock: 'materials',
        materialsVisaCaseId: 'vc-strip-1',
      }),
    })

    wrapper.unmount()
  })
})

describe('CustomerDetailContextStrip — openWriteLog', () => {
  it('存在下次跟进日时附带 suggestedNextFollowUpAt', async () => {
    const nextFollowUpAt = '2026-03-20T00:00:00.000Z'
    const { wrapper, pushSpy } = await mountContextStrip(
      {
        permissions: [P.VISA_CASE_LOG_CREATE],
        listPrimaryVisaCase: minimalListPrimaryVisaCase({ nextFollowUpAt }),
      },
      { spyPush: true },
    )

    await clickContextStripButton(wrapper, 'writeLog')
    expect(pushSpy).toHaveBeenCalledWith({
      path: '/customers/cust-1',
      query: expect.objectContaining({
        tab: 'visa-domain',
        visaDomainBlock: 'logs',
        logVisaCaseId: 'vc-strip-1',
        openVisaCaseLogForm: '1',
        suggestedNextFollowUpAt: nextFollowUpAt,
      }),
    })

    wrapper.unmount()
  })
})

describe('CustomerDetailContextStrip — empty primary case', () => {
  it('无建案权时仅展示空态说明、不展示前往建案按钮', async () => {
    const { wrapper } = await mountContextStrip({
      permissions: [P.CUSTOMER_DETAIL],
      listPrimaryVisaCase: null,
    })

    expect(document.body.textContent ?? '').toContain(
      String(i18n.global.t('detailViews.customer.contextStrip.noPrimaryCase')),
    )
    expect(document.body.textContent ?? '').not.toContain(
      String(i18n.global.t('detailViews.customer.contextStrip.goCreateCase')),
    )

    wrapper.unmount()
  })

  it('具备建案权时展示空态与前往签证域建案', async () => {
    const { wrapper, pushSpy } = await mountContextStrip(
      {
        permissions: [P.VISA_CASE_CREATE],
        listPrimaryVisaCase: null,
      },
      { spyPush: true },
    )

    expect(document.body.textContent ?? '').toContain(
      String(i18n.global.t('detailViews.customer.contextStrip.noPrimaryCase')),
    )
    expect(document.body.textContent ?? '').toContain(
      String(i18n.global.t('detailViews.customer.contextStrip.goCreateCase')),
    )

    await clickContextStripButton(wrapper, 'goCreateCase')
    expect(pushSpy).toHaveBeenCalledWith({
      path: '/customers/cust-1',
      query: expect.objectContaining({
        tab: 'visa-domain',
        openVisaCaseWizard: '1',
      }),
    })

    wrapper.unmount()
  })
})

describe('CustomerDetailContextStrip — primary customer fallback banner', () => {
  it('PRIMARY_CUSTOMER_FALLBACK 时展示 el-alert；具备客户详情权时 router-link 可导航至主客户', async () => {
    const { wrapper, pushSpy } = await mountContextStrip(
      {
        permissions: [P.VISA_CASE_DETAIL, P.CUSTOMER_DETAIL],
        customerId: 'dep-1',
        listPrimaryVisaCase: minimalListPrimaryVisaCase(),
        listPrimaryVisaCaseSource: 'PRIMARY_CUSTOMER_FALLBACK',
        primaryCustomerIdForListFallback: 'primary-uuid',
        routeQuery: { dataScope: 'team' },
      },
      { spyPush: true },
    )

    expect(wrapper.find('.customer-detail-context-strip__fallback-alert').exists()).toBe(true)
    expect(document.body.textContent ?? '').toContain(
      String(i18n.global.t('detailViews.customer.contextStrip.primaryCustomerFallbackLine')),
    )

    const link = wrapper.find('.customer-detail-context-strip__fallback-link')
    expect(link.exists()).toBe(true)

    await link.trigger('click')
    expect(pushSpy).toHaveBeenCalledWith({
      path: '/customers/primary-uuid',
      query: expect.objectContaining({
        dataScope: 'team',
      }),
    })

    wrapper.unmount()
  })

  it('无客户详情权时不展示主客户深链，仅保留说明文案', async () => {
    const { wrapper } = await mountContextStrip({
      permissions: [P.VISA_CASE_DETAIL],
      customerId: 'dep-1',
      listPrimaryVisaCase: minimalListPrimaryVisaCase(),
      listPrimaryVisaCaseSource: 'PRIMARY_CUSTOMER_FALLBACK',
      primaryCustomerIdForListFallback: 'primary-uuid',
    })

    expect(wrapper.find('.customer-detail-context-strip__fallback-alert').exists()).toBe(true)
    expect(document.body.textContent ?? '').toContain(
      String(i18n.global.t('detailViews.customer.contextStrip.primaryCustomerFallbackLine')),
    )
    expect(wrapper.find('.customer-detail-context-strip__fallback-link').exists()).toBe(false)

    wrapper.unmount()
  })

  it('来源为本人案件时不展示回退横幅', async () => {
    const { wrapper } = await mountContextStrip({
      permissions: [P.VISA_CASE_DETAIL, P.CUSTOMER_DETAIL],
      listPrimaryVisaCase: minimalListPrimaryVisaCase(),
      listPrimaryVisaCaseSource: 'SELF',
      primaryCustomerIdForListFallback: 'primary-uuid',
    })

    expect(wrapper.find('.customer-detail-context-strip__fallback-alert').exists()).toBe(false)

    wrapper.unmount()
  })
})

describe('CustomerDetailContextStrip — view all visa cases', () => {
  it('push tab=visa-domain 且 visaDomainBlock=cases，并保留 hub query', async () => {
    const { wrapper, pushSpy } = await mountContextStrip(
      {
        permissions: [P.VISA_CASE_LIST],
        listPrimaryVisaCase: minimalListPrimaryVisaCase(),
        routeQuery: { dataScope: 'mine' },
      },
      { spyPush: true },
    )

    await clickContextStripButton(wrapper, 'viewAllVisaCases')

    expect(pushSpy).toHaveBeenCalledWith({
      path: '/customers/cust-1',
      query: expect.objectContaining({
        dataScope: 'mine',
        tab: 'visa-domain',
        visaDomainBlock: 'cases',
      }),
    })

    wrapper.unmount()
  })
})

describe('CustomerDetailContextStrip — deep link preserve', () => {
  it('保留当前 URL 中安全的 ccFrom 片段', async () => {
    const ccFrom = '/customers/workbench/visa?dataScope=team'
    const { wrapper, pushSpy } = await mountContextStrip(
      {
        permissions: [P.VISA_CASE_DETAIL],
        listPrimaryVisaCase: minimalListPrimaryVisaCase(),
        routeQuery: { [CUSTOMER_DETAIL_RETURN_QUERY_KEY]: ccFrom },
      },
      { spyPush: true },
    )

    await clickContextStripButton(wrapper, 'openCase')
    expect(pushSpy).toHaveBeenCalledWith({
      path: '/customers/cust-1',
      query: expect.objectContaining({
        [CUSTOMER_DETAIL_RETURN_QUERY_KEY]: ccFrom,
        tab: 'visa-domain',
        openVisaCaseId: 'vc-strip-1',
      }),
    })

    wrapper.unmount()
  })
})
