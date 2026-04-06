/**
 * 签证域「基本信息摘要」卡片：跳转主档 Tab 的交互（Vitest）。
 */
import { mount } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import { describe, expect, it } from 'vitest'

import { CustomerStatus, CustomerType, ServiceType } from '@/constants/enums'
import { i18n } from '@/i18n'
import type { CustomerDetail } from '@/types/customer'

import CustomerVisaDomainBasicSnapshotCard from './CustomerVisaDomainBasicSnapshotCard.vue'

/**
 * 构造与 `GET /customers/:id` 对齐的最小详情，用于挂载摘要卡片。
 *
 * @returns 只读展示所需字段齐备的 `CustomerDetail`
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

describe('CustomerVisaDomainBasicSnapshotCard', () => {
  it('点击「查看完整资料」时抛出 open-full-basic', async () => {
    const wrapper = mount(CustomerVisaDomainBasicSnapshotCard, {
      props: { customer: minimalCustomerDetail() },
      global: { plugins: [ElementPlus, i18n] },
    })
    expect(wrapper.text()).toContain(
      i18n.global.t('detailViews.customer.stitchLayout.stackBlocks.basicSnapshot'),
    )
    expect(wrapper.text()).toContain(
      i18n.global.t('detailViews.customer.visaDomainTab.basicSnapshotGroupContact'),
    )
    expect(wrapper.text()).toContain(
      i18n.global.t('detailViews.customer.basicFields.passportNumber'),
    )
    await wrapper.find('[data-testid="visa-domain-basic-snapshot-open"]').trigger('click')
    expect(wrapper.emitted('open-full-basic')).toBeTruthy()
  })
})
