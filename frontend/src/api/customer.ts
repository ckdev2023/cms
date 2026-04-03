import type { ApiResponse, PaginatedResponse } from '@/types'
import type {
  CreateCustomerParams,
  CreateNoteParams,
  CustomerDetail,
  CustomerItem,
  CustomerQueryParams,
  NoteItem,
  NoteQueryParams,
  ReminderQueryParams,
  ResidenceExpiryReminderItem,
  UpdateCustomerParams,
  UpdateNoteParams,
} from '@/types/customer'
import { request } from '@/utils/request'

/**
 * 按筛选条件分页获取客户档案列表。
 *
 * @param params - 客户分页、状态与关键字等查询条件
 * @returns 包含客户列表与总数的分页响应体
 */
export function getCustomers(
  params: CustomerQueryParams,
): Promise<ApiResponse<PaginatedResponse<CustomerItem>>> {
  return request<PaginatedResponse<CustomerItem>>({
    url: '/customers',
    method: 'GET',
    params,
  })
}

/**
 * 获取单个客户的完整档案详情。
 *
 * @param id - 目标客户 ID
 * @returns 指定客户的详情响应体
 */
export function getCustomer(id: string): Promise<ApiResponse<CustomerDetail>> {
  return request<CustomerDetail>({
    url: `/customers/${id}`,
    method: 'GET',
  })
}

/**
 * 提交新建客户表单并返回创建结果。
 *
 * @param data - 客户基础信息与联系资料等字段
 * @returns 新建成功后的客户详情响应体
 */
export function createCustomer(
  data: CreateCustomerParams,
): Promise<ApiResponse<CustomerDetail>> {
  return request<CustomerDetail>({
    url: '/customers',
    method: 'POST',
    data,
  })
}

/**
 * 更新指定客户的基础档案信息。
 *
 * @param id - 需要更新的客户 ID
 * @param data - 本次允许修改的客户字段集合
 * @returns 更新后的客户详情响应体
 */
export function updateCustomer(
  id: string,
  data: UpdateCustomerParams,
): Promise<ApiResponse<CustomerDetail>> {
  return request<CustomerDetail>({
    url: `/customers/${id}`,
    method: 'PUT',
    data,
  })
}

/**
 * 删除指定的客户档案记录。
 *
 * @param id - 需要删除的客户 ID
 * @returns 删除请求的响应体，成功时不返回业务数据
 */
export function deleteCustomer(id: string): Promise<ApiResponse<void>> {
  return request<void>({
    url: `/customers/${id}`,
    method: 'DELETE',
  })
}

/**
 * 分页获取 90 天内在留期限到期的客户提醒列表。
 *
 * @param params - 分页参数
 * @returns 按到期日升序排列的提醒分页列表
 */
export function getResidenceExpiryReminders(
  params: ReminderQueryParams,
): Promise<ApiResponse<PaginatedResponse<ResidenceExpiryReminderItem>>> {
  return request<PaginatedResponse<ResidenceExpiryReminderItem>>({
    url: '/customers/residence-expiry-reminders',
    method: 'GET',
    params,
  })
}

/**
 * 分页获取客户档案下的备注记录。
 *
 * @param customerId - 所属客户 ID
 * @param params - 备注分页与筛选参数
 * @returns 包含备注列表与总数的分页响应体
 */
export function getNotes(
  customerId: string,
  params: NoteQueryParams,
): Promise<ApiResponse<PaginatedResponse<NoteItem>>> {
  return request<PaginatedResponse<NoteItem>>({
    url: `/customers/${customerId}/notes`,
    method: 'GET',
    params,
  })
}

/**
 * 为指定客户新增一条跟进备注。
 *
 * @param customerId - 所属客户 ID
 * @param data - 备注内容与可选标签等字段
 * @returns 新建成功后的备注详情响应体
 */
export function createNote(
  customerId: string,
  data: CreateNoteParams,
): Promise<ApiResponse<NoteItem>> {
  return request<NoteItem>({
    url: `/customers/${customerId}/notes`,
    method: 'POST',
    data,
  })
}

/**
 * 更新指定客户备注的内容。
 *
 * @param customerId - 所属客户 ID
 * @param noteId - 需要更新的备注 ID
 * @param data - 本次允许修改的备注字段
 * @returns 更新后的备注详情响应体
 */
export function updateNote(
  customerId: string,
  noteId: string,
  data: UpdateNoteParams,
): Promise<ApiResponse<NoteItem>> {
  return request<NoteItem>({
    url: `/customers/${customerId}/notes/${noteId}`,
    method: 'PUT',
    data,
  })
}

/**
 * 删除客户档案中的指定备注记录。
 *
 * @param customerId - 所属客户 ID
 * @param noteId - 需要删除的备注 ID
 * @returns 删除请求的响应体，成功时不返回业务数据
 */
export function deleteNote(
  customerId: string,
  noteId: string,
): Promise<ApiResponse<void>> {
  return request<void>({
    url: `/customers/${customerId}/notes/${noteId}`,
    method: 'DELETE',
  })
}
