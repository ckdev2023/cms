import type { ApiResponse, PaginatedResponse } from '@/types'
import type {
  AdminCaseVisaSupplementCommitResult,
  AdminCaseVisaSupplementPreviewResult,
  CreateCustomerFilePathParams,
  CreateFamilyMemberParams,
  CreateVisaCaseLogParams,
  CreateVisaCaseMaterialItemParams,
  CreateVisaCaseParams,
  CustomerFilePathItem,
  CustomerFilePathQueryParams,
  GlobalVisaCaseQueryParams,
  MaterialSummary,
  UpdateCustomerFilePathParams,
  UpdateFamilyMemberParams,
  UpdateVisaCaseLogParams,
  UpdateVisaCaseMaterialItemParams,
  UpdateVisaCaseParams,
  VisaCaseFamilyMemberItem,
  VisaCaseImportBatchAuditItem,
  VisaCaseImportCommitResult,
  VisaCaseImportPreviewResult,
  VisaCaseItem,
  VisaCaseLogItem,
  VisaCaseLogQueryParams,
  VisaCaseMaterialItemDetail,
  VisaCaseQueryParams,
  VisaDomainStats,
  VisaDomainStatsQueryParams,
  VisaReminderItem,
  VisaReminderQueryParams,
  VisaWorkbenchAggregate,
  VisaWorkbenchQueryParams,
} from '@/types/visa-case'
import { request } from '@/utils/request'

/**
 * 将全局案件列表查询对象序列化为后端可解析的扁平 query 参数（数组以逗号拼接）。
 *
 * @param params - 前端组装的筛选与分页条件
 * @returns 供 GET `/visa-cases` 使用的 query 字典
 */
// eslint-disable-next-line complexity -- 各可选筛选键独立映射，拆分会降低可读性
export function serializeGlobalVisaCaseQuery(
  params: GlobalVisaCaseQueryParams,
): Record<string, string | number | boolean> {
  const q: Record<string, string | number | boolean> = {}
  if (params.page !== undefined) {q.page = params.page}
  if (params.pageSize !== undefined) {q.pageSize = params.pageSize}
  if (params.customerId) {q.customerId = params.customerId}
  const kw = params.customerKeyword?.trim()
  if (kw) {q.customerKeyword = kw}
  if (params.caseStatuses?.length) {
    q.caseStatuses = params.caseStatuses.join(',')
  }
  if (params.assignedToIds?.length) {
    q.assignedToIds = params.assignedToIds.join(',')
  }
  if (params.unassignedOnly === true) {q.unassignedOnly = true}
  if (params.materialStatuses?.length) {
    q.materialStatuses = params.materialStatuses.join(',')
  }
  if (params.feeStatuses?.length) {
    q.feeStatuses = params.feeStatuses.join(',')
  }
  if (params.expireDateFrom) {q.expireDateFrom = params.expireDateFrom}
  if (params.expireDateTo) {q.expireDateTo = params.expireDateTo}
  if (params.nextFollowUpAtFrom) {q.nextFollowUpAtFrom = params.nextFollowUpAtFrom}
  if (params.nextFollowUpAtTo) {q.nextFollowUpAtTo = params.nextFollowUpAtTo}
  if (params.isFamilyCase === true || params.isFamilyCase === false) {
    q.isFamilyCase = params.isFamilyCase
  }
  if (params.familyLinkMode) {q.familyLinkMode = params.familyLinkMode}
  if (params.supplementRelated === true || params.supplementRelated === false) {
    q.supplementRelated = params.supplementRelated
  }
  if (params.reminderBucket) {q.reminderBucket = params.reminderBucket}
  if (params.dataScope) {q.dataScope = params.dataScope}
  return q
}

/**
 * 在指定客户上下文中创建最小签证案件。
 *
 * @param customerId - 案件归属的客户 ID
 * @param data - 案件创建参数
 * @returns 新建成功后的案件详情响应体
 */
export function createVisaCase(
  customerId: string,
  data: CreateVisaCaseParams,
): Promise<ApiResponse<VisaCaseItem>> {
  return request<VisaCaseItem>({
    url: `/customers/${customerId}/visa-cases`,
    method: 'POST',
    data,
  })
}

/**
 * 分页获取指定客户名下的签证案件列表。
 *
 * @param customerId - 案件归属的客户 ID
 * @param params - 分页与筛选参数
 * @returns 包含案件列表与总数的分页响应体
 */
export function getVisaCases(
  customerId: string,
  params: VisaCaseQueryParams,
): Promise<ApiResponse<PaginatedResponse<VisaCaseItem>>> {
  return request<PaginatedResponse<VisaCaseItem>>({
    url: `/customers/${customerId}/visa-cases`,
    method: 'GET',
    params,
  })
}

/**
 * 跨客户分页获取签证案件登记册列表，支持全局筛选维度。
 *
 * @param params - 分页与跨客户筛选条件
 * @returns 含客户名称编码等展示字段的分页案件列表响应体
 */
export function getGlobalVisaCases(
  params: GlobalVisaCaseQueryParams,
): Promise<ApiResponse<PaginatedResponse<VisaCaseItem>>> {
  return request<PaginatedResponse<VisaCaseItem>>({
    url: '/visa-cases',
    method: 'GET',
    params: serializeGlobalVisaCaseQuery(params),
  })
}

/**
 * 拉取签证域只读 KPI 聚合，与 `GET /visa-cases` 共用 `serializeGlobalVisaCaseQuery` 筛选键（无分页），
 * 并保留可选 `assignedTo` 以兼容工作台等单一负责人收窄路径。
 *
 * @param params - 与登记册列表同构的筛选及 `dataScope`；可选 `assignedTo` 叠加旧版收窄
 * @returns 含状态分布、提醒桶与窗口内 KPI 的统计响应体
 */
export function getVisaDomainStats(
  params: VisaDomainStatsQueryParams = {},
): Promise<ApiResponse<VisaDomainStats>> {
  const { assignedTo, ...listLike } = params
  const q = serializeGlobalVisaCaseQuery(listLike as GlobalVisaCaseQueryParams)
  if (assignedTo) {q.assignedTo = assignedTo}
  return request<VisaDomainStats>({
    url: '/visa-cases/stats',
    method: 'GET',
    params: q,
  })
}

/**
 * 拉取签证工作台只读聚合（域 KPI + 四分桶各 Top N 预览），对齐后端 `GET /workbench/visa`。
 *
 * 鉴权为 `visaReminder:list` 与 `visaCase:list` 二选一即可，与侧栏入口一致。
 *
 * @param params - 可选负责人收窄与 `previewLimit`（每桶 0–20，缺省 5）
 * @returns 聚合载荷响应体
 */
export function getVisaWorkbenchAggregate(
  params: VisaWorkbenchQueryParams = {},
): Promise<ApiResponse<VisaWorkbenchAggregate>> {
  const q: Record<string, string | number> = {}
  if (params.assignedTo) {q.assignedTo = params.assignedTo}
  if (params.dataScope) {q.dataScope = params.dataScope}
  if (params.previewLimit !== undefined) {
    q.previewLimit = params.previewLimit
  }
  return request<VisaWorkbenchAggregate>({
    url: '/workbench/visa',
    method: 'GET',
    params: q,
  })
}

/**
 * 获取单个签证案件详情。
 *
 * @param id - 签证案件 ID
 * @returns 指定案件的详情响应体
 */
export function getVisaCase(id: string): Promise<ApiResponse<VisaCaseItem>> {
  return request<VisaCaseItem>({
    url: `/visa-cases/${id}`,
    method: 'GET',
  })
}

/**
 * 更新签证案件的可编辑字段。
 *
 * @param id - 签证案件 ID
 * @param data - 本次允许修改的案件字段
 * @returns 更新后的案件详情响应体
 */
export function updateVisaCase(
  id: string,
  data: UpdateVisaCaseParams,
): Promise<ApiResponse<VisaCaseItem>> {
  return request<VisaCaseItem>({
    url: `/visa-cases/${id}`,
    method: 'PUT',
    data,
  })
}

/**
 * 获取指定签证案件的家属成员列表。
 *
 * @param visaCaseId - 签证案件 ID
 * @returns 家属成员列表响应体
 */
export function getFamilyMembers(
  visaCaseId: string,
): Promise<ApiResponse<VisaCaseFamilyMemberItem[]>> {
  return request<VisaCaseFamilyMemberItem[]>({
    url: `/visa-cases/${visaCaseId}/family-members`,
    method: 'GET',
  })
}

/**
 * 向指定签证案件添加家属成员。
 *
 * @param visaCaseId - 签证案件 ID
 * @param data - 家属成员创建参数
 * @returns 新添加的家属成员响应体
 */
export function addFamilyMember(
  visaCaseId: string,
  data: CreateFamilyMemberParams,
): Promise<ApiResponse<VisaCaseFamilyMemberItem>> {
  return request<VisaCaseFamilyMemberItem>({
    url: `/visa-cases/${visaCaseId}/family-members`,
    method: 'POST',
    data,
  })
}

/**
 * 更新指定家属成员的角色或主申请人标记。
 *
 * @param visaCaseId - 签证案件 ID
 * @param memberId - 家属成员记录 ID
 * @param data - 允许修改的字段集
 * @returns 更新后的家属成员响应体
 */
export function updateFamilyMember(
  visaCaseId: string,
  memberId: string,
  data: UpdateFamilyMemberParams,
): Promise<ApiResponse<VisaCaseFamilyMemberItem>> {
  return request<VisaCaseFamilyMemberItem>({
    url: `/visa-cases/${visaCaseId}/family-members/${memberId}`,
    method: 'PUT',
    data,
  })
}

/**
 * 从签证案件中移除指定家属成员。
 *
 * @param visaCaseId - 签证案件 ID
 * @param memberId - 家属成员记录 ID
 * @returns 空响应体
 */
export function removeFamilyMember(
  visaCaseId: string,
  memberId: string,
): Promise<ApiResponse<void>> {
  return request<void>({
    url: `/visa-cases/${visaCaseId}/family-members/${memberId}`,
    method: 'DELETE',
  })
}

/**
 * 为指定签证案件创建一条日志记录。
 *
 * @param visaCaseId - 签证案件 ID
 * @param data - 日志创建参数（含日志类型、内容与结构化跟进字段）
 * @returns 新创建的日志响应体
 */
export function createVisaCaseLog(
  visaCaseId: string,
  data: CreateVisaCaseLogParams,
): Promise<ApiResponse<VisaCaseLogItem>> {
  return request<VisaCaseLogItem>({
    url: `/visa-cases/${visaCaseId}/logs`,
    method: 'POST',
    data,
  })
}

/**
 * 分页获取指定签证案件的日志列表。
 *
 * @param visaCaseId - 签证案件 ID
 * @param params - 分页与日志类型筛选参数
 * @returns 包含日志列表与总数的分页响应体
 */
export function getVisaCaseLogs(
  visaCaseId: string,
  params: VisaCaseLogQueryParams,
): Promise<ApiResponse<PaginatedResponse<VisaCaseLogItem>>> {
  return request<PaginatedResponse<VisaCaseLogItem>>({
    url: `/visa-cases/${visaCaseId}/logs`,
    method: 'GET',
    params,
  })
}

/**
 * 获取单条签证案件日志详情。
 *
 * @param visaCaseId - 签证案件 ID
 * @param logId - 日志 ID
 * @returns 指定日志的详情响应体
 */
export function getVisaCaseLog(
  visaCaseId: string,
  logId: string,
): Promise<ApiResponse<VisaCaseLogItem>> {
  return request<VisaCaseLogItem>({
    url: `/visa-cases/${visaCaseId}/logs/${logId}`,
    method: 'GET',
  })
}

/**
 * 更新指定签证案件日志的内容或结构化字段。
 *
 * @param visaCaseId - 签证案件 ID
 * @param logId - 日志 ID
 * @param data - 本次允许修改的日志字段
 * @returns 更新后的日志详情响应体
 */
export function updateVisaCaseLog(
  visaCaseId: string,
  logId: string,
  data: UpdateVisaCaseLogParams,
): Promise<ApiResponse<VisaCaseLogItem>> {
  return request<VisaCaseLogItem>({
    url: `/visa-cases/${visaCaseId}/logs/${logId}`,
    method: 'PUT',
    data,
  })
}

/**
 * 对指定签证案件日志执行逻辑删除。
 *
 * @param visaCaseId - 签证案件 ID
 * @param logId - 日志 ID
 * @returns 空响应体
 */
export function deleteVisaCaseLog(
  visaCaseId: string,
  logId: string,
): Promise<ApiResponse<void>> {
  return request<void>({
    url: `/visa-cases/${visaCaseId}/logs/${logId}`,
    method: 'DELETE',
  })
}

/**
 * 在指定客户上下文中创建一条资料路径台账记录。
 *
 * @param customerId - 客户 ID
 * @param data - 路径创建参数
 * @returns 新创建的路径响应体
 */
export function createCustomerFilePath(
  customerId: string,
  data: CreateCustomerFilePathParams,
): Promise<ApiResponse<CustomerFilePathItem>> {
  return request<CustomerFilePathItem>({
    url: `/customers/${customerId}/file-paths`,
    method: 'POST',
    data,
  })
}

/**
 * 分页获取指定客户名下的资料路径台账列表。
 *
 * @param customerId - 客户 ID
 * @param params - 分页与路径类型筛选参数
 * @returns 包含路径列表与总数的分页响应体
 */
export function getCustomerFilePaths(
  customerId: string,
  params: CustomerFilePathQueryParams,
): Promise<ApiResponse<PaginatedResponse<CustomerFilePathItem>>> {
  return request<PaginatedResponse<CustomerFilePathItem>>({
    url: `/customers/${customerId}/file-paths`,
    method: 'GET',
    params,
  })
}

/**
 * 分页获取指定签证案件下的资料路径台账列表。
 *
 * @param visaCaseId - 签证案件 ID
 * @param params - 分页与路径类型筛选参数
 * @returns 包含路径列表与总数的分页响应体
 */
export function getVisaCaseFilePaths(
  visaCaseId: string,
  params: CustomerFilePathQueryParams,
): Promise<ApiResponse<PaginatedResponse<CustomerFilePathItem>>> {
  return request<PaginatedResponse<CustomerFilePathItem>>({
    url: `/visa-cases/${visaCaseId}/file-paths`,
    method: 'GET',
    params,
  })
}

/**
 * 更新指定资料路径台账记录的可编辑字段。
 *
 * @param id - 路径记录 ID
 * @param data - 本次允许修改的字段
 * @returns 更新后的路径响应体
 */
export function updateCustomerFilePath(
  id: string,
  data: UpdateCustomerFilePathParams,
): Promise<ApiResponse<CustomerFilePathItem>> {
  return request<CustomerFilePathItem>({
    url: `/file-paths/${id}`,
    method: 'PUT',
    data,
  })
}

/**
 * 对指定资料路径记录执行逻辑删除。
 *
 * @param id - 路径记录 ID
 * @returns 空响应体
 */
export function deleteCustomerFilePath(
  id: string,
): Promise<ApiResponse<void>> {
  return request<void>({
    url: `/file-paths/${id}`,
    method: 'DELETE',
  })
}

/**
 * 获取指定签证案件的材料清单实例列表，含案件级与成员级归属。
 *
 * @param visaCaseId - 签证案件 ID
 * @returns 材料项列表响应体
 */
export function getVisaCaseMaterials(
  visaCaseId: string,
): Promise<ApiResponse<VisaCaseMaterialItemDetail[]>> {
  return request<VisaCaseMaterialItemDetail[]>({
    url: `/visa-cases/${visaCaseId}/materials`,
    method: 'GET',
  })
}

/**
 * 获取指定签证案件的材料收集统计摘要与建议 materialStatus。
 *
 * @param visaCaseId - 签证案件 ID
 * @returns 材料统计摘要响应体
 */
export function getVisaCaseMaterialSummary(
  visaCaseId: string,
): Promise<ApiResponse<MaterialSummary>> {
  return request<MaterialSummary>({
    url: `/visa-cases/${visaCaseId}/materials/summary`,
    method: 'GET',
  })
}

/**
 * 从模板初始化指定签证案件的材料清单（幂等：已有实例则跳过）。
 *
 * @param visaCaseId - 签证案件 ID
 * @returns 初始化后的材料项列表响应体
 */
export function initializeVisaCaseMaterials(
  visaCaseId: string,
): Promise<ApiResponse<VisaCaseMaterialItemDetail[]>> {
  return request<VisaCaseMaterialItemDetail[]>({
    url: `/visa-cases/${visaCaseId}/materials/initialize`,
    method: 'POST',
  })
}

/**
 * 更新指定案件材料项的状态、备注或排序。
 *
 * @param visaCaseId - 签证案件 ID
 * @param itemId - 材料项 ID
 * @param data - 部分更新字段
 * @returns 更新后的材料项响应体
 */
export function updateVisaCaseMaterialItem(
  visaCaseId: string,
  itemId: string,
  data: UpdateVisaCaseMaterialItemParams,
): Promise<ApiResponse<VisaCaseMaterialItemDetail>> {
  return request<VisaCaseMaterialItemDetail>({
    url: `/visa-cases/${visaCaseId}/materials/${itemId}`,
    method: 'PUT',
    data,
  })
}

/**
 * 手动新增一条材料项到指定案件（不关联模板）。
 *
 * @param visaCaseId - 签证案件 ID
 * @param data - 材料项创建参数
 * @returns 新创建的材料项响应体
 */
export function createVisaCaseMaterialItem(
  visaCaseId: string,
  data: CreateVisaCaseMaterialItemParams,
): Promise<ApiResponse<VisaCaseMaterialItemDetail>> {
  return request<VisaCaseMaterialItemDetail>({
    url: `/visa-cases/${visaCaseId}/materials`,
    method: 'POST',
    data,
  })
}

/**
 * 删除手动新增的材料项（模板来源项不可删除，只能标不适用）。
 *
 * @param visaCaseId - 签证案件 ID
 * @param itemId - 材料项 ID
 * @returns 空响应体
 */
export function deleteVisaCaseMaterialItem(
  visaCaseId: string,
  itemId: string,
): Promise<ApiResponse<void>> {
  return request<void>({
    url: `/visa-cases/${visaCaseId}/materials/${itemId}`,
    method: 'DELETE',
  })
}

/**
 * 将 checklist 建议的 material_status 同步写入案件表。
 *
 * @param visaCaseId - 签证案件 ID
 * @returns 同步后的摘要响应体
 */
export function syncVisaCaseMaterialStatus(
  visaCaseId: string,
): Promise<ApiResponse<MaterialSummary>> {
  return request<MaterialSummary>({
    url: `/visa-cases/${visaCaseId}/materials/sync-status`,
    method: 'POST',
  })
}

/**
 * 获取签证提醒列表，支持按提醒桶类型与负责人筛选。
 *
 * @param params - 分页与筛选参数
 * @returns 按桶优先级排序的提醒分页列表
 */
export function getVisaReminders(
  params: VisaReminderQueryParams,
): Promise<ApiResponse<PaginatedResponse<VisaReminderItem>>> {
  return request<PaginatedResponse<VisaReminderItem>>({
    url: '/visa-reminders',
    method: 'GET',
    params,
  })
}

const VISA_IMPORT_UPLOAD_TIMEOUT_MS = 120_000

/**
 * 上传历史签证导入 CSV 并执行 dry-run 预览，不写库。
 *
 * @param file - UTF-8 编码的 CSV 文件（≤5MB）
 * @returns 预览摘要、行级状态与 `canProceed` 标记
 */
export function previewVisaCaseImport(
  file: File,
): Promise<ApiResponse<VisaCaseImportPreviewResult>> {
  const formData = new FormData()
  formData.append('file', file)
  return request<VisaCaseImportPreviewResult>({
    url: '/visa-cases/import/preview',
    method: 'POST',
    data: formData,
    timeout: VISA_IMPORT_UPLOAD_TIMEOUT_MS,
  })
}

/**
 * 上传与预览校验通过内容一致的 CSV，分批逻辑由前端子集文件控制，服务端按行落库并返回批次报告。
 *
 * @param file - 与最近一次成功子集预览内容一致的 CSV 文件
 * @returns 导入批次 ID、内容哈希、汇总计数与逐行 outcome
 */
export function commitVisaCaseImport(
  file: File,
): Promise<ApiResponse<VisaCaseImportCommitResult>> {
  const formData = new FormData()
  formData.append('file', file)
  return request<VisaCaseImportCommitResult>({
    url: '/visa-cases/import/commit',
    method: 'POST',
    data: formData,
    timeout: VISA_IMPORT_UPLOAD_TIMEOUT_MS,
  })
}

/**
 * 分页查询已成功写入的签证 CSV 导入批次（只读），用于与 `audit_logs` 及本地下载 JSON 报告对账。
 *
 * @param params - 可选分页条件；省略时使用服务端默认第 1 页
 * @param params.page - 页码（从 1 起）
 * @param params.pageSize - 每页条数（上限由服务端校验）
 * @returns 分页批次审计列表
 */
export function listVisaCaseImportBatches(params?: {
  page?: number
  pageSize?: number
}): Promise<ApiResponse<PaginatedResponse<VisaCaseImportBatchAuditItem>>> {
  return request<PaginatedResponse<VisaCaseImportBatchAuditItem>>({
    url: '/visa-cases/import/batches',
    method: 'GET',
    params,
  })
}

/**
 * 按主键获取单条导入批次审计信息（只读）。
 *
 * @param importBatchId - 批次 UUID（commit 响应中的 `importBatchId`）
 * @returns 批次审计载荷；不存在时服务端返回 404
 */
export function getVisaCaseImportBatch(
  importBatchId: string,
): Promise<ApiResponse<VisaCaseImportBatchAuditItem>> {
  return request<VisaCaseImportBatchAuditItem>({
    url: `/visa-cases/import/batches/${importBatchId}`,
    method: 'GET',
  })
}

/**
 * 对所选行政案件 UUID 执行 dry-run 预览，不写库；幂等键为 `admin:{adminCaseId}`。
 *
 * @param adminCaseIds - 行政案件主键列表（服务端去重并字典序稳定哈希）
 * @returns 预览摘要、行级状态与 `canProceed`
 */
export function previewAdminCaseVisaSupplement(
  adminCaseIds: string[],
): Promise<ApiResponse<AdminCaseVisaSupplementPreviewResult>> {
  return request<AdminCaseVisaSupplementPreviewResult>({
    url: '/visa-cases/admin-case-supplement/preview',
    method: 'POST',
    data: { adminCaseIds },
  })
}

/**
 * 在预览无 ERROR 行时提交补录：逐行创建签证案件，同一 ID 集合重复提交返回 409。
 *
 * @param adminCaseIds - 与预览请求相同的 ID 列表
 * @returns 补录批次 ID、SHA-256 汇总与逐行 outcome
 */
export function commitAdminCaseVisaSupplement(
  adminCaseIds: string[],
): Promise<ApiResponse<AdminCaseVisaSupplementCommitResult>> {
  return request<AdminCaseVisaSupplementCommitResult>({
    url: '/visa-cases/admin-case-supplement/commit',
    method: 'POST',
    data: { adminCaseIds },
  })
}
