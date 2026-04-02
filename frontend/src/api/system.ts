import type { ApiResponse, PaginatedResponse } from '@/types'
import type {
  CreateRoleParams,
  CreateUserParams,
  PermissionGroup,
  RoleQueryParams,
  SystemRole,
  SystemUser,
  UpdateRoleParams,
  UpdateUserParams,
  UserQueryParams,
} from '@/types/system'
import { request } from '@/utils/request'

// ── Users ──

/**
 * 按筛选条件分页获取系统用户列表。
 *
 * @param params - 用户分页、状态与关键字等查询条件
 * @returns 包含用户列表与总数的分页响应体
 */
export function getUsers(
  params: UserQueryParams,
): Promise<ApiResponse<PaginatedResponse<SystemUser>>> {
  return request<PaginatedResponse<SystemUser>>({
    url: '/system/users',
    method: 'GET',
    params,
  })
}

/**
 * 获取单个系统用户的完整资料。
 *
 * @param id - 目标用户 ID
 * @returns 指定用户的详情响应体
 */
export function getUser(id: string): Promise<ApiResponse<SystemUser>> {
  return request<SystemUser>({
    url: `/system/users/${id}`,
    method: 'GET',
  })
}

/**
 * 提交新建系统用户表单并返回创建结果。
 *
 * @param data - 新用户的基础资料、角色与初始状态
 * @returns 新建成功后的用户详情响应体
 */
export function createUser(data: CreateUserParams): Promise<ApiResponse<SystemUser>> {
  return request<SystemUser>({
    url: '/system/users',
    method: 'POST',
    data,
  })
}

/**
 * 更新指定系统用户的资料与角色配置。
 *
 * @param id - 需要更新的用户 ID
 * @param data - 本次允许修改的用户字段集合
 * @returns 更新后的用户详情响应体
 */
export function updateUser(
  id: string,
  data: UpdateUserParams,
): Promise<ApiResponse<SystemUser>> {
  return request<SystemUser>({
    url: `/system/users/${id}`,
    method: 'PUT',
    data,
  })
}

/**
 * 重置指定系统用户的登录密码。
 *
 * @param id - 需要重置密码的用户 ID
 * @param newPassword - 可选的新密码；省略时由后端按默认策略生成
 * @returns 密码重置请求的响应体，成功时不返回业务数据
 */
export function resetUserPassword(
  id: string,
  newPassword?: string,
): Promise<ApiResponse<void>> {
  return request<void>({
    url: `/system/users/${id}/reset-password`,
    method: 'PUT',
    data: { newPassword },
  })
}

/**
 * 切换指定系统用户的启用状态。
 *
 * @param id - 需要切换状态的用户 ID
 * @returns 状态切换后的用户详情响应体
 */
export function toggleUserStatus(id: string): Promise<ApiResponse<SystemUser>> {
  return request<SystemUser>({
    url: `/system/users/${id}/toggle-status`,
    method: 'PUT',
  })
}

/**
 * 删除指定的系统用户记录。
 *
 * @param id - 需要删除的用户 ID
 * @returns 删除请求的响应体，成功时不返回业务数据
 */
export function deleteUser(id: string): Promise<ApiResponse<void>> {
  return request<void>({
    url: `/system/users/${id}`,
    method: 'DELETE',
  })
}

// ── Roles ──

/**
 * 按筛选条件分页获取系统角色列表。
 *
 * @param params - 角色分页与关键字等查询条件
 * @returns 包含角色列表与总数的分页响应体
 */
export function getRoles(
  params: RoleQueryParams,
): Promise<ApiResponse<PaginatedResponse<SystemRole>>> {
  return request<PaginatedResponse<SystemRole>>({
    url: '/system/roles',
    method: 'GET',
    params,
  })
}

/**
 * 获取单个系统角色的详情信息。
 *
 * @param id - 目标角色 ID
 * @returns 指定角色的详情响应体
 */
export function getRole(id: string): Promise<ApiResponse<SystemRole>> {
  return request<SystemRole>({
    url: `/system/roles/${id}`,
    method: 'GET',
  })
}

/**
 * 提交新建系统角色表单并返回创建结果。
 *
 * @param data - 角色名称、权限集合与备注等字段
 * @returns 新建成功后的角色详情响应体
 */
export function createRole(data: CreateRoleParams): Promise<ApiResponse<SystemRole>> {
  return request<SystemRole>({
    url: '/system/roles',
    method: 'POST',
    data,
  })
}

/**
 * 更新指定系统角色的权限配置。
 *
 * @param id - 需要更新的角色 ID
 * @param data - 本次允许修改的角色字段集合
 * @returns 更新后的角色详情响应体
 */
export function updateRole(
  id: string,
  data: UpdateRoleParams,
): Promise<ApiResponse<SystemRole>> {
  return request<SystemRole>({
    url: `/system/roles/${id}`,
    method: 'PUT',
    data,
  })
}

/**
 * 删除指定的系统角色记录。
 *
 * @param id - 需要删除的角色 ID
 * @returns 删除请求的响应体，成功时不返回业务数据
 */
export function deleteRole(id: string): Promise<ApiResponse<void>> {
  return request<void>({
    url: `/system/roles/${id}`,
    method: 'DELETE',
  })
}

// ── Permissions ──

/**
 * 获取角色编辑器使用的权限树结构。
 *
 * @returns 按模块分组的权限树响应体
 */
export function getPermissionTree(): Promise<ApiResponse<PermissionGroup[]>> {
  return request<PermissionGroup[]>({
    url: '/system/roles/permissions/tree',
    method: 'GET',
  })
}

// ── Helper: fetch all roles for selectors ──

/**
 * 获取角色下拉选择器使用的全量角色列表。
 *
 * @returns 预设大页大小返回的角色分页响应体
 */
export function getAllRoles(): Promise<ApiResponse<PaginatedResponse<SystemRole>>> {
  return request<PaginatedResponse<SystemRole>>({
    url: '/system/roles',
    method: 'GET',
    params: { page: 1, pageSize: 200 },
  })
}
