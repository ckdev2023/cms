import { request } from '@/utils/request'
import type { PaginatedResponse } from '@/types'
import type {
  AdminCaseItem,
  AdminCaseDetail,
  CreateAdminCaseParams,
  UpdateAdminCaseParams,
  AdminCaseQueryParams,
  InterviewItem,
  CreateInterviewParams,
  UpdateInterviewParams,
  InterviewQueryParams,
  AdminCaseDocumentItem,
  CreateAdminCaseDocumentParams,
  UpdateAdminCaseDocumentParams,
} from '@/types/admin-case'
import type { AdminCaseStatus } from '@/constants/enums'

// ── Cases ─────────────────────────────────────────────

export function getAdminCases(params: AdminCaseQueryParams) {
  return request<PaginatedResponse<AdminCaseItem>>({
    url: '/admin-cases',
    method: 'GET',
    params,
  })
}

export function getAdminCase(id: string) {
  return request<AdminCaseDetail>({
    url: `/admin-cases/${id}`,
    method: 'GET',
  })
}

export function createAdminCase(data: CreateAdminCaseParams) {
  return request<AdminCaseDetail>({
    url: '/admin-cases',
    method: 'POST',
    data,
  })
}

export function updateAdminCase(id: string, data: UpdateAdminCaseParams) {
  return request<AdminCaseDetail>({
    url: `/admin-cases/${id}`,
    method: 'PUT',
    data,
  })
}

export function updateAdminCaseStatus(id: string, status: AdminCaseStatus) {
  return request<AdminCaseDetail>({
    url: `/admin-cases/${id}/status`,
    method: 'PATCH',
    data: { status },
  })
}

export function deleteAdminCase(id: string) {
  return request<void>({
    url: `/admin-cases/${id}`,
    method: 'DELETE',
  })
}

export function getAdminCaseTransitions(id: string) {
  return request<AdminCaseStatus[]>({
    url: `/admin-cases/${id}/transitions`,
    method: 'GET',
  })
}

// ── Interviews ────────────────────────────────────────

export function getInterviews(caseId: string, params: InterviewQueryParams) {
  return request<PaginatedResponse<InterviewItem>>({
    url: `/admin-cases/${caseId}/interviews`,
    method: 'GET',
    params,
  })
}

export function createInterview(caseId: string, data: CreateInterviewParams) {
  return request<InterviewItem>({
    url: `/admin-cases/${caseId}/interviews`,
    method: 'POST',
    data,
  })
}

export function updateInterview(
  caseId: string,
  interviewId: string,
  data: UpdateInterviewParams,
) {
  return request<InterviewItem>({
    url: `/admin-cases/${caseId}/interviews/${interviewId}`,
    method: 'PUT',
    data,
  })
}

export function deleteInterview(caseId: string, interviewId: string) {
  return request<void>({
    url: `/admin-cases/${caseId}/interviews/${interviewId}`,
    method: 'DELETE',
  })
}

// ── Documents ──────────────────────────────────────────

export function getAdminCaseDocuments(caseId: string) {
  return request<AdminCaseDocumentItem[]>({
    url: `/admin-cases/${caseId}/documents`,
    method: 'GET',
  })
}

export function createAdminCaseDocument(
  caseId: string,
  data: CreateAdminCaseDocumentParams,
) {
  return request<AdminCaseDocumentItem>({
    url: `/admin-cases/${caseId}/documents`,
    method: 'POST',
    data,
  })
}

export function updateAdminCaseDocument(
  caseId: string,
  docId: string,
  data: UpdateAdminCaseDocumentParams,
) {
  return request<AdminCaseDocumentItem>({
    url: `/admin-cases/${caseId}/documents/${docId}`,
    method: 'PUT',
    data,
  })
}

export function deleteAdminCaseDocument(caseId: string, docId: string) {
  return request<void>({
    url: `/admin-cases/${caseId}/documents/${docId}`,
    method: 'DELETE',
  })
}
