import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getVisaDomainStats } from '@/api/visa-case'
import { VisaDataScope } from '@/constants/enums'
import { i18n } from '@/i18n'
import type { VisaDomainStats } from '@/types/visa-case'

import VisaCaseRegistryStatsPanel from './VisaCaseRegistryStatsPanel.vue'

vi.mock('@/api/visa-case', () => ({
  getVisaDomainStats: vi.fn(),
}))

const emptyStats: VisaDomainStats = {
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
}

/**
 * Phase C1：`listQuery` 与 `dataScope` 变更时须以与列表同构参数调用 `getVisaDomainStats`（docs/25 §12.3 / §12.6 F2）。
 */
describe('VisaCaseRegistryStatsPanel', () => {
  beforeEach(() => {
    vi.mocked(getVisaDomainStats).mockResolvedValue({
      code: 0,
      message: 'ok',
      data: emptyStats,
    })
  })

  it('calls getVisaDomainStats with listQuery spread and dataScope when props change', async () => {
    const wrapper = mount(VisaCaseRegistryStatsPanel, {
      props: {
        listQuery: {},
        dataScope: VisaDataScope.ALL,
      },
      global: { plugins: [ElementPlus, i18n] },
    })
    await flushPromises()
    expect(getVisaDomainStats).toHaveBeenLastCalledWith({
      dataScope: VisaDataScope.ALL,
    })

    await wrapper.setProps({
      listQuery: { assignedToIds: ['user-abc'] },
      dataScope: VisaDataScope.MINE,
    })
    await flushPromises()
    expect(getVisaDomainStats).toHaveBeenLastCalledWith({
      assignedToIds: ['user-abc'],
      dataScope: VisaDataScope.MINE,
    })
  })
})
