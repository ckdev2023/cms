/**
 * 签证域堆叠布局：锚点 id、主展示案件折叠区与懒加载分区的行为（Vitest）。
 */
import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus, { ElCollapse } from 'element-plus'
import type { Pinia } from 'pinia'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { h } from 'vue'
import type { Router } from 'vue-router'
import { createMemoryHistory, createRouter } from 'vue-router'

import { CustomerStatus, CustomerType, MaterialStatus, ServiceType, VisaCaseStatus } from '@/constants/enums'
import { P } from '@/constants/permissions'
import { i18n } from '@/i18n'
import { useUserStore } from '@/stores/user'
import type { CustomerDetail, CustomerListPrimaryVisaCaseSummary } from '@/types/customer'
import { VISA_DOMAIN_BLOCK_KEYS } from '@/utils/customer-detail-visa-domain-deeplink'

import CustomerVisaDomainTab from './CustomerVisaDomainTab.vue'

vi.mock('@/api/visa-case', () => ({
  getVisaCases: vi.fn(),
}))

import { getVisaCases } from '@/api/visa-case'

/**
 * 构造客户详情最小对象，满足签证域 Tab 对 `customer` 摘要卡片的 props 要求。
 *
 * @returns 可挂载用的 `CustomerDetail`
 */
function minimalCustomerDetail(): CustomerDetail {
  return {
    id: 'c1',
    customerCode: 'C-001',
    customerType: CustomerType.PERSONAL,
    customerName: '山田',
    phone: '03-0000-0000',
    email: 't@example.jp',
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
    createdAt: '2020-01-01T00:00:00.000Z',
    updatedAt: '2020-01-01T00:00:00.000Z',
    staffRelations: [],
  }
}

function minimalPrimaryCase(): CustomerListPrimaryVisaCaseSummary {
  return {
    visaCaseId: 'vc-p1',
    caseType: 'WORK',
    caseStatus: VisaCaseStatus.IN_PROGRESS,
    expireDate: '2026-12-31',
    nextFollowUpAt: null,
    assignedToUserId: 'u1',
    assignedToDisplayName: '担当A',
    isFamilyCase: false,
    familyLinkMode: null,
    familyDependentsCount: 0,
    materialStatus: MaterialStatus.PARTIAL,
    materialChecklistTotal: 0,
    materialChecklistCollected: 0,
    materialChecklistNotApplicable: 0,
    materialChecklistSuggestedStatus: MaterialStatus.PARTIAL,
    materialChecklistOutOfSync: false,
  }
}

let pinia: Pinia

/**
 * 重置签证案件列表 mock 并挂载带 `VISA_CASE_LIST` 的 Pinia，供本文件各用例复用。
 *
 * @returns 已写入用户权限的 Pinia 实例
 */
function resetVisaDomainTestPinia(): Pinia {
  vi.mocked(getVisaCases).mockResolvedValue({
    data: { items: [], total: 0 },
  } as never)
  const p = createPinia()
  setActivePinia(p)
  useUserStore(p).$patch({
    userInfo: {
      id: 'u1',
      username: 't',
      displayName: 'T',
      email: 't@t.jp',
      roles: [],
      permissions: [P.VISA_CASE_LIST],
      status: 'ACTIVE',
    },
  })
  return p
}

/**
 * 创建客户详情记忆路由，供 `CustomerVisaDomainTab` 内 `useRoute` / `useRouter` 消费深链剥离逻辑。
 *
 * @returns 已注册 `/customers/:id` 的 Router
 */
function createVisaDomainTabRouter(): Router {
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
 * 挂载签证域 Tab 并完成路由就绪，复用当前 `pinia` 与给定 stubs。
 *
 * @param extraProps - 覆盖默认 `customerId` / `customer` 之外的 props
 * @param stubs - `@vue/test-utils` 子组件桩
 * @param routeQuery - 初始 `router.push` query
 * @returns 已 `flushPromises` 一次的 wrapper 与 router（便于断言深链 `replace`）
 */
async function mountVisaDomainTab(
  extraProps: Record<string, unknown>,
  stubs: Record<string, boolean | { template: string }>,
  routeQuery: Record<string, string> = {},
): Promise<{ wrapper: ReturnType<typeof mount>; router: Router }> {
  const router = createVisaDomainTabRouter()
  await router.push({ path: '/customers/c1', query: routeQuery })
  await router.isReady()
  const wrapper = mount(CustomerVisaDomainTab, {
    props: {
      customerId: 'c1',
      customer: minimalCustomerDetail(),
      ...extraProps,
    },
    global: {
      plugins: [ElementPlus, i18n, pinia, router],
      stubs,
    },
  })
  await flushPromises()
  return { wrapper, router }
}

function resetPiniaForVisaDomainTab(): void {
  pinia = resetVisaDomainTestPinia()
}

/**
 * 构造最小 `IntersectionObserverEntry` 片段，供触发组件内缓存逻辑。
 *
 * @param target - 对应分区根元素
 * @param ratio - `intersectionRatio`
 * @returns 可传入 mock 回调的条目
 */
function fakeVisaDomainIoEntry(target: Element, ratio: number): IntersectionObserverEntry {
  return {
    target,
    isIntersecting: ratio > 0,
    intersectionRatio: ratio,
  } as IntersectionObserverEntry
}

/**
 * 等待 `requestAnimationFrame` 与 Vue 更新，便于断言 IO 回调后的 pill 状态。
 */
async function flushVisaDomainObserverPillFrame(): Promise<void> {
  await flushPromises()
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve())
  })
}

/**
 * 安装可捕获构造回调的 `IntersectionObserver` 桩。
 *
 * @returns `getIoCallback` 读取最近一次注册的 observer 回调
 */
function stubVisaDomainIntersectionObserver(): {
  getIoCallback: () => IntersectionObserverCallback | null
} {
  let ioCallback: IntersectionObserverCallback | null = null
  vi.stubGlobal(
    'IntersectionObserver',
    vi.fn(function VisaDomainIntersectionObserverStub(
      cb: IntersectionObserverCallback,
      _options?: IntersectionObserverInit,
    ) {
      ioCallback = cb
      return {
        observe: vi.fn(),
        disconnect: vi.fn(),
        unobserve: vi.fn(),
        takeRecords: vi.fn((): IntersectionObserverEntry[] => []),
      }
    }) as unknown as typeof IntersectionObserver,
  )
  return { getIoCallback: () => ioCallback }
}

describe('CustomerVisaDomainTab / section nav', () => {
  beforeEach(resetPiniaForVisaDomainTab)

  it('分区导航首项为基本信息摘要且与堆叠顺序一致', async () => {
    const { wrapper } = await mountVisaDomainTab(
      {},
      {
        CustomerVisaCasesTab: true,
        CustomerFamilyMembersBlock: true,
        CustomerFilePathsTab: true,
        CustomerVisaCaseLogsTab: true,
        CustomerMaterialChecklistTab: true,
      },
    )
    const nav = wrapper.find('.visa-domain-tab__section-nav')
    expect(nav.exists()).toBe(true)
    const buttons = nav.findAll('button')
    expect(buttons.length).toBeGreaterThanOrEqual(6)
    expect(buttons[0]?.text()).toContain(
      i18n.global.t('detailViews.customer.stitchLayout.stackBlocks.basicSnapshot'),
    )
    expect(buttons[1]?.text()).toContain(
      i18n.global.t('detailViews.customer.stitchLayout.stackBlocks.family'),
    )
  })
})

describe('CustomerVisaDomainTab / section anchors', () => {
  beforeEach(resetPiniaForVisaDomainTab)

  describe('section anchors', () => {
    it('为各分区输出与 visaDomainBlock 一致的锚点 id', async () => {
      const { wrapper } = await mountVisaDomainTab(
        { initialSubBlock: 'family' },
        {
          CustomerVisaCasesTab: { template: '<div data-testid="stub-cases" />' },
          CustomerFamilyMembersBlock: { template: '<div data-testid="stub-family" />' },
          CustomerFilePathsTab: { template: '<div data-testid="stub-paths" />' },
          CustomerVisaCaseLogsTab: { template: '<div data-testid="stub-logs" />' },
          CustomerMaterialChecklistTab: { template: '<div data-testid="stub-materials" />' },
        },
      )
      expect(wrapper.find('#visa-domain-cases').exists()).toBe(true)
      expect(wrapper.find('#visa-domain-family').exists()).toBe(true)
      expect(wrapper.find('#visa-domain-paths').exists()).toBe(true)
      expect(wrapper.find('#visa-domain-logs').exists()).toBe(true)
      expect(wrapper.find('#visa-domain-materials').exists()).toBe(true)
      expect(wrapper.find('#visa-domain-basic-snapshot').exists()).toBe(true)
    })
  })
})

describe('CustomerVisaDomainTab / primary case layout', () => {
  beforeEach(resetPiniaForVisaDomainTab)

  describe('primary case layout', () => {
    it('存在主展示案件时渲染全部案件折叠项且仍挂载案件子组件', async () => {
      const { wrapper } = await mountVisaDomainTab(
        { listPrimaryVisaCase: minimalPrimaryCase() },
        {
          CustomerVisaCasesTab: { template: '<div data-testid="stub-cases" />' },
          CustomerFamilyMembersBlock: true,
          CustomerFilePathsTab: true,
          CustomerVisaCaseLogsTab: true,
          CustomerMaterialChecklistTab: true,
        },
      )
      expect(wrapper.text()).toContain(
        i18n.global.t('detailViews.customer.visaDomainTab.allCasesCollapseTitle'),
      )
      expect(wrapper.find('[data-testid="stub-cases"]').exists()).toBe(true)
    })

    it('深链 cases 分区时展开「全部案件」折叠面板', async () => {
      const { wrapper } = await mountVisaDomainTab(
        { listPrimaryVisaCase: minimalPrimaryCase(), initialSubBlock: 'cases' },
        {
          CustomerVisaCasesTab: { template: '<div data-testid="stub-cases" />' },
          CustomerFamilyMembersBlock: true,
          CustomerFilePathsTab: true,
          CustomerVisaCaseLogsTab: true,
          CustomerMaterialChecklistTab: true,
        },
        { visaDomainBlock: 'cases' },
      )
      await flushPromises()
      const collapse = wrapper.findComponent(ElCollapse)
      expect(collapse.exists()).toBe(true)
      expect(collapse.props('modelValue')).toEqual(expect.arrayContaining(['all']))
    })
  })
})

describe('CustomerVisaDomainTab / lazy mount via initialSubBlock', () => {
  beforeEach(resetPiniaForVisaDomainTab)

  it('materials 时挂载材料清单子组件', async () => {
    const { wrapper } = await mountVisaDomainTab(
      { initialSubBlock: 'materials' },
      {
        CustomerVisaCasesTab: true,
        CustomerFamilyMembersBlock: true,
        CustomerFilePathsTab: true,
        CustomerVisaCaseLogsTab: true,
        CustomerMaterialChecklistTab: { template: '<div data-testid="stub-materials" />' },
      },
    )
    expect(wrapper.find('[data-testid="stub-materials"]').exists()).toBe(true)
  })

  it('basicSnapshot 深链时挂载首卡且可解析 visa-domain-basic-snapshot 锚点', async () => {
    const { wrapper } = await mountVisaDomainTab(
      { initialSubBlock: 'basicSnapshot' },
      {
        CustomerVisaCasesTab: true,
        CustomerFamilyMembersBlock: true,
        CustomerFilePathsTab: true,
        CustomerVisaCaseLogsTab: true,
        CustomerMaterialChecklistTab: true,
        CustomerVisaDomainBasicSnapshotCard: { template: '<div data-testid="stub-basic-snapshot" />' },
      },
      { visaDomainBlock: 'basicSnapshot' },
    )
    await flushPromises()
    await flushPromises()
    expect(wrapper.find('[data-testid="stub-basic-snapshot"]').exists()).toBe(true)
    expect(wrapper.find('#visa-domain-basic-snapshot').exists()).toBe(true)
  })

  it('materials 深链将 materialsPreferredVisaCaseId 传入材料清单子组件', async () => {
    const MatStub = {
      name: 'CustomerMaterialChecklistTab',
      props: ['preferredMaterialsVisaCaseId'],
      template: '<div data-testid="stub-materials" />',
    }
    const { wrapper } = await mountVisaDomainTab(
      {
        initialSubBlock: 'materials',
        materialsPreferredVisaCaseId: 'vc-mat-deeplink',
      },
      {
        CustomerVisaCasesTab: true,
        CustomerFamilyMembersBlock: true,
        CustomerFilePathsTab: true,
        CustomerVisaCaseLogsTab: true,
        CustomerMaterialChecklistTab: MatStub,
      },
      { visaDomainBlock: 'materials' },
    )
    const stub = wrapper.findComponent({ name: 'CustomerMaterialChecklistTab' })
    expect(stub.exists()).toBe(true)
    expect(stub.props('preferredMaterialsVisaCaseId')).toBe('vc-mat-deeplink')
  })
})

describe('CustomerVisaDomainTab / wide stack grid markers', () => {
  beforeEach(resetPiniaForVisaDomainTab)

  it('六个分区均带宽屏双列栅格定位 class 且锚点 id 不变', async () => {
    const { wrapper } = await mountVisaDomainTab(
      {},
      {
        CustomerVisaCasesTab: true,
        CustomerFamilyMembersBlock: true,
        CustomerFilePathsTab: true,
        CustomerVisaCaseLogsTab: true,
        CustomerMaterialChecklistTab: true,
      },
    )
    expect(
      wrapper.find('#visa-domain-basic-snapshot.visa-domain-tab__section--stack-left-1').exists(),
    ).toBe(true)
    expect(wrapper.find('#visa-domain-family.visa-domain-tab__section--stack-left-2').exists()).toBe(
      true,
    )
    expect(
      wrapper.find('#visa-domain-materials.visa-domain-tab__section--stack-left-3').exists(),
    ).toBe(true)
    expect(wrapper.find('#visa-domain-paths.visa-domain-tab__section--stack-right-1').exists()).toBe(
      true,
    )
    expect(wrapper.find('#visa-domain-cases.visa-domain-tab__section--stack-right-2').exists()).toBe(
      true,
    )
    expect(wrapper.find('#visa-domain-logs.visa-domain-tab__section--stack-right-3').exists()).toBe(
      true,
    )
  })
})

describe('CustomerVisaDomainTab / section observer → pill', () => {
  beforeEach(resetPiniaForVisaDomainTab)
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('IntersectionObserver 按最大可见比例将对应分区 pill 标为 is-active', async () => {
    const { getIoCallback } = stubVisaDomainIntersectionObserver()
    const { wrapper } = await mountVisaDomainTab(
      {},
      {
        CustomerVisaCasesTab: true,
        CustomerFamilyMembersBlock: true,
        CustomerFilePathsTab: true,
        CustomerVisaCaseLogsTab: true,
        CustomerMaterialChecklistTab: true,
      },
    )
    const ioCallback = getIoCallback()
    expect(ioCallback).not.toBeNull()
    ioCallback!(
      [
        fakeVisaDomainIoEntry(wrapper.find('#visa-domain-materials').element, 0.55),
        fakeVisaDomainIoEntry(wrapper.find('#visa-domain-paths').element, 0.12),
      ],
      {} as IntersectionObserver,
    )
    await flushVisaDomainObserverPillFrame()
    const pills = wrapper.find('.visa-domain-tab__section-nav').findAll('.visa-domain-tab__section-pill')
    expect(pills[VISA_DOMAIN_BLOCK_KEYS.indexOf('materials')]?.classes()).toContain('is-active')
    wrapper.unmount()
  })

  it('可见比例并列时按 VISA_DOMAIN_BLOCK_KEYS 顺序优先高亮更靠前分区 pill', async () => {
    const { getIoCallback } = stubVisaDomainIntersectionObserver()
    const { wrapper } = await mountVisaDomainTab(
      {},
      {
        CustomerVisaCasesTab: true,
        CustomerFamilyMembersBlock: true,
        CustomerFilePathsTab: true,
        CustomerVisaCaseLogsTab: true,
        CustomerMaterialChecklistTab: true,
      },
    )
    const ioCallback = getIoCallback()
    expect(ioCallback).not.toBeNull()
    ioCallback!(
      [
        fakeVisaDomainIoEntry(wrapper.find('#visa-domain-family').element, 0.4),
        fakeVisaDomainIoEntry(wrapper.find('#visa-domain-materials').element, 0.4),
      ],
      {} as IntersectionObserver,
    )
    await flushVisaDomainObserverPillFrame()
    const pills = wrapper.find('.visa-domain-tab__section-nav').findAll('.visa-domain-tab__section-pill')
    expect(pills[VISA_DOMAIN_BLOCK_KEYS.indexOf('family')]?.classes()).toContain('is-active')
    wrapper.unmount()
  })
})

describe('CustomerVisaDomainTab / strip visaDomainBlock query', () => {
  beforeEach(resetPiniaForVisaDomainTab)

  it('消费 visaDomainBlock 深链后 router.replace 去掉 query 中的 visaDomainBlock', async () => {
    const router = createVisaDomainTabRouter()
    const replaceSpy = vi.spyOn(router, 'replace').mockResolvedValue(undefined)
    await router.push({
      path: '/customers/c1',
      query: { visaDomainBlock: 'logs', tab: 'visa-domain' },
    })
    await router.isReady()
    const wrapper = mount(CustomerVisaDomainTab, {
      props: {
        customerId: 'c1',
        customer: minimalCustomerDetail(),
        initialSubBlock: 'logs',
      },
      global: {
        plugins: [ElementPlus, i18n, pinia, router],
        stubs: {
          CustomerVisaCasesTab: true,
          CustomerFamilyMembersBlock: true,
          CustomerFilePathsTab: true,
          CustomerVisaCaseLogsTab: { template: '<div data-testid="stub-logs" />' },
          CustomerMaterialChecklistTab: true,
        },
      },
    })
    await flushPromises()
    await flushPromises()
    expect(replaceSpy).toHaveBeenCalled()
    const arg = replaceSpy.mock.calls[0]?.[0] as { query?: Record<string, unknown> }
    expect(arg?.query?.visaDomainBlock).toBeUndefined()
    wrapper.unmount()
  })
})
