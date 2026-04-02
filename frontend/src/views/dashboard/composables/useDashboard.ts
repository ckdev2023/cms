import { onMounted, reactive, ref } from 'vue'

import {
  getDashboardSummary,
  getExpiringItems,
  getFinanceSummary,
  getRecentActivity,
} from '@/api/dashboard'
import type {
  DashboardSummary,
  ExpiringItem,
  FinanceSummary,
  RecentActivityItem,
} from '@/types/dashboard'

const EXPIRING_WINDOW_DAYS = 30
const RECENT_ACTIVITY_LIMIT = 10

interface DashboardLoadingStates {
  summary: boolean
  expiring: boolean
  finance: boolean
  activity: boolean
}

type DashboardSectionKey = keyof DashboardLoadingStates

function createEmptySummary(): DashboardSummary {
  return {
    activeCustomers: 0,
    activeCases: 0,
    pendingInvoices: 0,
    activeContracts: 0,
  }
}

function createEmptyFinanceSummary(): FinanceSummary {
  return {
    draftCount: 0,
    draftAmount: 0,
    sentCount: 0,
    sentAmount: 0,
    partialCount: 0,
    partialAmount: 0,
    overdueCount: 0,
    overdueAmount: 0,
    monthlyCollected: 0,
    monthlyCollectedCount: 0,
  }
}

function createInitialLoadingStates(): DashboardLoadingStates {
  return {
    summary: true,
    expiring: true,
    finance: true,
    activity: true,
  }
}

/**
 * 聚合仪表盘首页的各区块数据请求与加载状态。
 *
 * @returns 包含汇总卡片、到期提醒、财务概览、最近动态及刷新方法的对象
 */
export function useDashboard() {
  const summary = ref<DashboardSummary>(createEmptySummary())
  const expiringItems = ref<ExpiringItem[]>([])
  const financeSummary = ref<FinanceSummary>(createEmptyFinanceSummary())
  const recentActivity = ref<RecentActivityItem[]>([])
  const loadingStates = reactive<DashboardLoadingStates>(createInitialLoadingStates())

  async function runSectionRequest<T>(
    section: DashboardSectionKey,
    request: () => Promise<{ data: T }>,
    onSuccess: (data: T) => void,
    onError?: () => void,
  ): Promise<void> {
    loadingStates[section] = true
    try {
      const res = await request()
      onSuccess(res.data)
    } catch {
      onError?.()
    } finally {
      loadingStates[section] = false
    }
  }

  /**
   * 并行刷新仪表盘全部区块。
   */
  async function fetchAll(): Promise<void> {
    await Promise.allSettled([
      fetchSummary(),
      fetchExpiring(),
      fetchFinance(),
      fetchActivity(),
    ])
  }

  function fetchSummary(): Promise<void> {
    return runSectionRequest('summary', getDashboardSummary, (data) => {
      summary.value = data
    })
  }

  function fetchExpiring(): Promise<void> {
    return runSectionRequest('expiring', () => getExpiringItems(EXPIRING_WINDOW_DAYS), (data) => {
      expiringItems.value = data
    }, () => {
      expiringItems.value = []
    })
  }

  function fetchFinance(): Promise<void> {
    return runSectionRequest('finance', getFinanceSummary, (data) => {
      financeSummary.value = data
    })
  }

  function fetchActivity(): Promise<void> {
    return runSectionRequest('activity', () => getRecentActivity(RECENT_ACTIVITY_LIMIT), (data) => {
      recentActivity.value = data
    }, () => {
      recentActivity.value = []
    })
  }

  onMounted(() => {
    void fetchAll()
  })

  return {
    loadingStates,
    summary,
    expiringItems,
    financeSummary,
    recentActivity,
    fetchAll,
  }
}
