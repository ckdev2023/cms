/**
 * 客户详情可追溯性短规则：`el-collapse` 展开长文案与 `router.push` 深链（Vitest）。
 */
import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import type { Pinia } from 'pinia'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { h } from 'vue'
import type { Router } from 'vue-router'
import { createMemoryHistory, createRouter } from 'vue-router'

import { P } from '@/constants/permissions'
import { i18n } from '@/i18n'
import { useUserStore } from '@/stores/user'

import CustomerDetailTraceabilityHint from './CustomerDetailTraceabilityHint.vue'

/**
 * 使用给定权限初始化 Pinia 用户态。
 *
 * @param permissions - 模拟权限码列表
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

type HintMountOpts = {
  permissions: string[]
  routeQuery?: Record<string, string>
  spyPush?: boolean
}

/**
 * 挂载可追溯提示条并完成路由就绪，可选对 `router.push` 打桩。
 *
 * @param opts - 权限、初始 query、是否 spy push
 * @returns wrapper、router、pushSpy
 */
async function mountTraceabilityHint(
  opts: HintMountOpts,
): Promise<{ wrapper: ReturnType<typeof mount>; router: Router; pushSpy: ReturnType<typeof vi.spyOn> | null }> {
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
    path: '/customers/cust-trace',
    query: opts.routeQuery ?? { keep: '1' },
  })
  await router.isReady()
  const pushSpy = opts.spyPush
    ? vi.spyOn(router, 'push').mockResolvedValue(undefined)
    : null

  const wrapper = mount(CustomerDetailTraceabilityHint, {
    attachTo: document.body,
    global: {
      plugins: [pinia, router, i18n, ElementPlus],
    },
  })
  await flushPromises()
  return { wrapper, router, pushSpy }
}

/**
 * 按 `detailViews.customer.traceabilityHint` 子键匹配并点击首个按钮。
 *
 * @param wrapper - 已挂载组件 wrapper
 * @param messageKey - i18n 子键（如 `goCaseLogs`）
 */
async function clickTraceabilityButton(
  wrapper: ReturnType<typeof mount>,
  messageKey: 'goCaseLogs' | 'goNotes',
): Promise<void> {
  const label = String(
    i18n.global.t(`detailViews.customer.traceabilityHint.${messageKey}`),
  )
  const btn = wrapper
    .findAll('button')
    .find((b) => (b.text() ?? '').includes(label))
  expect(btn).toBeTruthy()
  await btn!.trigger('click')
  await flushPromises()
}

beforeEach(() => {
  i18n.global.locale.value = 'zh-CN'
  vi.clearAllMocks()
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('CustomerDetailTraceabilityHint — summary & permissions', () => {
  it('具备签证域相关只读能力时默认展示短文案（含签证分工）与「打开案件日志」', async () => {
    const { wrapper } = await mountTraceabilityHint({
      permissions: [P.VISA_CASE_LIST],
    })

    expect(document.body.textContent ?? '').toContain(
      String(i18n.global.t('detailViews.customer.traceabilityHint.summaryLineWithVisa')),
    )
    expect(document.body.textContent ?? '').toContain(
      String(i18n.global.t('detailViews.customer.traceabilityHint.goCaseLogs')),
    )

    wrapper.unmount()
  })

  it('无签证域入口权限时展示另一套短文案且不展示案件日志按钮', async () => {
    const { wrapper } = await mountTraceabilityHint({
      permissions: [P.CUSTOMER_DETAIL],
    })

    expect(document.body.textContent ?? '').toContain(
      String(i18n.global.t('detailViews.customer.traceabilityHint.summaryLineWithoutVisa')),
    )
    expect(document.body.textContent ?? '').not.toContain(
      String(i18n.global.t('detailViews.customer.traceabilityHint.goCaseLogs')),
    )

    wrapper.unmount()
  })
})

describe('CustomerDetailTraceabilityHint — collapse expanded body', () => {
  it('展开后展示长说明正文（含签证分支）', async () => {
    const { wrapper } = await mountTraceabilityHint({
      permissions: [P.VISA_CASE_DETAIL],
    })

    const expandLabel = String(
      i18n.global.t('detailViews.customer.traceabilityHint.expandRulesLabel'),
    )
    const header = wrapper
      .findAll('.el-collapse-item__header')
      .find((el) => (el.text() ?? '').includes(expandLabel))
    expect(header).toBeTruthy()
    await header!.trigger('click')
    await flushPromises()

    expect(document.body.textContent ?? '').toContain(
      String(i18n.global.t('detailViews.customer.traceabilityHint.detailExpandedWithVisa')),
    )

    wrapper.unmount()
  })

  it('无签证域权限时展开后展示无签证版长说明', async () => {
    const { wrapper } = await mountTraceabilityHint({
      permissions: [P.CUSTOMER_DETAIL],
    })

    const expandLabel = String(
      i18n.global.t('detailViews.customer.traceabilityHint.expandRulesLabel'),
    )
    const header = wrapper
      .findAll('.el-collapse-item__header')
      .find((el) => (el.text() ?? '').includes(expandLabel))
    expect(header).toBeTruthy()
    await header!.trigger('click')
    await flushPromises()

    expect(document.body.textContent ?? '').toContain(
      String(i18n.global.t('detailViews.customer.traceabilityHint.detailExpandedWithoutVisa')),
    )

    wrapper.unmount()
  })
})

describe('CustomerDetailTraceabilityHint — router.push', () => {
  it('点击「打开案件日志」时 push 签证域 logs 子块并合并当前 query', async () => {
    const { wrapper, pushSpy } = await mountTraceabilityHint({
      permissions: [P.VISA_CASE_LIST],
      routeQuery: { keep: '1', dataScope: 'team' },
      spyPush: true,
    })

    await clickTraceabilityButton(wrapper, 'goCaseLogs')
    expect(pushSpy).toHaveBeenCalledWith({
      path: '/customers/cust-trace',
      query: expect.objectContaining({
        keep: '1',
        dataScope: 'team',
        tab: 'visa-domain',
        visaDomainBlock: 'logs',
      }),
    })

    wrapper.unmount()
  })

  it('点击「打开备忘与跟进」时 push notes Tab 并合并当前 query', async () => {
    const { wrapper, pushSpy } = await mountTraceabilityHint({
      permissions: [P.VISA_CASE_LIST],
      routeQuery: { keep: '1' },
      spyPush: true,
    })

    await clickTraceabilityButton(wrapper, 'goNotes')
    expect(pushSpy).toHaveBeenCalledWith({
      path: '/customers/cust-trace',
      query: expect.objectContaining({
        keep: '1',
        tab: 'notes',
      }),
    })

    wrapper.unmount()
  })

  it('无签证域权限时仍可打开备忘 Tab', async () => {
    const { wrapper, pushSpy } = await mountTraceabilityHint({
      permissions: [P.CUSTOMER_DETAIL],
      spyPush: true,
    })

    await clickTraceabilityButton(wrapper, 'goNotes')
    expect(pushSpy).toHaveBeenCalledWith({
      path: '/customers/cust-trace',
      query: expect.objectContaining({ tab: 'notes' }),
    })

    wrapper.unmount()
  })
})
