import type { MonthlyStatus, TaxContractStatus } from '@/constants/enums'
import type { ApiResponse, PaginatedResponse } from '@/types'
import type {
  CreateTaxContractParams,
  CreateTaxDocumentParams,
  CreateTaxPeriodParams,
  CreateTaxWorkItemParams,
  GeneratePeriodsParams,
  TaxContractDetail,
  TaxContractItem,
  TaxContractQueryParams,
  TaxMonthlyDocumentItem,
  TaxMonthlyWorkItemItem,
  TaxPeriodDetail,
  TaxPeriodItem,
  TaxPeriodQueryParams,
  UpdateTaxContractParams,
  UpdateTaxDocumentParams,
  UpdateTaxPeriodParams,
  UpdateTaxWorkItemParams,
} from '@/types/tax'
import { request } from '@/utils/request'

// ── Tax Contracts ────────────────────────────────────────

/**
 * 按筛选条件分页获取税务合约列表。
 *
 * @param params - 合约分页、客户与状态等查询条件
 * @returns 包含税务合约列表与总数的分页响应体
 */
export function getTaxContracts(
  params: TaxContractQueryParams,
): Promise<ApiResponse<PaginatedResponse<TaxContractItem>>> {
  return request<PaginatedResponse<TaxContractItem>>({
    url: '/tax-contracts',
    method: 'GET',
    params,
  })
}

/**
 * 获取单个税务合约的完整详情。
 *
 * @param id - 目标税务合约 ID
 * @returns 指定税务合约的详情响应体
 */
export function getTaxContract(id: string): Promise<ApiResponse<TaxContractDetail>> {
  return request<TaxContractDetail>({
    url: `/tax-contracts/${id}`,
    method: 'GET',
  })
}

/**
 * 提交新建税务合约表单并返回创建结果。
 *
 * @param data - 合约基础资料、客户关联与服务范围等字段
 * @returns 新建成功后的税务合约详情响应体
 */
export function createTaxContract(
  data: CreateTaxContractParams,
): Promise<ApiResponse<TaxContractDetail>> {
  return request<TaxContractDetail>({
    url: '/tax-contracts',
    method: 'POST',
    data,
  })
}

/**
 * 更新指定税务合约的基础资料。
 *
 * @param id - 需要更新的税务合约 ID
 * @param data - 本次允许修改的合约字段集合
 * @returns 更新后的税务合约详情响应体
 */
export function updateTaxContract(
  id: string,
  data: UpdateTaxContractParams,
): Promise<ApiResponse<TaxContractDetail>> {
  return request<TaxContractDetail>({
    url: `/tax-contracts/${id}`,
    method: 'PUT',
    data,
  })
}

/**
 * 推进税务合约状态流转并返回最新详情。
 *
 * @param id - 需要流转状态的税务合约 ID
 * @param contractStatus - 目标合约状态枚举值
 * @returns 状态更新后的税务合约详情响应体
 */
export function updateTaxContractStatus(
  id: string,
  contractStatus: TaxContractStatus,
): Promise<ApiResponse<TaxContractDetail>> {
  return request<TaxContractDetail>({
    url: `/tax-contracts/${id}/status`,
    method: 'PATCH',
    data: { contractStatus },
  })
}

/**
 * 删除指定的税务合约记录。
 *
 * @param id - 需要删除的税务合约 ID
 * @returns 删除请求的响应体，成功时不返回业务数据
 */
export function deleteTaxContract(id: string): Promise<ApiResponse<void>> {
  return request<void>({
    url: `/tax-contracts/${id}`,
    method: 'DELETE',
  })
}

/**
 * 查询当前税务合约允许执行的下一步状态。
 *
 * @param id - 税务合约 ID
 * @returns 当前状态下可选目标状态的响应体
 */
export function getTaxContractTransitions(
  id: string,
): Promise<ApiResponse<TaxContractStatus[]>> {
  return request<TaxContractStatus[]>({
    url: `/tax-contracts/${id}/transitions`,
    method: 'GET',
  })
}

// ── Tax Periods ──────────────────────────────────────────

/**
 * 分页获取指定税务合约下的申报期间列表。
 *
 * @param contractId - 所属税务合约 ID
 * @param params - 期间分页、状态与年份等查询条件
 * @returns 包含期间列表与总数的分页响应体
 */
export function getTaxPeriods(
  contractId: string,
  params: TaxPeriodQueryParams,
): Promise<ApiResponse<PaginatedResponse<TaxPeriodItem>>> {
  return request<PaginatedResponse<TaxPeriodItem>>({
    url: `/tax-contracts/${contractId}/periods`,
    method: 'GET',
    params,
  })
}

/**
 * 获取税务期间的完整详情。
 *
 * @param contractId - 所属税务合约 ID
 * @param periodId - 目标税务期间 ID
 * @returns 指定期间的详情响应体
 */
export function getTaxPeriod(
  contractId: string,
  periodId: string,
): Promise<ApiResponse<TaxPeriodDetail>> {
  return request<TaxPeriodDetail>({
    url: `/tax-contracts/${contractId}/periods/${periodId}`,
    method: 'GET',
  })
}

/**
 * 为指定税务合约新增一个申报期间。
 *
 * @param contractId - 所属税务合约 ID
 * @param data - 期间年月、负责人和申报要求等字段
 * @returns 新建成功后的期间详情响应体
 */
export function createTaxPeriod(
  contractId: string,
  data: CreateTaxPeriodParams,
): Promise<ApiResponse<TaxPeriodDetail>> {
  return request<TaxPeriodDetail>({
    url: `/tax-contracts/${contractId}/periods`,
    method: 'POST',
    data,
  })
}

/**
 * 更新指定税务期间的基础资料。
 *
 * @param contractId - 所属税务合约 ID
 * @param periodId - 需要更新的期间 ID
 * @param data - 本次允许修改的期间字段集合
 * @returns 更新后的期间详情响应体
 */
export function updateTaxPeriod(
  contractId: string,
  periodId: string,
  data: UpdateTaxPeriodParams,
): Promise<ApiResponse<TaxPeriodDetail>> {
  return request<TaxPeriodDetail>({
    url: `/tax-contracts/${contractId}/periods/${periodId}`,
    method: 'PUT',
    data,
  })
}

/**
 * 推进税务期间月度状态并返回最新详情。
 *
 * @param contractId - 所属税务合约 ID
 * @param periodId - 需要流转状态的期间 ID
 * @param monthlyStatus - 目标月度状态枚举值
 * @returns 状态更新后的期间详情响应体
 */
export function updateTaxPeriodStatus(
  contractId: string,
  periodId: string,
  monthlyStatus: MonthlyStatus,
): Promise<ApiResponse<TaxPeriodDetail>> {
  return request<TaxPeriodDetail>({
    url: `/tax-contracts/${contractId}/periods/${periodId}/status`,
    method: 'PATCH',
    data: { monthlyStatus },
  })
}

/**
 * 删除指定税务期间记录。
 *
 * @param contractId - 所属税务合约 ID
 * @param periodId - 需要删除的期间 ID
 * @returns 删除请求的响应体，成功时不返回业务数据
 */
export function deleteTaxPeriod(
  contractId: string,
  periodId: string,
): Promise<ApiResponse<void>> {
  return request<void>({
    url: `/tax-contracts/${contractId}/periods/${periodId}`,
    method: 'DELETE',
  })
}

/**
 * 按生成规则批量创建税务期间。
 *
 * @param contractId - 所属税务合约 ID
 * @param data - 起止月份、频率与模板参数等生成条件
 * @returns 批量生成后的期间列表响应体
 */
export function generateTaxPeriods(
  contractId: string,
  data: GeneratePeriodsParams,
): Promise<ApiResponse<TaxPeriodItem[]>> {
  return request<TaxPeriodItem[]>({
    url: `/tax-contracts/${contractId}/periods/generate`,
    method: 'POST',
    data,
  })
}

// ── Tax Monthly Documents ────────────────────────────────

/**
 * 为指定税务期间新增月度资料记录。
 *
 * @param contractId - 所属税务合约 ID
 * @param periodId - 所属税务期间 ID
 * @param data - 文件关联、资料类型与备注等字段
 * @returns 新建成功后的月度资料响应体
 */
export function createTaxDocument(
  contractId: string,
  periodId: string,
  data: CreateTaxDocumentParams,
): Promise<ApiResponse<TaxMonthlyDocumentItem>> {
  return request<TaxMonthlyDocumentItem>({
    url: `/tax-contracts/${contractId}/periods/${periodId}/documents`,
    method: 'POST',
    data,
  })
}

/**
 * 更新税务期间下的月度资料记录。
 *
 * @param contractId - 所属税务合约 ID
 * @param periodId - 所属税务期间 ID
 * @param docId - 需要更新的资料记录 ID
 * @param data - 本次允许修改的资料字段集合
 * @returns 更新后的月度资料响应体
 */
export function updateTaxDocument(
  contractId: string,
  periodId: string,
  docId: string,
  data: UpdateTaxDocumentParams,
): Promise<ApiResponse<TaxMonthlyDocumentItem>> {
  return request<TaxMonthlyDocumentItem>({
    url: `/tax-contracts/${contractId}/periods/${periodId}/documents/${docId}`,
    method: 'PUT',
    data,
  })
}

/**
 * 删除税务期间下的月度资料记录。
 *
 * @param contractId - 所属税务合约 ID
 * @param periodId - 所属税务期间 ID
 * @param docId - 需要删除的资料记录 ID
 * @returns 删除请求的响应体，成功时不返回业务数据
 */
export function deleteTaxDocument(
  contractId: string,
  periodId: string,
  docId: string,
): Promise<ApiResponse<void>> {
  return request<void>({
    url: `/tax-contracts/${contractId}/periods/${periodId}/documents/${docId}`,
    method: 'DELETE',
  })
}

// ── Tax Monthly Work Items ───────────────────────────────

/**
 * 为指定税务期间新增月度工作项。
 *
 * @param contractId - 所属税务合约 ID
 * @param periodId - 所属税务期间 ID
 * @param data - 工作项名称、截止日和负责信息等字段
 * @returns 新建成功后的月度工作项响应体
 */
export function createTaxWorkItem(
  contractId: string,
  periodId: string,
  data: CreateTaxWorkItemParams,
): Promise<ApiResponse<TaxMonthlyWorkItemItem>> {
  return request<TaxMonthlyWorkItemItem>({
    url: `/tax-contracts/${contractId}/periods/${periodId}/work-items`,
    method: 'POST',
    data,
  })
}

/**
 * 更新税务期间下的月度工作项。
 *
 * @param contractId - 所属税务合约 ID
 * @param periodId - 所属税务期间 ID
 * @param itemId - 需要更新的工作项 ID
 * @param data - 本次允许修改的工作项字段集合
 * @returns 更新后的月度工作项响应体
 */
export function updateTaxWorkItem(
  contractId: string,
  periodId: string,
  itemId: string,
  data: UpdateTaxWorkItemParams,
): Promise<ApiResponse<TaxMonthlyWorkItemItem>> {
  return request<TaxMonthlyWorkItemItem>({
    url: `/tax-contracts/${contractId}/periods/${periodId}/work-items/${itemId}`,
    method: 'PUT',
    data,
  })
}

/**
 * 删除税务期间下的月度工作项。
 *
 * @param contractId - 所属税务合约 ID
 * @param periodId - 所属税务期间 ID
 * @param itemId - 需要删除的工作项 ID
 * @returns 删除请求的响应体，成功时不返回业务数据
 */
export function deleteTaxWorkItem(
  contractId: string,
  periodId: string,
  itemId: string,
): Promise<ApiResponse<void>> {
  return request<void>({
    url: `/tax-contracts/${contractId}/periods/${periodId}/work-items/${itemId}`,
    method: 'DELETE',
  })
}
