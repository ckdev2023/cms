import type { PaginationParams } from './api'

export interface AuditLogItem {
  id: string
  userId: string | null
  username: string | null
  displayName: string | null
  actionType: string
  targetType: string | null
  targetId: string | null
  beforeValue: Record<string, unknown> | null
  afterValue: Record<string, unknown> | null
  ipAddress: string | null
  deviceInfo: string | null
  result: string | null
  occurredAt: string
}

export interface LoginLogItem {
  id: string
  userId: string | null
  username: string
  displayName: string | null
  loginType: string
  ipAddress: string | null
  deviceInfo: string | null
  result: string
  failureReason: string | null
  occurredAt: string
}

export interface AuditLogQueryParams extends PaginationParams {
  userId?: string
  actionType?: string
  targetType?: string
  targetId?: string
  startDate?: string
  endDate?: string
  result?: string
}

export interface LoginLogQueryParams extends PaginationParams {
  userId?: string
  username?: string
  loginType?: string
  result?: string
  startDate?: string
  endDate?: string
}
