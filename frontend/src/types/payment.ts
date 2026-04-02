/**
 * 定义收款、分配与冲销流程使用的声明类型。
 */
import type { PaymentMethod, PaymentStatus } from '@/constants/enums'

export interface PaymentAllocationItem {
  id: string
  paymentId: string
  invoiceId: string
  allocatedAmount: number
  createdAt: string
  createdBy: string | null
  invoice?: {
    id: string
    invoiceNo: string
    totalAmount: number
    status: string
    customerId: string
  } | null
}

export interface PaymentListItem {
  id: string
  customerId: string
  customerName: string | null
  paymentNo: string
  paymentDate: string
  paymentAmount: number
  paymentMethod: PaymentMethod
  status: PaymentStatus
  remark: string | null
  allocationCount: number
  createdBy: string | null
  reversedAt: string | null
  reversalReason: string | null
  createdAt: string
  updatedAt: string
}

export interface PaymentDetail extends PaymentListItem {
  customer: {
    id: string
    customerName: string
    customerCode: string
  } | null
  allocations: PaymentAllocationItem[]
}

export interface CreatePaymentAllocationParams {
  invoiceId: string
  allocatedAmount: number
}

export interface CreatePaymentParams {
  customerId: string
  paymentDate: string
  paymentAmount: number
  paymentMethod: PaymentMethod
  remark?: string
  allocations: CreatePaymentAllocationParams[]
}

export interface PaymentQueryParams {
  page?: number
  pageSize?: number
  keyword?: string
  status?: PaymentStatus
  paymentMethod?: PaymentMethod
  customerId?: string
  invoiceId?: string
  paymentDateFrom?: string
  paymentDateTo?: string
  createdFrom?: string
  createdTo?: string
  sortBy?: string
  sortOrder?: 'ASC' | 'DESC'
}

export interface ReversePaymentParams {
  reversalReason: string
}

export interface InvoicePaymentItem {
  id: string
  paymentId: string
  paymentNo: string | null
  paymentDate: string | null
  paymentMethod: PaymentMethod | null
  paymentStatus: PaymentStatus | null
  allocatedAmount: number
  createdAt: string
}

export interface PaymentSummaryItem {
  status: PaymentStatus
  count: string
  totalAmount: string
}
