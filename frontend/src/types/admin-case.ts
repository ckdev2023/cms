/**
 * 定义行政书士案件模块使用的案件、访谈与资料类型。
 */
import type { AdminCaseStatus } from '@/constants/enums'

export interface AdminCaseItem {
  id: string
  customerId: string
  customerName: string | null
  caseName: string
  applicantName: string | null
  residenceStatus: string | null
  status: AdminCaseStatus
  expireDate: string | null
  ownerUserId: string | null
  ownerName: string | null
  createdBy: string | null
  updatedBy: string | null
  createdAt: string
  updatedAt: string
}

export interface AdminCaseDetail extends AdminCaseItem {
  customer: {
    id: string
    customerName: string
    customerCode: string
  } | null
  owner: {
    id: string
    displayName: string
  } | null
  interviews: InterviewItem[]
}

export interface CreateAdminCaseParams {
  customerId: string
  caseName: string
  applicantName?: string
  residenceStatus?: string
  status?: AdminCaseStatus
  expireDate?: string
  ownerUserId?: string
}

export type UpdateAdminCaseParams = Partial<CreateAdminCaseParams>

export interface AdminCaseQueryParams {
  page?: number
  pageSize?: number
  keyword?: string
  status?: AdminCaseStatus
  customerId?: string
  ownerUserId?: string
  expireDateFrom?: string
  expireDateTo?: string
  sortBy?: string
  sortOrder?: 'ASC' | 'DESC'
}

export interface InterviewItem {
  id: string
  adminCaseId: string
  customerId: string
  interviewDate: string
  interviewLocation: string | null
  content: string
  createdBy: string | null
  creatorName: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateInterviewParams {
  interviewDate: string
  interviewLocation?: string
  content: string
  customerId?: string
}

export type UpdateInterviewParams = Partial<CreateInterviewParams>

export interface InterviewQueryParams {
  page?: number
  pageSize?: number
  dateFrom?: string
  dateTo?: string
  sortOrder?: 'ASC' | 'DESC'
}

// ── Documents ─────────────────────────────────────────

export interface AdminCaseDocumentItem {
  id: string
  adminCaseId: string
  fileId: string
  documentType: string | null
  remark: string | null
  createdAt: string
  file: {
    id: string
    fileName: string
    fileExt: string | null
    fileSize: number | null
    mimeType: string | null
    description: string | null
    uploaderName: string | null
    createdAt: string
  } | null
}

export interface CreateAdminCaseDocumentParams {
  fileId: string
  documentType?: string
  remark?: string
}

export interface UpdateAdminCaseDocumentParams {
  documentType?: string
  remark?: string
}
