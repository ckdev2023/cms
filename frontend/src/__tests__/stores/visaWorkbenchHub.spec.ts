import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getVisaWorkbenchAggregate } from '@/api/visa-case'
import { VisaDataScope } from '@/constants/enums'
import { useVisaWorkbenchHubStore } from '@/stores/visaWorkbenchHub'
import type { ApiResponse } from '@/types'
import type { VisaWorkbenchAggregate } from '@/types/visa-case'

vi.mock('@/api/visa-case', () => ({
  getVisaWorkbenchAggregate: vi.fn(),
}))

/**
 * 构造工作台聚合接口的最小合法响应体，供 store 单测复用。
 *
 * @param buckets - 覆盖 `reminderBuckets` 计数
 * @returns 带 `code` / `message` 的 `ApiResponse` 形态
 */
function visaWorkbenchAggregateOk(
  buckets: VisaWorkbenchAggregate['stats']['reminderBuckets'],
): ApiResponse<VisaWorkbenchAggregate> {
  return {
    code: 0,
    message: 'ok',
    data: {
      stats: {
        caseStatusCounts: [],
        reminderBuckets: buckets,
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
    },
  }
}

describe('useVisaWorkbenchHubStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(getVisaWorkbenchAggregate).mockReset()
  })

  it('should fetch stats with previewLimit 0 and set fetchedAt on success', async () => {
    vi.mocked(getVisaWorkbenchAggregate).mockResolvedValue(
      visaWorkbenchAggregateOk({
        supplement: 1,
        todayFollowUp: 2,
        expiring7Days: 3,
        expiring2Months: 0,
        noBucket: 0,
      }),
    )

    const store = useVisaWorkbenchHubStore()
    await store.fetchAggregateStatsOnly(VisaDataScope.MINE, { force: true })

    expect(getVisaWorkbenchAggregate).toHaveBeenCalledWith({
      dataScope: VisaDataScope.MINE,
      previewLimit: 0,
    })
    expect(store.stats?.reminderBuckets.supplement).toBe(1)
    expect(store.fetchedAt).not.toBeNull()
    expect(store.fetchFailed).toBe(false)
    expect(store.lastSuccessfulDataScope).toBe(VisaDataScope.MINE)
  })

  it('should throttle repeat fetches for the same scope within 60s', async () => {
    vi.mocked(getVisaWorkbenchAggregate).mockResolvedValue(
      visaWorkbenchAggregateOk({
        supplement: 0,
        todayFollowUp: 0,
        expiring7Days: 0,
        expiring2Months: 0,
        noBucket: 0,
      }),
    )

    const store = useVisaWorkbenchHubStore()
    await store.fetchAggregateStatsOnly(VisaDataScope.ALL, { force: true })
    await store.fetchAggregateStatsOnly(VisaDataScope.ALL)

    expect(getVisaWorkbenchAggregate).toHaveBeenCalledTimes(1)
  })

  it('should set fetchFailed on error without throwing', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.mocked(getVisaWorkbenchAggregate).mockRejectedValue(new Error('network'))

    const store = useVisaWorkbenchHubStore()
    await expect(store.fetchAggregateStatsOnly(VisaDataScope.TEAM, { force: true })).resolves.toBeUndefined()

    expect(store.fetchFailed).toBe(true)
    expect(warnSpy).toHaveBeenCalledOnce()
    expect(String(warnSpy.mock.calls[0]?.[0])).toContain('[visaWorkbenchHub] fetchAggregateStatsOnly failed')
    warnSpy.mockRestore()
  })

  it('should apply stats from full aggregate and refresh throttle anchor for scope', () => {
    const store = useVisaWorkbenchHubStore()
    const buckets: VisaWorkbenchAggregate['stats']['reminderBuckets'] = {
      supplement: 9,
      todayFollowUp: 8,
      expiring7Days: 7,
      expiring2Months: 0,
      noBucket: 1,
    }
    store.applyStatsFromFullAggregate(VisaDataScope.MINE, {
      caseStatusCounts: [],
      reminderBuckets: buckets,
      expiringWithin7DaysWindow: 1,
      todayFollowUpCount: 8,
      supplementRelatedCount: 9,
      unassignedCount: 0,
    })

    expect(store.stats?.reminderBuckets.supplement).toBe(9)
    expect(store.lastSuccessfulDataScope).toBe(VisaDataScope.MINE)
    expect(store.fetchFailed).toBe(false)
  })
})
