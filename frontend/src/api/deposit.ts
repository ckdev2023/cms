import type { ApiResponse, PaginatedResponse } from '@/types'
import type {
  CreateDepositAdjustmentParams,
  CreateDepositOffsetParams,
  CreateDepositRechargeParams,
  CreateDepositRefundParams,
  DepositAccountDetail,
  DepositAccountListItem,
  DepositAccountQueryParams,
  DepositAccountSummary,
  DepositTransactionListItem,
  DepositTransactionQueryParams,
} from '@/types/deposit'
import { request } from '@/utils/request'

/**
 * 为需防重的保证金写操作生成幂等请求头。
 *
 * @returns 包含随机幂等键的请求头对象
 */
function idempotencyHeaders(): Record<string, string> {
  return { 'x-idempotency-key': crypto.randomUUID() }
}

/**
 * 按筛选条件分页获取保证金账户列表。
 *
 * @param params - 账户分页、客户与状态等查询条件
 * @returns 包含账户列表与总数的分页响应体
 */
export function getDepositAccounts(
  params: DepositAccountQueryParams,
): Promise<ApiResponse<PaginatedResponse<DepositAccountListItem>>> {
  return request<PaginatedResponse<DepositAccountListItem>>({
    url: '/deposits',
    method: 'GET',
    params,
  })
}

/**
 * 获取单个保证金账户的完整详情。
 *
 * @param id - 目标保证金账户 ID
 * @returns 指定账户的详情响应体
 */
export function getDepositAccount(id: string): Promise<ApiResponse<DepositAccountDetail>> {
  return request<DepositAccountDetail>({
    url: `/deposits/${id}`,
    method: 'GET',
  })
}

/**
 * 通过客户 ID 查询对应的保证金账户。
 *
 * @param customerId - 客户 ID
 * @returns 匹配账户的详情响应体；未开户时 data 为 null
 */
export function getDepositAccountByCustomer(
  customerId: string,
): Promise<ApiResponse<DepositAccountDetail | null>> {
  return request<DepositAccountDetail | null>({
    url: `/deposits/by-customer/${customerId}`,
    method: 'GET',
  })
}

/**
 * 获取保证金模块首页使用的汇总指标。
 *
 * @returns 账户余额与收支概览的汇总响应体
 */
export function getDepositSummary(): Promise<ApiResponse<DepositAccountSummary>> {
  return request<DepositAccountSummary>({
    url: '/deposits/summary',
    method: 'GET',
  })
}

/**
 * 分页获取全局保证金流水列表。
 *
 * @param params - 流水分页、交易类型与时间范围等查询条件
 * @returns 包含流水列表与总数的分页响应体
 */
export function getDepositTransactions(
  params: DepositTransactionQueryParams,
): Promise<ApiResponse<PaginatedResponse<DepositTransactionListItem>>> {
  return request<PaginatedResponse<DepositTransactionListItem>>({
    url: '/deposits/transactions',
    method: 'GET',
    params,
  })
}

/**
 * 获取指定保证金账户下的流水记录。
 *
 * @param accountId - 目标保证金账户 ID
 * @param params - 流水分页、交易类型与时间范围等查询条件
 * @returns 指定账户的流水分页响应体
 */
export function getAccountTransactions(
  accountId: string,
  params: DepositTransactionQueryParams,
): Promise<ApiResponse<PaginatedResponse<DepositTransactionListItem>>> {
  return request<PaginatedResponse<DepositTransactionListItem>>({
    url: `/deposits/${accountId}/transactions`,
    method: 'GET',
    params,
  })
}

/**
 * 提交保证金充值登记并返回最新流水。
 *
 * @param data - 充值金额、到账方式与归属账户等字段
 * @returns 新建成功后的保证金流水响应体
 */
export function depositRecharge(
  data: CreateDepositRechargeParams,
): Promise<ApiResponse<DepositTransactionListItem>> {
  return request<DepositTransactionListItem>({
    url: '/deposits/recharge',
    method: 'POST',
    data,
    headers: idempotencyHeaders(),
  })
}

/**
 * 提交保证金冲抵登记并返回最新流水。
 *
 * @param data - 冲抵目标账单、金额与账户信息
 * @returns 新建成功后的保证金流水响应体
 */
export function depositOffset(
  data: CreateDepositOffsetParams,
): Promise<ApiResponse<DepositTransactionListItem>> {
  return request<DepositTransactionListItem>({
    url: '/deposits/offset',
    method: 'POST',
    data,
    headers: idempotencyHeaders(),
  })
}

/**
 * 提交保证金退款登记并返回最新流水。
 *
 * @param data - 退款金额、退款方式与账户信息
 * @returns 新建成功后的保证金流水响应体
 */
export function depositRefund(
  data: CreateDepositRefundParams,
): Promise<ApiResponse<DepositTransactionListItem>> {
  return request<DepositTransactionListItem>({
    url: '/deposits/refund',
    method: 'POST',
    data,
    headers: idempotencyHeaders(),
  })
}

/**
 * 提交保证金调账登记并返回最新流水。
 *
 * @param data - 调账金额、原因与目标账户等字段
 * @returns 新建成功后的保证金流水响应体
 */
export function depositAdjustment(
  data: CreateDepositAdjustmentParams,
): Promise<ApiResponse<DepositTransactionListItem>> {
  return request<DepositTransactionListItem>({
    url: '/deposits/adjustment',
    method: 'POST',
    data,
    headers: idempotencyHeaders(),
  })
}
