import type { ApiResponse, PaginatedResponse } from '@/types'
import type {
  CreatePaymentParams,
  InvoicePaymentItem,
  PaymentDetail,
  PaymentListItem,
  PaymentQueryParams,
  PaymentSummaryItem,
  ReversePaymentParams,
} from '@/types/payment'
import { request } from '@/utils/request'

/**
 * 为支付写操作生成幂等请求头。
 *
 * @returns 包含随机幂等键的请求头对象
 */
function idempotencyHeaders(): Record<string, string> {
  return { 'x-idempotency-key': crypto.randomUUID() }
}

/**
 * 按筛选条件分页获取收款记录列表。
 *
 * @param params - 收款分页、客户和状态等查询条件
 * @returns 包含收款记录列表与总数的分页响应体
 */
export function getPayments(
  params: PaymentQueryParams,
): Promise<ApiResponse<PaginatedResponse<PaymentListItem>>> {
  return request<PaginatedResponse<PaymentListItem>>({
    url: '/payments',
    method: 'GET',
    params,
  })
}

/**
 * 获取单笔收款记录的完整详情。
 *
 * @param id - 目标收款记录 ID
 * @returns 指定收款记录的详情响应体
 */
export function getPayment(id: string): Promise<ApiResponse<PaymentDetail>> {
  return request<PaymentDetail>({
    url: `/payments/${id}`,
    method: 'GET',
  })
}

/**
 * 提交新建收款登记并返回创建结果。
 *
 * @param data - 收款金额、票据关联与到账信息等字段
 * @returns 新建成功后的收款详情响应体
 */
export function createPayment(
  data: CreatePaymentParams,
): Promise<ApiResponse<PaymentDetail>> {
  return request<PaymentDetail>({
    url: '/payments',
    method: 'POST',
    data,
    headers: idempotencyHeaders(),
  })
}

/**
 * 提交收款冲正操作并返回最新详情。
 *
 * @param id - 需要冲正的收款记录 ID
 * @param data - 冲正原因与备注等字段
 * @returns 冲正后的收款详情响应体
 */
export function reversePayment(
  id: string,
  data: ReversePaymentParams,
): Promise<ApiResponse<PaymentDetail>> {
  return request<PaymentDetail>({
    url: `/payments/${id}/reverse`,
    method: 'PATCH',
    data,
    headers: idempotencyHeaders(),
  })
}

/**
 * 获取指定发票已关联的全部收款记录。
 *
 * @param invoiceId - 发票 ID
 * @returns 该发票关联收款列表的响应体
 */
export function getPaymentsByInvoice(
  invoiceId: string,
): Promise<ApiResponse<InvoicePaymentItem[]>> {
  return request<InvoicePaymentItem[]>({
    url: `/payments/by-invoice/${invoiceId}`,
    method: 'GET',
  })
}

/**
 * 获取收款模块汇总统计数据。
 *
 * @param customerId - 可选的客户 ID；传入时仅统计该客户
 * @returns 收款汇总卡片数据的响应体
 */
export function getPaymentSummary(
  customerId?: string,
): Promise<ApiResponse<PaymentSummaryItem[]>> {
  return request<PaymentSummaryItem[]>({
    url: '/payments/summary',
    method: 'GET',
    params: customerId ? { customerId } : {},
  })
}
