import type { PaginationParams } from './api'

export interface RoleRef {
  id: string
  roleName: string
  roleCode: string
}

export interface SystemUser {
  id: string
  username: string
  displayName: string
  email: string | null
  phone: string | null
  status: 'ACTIVE' | 'INACTIVE'
  roles: RoleRef[]
  createdAt: string
  updatedAt: string
}

export interface CreateUserParams {
  username: string
  password: string
  displayName: string
  email?: string
  phone?: string
  roleIds?: string[]
}

export interface UpdateUserParams {
  displayName?: string
  email?: string
  phone?: string
  status?: 'ACTIVE' | 'INACTIVE'
  roleIds?: string[]
}

export interface UserQueryParams extends PaginationParams {
  status?: 'ACTIVE' | 'INACTIVE'
  roleCode?: string
}

export interface PermissionRef {
  id: string
  permissionCode: string
  permissionName: string
  module: string
}

export interface SystemRole {
  id: string
  roleName: string
  roleCode: string
  description: string | null
  isSystem: boolean
  permissionIds: string[]
  permissions: PermissionRef[]
  createdAt: string
  updatedAt: string
}

export interface CreateRoleParams {
  roleName: string
  roleCode: string
  description?: string
  permissionIds?: string[]
}

export interface UpdateRoleParams {
  roleName?: string
  description?: string
  permissionIds?: string[]
}

export interface RoleQueryParams extends PaginationParams {
  roleCode?: string
}

export interface PermissionGroup {
  module: string
  children: Array<{
    id: string
    permissionCode: string
    permissionName: string
  }>
}
