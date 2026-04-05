/**
 * Phase E2：签证工作台在「接口成功但业务全空」与「接口失败」下的主态区分（Vitest）。
 * 主表：`route.query.reminderType` 与 `GET /visa-reminders` 参数联动、KPI `replace` 行为。
 *
 * **手测（E2E 抽样）**
 *
 * 1. **成功空数据**：使用无签证案件的数据范围或测试库；打开 `/customers/workbench/visa`。应看到信息态 `el-alert`（`emptyWorkbenchScopeHintAll` 等按数据范围）与主表空态（`pages.visaReminders.noData`），不应出现 `loadFailedTitle` 作为主标题。
 * 2. **失败态**：DevTools → Network → 对 `workbench/visa` API 请求 Block URL，点击刷新或重试。应出现 `loadFailedTitle` 与 `pickApiErrorMessage` 详情，不应出现成功空文案（`emptyWorkbenchScopeHintAll` / `noData`）。
 */
import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus, { ElMessage } from 'element-plus'
import type { Pinia } from 'pinia'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, h } from 'vue'
import type { Router } from 'vue-router'
import { createMemoryHistory, createRouter } from 'vue-router'

import { getVisaReminders, getVisaWorkbenchAggregate } from '@/api/visa-case'
import { VisaReminderTypeLabel } from '@/constants/enum-labels'
import { VisaDataScope, VisaReminderType } from '@/constants/enums'
import { i18n } from '@/i18n'
import { useUserStore } from '@/stores/user'
import { useVisaWorkbenchHubStore } from '@/stores/visaWorkbenchHub'
import type { VisaReminderItem, VisaWorkbenchAggregate } from '@/types/visa-case'

import VisaWorkbenchView from './VisaWorkbenchView.vue'

vi.mock('@/api/visa-case', () => ({
  getVisaWorkbenchAggregate: vi.fn(),
  getVisaReminders: vi.fn(),
}))

vi.mock('@/api/system', () => ({
  getUsers: vi.fn(() =>
    Promise.resolve({
      code: 0,
      message: 'ok',
      data: { items: [], page: 1, pageSize: 500, total: 0 },
    }),
  ),
}))

vi.mock('@/composables/useVisaDataScopeRoute', () => ({
  useVisaDataScopeRoute: () => ({
    dataScopeForApi: computed(() => VisaDataScope.ALL),
    showScopeSwitch: computed(() => false),
    setDataScope: vi.fn(),
    selectableScopes: computed(() => [VisaDataScope.ALL]),
  }),
}))

const emptyWorkbenchAggregate: VisaWorkbenchAggregate = {
  stats: {
    caseStatusCounts: [],
    reminderBuckets: {
      supplement: 0,
      todayFollowUp: 0,
      expiring7Days: 0,
      expiring2Months: 0,
      noBucket: 0,
    },
    expiringWithin7DaysWindow: 0,
    todayFollowUpCount: 0,
    supplementRelatedCount: 0,
    unassignedCount: 0,
  },
  reminderPreviews: {
    supplement: [],
    todayFollowUp: [],
    expiring7Days: [],
    expiring2Months: [],
  },
}

const emptyVisaRemindersPage = {
  items: [] as VisaReminderItem[],
  page: 1,
  pageSize: 20,
  total: 0,
}

const mountPlugins = {
  stubs: { VisaDataScopeSegmented: true },
}

/**
 * 创建带工作台路由的 MemoryHistory 路由器（组件桩占位）。
 *
 * @returns 已注册 `/customers/workbench/visa` 等路径的 Router
 */
function createTestRouter(): Router {
  const stub = { render: () => h('div') }
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/customers/workbench/visa', name: 'VisaWorkbench', component: stub },
      { path: '/customers/visa-reminders', name: 'VisaReminderList', component: stub },
      { path: '/customers/visa-cases', name: 'VisaCaseRegistry', component: stub },
    ],
  })
}

/**
 * 重置签证聚合／提醒列表 mock，并为列表提供空分页默认成功响应。
 */
function resetVisaCaseApiMocks(): void {
  vi.mocked(getVisaWorkbenchAggregate).mockReset()
  vi.mocked(getVisaReminders).mockReset()
  vi.mocked(getVisaReminders).mockResolvedValue({
    code: 0,
    message: 'ok',
    data: emptyVisaRemindersPage,
  })
}

/**
 * 注入具备全权限的当前用户，供工作台权限分支与 hub 更新使用。
 *
 * @param pinia - 测试用 Pinia 实例
 */
function seedAdminUserStore(pinia: Pinia): void {
  setActivePinia(pinia)
  useUserStore(pinia).$patch({
    userInfo: {
      id: 'u1',
      username: 't',
      displayName: 'T',
      email: 't@t.jp',
      roles: [],
      permissions: ['*'],
      status: 'ACTIVE',
    },
  })
}

describe('VisaWorkbenchView (E2 empty vs error)', () => {
  beforeEach(() => {
    resetVisaCaseApiMocks()
  })

  it('shows info empty hint and todo empty copy when API succeeds with empty aggregate, not load-failed title', async () => {
    vi.mocked(getVisaWorkbenchAggregate).mockResolvedValue({
      code: 0,
      message: 'ok',
      data: emptyWorkbenchAggregate,
    })

    const pinia = createPinia()
    seedAdminUserStore(pinia)
    const router = createTestRouter()
    await router.push('/customers/workbench/visa')
    await router.isReady()

    const wrapper = mount(VisaWorkbenchView, {
      global: { plugins: [pinia, router, i18n, ElementPlus], ...mountPlugins },
    })
    await flushPromises()

    const hub = useVisaWorkbenchHubStore()
    expect(hub.stats).not.toBeNull()
    expect(hub.lastSuccessfulDataScope).toBe(VisaDataScope.ALL)
    expect(hub.stats?.reminderBuckets.supplement).toBe(0)

    const { t } = i18n.global
    const text = wrapper.text()
    expect(text).toContain(t('pages.workbenchVisa.pageTitle'))
    expect(text).toContain(t('pages.workbenchVisa.kpiStripHint'))
    expect(text).toContain(t('pages.workbenchVisa.emptyWorkbenchScopeHintAll'))
    expect(text).toContain(t('pages.visaReminders.noData'))
    expect(text).not.toContain(t('pages.workbenchVisa.loadFailedTitle'))
  })

  it('shows fatal load-failed title when API rejects and does not show success-only empty copy', async () => {
    vi.mocked(getVisaWorkbenchAggregate).mockRejectedValue(new Error('E2_NETWORK'))

    const pinia = createPinia()
    seedAdminUserStore(pinia)
    const router = createTestRouter()
    await router.push('/customers/workbench/visa')
    await router.isReady()

    const wrapper = mount(VisaWorkbenchView, {
      global: { plugins: [pinia, router, i18n, ElementPlus], ...mountPlugins },
    })
    await flushPromises()

    const { t } = i18n.global
    const text = wrapper.text()
    expect(text).toContain(t('pages.workbenchVisa.pageTitle'))
    expect(text).toContain(t('pages.workbenchVisa.loadFailedTitle'))
    expect(text).toContain('E2_NETWORK')
    expect(text).not.toContain(t('pages.workbenchVisa.emptyWorkbenchScopeHintAll'))
    expect(text).not.toContain(t('pages.visaReminders.noData'))
  })
})

function setupReminderTableQueryMocks(): void {
  resetVisaCaseApiMocks()
  vi.mocked(getVisaWorkbenchAggregate).mockResolvedValue({
    code: 0,
    message: 'ok',
    data: emptyWorkbenchAggregate,
  })
}

/**
 * 在挂载后的工作台包装器中找到「补件」提醒桶 KPI chip（排除「全部」与 MVP 提示 chip）。
 *
 * @param wrapper - `VisaWorkbenchView` 测试包装器
 * @returns 对应按钮包装器
 */
function findSupplementReminderBucketChip(wrapper: ReturnType<typeof mount>): ReturnType<
  typeof wrapper.findAll
>[number] {
  const supplementLabel = VisaReminderTypeLabel[VisaReminderType.SUPPLEMENT]
  const match = wrapper
    .findAll('button')
    .find((btn) => {
      const aria = btn.attributes('aria-label') ?? ''
      return (
        aria.includes(supplementLabel) &&
        !btn.classes().includes('visa-workbench-kpi-strip__chip-host--mvp')
      )
    })
  if (!match) {
    throw new Error('Supplement reminder KPI chip not found')
  }
  return match
}

describe('VisaWorkbenchView — reminder table query (assignedTo)', () => {
  beforeEach(setupReminderTableQueryMocks)

  const sampleAssigneeUuid = '550e8400-e29b-41d4-a716-446655440000'

  it('requests visa reminders with assignedTo from route query', async () => {
    const pinia = createPinia()
    seedAdminUserStore(pinia)
    const router = createTestRouter()
    await router.push({
      path: '/customers/workbench/visa',
      query: { assignedTo: sampleAssigneeUuid },
    })
    await router.isReady()

    mount(VisaWorkbenchView, {
      global: { plugins: [pinia, router, i18n, ElementPlus], ...mountPlugins },
    })
    await flushPromises()

    const call = vi.mocked(getVisaReminders).mock.calls.find((c) => {
      const p = c[0] as { assignedTo?: string }
      return p?.assignedTo === sampleAssigneeUuid
    })
    expect(call).toBeDefined()
  })
})

describe('VisaWorkbenchView — reminder table query (reminderType)', () => {
  beforeEach(setupReminderTableQueryMocks)

  it('requests visa reminders with reminderType from route query', async () => {
    const pinia = createPinia()
    seedAdminUserStore(pinia)
    const router = createTestRouter()
    await router.push({
      path: '/customers/workbench/visa',
      query: { reminderType: VisaReminderType.SUPPLEMENT },
    })
    await router.isReady()

    mount(VisaWorkbenchView, {
      global: { plugins: [pinia, router, i18n, ElementPlus], ...mountPlugins },
    })
    await flushPromises()

    expect(getVisaReminders).toHaveBeenCalled()
    const call = vi.mocked(getVisaReminders).mock.calls.find((c) => {
      const p = c[0] as { reminderType?: string }
      return p?.reminderType === VisaReminderType.SUPPLEMENT
    })
    expect(call).toBeDefined()
    expect((call![0] as { dataScope: string }).dataScope).toBe(VisaDataScope.ALL)
  })
})

describe('VisaWorkbenchView — KPI strip aria', () => {
  beforeEach(setupReminderTableQueryMocks)

  it('exposes read-only open-case KPI plus MVP notice chips with expected aria-labels', async () => {
    const pinia = createPinia()
    seedAdminUserStore(pinia)
    const router = createTestRouter()
    await router.push('/customers/workbench/visa')
    await router.isReady()

    const wrapper = mount(VisaWorkbenchView, {
      global: { plugins: [pinia, router, i18n, ElementPlus], ...mountPlugins },
    })
    await flushPromises()

    const { t } = i18n.global
    const hosts = wrapper.findAll('.visa-workbench-kpi-strip__chip-host--stat')
    expect(hosts.length).toBe(1)
    expect(hosts[0]!.attributes('aria-label')).toContain(t('pages.workbenchVisa.kpiOpenCasesFilterPending'))

    const mvpChips = wrapper.findAll('.visa-workbench-kpi-strip__chip-host--mvp')
    expect(mvpChips.length).toBe(2)
    expect(mvpChips[0]!.attributes('aria-label')).toBe(
      t('pages.workbenchVisa.kpiUnassignedChipAria', { count: 0 }),
    )
    expect(mvpChips[1]!.attributes('aria-label')).toBe(
      t('pages.workbenchVisa.kpiNoBucketChipAria', { count: 0 }),
    )
  })
})

describe('VisaWorkbenchView — KPI bucket chips and route query', () => {
  beforeEach(setupReminderTableQueryMocks)

  it('clicking supplement KPI replaces route query with reminderType SUPPLEMENT', async () => {
    const pinia = createPinia()
    seedAdminUserStore(pinia)
    const router = createTestRouter()
    await router.push('/customers/workbench/visa')
    await router.isReady()

    const wrapper = mount(VisaWorkbenchView, {
      global: { plugins: [pinia, router, i18n, ElementPlus], ...mountPlugins },
    })
    await flushPromises()

    const supplementChip = findSupplementReminderBucketChip(wrapper)
    await supplementChip.trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.query.reminderType).toBe(VisaReminderType.SUPPLEMENT)
  })

  it('clicking active supplement KPI chip again clears reminderType from query', async () => {
    const pinia = createPinia()
    seedAdminUserStore(pinia)
    const router = createTestRouter()
    await router.push({
      path: '/customers/workbench/visa',
      query: { reminderType: VisaReminderType.SUPPLEMENT },
    })
    await router.isReady()

    const wrapper = mount(VisaWorkbenchView, {
      global: { plugins: [pinia, router, i18n, ElementPlus], ...mountPlugins },
    })
    await flushPromises()

    const supplementChip = findSupplementReminderBucketChip(wrapper)
    await supplementChip.trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.query.reminderType).toBeUndefined()
  })
})

describe('VisaWorkbenchView — KPI MVP notice chips', () => {
  beforeEach(setupReminderTableQueryMocks)

  it('clicking unassigned MVP KPI chip shows info message without changing route query', async () => {
    const infoSpy = vi.spyOn(ElMessage, 'info').mockImplementation(() => ({ close: () => {} }) as never)
    const pinia = createPinia()
    seedAdminUserStore(pinia)
    const router = createTestRouter()
    await router.push('/customers/workbench/visa')
    await router.isReady()

    const wrapper = mount(VisaWorkbenchView, {
      global: { plugins: [pinia, router, i18n, ElementPlus], ...mountPlugins },
    })
    await flushPromises()

    const mvpChips = wrapper.findAll('.visa-workbench-kpi-strip__chip-host--mvp')
    await mvpChips[0]!.trigger('click')
    await flushPromises()

    const { t } = i18n.global
    expect(infoSpy).toHaveBeenCalledWith(
      expect.objectContaining({ message: t('pages.workbenchVisa.kpiUnassignedMvpToast') }),
    )
    expect(router.currentRoute.value.query.reminderType).toBeUndefined()
    expect(router.currentRoute.value.query.assignedTo).toBeUndefined()
    infoSpy.mockRestore()
  })

  it('clicking no-bucket MVP KPI chip shows info message without changing route query', async () => {
    const infoSpy = vi.spyOn(ElMessage, 'info').mockImplementation(() => ({ close: () => {} }) as never)
    const pinia = createPinia()
    seedAdminUserStore(pinia)
    const router = createTestRouter()
    await router.push('/customers/workbench/visa')
    await router.isReady()

    const wrapper = mount(VisaWorkbenchView, {
      global: { plugins: [pinia, router, i18n, ElementPlus], ...mountPlugins },
    })
    await flushPromises()

    const mvpChips = wrapper.findAll('.visa-workbench-kpi-strip__chip-host--mvp')
    await mvpChips[1]!.trigger('click')
    await flushPromises()

    const { t } = i18n.global
    expect(infoSpy).toHaveBeenCalledWith(
      expect.objectContaining({ message: t('pages.workbenchVisa.kpiNoBucketMvpToast') }),
    )
    expect(router.currentRoute.value.query.reminderType).toBeUndefined()
    infoSpy.mockRestore()
  })
})

describe('VisaWorkbenchView — full reminder list link', () => {
  beforeEach(setupReminderTableQueryMocks)

  it('renders secondary link to visa-reminders preserving scope and reminderType when user has visaReminder:list', async () => {
    const pinia = createPinia()
    seedAdminUserStore(pinia)
    const router = createTestRouter()
    await router.push({
      path: '/customers/workbench/visa',
      query: { dataScope: VisaDataScope.MINE, reminderType: VisaReminderType.SUPPLEMENT },
    })
    await router.isReady()

    const wrapper = mount(VisaWorkbenchView, {
      global: { plugins: [pinia, router, i18n, ElementPlus], ...mountPlugins },
    })
    await flushPromises()

    const link = wrapper.find('.visa-workbench__full-list-link')
    expect(link.exists()).toBe(true)
    const href = link.attributes('href') ?? ''
    expect(href).toContain('/customers/visa-reminders')
    expect(href).toContain('dataScope=mine')
    expect(href).toContain(`reminderType=${VisaReminderType.SUPPLEMENT}`)
    const { t } = i18n.global
    expect(link.attributes('aria-label')).toBe(t('pages.workbenchVisa.fullReminderListLinkAria'))
  })

  it('does not render link when user lacks visaReminder:list', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    useUserStore(pinia).$patch({
      userInfo: {
        id: 'u1',
        username: 't',
        displayName: 'T',
        email: 't@t.jp',
        roles: [],
        permissions: ['visaCase:list'],
        status: 'ACTIVE',
      },
    })
    const router = createTestRouter()
    await router.push('/customers/workbench/visa')
    await router.isReady()

    const wrapper = mount(VisaWorkbenchView, {
      global: { plugins: [pinia, router, i18n, ElementPlus], ...mountPlugins },
    })
    await flushPromises()

    expect(wrapper.find('.visa-workbench__full-list-link').exists()).toBe(false)
  })
})

