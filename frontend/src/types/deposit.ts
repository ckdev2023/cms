import type { DepositTransactionType, PaymentMethod } from '@/constants/enums'

export interface DepositAccountListItem {
  id: string
  customerId: string
  customerName: string | null
  customerCode: string | null
  balance: number
  transactionCount: number
  createdAt: string
  updatedAt: string
}

export interface DepositAccountDetail {
  id: string
  customerId: string
  balance: number
  createdAt: string
  updatedAt: string
  customer: {
    id: string
    customerName: string
    customerCode: string
  } | null
}

export interface DepositTransactionListItem {
  id: string
  depositAccountId: string
  customerId: string | null
  customerName: string | null
  transactionType: DepositTransactionType
  amount: number
  balanceAfter: number
  relatedInvoiceId: string | null
  relatedInvoiceNo: string | null
  remark: string | null
  createdBy: string | null
  createdAt: string
}

export interface DepositAccountSummary {
  totalAccounts: string
  totalBalance: string
  activeAccounts: string
}

export interface DepositAccountQueryParams {
  page?: number
  pageSize?: number
  keyword?: string
  customerId?: string
  hasBalance?: boolean
  sortBy?: string
  sortOrder?: 'ASC' | 'DESC'
}

export interface DepositTransactionQueryParams {
  page?: number
  pageSize?: number
  keyword?: string
  depositAccountId?: string
  customerId?: string
  transactionType?: DepositTransactionType
  relatedInvoiceId?: string
  createdFrom?: string
  createdTo?: string
  sortBy?: string
  sortOrder?: 'ASC' | 'DESC'
}

export interface CreateDepositRechargeParams {
  customerId: string
  amount: number
  paymentMethod?: PaymentMethod
  remark?: string
}

export interface CreateDepositOffsetParams {
  customerId: string
  invoiceId: string
  amount: number
  remark?: string
}

export interface CreateDepositRefundParams {
  customerId: string
  amount: number
  reason: string
  remark?: string
}

export interface CreateDepositAdjustmentParams {
  customerId: string
  amount: number
  reason: string
  remark?: string
}
