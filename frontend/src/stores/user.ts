import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { getMe, login as loginApi, logout as logoutApi } from '@/api/auth'
import type { LoginForm, UserInfo } from '@/types'

const ACCESS_TOKEN_STORAGE_KEY = 'access_token'

/**
 * 管理当前登录用户的凭证、资料与权限判断结果。
 *
 * 初始化时会从 localStorage 恢复 access token，供页面刷新后的鉴权流程继续使用。
 *
 * @returns 包含登录态、用户资料与权限 action 的 User store 实例
 */
export const useUserStore = defineStore('user', () => {
  const token = ref<string>(localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY) || '')
  const userInfo = ref<UserInfo | null>(null)

  const isLoggedIn = computed(() => !!token.value)
  const permissions = computed(() => userInfo.value?.permissions ?? [])
  const roles = computed(() => userInfo.value?.roles ?? [])

  /**
   * 调用登录接口并把 access token 与用户资料写入本地状态。
   *
   * 副作用：成功后会把 access token 持久化到 localStorage。
   *
   * @param form - 包含用户名与密码的登录表单数据
   * @throws {Error} 登录接口返回异常或网络请求失败时继续向上抛出
   */
  async function login(form: LoginForm): Promise<void> {
    const res = await loginApi(form)
    token.value = res.data.accessToken
    userInfo.value = res.data.user
    localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, res.data.accessToken)
  }

  /**
   * 调用登出接口并无条件清空当前登录态。
   *
   * 副作用：无论接口是否成功，都会移除内存状态与 localStorage 中的 access token。
   *
   * @throws {Error} 登出接口请求失败时继续向上抛出，便于调用方决定是否提示用户
   */
  async function logout(): Promise<void> {
    try {
      await logoutApi()
    } finally {
      token.value = ''
      userInfo.value = null
      localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY)
    }
  }

  /**
   * 拉取当前登录用户的最新资料并刷新 store 中的用户信息。
   *
   * @throws {Error} 获取当前用户资料失败时由请求层继续抛出异常
   */
  async function fetchUserInfo(): Promise<void> {
    const res = await getMe()
    userInfo.value = res.data
  }

  /**
   * 判断当前用户是否具备指定权限码或对应模块通配权限。
   *
   * 支持 `*` 全局权限、精确权限码，以及 `module:*` 形式的模块级通配权限。
   *
   * @param perm - 待校验的权限码，格式通常为 `模块:动作`
   * @returns 当前用户具备目标权限时返回 true
   */
  function hasPermission(perm: string): boolean {
    const perms = permissions.value
    if (perms.includes('*')) return true
    if (perms.includes(perm)) return true
    const [mod] = perm.split(':')
    return perms.includes(`${mod}:*`)
  }

  /**
   * 判断当前用户是否包含指定角色代码。
   *
   * @param role - 待匹配的角色标识
   * @returns 当前用户角色列表中存在该角色时返回 true
   */
  function hasRole(role: string): boolean {
    return roles.value.includes(role)
  }

  /**
   * 清空当前登录用户的凭证与资料缓存。
   *
   * 副作用：会移除 localStorage 中缓存的 access token。
   */
  function resetState(): void {
    token.value = ''
    userInfo.value = null
    localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY)
  }

  return {
    token,
    userInfo,
    isLoggedIn,
    permissions,
    roles,
    login,
    logout,
    fetchUserInfo,
    hasPermission,
    hasRole,
    resetState,
  }
})
