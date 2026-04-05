import type { ApiResponse, PaginatedResponse } from '@/types'
import type {
  AuditLogExportParams,
  AuditLogItem,
  AuditLogQueryParams,
  ExportLogItem,
  ExportLogQueryParams,
  LoginLogItem,
  LoginLogQueryParams,
} from '@/types/log'
import service, { request } from '@/utils/request'

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

/**
 * 按当前筛选条件下载操作审计 CSV（UTF-8 BOM），并在服务端写入 `export_logs`。
 *
 * @param params - 与列表相同的筛选与排序，可选 `limit`（默认 2000，最大 5000）
 * @returns 无返回值；成功时触发浏览器下载
 */
export async function exportAuditLogsCsv(params: AuditLogExportParams): Promise<void> {
  const response = await service.get('/logs/audit/export.csv', {
    params,
    responseType: 'blob',
  })
  const disposition = response.headers['content-disposition']
  let filename = 'audit-logs.csv'
  if (typeof disposition === 'string') {
    const match = disposition.match(/filename="([^"]+)"/)
    if (match?.[1]) {
      filename = match[1]
    }
  }
  const blob = new Blob([response.data as BlobPart], {
    type: 'text/csv;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

/**
 * 按筛选条件分页获取导出日志列表。
 *
 * @param params - 导出日志分页、操作者与时间范围等查询条件
 * @returns 包含导出日志列表与总数的分页响应体
 */
export function getExportLogs(
  params: ExportLogQueryParams,
): Promise<ApiResponse<PaginatedResponse<ExportLogItem>>> {
  return request<PaginatedResponse<ExportLogItem>>({
    url: '/logs/export',
    method: 'GET',
    params,
  })
}
