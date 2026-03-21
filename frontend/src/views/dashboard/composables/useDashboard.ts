import { ref, onMounted } from 'vue'
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

export function useDashboard() {
  const loading = ref(true)
  const summary = ref<DashboardSummary>({
    activeCustomers: 0,
    activeCases: 0,
    pendingInvoices: 0,
    activeContracts: 0,
  })
  const expiringItems = ref<ExpiringItem[]>([])
  const financeSummary = ref<FinanceSummary>({
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
  })
  const recentActivity = ref<RecentActivityItem[]>([])

  const loadingStates = ref({
    summary: true,
    expiring: true,
    finance: true,
    activity: true,
  })

  async function fetchAll() {
    loading.value = true
    await Promise.allSettled([
      fetchSummary(),
      fetchExpiring(),
      fetchFinance(),
      fetchActivity(),
    ])
    loading.value = false
  }

  async function fetchSummary() {
    loadingStates.value.summary = true
    try {
      const res = await getDashboardSummary()
      summary.value = res.data
    } catch {
      // keep default values
    } finally {
      loadingStates.value.summary = false
    }
  }

  async function fetchExpiring() {
    loadingStates.value.expiring = true
    try {
      const res = await getExpiringItems(30)
      expiringItems.value = res.data
    } catch {
      expiringItems.value = []
    } finally {
      loadingStates.value.expiring = false
    }
  }

  async function fetchFinance() {
    loadingStates.value.finance = true
    try {
      const res = await getFinanceSummary()
      financeSummary.value = res.data
    } catch {
      // keep default values
    } finally {
      loadingStates.value.finance = false
    }
  }

  async function fetchActivity() {
    loadingStates.value.activity = true
    try {
      const res = await getRecentActivity(10)
      recentActivity.value = res.data
    } catch {
      recentActivity.value = []
    } finally {
      loadingStates.value.activity = false
    }
  }

  onMounted(fetchAll)

  return {
    loading,
    loadingStates,
    summary,
    expiringItems,
    financeSummary,
    recentActivity,
    fetchAll,
  }
}
