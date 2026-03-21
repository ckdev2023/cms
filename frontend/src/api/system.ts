import { request } from '@/utils/request'
import type { PaginatedResponse } from '@/types'
import type {
  SystemUser,
  CreateUserParams,
  UpdateUserParams,
  UserQueryParams,
  SystemRole,
  CreateRoleParams,
  UpdateRoleParams,
  RoleQueryParams,
  PermissionGroup,
} from '@/types/system'

// ── Users ──

export function getUsers(params: UserQueryParams) {
  return request<PaginatedResponse<SystemUser>>({
    url: '/system/users',
    method: 'GET',
    params,
  })
}

export function getUser(id: string) {
  return request<SystemUser>({
    url: `/system/users/${id}`,
    method: 'GET',
  })
}

export function createUser(data: CreateUserParams) {
  return request<SystemUser>({
    url: '/system/users',
    method: 'POST',
    data,
  })
}

export function updateUser(id: string, data: UpdateUserParams) {
  return request<SystemUser>({
    url: `/system/users/${id}`,
    method: 'PUT',
    data,
  })
}

export function resetUserPassword(id: string, newPassword?: string) {
  return request<void>({
    url: `/system/users/${id}/reset-password`,
    method: 'PUT',
    data: { newPassword },
  })
}

export function toggleUserStatus(id: string) {
  return request<SystemUser>({
    url: `/system/users/${id}/toggle-status`,
    method: 'PUT',
  })
}

export function deleteUser(id: string) {
  return request<void>({
    url: `/system/users/${id}`,
    method: 'DELETE',
  })
}

// ── Roles ──

export function getRoles(params: RoleQueryParams) {
  return request<PaginatedResponse<SystemRole>>({
    url: '/system/roles',
    method: 'GET',
    params,
  })
}

export function getRole(id: string) {
  return request<SystemRole>({
    url: `/system/roles/${id}`,
    method: 'GET',
  })
}

export function createRole(data: CreateRoleParams) {
  return request<SystemRole>({
    url: '/system/roles',
    method: 'POST',
    data,
  })
}

export function updateRole(id: string, data: UpdateRoleParams) {
  return request<SystemRole>({
    url: `/system/roles/${id}`,
    method: 'PUT',
    data,
  })
}

export function deleteRole(id: string) {
  return request<void>({
    url: `/system/roles/${id}`,
    method: 'DELETE',
  })
}

// ── Permissions ──

export function getPermissionTree() {
  return request<PermissionGroup[]>({
    url: '/system/roles/permissions/tree',
    method: 'GET',
  })
}

// ── Helper: fetch all roles for selectors ──

export function getAllRoles() {
  return request<PaginatedResponse<SystemRole>>({
    url: '/system/roles',
    method: 'GET',
    params: { page: 1, pageSize: 200 },
  })
}
