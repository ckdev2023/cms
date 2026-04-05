import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import ElementPlus, { ElMenuItem } from 'element-plus'
import type { Pinia } from 'pinia'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { h } from 'vue'
import type { Router } from 'vue-router'
import { createMemoryHistory, createRouter } from 'vue-router'

import { P } from '@/constants/permissions'
import { i18n } from '@/i18n'
import { useUserStore } from '@/stores/user'

import CustomerCenterLayout from './CustomerCenterLayout.vue'

/**
 * 构造与 KeepAlive `include` 对齐的具名路由子组件桩。
 *
 * @param name - 子页组件 `defineOptions.name`
 * @returns 可作为 `component` 传入的桩对象
 */
function namedRouteStub(name: string): { name: string; render: () => ReturnType<typeof h> } {
  return {
    name,
    render() {
      return h('div', name)
    },
  }
}

function createCustomerCenterRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: '/dashboard',
        name: 'Dashboard',
        component: { name: 'DashboardStub', render: () => h('div') },
      },
      {
        path: '/customers',
        component: CustomerCenterLayout,
        children: [
          {
            path: '',
            name: 'CustomerList',
            component: namedRouteStub('CustomerListView'),
          },
          {
            path: 'workbench/visa',
            name: 'VisaWorkbench',
            component: namedRouteStub('VisaWorkbenchView'),
          },
          {
            path: 'visa-reminders',
            name: 'VisaReminderList',
            component: namedRouteStub('VisaReminderListView'),
          },
          {
            path: 'admin-cases',
            name: 'AdminCaseList',
            component: namedRouteStub('AdminCaseListView'),
          },
          {
            path: 'residence-reminders',
            name: 'ResidenceReminders',
            component: namedRouteStub('ResidenceReminderListView'),
          },
          {
            path: 'visa-cases',
            name: 'VisaCaseRegistry',
            component: namedRouteStub('VisaCaseRegistryView'),
          },
          {
            path: 'visa-case-import',
            name: 'VisaCaseImport',
            component: namedRouteStub('VisaCaseImportView'),
          },
        ],
      },
    ],
  })
}

/**
 * 读取当前挂载侧栏中 `el-menu-item` 的 `index`（路由 path）列表。
 *
 * @param wrapper - 已挂载的 `CustomerCenterLayout` 包装器
 * @returns 侧栏菜单项 path 列表（顺序与配置一致）
 */
function sidebarMenuItemPaths(wrapper: Awaited<ReturnType<typeof mountCustomerCenterLayout>>): string[] {
  const menu = wrapper.find('.customer-center-layout__menu')
  if (!menu.exists()) {
    return []
  }
  return menu
    .findAllComponents(ElMenuItem)
    .map((w: VueWrapper<InstanceType<typeof ElMenuItem>>) => String(w.props('index')))
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
 * 挂载客户中心布局并等待 `watch` / `replace` 副作用 flush。
 *
 * @param pinia - Pinia 实例
 * @param router - 与布局共用的路由器
 * @returns 挂载后的 Wrapper（已 `flushPromises`）
 */
async function mountCustomerCenterLayout(pinia: Pinia, router: Router) {
  const wrapper = mount(CustomerCenterLayout, {
    global: {
      plugins: [pinia, router, i18n, ElementPlus],
    },
  })
  await flushPromises()
  return wrapper
}

async function assertReplacesToWorkbenchWithPreservedQuery(): Promise<void> {
  const pinia = initPiniaWithPermissions([P.CUSTOMER_LIST, P.VISA_CASE_LIST])
  const router = createCustomerCenterRouter()
  const replaceSpy = vi.spyOn(router, 'replace')

  await router.push({ path: '/customers', query: { dataScope: 'team' } })
  await router.isReady()
  await mountCustomerCenterLayout(pinia, router)

  expect(replaceSpy).toHaveBeenCalledWith(
    expect.objectContaining({
      path: '/customers/workbench/visa',
      query: expect.objectContaining({ dataScope: 'team' }),
    }),
  )
}

async function assertCustomerListOnlyDoesNotReplaceToWorkbench(): Promise<void> {
  const pinia = initPiniaWithPermissions([P.CUSTOMER_LIST])
  const router = createCustomerCenterRouter()
  const replaceSpy = vi.spyOn(router, 'replace')

  await router.push('/customers')
  await router.isReady()
  await mountCustomerCenterLayout(pinia, router)

  const workbenchRedirects = replaceSpy.mock.calls.filter(
    (call) => (call[0] as { path?: string })?.path === '/customers/workbench/visa',
  )
  expect(workbenchRedirects.length).toBe(0)
}

async function assertNoCustomerListRedirectsToFirstTab(): Promise<void> {
  const pinia = initPiniaWithPermissions([P.ADMIN_CASE_LIST])
  const router = createCustomerCenterRouter()
  const replaceSpy = vi.spyOn(router, 'replace')

  await router.push('/customers')
  await router.isReady()
  await mountCustomerCenterLayout(pinia, router)

  expect(replaceSpy).toHaveBeenCalledWith(
    expect.objectContaining({
      path: '/customers/admin-cases',
    }),
  )
}

async function assertTabSwitchFromWorkbenchToListDoesNotReplace(): Promise<void> {
  const pinia = initPiniaWithPermissions([P.CUSTOMER_LIST, P.VISA_REMINDER_LIST])
  const router = createCustomerCenterRouter()
  const replaceSpy = vi.spyOn(router, 'replace')

  await router.push('/customers/workbench/visa')
  await router.isReady()
  await mountCustomerCenterLayout(pinia, router)

  replaceSpy.mockClear()
  await router.push('/customers')
  await flushPromises()

  expect(replaceSpy).not.toHaveBeenCalled()
  expect(router.currentRoute.value.path).toBe('/customers')
}

describe('CustomerCenterLayout — /customers default workbench redirect', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('replace 到签证工作台并保留 query（双权限用户从 /customers 进入）', async () => {
    await assertReplacesToWorkbenchWithPreservedQuery()
  })

  it('仅客户列表权时不向工作台 replace', async () => {
    await assertCustomerListOnlyDoesNotReplaceToWorkbench()
  })

  it('无客户列表权时 replace 到首个可见 Tab（与既有行为一致）', async () => {
    await assertNoCustomerListRedirectsToFirstTab()
  })

  it('从工作台切回客户列表时不触发工作台 replace', async () => {
    await assertTabSwitchFromWorkbenchToListDoesNotReplace()
  })
})

describe('CustomerCenterLayout — 左侧侧栏可见性', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('可见 Tab 多于 1 时渲染侧栏、`el-menu` 与 `customer-center-layout--with-sidebar`', async () => {
    const pinia = initPiniaWithPermissions([P.CUSTOMER_LIST, P.VISA_REMINDER_LIST])
    const router = createCustomerCenterRouter()
    await router.push('/customers/workbench/visa')
    await router.isReady()
    const wrapper = await mountCustomerCenterLayout(pinia, router)

    expect(wrapper.find('.customer-center-layout--with-sidebar').exists()).toBe(true)
    expect(wrapper.find('nav.customer-center-layout__sidebar').exists()).toBe(true)
    expect(wrapper.find('.customer-center-layout__menu').exists()).toBe(true)
    expect(wrapper.find('nav').attributes('aria-label')).toBeTruthy()
  })

  it('仅单一可见 Tab 时不渲染侧栏且不附加 `customer-center-layout--with-sidebar`', async () => {
    const pinia = initPiniaWithPermissions([P.ADMIN_CASE_LIST])
    const router = createCustomerCenterRouter()
    await router.push('/customers')
    await router.isReady()
    const wrapper = await mountCustomerCenterLayout(pinia, router)

    expect(wrapper.find('.customer-center-layout--with-sidebar').exists()).toBe(false)
    expect(wrapper.find('nav.customer-center-layout__sidebar').exists()).toBe(false)
    expect(wrapper.find('.customer-center-layout__menu').exists()).toBe(false)
  })
})

describe('CustomerCenterLayout — 左侧侧栏权限与 path 集合', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('同权限下 `showInCustomerCenterSidebar:false` 的 Tab 不计入侧栏项（如全表签证提醒）', async () => {
    const pinia = initPiniaWithPermissions([P.VISA_REMINDER_LIST])
    const router = createCustomerCenterRouter()
    await router.push('/customers/workbench/visa')
    await router.isReady()
    const wrapper = await mountCustomerCenterLayout(pinia, router)

    expect(wrapper.find('.customer-center-layout--with-sidebar').exists()).toBe(true)
    const paths = sidebarMenuItemPaths(wrapper)
    expect(paths).toEqual(['/customers/workbench/visa'])
    expect(paths).not.toContain('/customers/visa-reminders')
  })

  it('权限裁剪：无案件台账权时侧栏不出现 `/customers/visa-cases`', async () => {
    const pinia = initPiniaWithPermissions([P.CUSTOMER_LIST, P.VISA_REMINDER_LIST])
    const router = createCustomerCenterRouter()
    await router.push('/customers/workbench/visa')
    await router.isReady()
    const wrapper = await mountCustomerCenterLayout(pinia, router)

    const paths = sidebarMenuItemPaths(wrapper)
    expect(paths).toContain('/customers')
    expect(paths).toContain('/customers/workbench/visa')
    expect(paths).toContain('/customers/residence-reminders')
    expect(paths).not.toContain('/customers/visa-cases')
  })

  it('跨分组多条可见时侧栏至少包含两个 `el-menu-item`', async () => {
    const pinia = initPiniaWithPermissions([P.CUSTOMER_LIST, P.ADMIN_CASE_LIST])
    const router = createCustomerCenterRouter()
    await router.push('/customers/admin-cases')
    await router.isReady()
    const wrapper = await mountCustomerCenterLayout(pinia, router)

    expect(wrapper.find('.customer-center-layout__menu').exists()).toBe(true)
    expect(
      wrapper.find('.customer-center-layout__menu').findAllComponents(ElMenuItem).length,
    ).toBeGreaterThanOrEqual(2)
  })
})

describe('CustomerCenterLayout — 左侧侧栏路由交互', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('点击侧栏菜单项时 `router.push` 到客户列表路径', async () => {
    const pinia = initPiniaWithPermissions([
      P.CUSTOMER_LIST,
      P.VISA_REMINDER_LIST,
      P.VISA_CASE_LIST,
    ])
    const router = createCustomerCenterRouter()
    const pushSpy = vi.spyOn(router, 'push')
    await router.push('/customers/workbench/visa')
    await router.isReady()
    const wrapper = await mountCustomerCenterLayout(pinia, router)
    pushSpy.mockClear()

    const customerItem = wrapper
      .find('.customer-center-layout__menu')
      .findAllComponents(ElMenuItem)
      .find((w: VueWrapper<InstanceType<typeof ElMenuItem>>) => w.props('index') === '/customers')
    expect(customerItem).toBeDefined()
    await customerItem!.trigger('click')
    await flushPromises()

    expect(pushSpy).toHaveBeenCalled()
    expect(router.currentRoute.value.path).toBe('/customers')
  })

  it('点击侧栏工作台项时导航到 `/customers/workbench/visa`', async () => {
    const pinia = initPiniaWithPermissions([P.CUSTOMER_LIST, P.VISA_REMINDER_LIST])
    const router = createCustomerCenterRouter()
    const pushSpy = vi.spyOn(router, 'push')
    await router.push('/customers/residence-reminders')
    await router.isReady()
    const wrapper = await mountCustomerCenterLayout(pinia, router)
    pushSpy.mockClear()

    const workbenchItem = wrapper
      .find('.customer-center-layout__menu')
      .findAllComponents(ElMenuItem)
      .find((w: VueWrapper<InstanceType<typeof ElMenuItem>>) => w.props('index') === '/customers/workbench/visa')
    expect(workbenchItem).toBeDefined()
    await workbenchItem!.trigger('click')
    await flushPromises()

    expect(pushSpy).toHaveBeenCalled()
    expect(router.currentRoute.value.path).toBe('/customers/workbench/visa')
  })
})
