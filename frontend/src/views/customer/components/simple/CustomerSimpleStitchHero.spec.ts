/**
 * 简化客户详情 Stitch Hero：编辑/分享/添加随访等 CTA 与跳转旧详情深链（Vitest）。
 */
import { flushPromises, mount } from '@vue/test-utils'
import { ElMessage } from 'element-plus'
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
  ServiceType,
  VisaCaseStatus,
} from '@/constants/enums'
import { P } from '@/constants/permissions'
import { i18n } from '@/i18n'
import { useUserStore } from '@/stores/user'
import type { CustomerDetail, CustomerListPrimaryVisaCaseSummary } from '@/types/customer'

import CustomerSimpleStitchHero from './CustomerSimpleStitchHero.vue'

const CUSTOMER_UUID = 'a0000001-0001-4000-8000-000000000001'

/**
 * 构造主展示案件摘要最小对象。
 *
 * @param overrides - 可选字段覆盖
 * @returns 摘要对象
 */
function minimalListPrimaryVisaCase(
  overrides: Partial<CustomerListPrimaryVisaCaseSummary> = {},
): CustomerListPrimaryVisaCaseSummary {
  return {
    visaCaseId: 'vc-hero-1',
    caseType: null,
    caseStatus: VisaCaseStatus.IN_PROGRESS,
    expireDate: null,
    nextFollowUpAt: '2026-07-01',
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
 * 构造 Hero 所需的最小 `CustomerDetail`（未用到的列表字段以占位满足类型）。
 *
 * @param overrides - 可选覆盖
 * @returns 详情对象
 */
function minimalCustomerDetail(overrides: Partial<CustomerDetail> = {}): CustomerDetail {
  const base: CustomerDetail = {
    id: CUSTOMER_UUID,
    customerCode: 'H-001',
    customerType: CustomerType.PERSONAL,
    customerName: '简化 Hero 客户',
    phone: null,
    email: null,
    wechatId: null,
    lineId: null,
    address: null,
    serviceType: ServiceType.ADMIN,
    ownerUserId: null,
    ownerName: null,
    status: CustomerStatus.ACTIVE,
    photoFileId: null,
    listPrimaryVisaCase: minimalListPrimaryVisaCase(),
    listPrimaryVisaCaseSource: 'SELF',
    primaryCustomerIdForListFallback: null,
    companyInfo: null,
    personInfo: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    staffRelations: [],
    ...overrides,
  }
  return base
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
 * 挂载简化 Hero 并可选监听 `router.push`。
 *
 * @param opts - 权限、客户数据、是否 spy push
 * @returns wrapper、router、pushSpy
 */
async function mountHero(opts: {
  permissions: string[]
  customer?: CustomerDetail
  spyPush?: boolean
}): Promise<{
  wrapper: ReturnType<typeof mount>
  router: Router
  pushSpy: ReturnType<typeof vi.spyOn> | null
}> {
  const pinia = initPiniaWithPermissions(opts.permissions)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: '/customers/:id/simple',
        name: 'CustomerDetailSimpleStub',
        component: { render: () => h('div') },
      },
      {
        path: '/customers/:id',
        name: 'CustomerDetail',
        component: { render: () => h('div') },
      },
    ],
  })
  await router.push({
    path: `/customers/${CUSTOMER_UUID}/simple`,
    query: {},
  })
  await router.isReady()

  const pushSpy = opts.spyPush ? vi.spyOn(router, 'push').mockResolvedValue(undefined) : null

  const wrapper = mount(CustomerSimpleStitchHero, {
    props: {
      customer: opts.customer ?? minimalCustomerDetail(),
    },
    global: {
      plugins: [pinia, router, ElementPlus, i18n],
    },
  })
  await flushPromises()
  return { wrapper, router, pushSpy }
}

describe('CustomerSimpleStitchHero — CTA wiring', () => {
  beforeEach(() => {
    vi.spyOn(ElMessage, 'success').mockImplementation(vi.fn())
    vi.spyOn(ElMessage, 'error').mockImplementation(vi.fn())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('点击顶栏「返回」向父组件抛出 request-back', async () => {
    const { wrapper } = await mountHero({
      permissions: [],
    })
    const backLabel = String(
      i18n.global.t('detailViews.customer.stitchLayout.simpleHero.backToCustomerList'),
    )
    const btn = wrapper.findAll('button').find((b) => String(b.text()).includes(backLabel))
    expect(btn).toBeTruthy()
    await btn!.trigger('click')
    expect(wrapper.emitted('request-back')).toEqual([[]])
  })

  it('可编辑时点击「编辑」向父组件抛出 request-edit', async () => {
    const { wrapper } = await mountHero({
      permissions: [P.CUSTOMER_EDIT],
    })
    const editLabel = String(i18n.global.t('detailViews.customer.stitchLayout.simpleHero.edit'))
    const btn = wrapper.findAll('button').find((b) => String(b.text()).includes(editLabel))
    expect(btn).toBeTruthy()
    await btn!.trigger('click')
    expect(wrapper.emitted('request-edit')).toEqual([[]])
  })

  it('点击「复制链接」复制当前页 URL 并提示成功', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })

    const { wrapper } = await mountHero({
      permissions: [],
      customer: minimalCustomerDetail({ listPrimaryVisaCase: null }),
    })
    const shareLabel = String(
      i18n.global.t('detailViews.customer.stitchLayout.simpleHero.copyPageLink'),
    )
    const btn = wrapper.findAll('button').find((b) => String(b.text()).includes(shareLabel))
    expect(btn).toBeTruthy()
    await btn!.trigger('click')
    await flushPromises()
    expect(writeText).toHaveBeenCalledWith(window.location.href)
    expect(ElMessage.success).toHaveBeenCalled()
  })

  it('有主展示案件且可写日志时「添加随访」打开新增跟进弹框且不跳转旧详情', async () => {
    const { wrapper, pushSpy } = await mountHero({
      permissions: [P.VISA_CASE_LOG_CREATE],
      spyPush: true,
    })
    const ctaLabel = String(
      i18n.global.t('detailViews.customer.stitchLayout.simpleHero.addFollowUp'),
    )
    const btn = wrapper.findAll('button').find((b) => String(b.text()).includes(ctaLabel))
    expect(btn).toBeTruthy()
    await btn!.trigger('click')
    await flushPromises()
    expect(pushSpy).not.toHaveBeenCalled()
    expect(document.querySelector('.customer-simple-follow-up-log-dialog')).toBeTruthy()
    wrapper.unmount()
  })
})
