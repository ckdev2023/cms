import { request } from '@/utils/request'
import type { PaginatedResponse } from '@/types'
import type {
  DepositAccountListItem,
  DepositAccountDetail,
  DepositAccountSummary,
  DepositAccountQueryParams,
  DepositTransactionListItem,
  DepositTransactionQueryParams,
  CreateDepositRechargeParams,
  CreateDepositOffsetParams,
  CreateDepositRefundParams,
  CreateDepositAdjustmentParams,
} from '@/types/deposit'

function idempotencyHeaders() {
  return { 'x-idempotency-key': crypto.randomUUID() }
}

export function getDepositAccounts(params: DepositAccountQueryParams) {
  return request<PaginatedResponse<DepositAccountListItem>>({
    url: '/deposits',
    method: 'GET',
    params,
  })
}

export function getDepositAccount(id: string) {
  return request<DepositAccountDetail>({
    url: `/deposits/${id}`,
    method: 'GET',
  })
}

export function getDepositAccountByCustomer(customerId: string) {
  return request<DepositAccountDetail | null>({
    url: `/deposits/by-customer/${customerId}`,
    method: 'GET',
  })
}

export function getDepositSummary() {
  return request<DepositAccountSummary>({
    url: '/deposits/summary',
    method: 'GET',
  })
}

export function getDepositTransactions(params: DepositTransactionQueryParams) {
  return request<PaginatedResponse<DepositTransactionListItem>>({
    url: '/deposits/transactions',
    method: 'GET',
    params,
  })
}

export function getAccountTransactions(
  accountId: string,
  params: DepositTransactionQueryParams,
) {
  return request<PaginatedResponse<DepositTransactionListItem>>({
    url: `/deposits/${accountId}/transactions`,
    method: 'GET',
    params,
  })
}

export function depositRecharge(data: CreateDepositRechargeParams) {
  return request<DepositTransactionListItem>({
    url: '/deposits/recharge',
    method: 'POST',
    data,
    headers: idempotencyHeaders(),
  })
}

export function depositOffset(data: CreateDepositOffsetParams) {
  return request<DepositTransactionListItem>({
    url: '/deposits/offset',
    method: 'POST',
    data,
    headers: idempotencyHeaders(),
  })
}

export function depositRefund(data: CreateDepositRefundParams) {
  return request<DepositTransactionListItem>({
    url: '/deposits/refund',
    method: 'POST',
    data,
    headers: idempotencyHeaders(),
  })
}

export function depositAdjustment(data: CreateDepositAdjustmentParams) {
  return request<DepositTransactionListItem>({
    url: '/deposits/adjustment',
    method: 'POST',
    data,
    headers: idempotencyHeaders(),
  })
}
