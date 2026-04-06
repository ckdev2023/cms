/**
 * 简化客户详情「随访进展记录」时间线：`getVisaCaseLogs` 门禁、DESC 排序参数与空/错态展示（Vitest）。
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

import CustomerSimpleFollowUpTimeline from './CustomerSimpleFollowUpTimeline.vue'

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
    visaCaseId: 'vc-simple-tl-1',
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
 * 挂载简化页随访时间线组件。
 *
 * @param opts - 权限与 props
 * @returns wrapper、router
 */
async function mountTimeline(opts: {
  permissions: string[]
  customerId?: string
  listPrimaryVisaCase: CustomerListPrimaryVisaCaseSummary | null
}): Promise<{ wrapper: ReturnType<typeof mount>; router: Router }> {
  const customerId = opts.customerId ?? 'cust-simple-tl'
  const pinia = initPiniaWithPermissions(opts.permissions)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: '/customers/:id/simple',
        name: 'CustomerDetailSimpleStub',
        component: { render: () => h('div') },
      },
    ],
  })
  await router.push({ path: `/customers/${customerId}/simple`, query: {} })
  await router.isReady()

  const wrapper = mount(CustomerSimpleFollowUpTimeline, {
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
  return { wrapper, router }
}

beforeEach(() => {
  i18n.global.locale.value = 'zh-CN'
  vi.clearAllMocks()
  getVisaCaseLogs.mockReset()
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('CustomerSimpleFollowUpTimeline — getVisaCaseLogs 门禁', () => {
  it('无主展示案件时不调用 getVisaCaseLogs', async () => {
    const { wrapper } = await mountTimeline({
      permissions: [P.VISA_CASE_DETAIL],
      listPrimaryVisaCase: null,
    })
    await flushPromises()
    expect(getVisaCaseLogs).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('仅有 LIST 权时不调用 getVisaCaseLogs', async () => {
    const { wrapper } = await mountTimeline({
      permissions: [P.VISA_CASE_LIST],
      listPrimaryVisaCase: minimalPrimaryCase(),
    })
    await flushPromises()
    expect(getVisaCaseLogs).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('具备 DETAIL 且存在主展示案件时以 pageSize=25、sortOrder=DESC 拉取日志', async () => {
    getVisaCaseLogs.mockResolvedValue({
      data: { items: [], page: 1, pageSize: 25, total: 0 },
    })
    const { wrapper } = await mountTimeline({
      permissions: [P.VISA_CASE_DETAIL],
      listPrimaryVisaCase: minimalPrimaryCase(),
    })
    await flushPromises()
    expect(getVisaCaseLogs).toHaveBeenCalledWith('vc-simple-tl-1', {
      page: 1,
      pageSize: 25,
      sortOrder: 'DESC',
    })
    wrapper.unmount()
  })
})

describe('CustomerSimpleFollowUpTimeline — getVisaCaseLogs 结果展示', () => {
  it('请求失败时展示与材料卡一致的空态容器与加载失败文案', async () => {
    getVisaCaseLogs.mockRejectedValue(new Error('network'))
    const { wrapper } = await mountTimeline({
      permissions: [P.VISA_CASE_DETAIL],
      listPrimaryVisaCase: minimalPrimaryCase(),
    })
    await flushPromises()
    const empty = wrapper.find('.customer-simple-follow-up-timeline__empty')
    expect(empty.exists()).toBe(true)
    expect(empty.text()).toContain('日志加载失败')
    wrapper.unmount()
  })

  it('有数据时渲染时间线条目', async () => {
    getVisaCaseLogs.mockResolvedValue({
      data: {
        items: [
          {
            id: 'log-a',
            visaCaseId: 'vc-simple-tl-1',
            customerId: 'c1',
            logType: VisaCaseLogType.GENERAL,
            content: 'line1',
            submittedItems: null,
            missingItems: null,
            nextAction: null,
            nextFollowUpAt: null,
            createdBy: null,
            creatorName: '经办',
            createdAt: '2026-01-02T00:00:00.000Z',
            updatedAt: '2026-01-02T00:00:00.000Z',
          },
        ],
        page: 1,
        pageSize: 25,
        total: 1,
      },
    })
    const { wrapper } = await mountTimeline({
      permissions: [P.VISA_CASE_DETAIL],
      listPrimaryVisaCase: minimalPrimaryCase(),
    })
    await flushPromises()
    expect(wrapper.findAll('.customer-simple-follow-up-timeline__item')).toHaveLength(1)
    expect(wrapper.text()).toContain('line1')
    wrapper.unmount()
  })
})

describe('CustomerSimpleFollowUpTimeline — 导出', () => {
  it('导出按钮禁用且带说明（无批量导出 API）', async () => {
    getVisaCaseLogs.mockResolvedValue({
      data: { items: [], page: 1, pageSize: 25, total: 0 },
    })
    const { wrapper } = await mountTimeline({
      permissions: [P.VISA_CASE_DETAIL],
      listPrimaryVisaCase: minimalPrimaryCase(),
    })
    await flushPromises()
    const btn = wrapper.find('.customer-simple-follow-up-timeline__export')
    expect(btn.exists()).toBe(true)
    expect(btn.attributes('disabled')).toBeDefined()
    const tip = wrapper.findComponent({ name: 'ElTooltip' })
    expect(tip.exists()).toBe(true)
    expect(tip.props('content')).toContain('导出')
    wrapper.unmount()
  })
})
