import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { UserInfo } from '@/types'
import { login as loginApi, logout as logoutApi, getMe } from '@/api/auth'
import type { LoginForm } from '@/types'

export const useUserStore = defineStore('user', () => {
  const token = ref<string>(localStorage.getItem('access_token') || '')
  const userInfo = ref<UserInfo | null>(null)

  const isLoggedIn = computed(() => !!token.value)
  const permissions = computed(() => userInfo.value?.permissions ?? [])
  const roles = computed(() => userInfo.value?.roles ?? [])

  async function login(form: LoginForm) {
    const res = await loginApi(form)
    token.value = res.data.accessToken
    userInfo.value = res.data.user
    localStorage.setItem('access_token', res.data.accessToken)
  }

  async function logout() {
    try {
      await logoutApi()
    } finally {
      token.value = ''
      userInfo.value = null
      localStorage.removeItem('access_token')
    }
  }

  async function fetchUserInfo() {
    const res = await getMe()
    userInfo.value = res.data
  }

  function hasPermission(perm: string): boolean {
    const perms = permissions.value
    if (perms.includes('*')) return true
    if (perms.includes(perm)) return true
    const [mod] = perm.split(':')
    return perms.includes(`${mod}:*`)
  }

  function hasRole(role: string): boolean {
    return roles.value.includes(role)
  }

  function resetState() {
    token.value = ''
    userInfo.value = null
    localStorage.removeItem('access_token')
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
