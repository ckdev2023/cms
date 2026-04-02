import type { AdminCaseStatus } from '@/constants/enums'
import type { ApiResponse, PaginatedResponse } from '@/types'
import type {
  AdminCaseDetail,
  AdminCaseDocumentItem,
  AdminCaseItem,
  AdminCaseQueryParams,
  CreateAdminCaseDocumentParams,
  CreateAdminCaseParams,
  CreateInterviewParams,
  InterviewItem,
  InterviewQueryParams,
  UpdateAdminCaseDocumentParams,
  UpdateAdminCaseParams,
  UpdateInterviewParams,
} from '@/types/admin-case'
import { request } from '@/utils/request'

// ── Cases ─────────────────────────────────────────────

/**
 * 按筛选条件分页获取行政案件列表。
 *
 * @param params - 列表查询参数，包含分页、状态和关键字等筛选条件
 * @returns 包含案件列表与总数的分页响应
 */
export function getAdminCases(
  params: AdminCaseQueryParams,
): Promise<ApiResponse<PaginatedResponse<AdminCaseItem>>> {
  return request<PaginatedResponse<AdminCaseItem>>({
    url: '/admin-cases',
    method: 'GET',
    params,
  })
}

/**
 * 获取单个行政案件的完整详情。
 *
 * @param id - 行政案件 ID
 * @returns 包含客户关联信息和面谈记录的案件详情
 */
export function getAdminCase(id: string): Promise<ApiResponse<AdminCaseDetail>> {
  return request<AdminCaseDetail>({
    url: `/admin-cases/${id}`,
    method: 'GET',
  })
}

/**
 * 提交新建行政案件表单并返回已创建的案件详情。
 *
 * @param data - 新建案件所需的客户、案件名称和补充字段
 * @returns 新建成功后的案件详情
 */
export function createAdminCase(
  data: CreateAdminCaseParams,
): Promise<ApiResponse<AdminCaseDetail>> {
  return request<AdminCaseDetail>({
    url: '/admin-cases',
    method: 'POST',
    data,
  })
}

/**
 * 更新指定行政案件的基础资料。
 *
 * @param id - 需要更新的行政案件 ID
 * @param data - 本次允许修改的案件字段集合
 * @returns 更新后的案件详情
 */
export function updateAdminCase(
  id: string,
  data: UpdateAdminCaseParams,
): Promise<ApiResponse<AdminCaseDetail>> {
  return request<AdminCaseDetail>({
    url: `/admin-cases/${id}`,
    method: 'PUT',
    data,
  })
}

/**
 * 推进行政案件状态流转并返回最新详情。
 *
 * @param id - 需要流转状态的行政案件 ID
 * @param status - 目标案件状态枚举值
 * @returns 状态更新后的案件详情
 */
export function updateAdminCaseStatus(
  id: string,
  status: AdminCaseStatus,
): Promise<ApiResponse<AdminCaseDetail>> {
  return request<AdminCaseDetail>({
    url: `/admin-cases/${id}/status`,
    method: 'PATCH',
    data: { status },
  })
}

/**
 * 删除指定的行政案件记录。
 *
 * @param id - 需要删除的行政案件 ID
 * @returns 删除请求的异步结果，成功时不返回业务数据
 */
export function deleteAdminCase(id: string): Promise<ApiResponse<void>> {
  return request<void>({
    url: `/admin-cases/${id}`,
    method: 'DELETE',
  })
}

/**
 * 查询当前行政案件允许执行的下一步状态。
 *
 * @param id - 行政案件 ID
 * @returns 当前状态下可选的目标状态列表
 */
export function getAdminCaseTransitions(
  id: string,
): Promise<ApiResponse<AdminCaseStatus[]>> {
  return request<AdminCaseStatus[]>({
    url: `/admin-cases/${id}/transitions`,
    method: 'GET',
  })
}

// ── Interviews ────────────────────────────────────────

/**
 * 分页获取行政案件的面谈记录。
 *
 * @param caseId - 所属行政案件 ID
 * @param params - 面谈分页与排序参数
 * @returns 包含面谈记录列表与总数的分页响应
 */
export function getInterviews(
  caseId: string,
  params: InterviewQueryParams,
): Promise<ApiResponse<PaginatedResponse<InterviewItem>>> {
  return request<PaginatedResponse<InterviewItem>>({
    url: `/admin-cases/${caseId}/interviews`,
    method: 'GET',
    params,
  })
}

/**
 * 为指定行政案件新增一条面谈记录。
 *
 * @param caseId - 所属行政案件 ID
 * @param data - 面谈日期、地点和内容等表单字段
 * @returns 新建成功后的面谈记录
 */
export function createInterview(
  caseId: string,
  data: CreateInterviewParams,
): Promise<ApiResponse<InterviewItem>> {
  return request<InterviewItem>({
    url: `/admin-cases/${caseId}/interviews`,
    method: 'POST',
    data,
  })
}

/**
 * 更新行政案件中的指定面谈记录。
 *
 * @param caseId - 所属行政案件 ID
 * @param interviewId - 需要更新的面谈记录 ID
 * @param data - 本次允许修改的面谈字段
 * @returns 更新后的面谈记录
 */
export function updateInterview(
  caseId: string,
  interviewId: string,
  data: UpdateInterviewParams,
): Promise<ApiResponse<InterviewItem>> {
  return request<InterviewItem>({
    url: `/admin-cases/${caseId}/interviews/${interviewId}`,
    method: 'PUT',
    data,
  })
}

/**
 * 删除行政案件中的指定面谈记录。
 *
 * @param caseId - 所属行政案件 ID
 * @param interviewId - 需要删除的面谈记录 ID
 * @returns 删除请求的异步结果，成功时不返回业务数据
 */
export function deleteInterview(
  caseId: string,
  interviewId: string,
): Promise<ApiResponse<void>> {
  return request<void>({
    url: `/admin-cases/${caseId}/interviews/${interviewId}`,
    method: 'DELETE',
  })
}

// ── Documents ──────────────────────────────────────────

/**
 * 获取行政案件下登记的全部关联文件。
 *
 * @param caseId - 所属行政案件 ID
 * @returns 该案件已绑定的文件记录列表
 */
export function getAdminCaseDocuments(
  caseId: string,
): Promise<ApiResponse<AdminCaseDocumentItem[]>> {
  return request<AdminCaseDocumentItem[]>({
    url: `/admin-cases/${caseId}/documents`,
    method: 'GET',
  })
}

/**
 * 在行政案件下登记一条新的文件关联记录。
 *
 * @param caseId - 所属行政案件 ID
 * @param data - 文件 ID 与可选的文件类型、备注信息
 * @returns 新建成功后的案件文件记录
 */
export function createAdminCaseDocument(
  caseId: string,
  data: CreateAdminCaseDocumentParams,
): Promise<ApiResponse<AdminCaseDocumentItem>> {
  return request<AdminCaseDocumentItem>({
    url: `/admin-cases/${caseId}/documents`,
    method: 'POST',
    data,
  })
}

/**
 * 更新行政案件文件的分类或备注信息。
 *
 * @param caseId - 所属行政案件 ID
 * @param docId - 需要更新的案件文件记录 ID
 * @param data - 文件类型与备注等可编辑字段
 * @returns 更新后的案件文件记录
 */
export function updateAdminCaseDocument(
  caseId: string,
  docId: string,
  data: UpdateAdminCaseDocumentParams,
): Promise<ApiResponse<AdminCaseDocumentItem>> {
  return request<AdminCaseDocumentItem>({
    url: `/admin-cases/${caseId}/documents/${docId}`,
    method: 'PUT',
    data,
  })
}

/**
 * 删除行政案件下的文件关联记录。
 *
 * @param caseId - 所属行政案件 ID
 * @param docId - 需要删除的案件文件记录 ID
 * @returns 删除请求的异步结果，成功时不返回业务数据
 */
export function deleteAdminCaseDocument(
  caseId: string,
  docId: string,
): Promise<ApiResponse<void>> {
  return request<void>({
    url: `/admin-cases/${caseId}/documents/${docId}`,
    method: 'DELETE',
  })
}
