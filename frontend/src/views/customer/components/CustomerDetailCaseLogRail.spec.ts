/**
 * 客户详情右侧案件日志预览栏：权限门禁、`getVisaCaseLogs` 调用与深链 `router.push`（Vitest）。
 */
import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import type { Pinia } from 'pinia'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { h } from 'vue'
import type { Router } from 'vue-router'
import { createMemoryHistory, createRouter } from 'vue-router'

import { MaterialStatus, VisaCaseLogType, VisaCaseStatus } from '@/constants/enums'
import { P } from '@/constants/permissions'
import { i18n } from '@/i18n'
import { useUserStore } from '@/stores/user'
import type { CustomerListPrimaryVisaCaseSummary } from '@/types/customer'

import CustomerDetailCaseLogRail from './CustomerDetailCaseLogRail.vue'

const getVisaCaseLogs = vi.hoisted(() => vi.fn())

vi.mock('@/api/visa-case', () => ({
  getVisaCaseLogs,
}))

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
    visaCaseId: 'vc-rail-1',
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
 * 挂载日志侧栏。
 *
 * @param opts - 权限与 props
 * @param options - 是否 spy router.push
 * @returns wrapper、router、pushSpy
 */
async function mountRail(
  opts: {
    permissions: string[]
    customerId?: string
    listPrimaryVisaCase: CustomerListPrimaryVisaCaseSummary | null
    routeQuery?: Record<string, string>
  },
  options?: { spyPush?: boolean },
): Promise<{ wrapper: ReturnType<typeof mount>; router: Router; pushSpy: ReturnType<typeof vi.spyOn> | null }> {
  const customerId = opts.customerId ?? 'cust-rail'
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
  const pushSpy = options?.spyPush
    ? vi.spyOn(router, 'push').mockResolvedValue(undefined)
    : null

  const wrapper = mount(CustomerDetailCaseLogRail, {
    props: {
      customerId,
      listPrimaryVisaCase: opts.listPrimaryVisaCase,
    },
    attachTo: document.body,
    global: {
      plugins: [pinia, router, i18n, ElementPlus],
    },
  })
  await flushPromises()
  return { wrapper, router, pushSpy }
}

beforeEach(() => {
  i18n.global.locale.value = 'zh-CN'
  vi.clearAllMocks()
  getVisaCaseLogs.mockReset()
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('CustomerDetailCaseLogRail — timeline tone class', () => {
  it('时间轴条目 li 挂载与 logType 对应的 visa-case-log-timeline-tone--* class', async () => {
    getVisaCaseLogs.mockResolvedValue({
      data: {
        items: [
          {
            id: 'log-sub',
            visaCaseId: 'vc-rail-1',
            logType: VisaCaseLogType.SUBMISSION,
            content: 'submitted',
            creatorName: null,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        page: 1,
        pageSize: 40,
        total: 1,
      },
    })
    const { wrapper } = await mountRail({
      permissions: [P.VISA_CASE_DETAIL],
      listPrimaryVisaCase: minimalPrimaryCase(),
    })
    await flushPromises()
    const items = wrapper.findAll('.customer-detail-case-log-rail__timeline-item')
    expect(items).toHaveLength(1)
    expect(items[0]!.classes()).toContain('visa-case-log-timeline-tone--primary')
    wrapper.unmount()
  })
})

describe('CustomerDetailCaseLogRail — API', () => {
  it('仅有 LIST 权时不调用 getVisaCaseLogs', async () => {
    getVisaCaseLogs.mockResolvedValue({
      data: { items: [], page: 1, pageSize: 40, total: 0 },
    })
    const { wrapper } = await mountRail({
      permissions: [P.VISA_CASE_LIST],
      listPrimaryVisaCase: minimalPrimaryCase(),
    })
    await flushPromises()
    expect(getVisaCaseLogs).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('具备 DETAIL 且存在主展示案件时以 pageSize=40、DESC 拉取日志（不传 logType）', async () => {
    getVisaCaseLogs.mockResolvedValue({
      data: {
        items: [
          {
            id: 'log-1',
            visaCaseId: 'vc-rail-1',
            logType: 'GENERAL',
            content: 'hello',
            creatorName: 'A',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        page: 1,
        pageSize: 40,
        total: 1,
      },
    })
    const { wrapper } = await mountRail({
      permissions: [P.VISA_CASE_DETAIL],
      listPrimaryVisaCase: minimalPrimaryCase({ visaCaseId: 'vc-x' }),
    })
    await flushPromises()
    expect(getVisaCaseLogs).toHaveBeenCalledWith('vc-x', {
      page: 1,
      pageSize: 40,
      sortOrder: 'DESC',
    })
    expect(document.body.textContent ?? '').toContain('hello')
    expect(wrapper.find('.visa-case-log-timeline-tone--info').exists()).toBe(true)
    wrapper.unmount()
  })
})

describe('CustomerDetailCaseLogRail — materials pill', () => {
  it('材料 pill 仅展示 SUBMISSION/SUPPLEMENT 类日志', async () => {
    getVisaCaseLogs.mockResolvedValue({
      data: {
        items: [
          {
            id: 'log-g',
            visaCaseId: 'vc-rail-1',
            logType: VisaCaseLogType.GENERAL,
            content: 'only-general',
            creatorName: null,
            createdAt: '2026-01-02T00:00:00.000Z',
            updatedAt: '2026-01-02T00:00:00.000Z',
          },
          {
            id: 'log-s',
            visaCaseId: 'vc-rail-1',
            logType: VisaCaseLogType.SUPPLEMENT,
            content: 'supp-line',
            creatorName: null,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        page: 1,
        pageSize: 40,
        total: 2,
      },
    })
    const { wrapper } = await mountRail({
      permissions: [P.VISA_CASE_DETAIL],
      listPrimaryVisaCase: minimalPrimaryCase(),
    })
    await flushPromises()
    expect(document.body.textContent ?? '').toContain('only-general')
    const materialsLabel = String(i18n.global.t('detailViews.customer.caseLogRail.filterPillMaterials'))
    const matInput = wrapper.findAll('label.el-radio-button').find((lb) => (lb.text() ?? '').includes(materialsLabel))
    expect(matInput).toBeTruthy()
    await matInput!.trigger('click')
    await flushPromises()
    expect(document.body.textContent ?? '').toContain('supp-line')
    expect(document.body.textContent ?? '').not.toContain('only-general')
    wrapper.unmount()
  })
})

describe('CustomerDetailCaseLogRail — communication pill', () => {
  it('沟通 pill 仅展示 FOLLOW_UP / GENERAL 类日志', async () => {
    getVisaCaseLogs.mockResolvedValue({
      data: {
        items: [
          {
            id: 'log-s',
            visaCaseId: 'vc-rail-1',
            logType: VisaCaseLogType.SUPPLEMENT,
            content: 'supp-only',
            creatorName: null,
            createdAt: '2026-01-02T00:00:00.000Z',
            updatedAt: '2026-01-02T00:00:00.000Z',
          },
          {
            id: 'log-f',
            visaCaseId: 'vc-rail-1',
            logType: VisaCaseLogType.FOLLOW_UP,
            content: 'follow-line',
            creatorName: null,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        page: 1,
        pageSize: 40,
        total: 2,
      },
    })
    const { wrapper } = await mountRail({
      permissions: [P.VISA_CASE_DETAIL],
      listPrimaryVisaCase: minimalPrimaryCase(),
    })
    await flushPromises()
    expect(document.body.textContent ?? '').toContain('supp-only')
    const commLabel = String(i18n.global.t('detailViews.customer.caseLogRail.filterPillCommunication'))
    const commInput = wrapper.findAll('label.el-radio-button').find((lb) => (lb.text() ?? '').includes(commLabel))
    expect(commInput).toBeTruthy()
    await commInput!.trigger('click')
    await flushPromises()
    expect(document.body.textContent ?? '').toContain('follow-line')
    expect(document.body.textContent ?? '').not.toContain('supp-only')
    wrapper.unmount()
  })
})

describe('CustomerDetailCaseLogRail — filter empty states', () => {
  it('有权限且存在主展示案件时提供 filterPillsLegend 的说明入口（标题旁信息按钮）', async () => {
    getVisaCaseLogs.mockResolvedValue({
      data: { items: [], page: 1, pageSize: 40, total: 0 },
    })
    const { wrapper } = await mountRail({
      permissions: [P.VISA_CASE_DETAIL],
      listPrimaryVisaCase: minimalPrimaryCase(),
    })
    await flushPromises()
    const hint = String(i18n.global.t('detailViews.customer.caseLogRail.filterLegendHint'))
    const trigger = wrapper.find('.customer-detail-case-log-rail__legend-trigger')
    expect(trigger.exists()).toBe(true)
    expect(trigger.attributes('aria-label')).toBe(hint)
    wrapper.unmount()
  })
})

describe('CustomerDetailCaseLogRail — filter pills / emptyFiltered', () => {
  it('筛选无命中时展示 emptyFiltered 文案', async () => {
    getVisaCaseLogs.mockResolvedValue({
      data: {
        items: [
          {
            id: 'log-g',
            visaCaseId: 'vc-rail-1',
            logType: VisaCaseLogType.GENERAL,
            content: 'note',
            creatorName: null,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        page: 1,
        pageSize: 40,
        total: 1,
      },
    })
    const { wrapper } = await mountRail({
      permissions: [P.VISA_CASE_DETAIL],
      listPrimaryVisaCase: minimalPrimaryCase(),
    })
    await flushPromises()
    const systemLabel = String(i18n.global.t('detailViews.customer.caseLogRail.filterPillSystem'))
    const sysInput = wrapper.findAll('label.el-radio-button').find((lb) => (lb.text() ?? '').includes(systemLabel))
    expect(sysInput).toBeTruthy()
    await sysInput!.trigger('click')
    await flushPromises()
    expect(document.body.textContent ?? '').toContain(
      String(i18n.global.t('detailViews.customer.caseLogRail.emptyFiltered')),
    )
    wrapper.unmount()
  })
})

describe('CustomerDetailCaseLogRail — navigation', () => {
  it('查看全部 push 签证域 logs 并带 logVisaCaseId', async () => {
    getVisaCaseLogs.mockResolvedValue({
      data: { items: [], page: 1, pageSize: 40, total: 0 },
    })
    const { wrapper, pushSpy } = await mountRail(
      {
        permissions: [P.VISA_CASE_DETAIL],
        listPrimaryVisaCase: minimalPrimaryCase({ visaCaseId: 'vc-nav' }),
        routeQuery: { dataScope: 'team' },
      },
      { spyPush: true },
    )
    await flushPromises()
    const viewAllLabel = String(i18n.global.t('detailViews.customer.caseLogRail.viewAll'))
    const btn = wrapper
      .findAll('button')
      .find((b) => (b.text() ?? '').includes(viewAllLabel))
    expect(btn).toBeTruthy()
    await btn!.trigger('click')
    await flushPromises()
    expect(pushSpy).toHaveBeenCalledWith({
      path: '/customers/cust-rail',
      query: expect.objectContaining({
        dataScope: 'team',
        tab: 'visa-domain',
        visaDomainBlock: 'logs',
        logVisaCaseId: 'vc-nav',
      }),
    })
    wrapper.unmount()
  })
})
