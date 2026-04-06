/**
 * 客户详情顶栏 Tab：主视图行标签、签证工作台 Tab 文案与默认工作台提示（Vitest）。
 */
import { mount } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import { describe, expect, it } from 'vitest'

import { i18n } from '@/i18n'

import CustomerDetailTabNav from './CustomerDetailTabNav.vue'

const tabNavPlugins = [i18n, ElementPlus] as const

describe('CustomerDetailTabNav — labels and visa workbench', () => {
  it('主 Tab 行展示 stitchLayout.detailTabsPrimaryRowLabel', () => {
    const wrapper = mount(CustomerDetailTabNav, {
      props: {
        showVisaDomainTab: true,
        showAdminCasesTab: true,
        visaDomainWorkbenchHint: false,
        activeTab: 'basic',
      },
      global: {
        plugins: [...tabNavPlugins],
      },
    })
    expect(wrapper.text()).toContain(
      String(i18n.global.t('detailViews.customer.stitchLayout.detailTabsPrimaryRowLabel')),
    )
    wrapper.unmount()
  })

  it('签证 Tab 标签与 stitchLayout.visaWorkbenchTab 一致', () => {
    const wrapper = mount(CustomerDetailTabNav, {
      props: {
        showVisaDomainTab: true,
        showAdminCasesTab: false,
        visaDomainWorkbenchHint: false,
        activeTab: 'basic',
      },
      global: {
        plugins: [...tabNavPlugins],
      },
    })
    expect(wrapper.text()).toContain(
      String(i18n.global.t('detailViews.customer.stitchLayout.visaWorkbenchTab')),
    )
    wrapper.unmount()
  })

  it('visaDomainWorkbenchHint 为 true 时签证 Tab 带 is-visa-workbench-default 类', () => {
    const wrapper = mount(CustomerDetailTabNav, {
      props: {
        showVisaDomainTab: true,
        showAdminCasesTab: false,
        visaDomainWorkbenchHint: true,
        activeTab: 'visa-domain',
      },
      global: {
        plugins: [...tabNavPlugins],
      },
    })
    const visaBtn = wrapper.findAll('button[role="tab"]').find((b) =>
      (b.text() ?? '').includes(
        String(i18n.global.t('detailViews.customer.stitchLayout.visaWorkbenchTab')),
      ),
    )
    expect(visaBtn?.classes().includes('is-visa-workbench-default')).toBe(true)
    wrapper.unmount()
  })
})

describe('CustomerDetailTabNav — primary row tab count and labels', () => {
  it('主行在展示签证时仅含基本信息、备忘、签证三个 role=tab，文案与 i18n 一致（行政案件不在主行）', () => {
    const wrapper = mount(CustomerDetailTabNav, {
      props: {
        showVisaDomainTab: true,
        showAdminCasesTab: true,
        visaDomainWorkbenchHint: false,
        activeTab: 'basic',
      },
      global: {
        plugins: [...tabNavPlugins],
      },
    })
    const primaryTabs = wrapper.find('.customer-detail-tab-nav__primary-tabs')
    const primaryTabButtons = primaryTabs.findAll('button[role="tab"]')
    expect(primaryTabButtons).toHaveLength(3)
    const basicLabel = String(i18n.global.t('detailViews.customer.basicInfo'))
    const notesLabel = String(i18n.global.t('detailViews.customer.notes'))
    const visaLabel = String(i18n.global.t('detailViews.customer.stitchLayout.visaWorkbenchTab'))
    expect(primaryTabs.text()).toContain(basicLabel)
    expect(primaryTabs.text()).toContain(notesLabel)
    expect(primaryTabs.text()).toContain(visaLabel)
    const adminLabel = String(i18n.global.t('detailViews.customer.adminCases'))
    expect(primaryTabs.text()).not.toContain(adminLabel)
    wrapper.unmount()
  })

  it('不展示签证域 Tab 时主行仅基本信息、备忘两个 role=tab', () => {
    const wrapper = mount(CustomerDetailTabNav, {
      props: {
        showVisaDomainTab: false,
        showAdminCasesTab: true,
        visaDomainWorkbenchHint: false,
        activeTab: 'basic',
      },
      global: {
        plugins: [...tabNavPlugins],
      },
    })
    const primaryTabs = wrapper.find('.customer-detail-tab-nav__primary-tabs')
    expect(primaryTabs.findAll('button[role="tab"]')).toHaveLength(2)
    expect(primaryTabs.text()).toContain(String(i18n.global.t('detailViews.customer.basicInfo')))
    expect(primaryTabs.text()).toContain(String(i18n.global.t('detailViews.customer.notes')))
    expect(primaryTabs.text()).not.toContain(
      String(i18n.global.t('detailViews.customer.stitchLayout.visaWorkbenchTab')),
    )
    wrapper.unmount()
  })
})

describe('CustomerDetailTabNav — ledger segmented row and admin-cases model', () => {
  it('showAdminCasesTab 为 true 时行政案件入口在台账分段行内', () => {
    const wrapper = mount(CustomerDetailTabNav, {
      props: {
        showVisaDomainTab: true,
        showAdminCasesTab: true,
        visaDomainWorkbenchHint: false,
        activeTab: 'admin-cases',
      },
      global: {
        plugins: [...tabNavPlugins],
      },
    })
    const segmented = wrapper.find('.customer-detail-tab-nav__segmented')
    expect(segmented.text()).toContain(
      String(i18n.global.t('detailViews.customer.adminCases')),
    )
    const adminBtn = segmented
      .findAll('button[role="tab"]')
      .find((b) =>
        (b.text() ?? '').includes(String(i18n.global.t('detailViews.customer.adminCases'))),
      )
    expect(adminBtn?.exists()).toBe(true)
    expect(adminBtn?.classes().includes('customer-detail-tab-nav__item--secondary')).toBe(true)
    wrapper.unmount()
  })

  it('点击台账分段行行政案件 Tab 时 v-model 仍为路由口径 admin-cases', async () => {
    const wrapper = mount(CustomerDetailTabNav, {
      props: {
        showVisaDomainTab: true,
        showAdminCasesTab: true,
        visaDomainWorkbenchHint: false,
        activeTab: 'basic',
      },
      global: {
        plugins: [...tabNavPlugins],
      },
    })
    const segmented = wrapper.find('.customer-detail-tab-nav__segmented')
    const adminBtn = segmented
      .findAll('button[role="tab"]')
      .find((b) =>
        (b.text() ?? '').includes(String(i18n.global.t('detailViews.customer.adminCases'))),
      )
    expect(adminBtn).toBeTruthy()
    await adminBtn!.trigger('click')
    const emitted = wrapper.emitted('update:activeTab')
    expect(emitted).toBeTruthy()
    expect(emitted?.at(-1)).toEqual(['admin-cases'])
    wrapper.unmount()
  })

  it('showAdminCasesTab 为 false 时台账分段行不含行政案件 Tab', () => {
    const wrapper = mount(CustomerDetailTabNav, {
      props: {
        showVisaDomainTab: true,
        showAdminCasesTab: false,
        visaDomainWorkbenchHint: false,
        activeTab: 'tax',
      },
      global: {
        plugins: [...tabNavPlugins],
      },
    })
    const segmented = wrapper.find('.customer-detail-tab-nav__segmented')
    expect(segmented.text()).not.toContain(String(i18n.global.t('detailViews.customer.adminCases')))
    wrapper.unmount()
  })
})

describe('CustomerDetailTabNav — a11y', () => {
  it('顶栏 tablist 标注 aria-orientation=horizontal，主行滚动区带可读 aria-label', () => {
    const wrapper = mount(CustomerDetailTabNav, {
      props: {
        showVisaDomainTab: true,
        showAdminCasesTab: false,
        visaDomainWorkbenchHint: false,
        activeTab: 'basic',
      },
      global: {
        plugins: [...tabNavPlugins],
      },
    })
    const tablist = wrapper.find('[role="tablist"]')
    expect(tablist.attributes('aria-orientation')).toBe('horizontal')
    const primaryGroup = wrapper.find('.customer-detail-tab-nav__primary-tabs')
    expect(primaryGroup.attributes('role')).toBe('group')
    expect(primaryGroup.attributes('aria-label')).toBe(
      String(
        i18n.global.t('detailViews.customer.stitchLayout.detailTabsPrimaryTabsScrollAriaLabel'),
      ),
    )
    wrapper.unmount()
  })
})
