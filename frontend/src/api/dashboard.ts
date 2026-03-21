import { request } from '@/utils/request'
import type {
  DashboardSummary,
  ExpiringItem,
  FinanceSummary,
  RecentActivityItem,
} from '@/types/dashboard'

export function getDashboardSummary() {
  return request<DashboardSummary>({
    url: '/dashboard/summary',
    method: 'GET',
  })
}

export function getExpiringItems(days = 30) {
  return request<ExpiringItem[]>({
    url: '/dashboard/expiring',
    method: 'GET',
    params: { days },
  })
}

export function getFinanceSummary() {
  return request<FinanceSummary>({
    url: '/dashboard/finance-summary',
    method: 'GET',
  })
}

export function getRecentActivity(limit = 10) {
  return request<RecentActivityItem[]>({
    url: '/dashboard/recent-activity',
    method: 'GET',
    params: { limit },
  })
}
