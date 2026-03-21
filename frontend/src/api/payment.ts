import { request } from '@/utils/request'
import type { PaginatedResponse } from '@/types'
import type {
  PaymentListItem,
  PaymentDetail,
  CreatePaymentParams,
  PaymentQueryParams,
  ReversePaymentParams,
  InvoicePaymentItem,
  PaymentSummaryItem,
} from '@/types/payment'

function idempotencyHeaders() {
  return { 'x-idempotency-key': crypto.randomUUID() }
}

export function getPayments(params: PaymentQueryParams) {
  return request<PaginatedResponse<PaymentListItem>>({
    url: '/payments',
    method: 'GET',
    params,
  })
}

export function getPayment(id: string) {
  return request<PaymentDetail>({
    url: `/payments/${id}`,
    method: 'GET',
  })
}

export function createPayment(data: CreatePaymentParams) {
  return request<PaymentDetail>({
    url: '/payments',
    method: 'POST',
    data,
    headers: idempotencyHeaders(),
  })
}

export function reversePayment(id: string, data: ReversePaymentParams) {
  return request<PaymentDetail>({
    url: `/payments/${id}/reverse`,
    method: 'PATCH',
    data,
    headers: idempotencyHeaders(),
  })
}

export function getPaymentsByInvoice(invoiceId: string) {
  return request<InvoicePaymentItem[]>({
    url: `/payments/by-invoice/${invoiceId}`,
    method: 'GET',
  })
}

export function getPaymentSummary(customerId?: string) {
  return request<PaymentSummaryItem[]>({
    url: '/payments/summary',
    method: 'GET',
    params: customerId ? { customerId } : {},
  })
}
