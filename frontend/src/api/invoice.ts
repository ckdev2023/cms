import type { InvoiceStatus } from '@/constants/enums'
import type { ApiResponse, PaginatedResponse } from '@/types'
import type {
  CreateInvoiceParams,
  InvoiceDetail,
  InvoiceListItem,
  InvoiceQueryParams,
  InvoiceSummaryItem,
  UpdateInvoiceParams,
  VoidInvoiceParams,
} from '@/types/invoice'
import { request } from '@/utils/request'

/**
 * 为发票写操作生成幂等请求头。
 *
 * @returns 包含随机幂等键的请求头对象
 */
function idempotencyHeaders(): Record<string, string> {
  return { 'x-idempotency-key': crypto.randomUUID() }
}

/**
 * 按筛选条件分页获取发票列表。
 *
 * @param params - 发票分页、状态与客户等查询条件
 * @returns 包含发票列表与总数的分页响应体
 */
export function getInvoices(
  params: InvoiceQueryParams,
): Promise<ApiResponse<PaginatedResponse<InvoiceListItem>>> {
  return request<PaginatedResponse<InvoiceListItem>>({
    url: '/invoices',
    method: 'GET',
    params,
  })
}

/**
 * 获取单张发票的完整详情。
 *
 * @param id - 目标发票 ID
 * @returns 指定发票的详情响应体
 */
export function getInvoice(id: string): Promise<ApiResponse<InvoiceDetail>> {
  return request<InvoiceDetail>({
    url: `/invoices/${id}`,
    method: 'GET',
  })
}

/**
 * 提交新建发票表单并返回创建结果。
 *
 * @param data - 发票金额、客户和明细等字段
 * @returns 新建成功后的发票详情响应体
 */
export function createInvoice(
  data: CreateInvoiceParams,
): Promise<ApiResponse<InvoiceDetail>> {
  return request<InvoiceDetail>({
    url: '/invoices',
    method: 'POST',
    data,
    headers: idempotencyHeaders(),
  })
}

/**
 * 更新指定发票的基础资料。
 *
 * @param id - 需要更新的发票 ID
 * @param data - 本次允许修改的发票字段集合
 * @returns 更新后的发票详情响应体
 */
export function updateInvoice(
  id: string,
  data: UpdateInvoiceParams,
): Promise<ApiResponse<InvoiceDetail>> {
  return request<InvoiceDetail>({
    url: `/invoices/${id}`,
    method: 'PUT',
    data,
    headers: idempotencyHeaders(),
  })
}

/**
 * 推进发票状态流转并返回最新详情。
 *
 * @param id - 需要流转状态的发票 ID
 * @param status - 目标发票状态枚举值
 * @returns 状态更新后的发票详情响应体
 */
export function updateInvoiceStatus(
  id: string,
  status: InvoiceStatus,
): Promise<ApiResponse<InvoiceDetail>> {
  return request<InvoiceDetail>({
    url: `/invoices/${id}/status`,
    method: 'PATCH',
    data: { status },
  })
}

/**
 * 作废指定发票并记录作废原因。
 *
 * @param id - 需要作废的发票 ID
 * @param data - 作废原因与补充备注等字段
 * @returns 作废后的发票详情响应体
 */
export function voidInvoice(
  id: string,
  data: VoidInvoiceParams,
): Promise<ApiResponse<InvoiceDetail>> {
  return request<InvoiceDetail>({
    url: `/invoices/${id}/void`,
    method: 'PATCH',
    data,
    headers: idempotencyHeaders(),
  })
}

/**
 * 查询当前发票允许执行的下一步状态。
 *
 * @param id - 发票 ID
 * @returns 当前状态下可选目标状态的响应体
 */
export function getInvoiceTransitions(
  id: string,
): Promise<ApiResponse<InvoiceStatus[]>> {
  return request<InvoiceStatus[]>({
    url: `/invoices/${id}/transitions`,
    method: 'GET',
  })
}

/**
 * 获取发票模块汇总统计数据。
 *
 * @param customerId - 可选的客户 ID；传入时仅统计该客户
 * @returns 发票汇总卡片数据的响应体
 */
export function getInvoiceSummary(
  customerId?: string,
): Promise<ApiResponse<InvoiceSummaryItem[]>> {
  return request<InvoiceSummaryItem[]>({
    url: '/invoices/summary',
    method: 'GET',
    params: customerId ? { customerId } : {},
  })
}

/**
 * 删除指定的发票记录。
 *
 * @param id - 需要删除的发票 ID
 * @returns 删除请求的响应体，成功时不返回业务数据
 */
export function deleteInvoice(id: string): Promise<ApiResponse<void>> {
  return request<void>({
    url: `/invoices/${id}`,
    method: 'DELETE',
  })
}
