import type {
  TaxContractStatus,
  BillingCycle,
  MonthlyStatus,
  MaterialStatus,
} from '@/constants/enums'

// ── Tax Contract ─────────────────────────────────────────

export interface TaxContractItem {
  id: string
  customerId: string
  customerName: string | null
  contractName: string
  contractStatus: TaxContractStatus
  billingCycle: BillingCycle
  startDate: string
  endDate: string | null
  monthlyFee: number
  ownerUserId: string | null
  ownerName: string | null
  createdBy: string | null
  updatedBy: string | null
  createdAt: string
  updatedAt: string
}

export interface TaxContractDetail extends TaxContractItem {
  customer: {
    id: string
    customerName: string
    customerCode: string
  } | null
  owner: {
    id: string
    displayName: string
  } | null
  periods: TaxPeriodItem[]
}

export interface CreateTaxContractParams {
  customerId: string
  contractName: string
  contractStatus?: TaxContractStatus
  billingCycle?: BillingCycle
  startDate: string
  endDate?: string
  monthlyFee?: number
  ownerUserId?: string
}

export interface UpdateTaxContractParams
  extends Partial<CreateTaxContractParams> {}

export interface TaxContractQueryParams {
  page?: number
  pageSize?: number
  keyword?: string
  contractStatus?: TaxContractStatus
  billingCycle?: BillingCycle
  customerId?: string
  ownerUserId?: string
  startDateFrom?: string
  startDateTo?: string
  sortBy?: string
  sortOrder?: 'ASC' | 'DESC'
}

// ── Tax Period ───────────────────────────────────────────

export interface TaxPeriodItem {
  id: string
  taxContractId: string
  customerId: string
  periodYm: string
  declarationDeadline: string | null
  monthlyStatus: MonthlyStatus
  materialStatus: MaterialStatus
  documentCount: number
  documentReceivedCount: number
  workItemCount: number
  workItemCompletedCount: number
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

export interface TaxPeriodDetail {
  id: string
  taxContractId: string
  customerId: string
  periodYm: string
  declarationDeadline: string | null
  monthlyStatus: MonthlyStatus
  materialStatus: MaterialStatus
  documents: TaxMonthlyDocumentItem[]
  workItems: TaxMonthlyWorkItemItem[]
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateTaxPeriodParams {
  periodYm: string
  declarationDeadline?: string
  monthlyStatus?: MonthlyStatus
  materialStatus?: MaterialStatus
}

export interface UpdateTaxPeriodParams
  extends Partial<CreateTaxPeriodParams> {}

export interface TaxPeriodQueryParams {
  page?: number
  pageSize?: number
  keyword?: string
  monthlyStatus?: MonthlyStatus
  materialStatus?: MaterialStatus
  periodYmFrom?: string
  periodYmTo?: string
  deadlineFrom?: string
  deadlineTo?: string
  sortBy?: string
  sortOrder?: 'ASC' | 'DESC'
}

export interface GeneratePeriodsParams {
  startYm: string
  endYm: string
  deadlineDay?: number
}

// ── Tax Monthly Document ─────────────────────────────────

export interface TaxMonthlyDocumentItem {
  id: string
  documentName: string
  fileId: string | null
  received: boolean
  receivedAt: string | null
  remark: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateTaxDocumentParams {
  documentName: string
  fileId?: string
  received?: boolean
  remark?: string
}

export interface UpdateTaxDocumentParams
  extends Partial<CreateTaxDocumentParams> {}

// ── Tax Monthly Work Item ────────────────────────────────

export interface TaxMonthlyWorkItemItem {
  id: string
  itemName: string
  completed: boolean
  completedAt: string | null
  completedBy: string | null
  completedByName: string | null
  remark: string | null
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface CreateTaxWorkItemParams {
  itemName: string
  completed?: boolean
  remark?: string
  sortOrder?: number
}

export interface UpdateTaxWorkItemParams
  extends Partial<CreateTaxWorkItemParams> {}
