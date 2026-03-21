import { request } from '@/utils/request'
import type { PaginatedResponse } from '@/types'
import type {
  AuditLogItem,
  AuditLogQueryParams,
  LoginLogItem,
  LoginLogQueryParams,
} from '@/types/log'

export function getAuditLogs(params: AuditLogQueryParams) {
  return request<PaginatedResponse<AuditLogItem>>({
    url: '/logs/audit',
    method: 'GET',
    params,
  })
}

export function getLoginLogs(params: LoginLogQueryParams) {
  return request<PaginatedResponse<LoginLogItem>>({
    url: '/logs/login',
    method: 'GET',
    params,
  })
}
