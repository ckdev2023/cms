/**
 * 定义仪表盘统计卡片、到期提醒与活动流的数据类型。
 */
export interface DashboardSummary {
  activeCustomers: number
  activeCases: number
  pendingInvoices: number
  activeContracts: number
}

export interface ExpiringItem {
  id: string
  type: 'admin_case' | 'tax_deadline'
  title: string
  customerName: string
  customerId: string
  deadline: string
  daysLeft: number
  status: string
}

export interface FinanceSummary {
  draftCount: number
  draftAmount: number
  sentCount: number
  sentAmount: number
  partialCount: number
  partialAmount: number
  overdueCount: number
  overdueAmount: number
  monthlyCollected: number
  monthlyCollectedCount: number
}

export interface RecentActivityItem {
  id: string
  type: 'note' | 'file'
  title: string
  description: string
  customerName: string | null
  customerId: string | null
  createdAt: string
  creatorName: string | null
}
