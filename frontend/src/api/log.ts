import type { ApiResponse, PaginatedResponse } from '@/types'
import type {
  AuditLogItem,
  AuditLogQueryParams,
  LoginLogItem,
  LoginLogQueryParams,
} from '@/types/log'
import { request } from '@/utils/request'

/**
 * 按筛选条件分页获取审计日志列表。
 *
 * @param params - 审计日志分页、操作人和时间范围等查询条件
 * @returns 包含审计日志列表与总数的分页响应体
 */
export function getAuditLogs(
  params: AuditLogQueryParams,
): Promise<ApiResponse<PaginatedResponse<AuditLogItem>>> {
  return request<PaginatedResponse<AuditLogItem>>({
    url: '/logs/audit',
    method: 'GET',
    params,
  })
}

/**
 * 按筛选条件分页获取登录日志列表。
 *
 * @param params - 登录日志分页、用户名和时间范围等查询条件
 * @returns 包含登录日志列表与总数的分页响应体
 */
export function getLoginLogs(
  params: LoginLogQueryParams,
): Promise<ApiResponse<PaginatedResponse<LoginLogItem>>> {
  return request<PaginatedResponse<LoginLogItem>>({
    url: '/logs/login',
    method: 'GET',
    params,
  })
}
