import type { InvoiceStatus, InvoiceType, BusinessType } from '@/constants/enums'

export interface InvoiceItemData {
  id: string
  invoiceId: string
  description: string
  quantity: number
  unitPrice: number
  amount: number
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface InvoiceListItem {
  id: string
  customerId: string
  customerName: string | null
  invoiceNo: string
  invoiceType: InvoiceType
  totalAmount: number
  currency: string
  status: InvoiceStatus
  dueDate: string | null
  issuedAt: string | null
  itemCount: number
  createdBy: string | null
  updatedBy: string | null
  createdAt: string
  updatedAt: string
}

export interface InvoiceDetail extends InvoiceListItem {
  relatedId: string | null
  relatedType: BusinessType | null
  remark: string | null
  voidReason: string | null
  voidedAt: string | null
  voidedBy: string | null
  version: number
  customer: {
    id: string
    customerName: string
    customerCode: string
  } | null
  items: InvoiceItemData[]
}

export interface CreateInvoiceItemParams {
  description: string
  quantity?: number
  unitPrice: number
  sortOrder?: number
}

export interface CreateInvoiceParams {
  customerId: string
  invoiceType: InvoiceType
  dueDate?: string
  relatedId?: string
  relatedType?: BusinessType
  remark?: string
  items: CreateInvoiceItemParams[]
}

export interface UpdateInvoiceParams {
  invoiceType?: InvoiceType
  dueDate?: string
  relatedId?: string
  relatedType?: BusinessType
  remark?: string
  items?: CreateInvoiceItemParams[]
}

export interface InvoiceQueryParams {
  page?: number
  pageSize?: number
  keyword?: string
  status?: InvoiceStatus
  invoiceType?: InvoiceType
  customerId?: string
  dueDateFrom?: string
  dueDateTo?: string
  createdFrom?: string
  createdTo?: string
  sortBy?: string
  sortOrder?: 'ASC' | 'DESC'
}

export interface VoidInvoiceParams {
  voidReason: string
}

export interface InvoiceSummaryItem {
  status: InvoiceStatus
  count: string
  totalAmount: string
}
