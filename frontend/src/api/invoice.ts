import { request } from '@/utils/request'
import type { PaginatedResponse } from '@/types'
import type {
  InvoiceListItem,
  InvoiceDetail,
  CreateInvoiceParams,
  UpdateInvoiceParams,
  InvoiceQueryParams,
  VoidInvoiceParams,
  InvoiceSummaryItem,
} from '@/types/invoice'
import type { InvoiceStatus } from '@/constants/enums'

function idempotencyHeaders() {
  return { 'x-idempotency-key': crypto.randomUUID() }
}

export function getInvoices(params: InvoiceQueryParams) {
  return request<PaginatedResponse<InvoiceListItem>>({
    url: '/invoices',
    method: 'GET',
    params,
  })
}

export function getInvoice(id: string) {
  return request<InvoiceDetail>({
    url: `/invoices/${id}`,
    method: 'GET',
  })
}

export function createInvoice(data: CreateInvoiceParams) {
  return request<InvoiceDetail>({
    url: '/invoices',
    method: 'POST',
    data,
    headers: idempotencyHeaders(),
  })
}

export function updateInvoice(id: string, data: UpdateInvoiceParams) {
  return request<InvoiceDetail>({
    url: `/invoices/${id}`,
    method: 'PUT',
    data,
    headers: idempotencyHeaders(),
  })
}

export function updateInvoiceStatus(id: string, status: InvoiceStatus) {
  return request<InvoiceDetail>({
    url: `/invoices/${id}/status`,
    method: 'PATCH',
    data: { status },
  })
}

export function voidInvoice(id: string, data: VoidInvoiceParams) {
  return request<InvoiceDetail>({
    url: `/invoices/${id}/void`,
    method: 'PATCH',
    data,
    headers: idempotencyHeaders(),
  })
}

export function getInvoiceTransitions(id: string) {
  return request<InvoiceStatus[]>({
    url: `/invoices/${id}/transitions`,
    method: 'GET',
  })
}

export function getInvoiceSummary(customerId?: string) {
  return request<InvoiceSummaryItem[]>({
    url: '/invoices/summary',
    method: 'GET',
    params: customerId ? { customerId } : {},
  })
}

export function deleteInvoice(id: string) {
  return request<void>({
    url: `/invoices/${id}`,
    method: 'DELETE',
  })
}
