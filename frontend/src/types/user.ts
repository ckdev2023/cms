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
