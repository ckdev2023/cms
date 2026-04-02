import type { ApiResponse, LoginForm, LoginResult, UserInfo } from '@/types'
import { request } from '@/utils/request'

/**
 * 提交登录凭证并获取当前会话的访问令牌。
 *
 * @param data - 登录表单数据，包含用户名与密码
 * @returns 包含访问令牌和当前用户概要信息的响应体
 */
export function login(data: LoginForm): Promise<ApiResponse<LoginResult>> {
  return request<LoginResult>({ url: '/auth/login', method: 'POST', data })
}

/**
 * 通知后端注销当前登录会话。
 *
 * @returns 注销请求的响应体，成功时不返回业务数据
 */
export function logout(): Promise<ApiResponse<void>> {
  return request<void>({ url: '/auth/logout', method: 'POST' })
}

/**
 * 获取当前登录用户的身份与权限信息。
 *
 * @returns 当前会话对应的用户资料响应体
 */
export function getMe(): Promise<ApiResponse<UserInfo>> {
  return request<UserInfo>({ url: '/auth/me', method: 'GET' })
}

/**
 * 提交当前用户的密码修改请求。
 *
 * @param data - 包含旧密码与新密码的修改表单
 * @param data.oldPassword - 当前登录密码明文
 * @param data.newPassword - 需要更新的新密码明文
 * @returns 密码修改请求的响应体，成功时不返回业务数据
 */
export function changePassword(
  data: { oldPassword: string; newPassword: string },
): Promise<ApiResponse<void>> {
  return request<void>({ url: '/auth/change-password', method: 'PUT', data })
}
