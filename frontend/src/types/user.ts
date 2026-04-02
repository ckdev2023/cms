/**
 * 定义登录鉴权流程使用的用户身份与凭证类型。
 */
export interface UserInfo {
  id: string
  username: string
  displayName: string
  email: string
  roles: string[]
  permissions: string[]
  status: 'ACTIVE' | 'INACTIVE'
}

export interface LoginForm {
  username: string
  password: string
}

export interface LoginResult {
  accessToken: string
  user: UserInfo
}
