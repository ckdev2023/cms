import { request } from '@/utils/request'
import type { LoginForm, LoginResult, UserInfo } from '@/types'

export function login(data: LoginForm) {
  return request<LoginResult>({ url: '/auth/login', method: 'POST', data })
}

export function logout() {
  return request<void>({ url: '/auth/logout', method: 'POST' })
}

export function getMe() {
  return request<UserInfo>({ url: '/auth/me', method: 'GET' })
}

export function changePassword(data: { oldPassword: string; newPassword: string }) {
  return request<void>({ url: '/auth/change-password', method: 'PUT', data })
}
