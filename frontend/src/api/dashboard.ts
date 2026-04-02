import type { ApiResponse } from '@/types'
import type {
  DashboardSummary,
  ExpiringItem,
  FinanceSummary,
  RecentActivityItem,
} from '@/types/dashboard'
import { request } from '@/utils/request'

/**
 * 获取仪表盘首页的总览统计数据。
 *
 * @returns 仪表盘摘要指标的响应体
 */
export function getDashboardSummary(): Promise<ApiResponse<DashboardSummary>> {
  return request<DashboardSummary>({
    url: '/dashboard/summary',
    method: 'GET',
  })
}

/**
 * 获取指定天数内即将到期的业务事项。
 *
 * @param days - 距离到期日的查询窗口天数，默认 30 天
 * @returns 即将到期事项列表的响应体
 */
export function getExpiringItems(days = 30): Promise<ApiResponse<ExpiringItem[]>> {
  return request<ExpiringItem[]>({
    url: '/dashboard/expiring',
    method: 'GET',
    params: { days },
  })
}

/**
 * 获取仪表盘财务概览卡片所需数据。
 *
 * @returns 财务汇总指标的响应体
 */
export function getFinanceSummary(): Promise<ApiResponse<FinanceSummary>> {
  return request<FinanceSummary>({
    url: '/dashboard/finance-summary',
    method: 'GET',
  })
}

/**
 * 获取仪表盘最近活动列表数据。
 *
 * @param limit - 返回的活动条数上限，默认 10 条
 * @returns 最近活动列表的响应体
 */
export function getRecentActivity(
  limit = 10,
): Promise<ApiResponse<RecentActivityItem[]>> {
  return request<RecentActivityItem[]>({
    url: '/dashboard/recent-activity',
    method: 'GET',
    params: { limit },
  })
}
