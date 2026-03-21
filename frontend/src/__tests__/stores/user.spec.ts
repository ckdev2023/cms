import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useUserStore } from '@/stores/user'

vi.mock('@/api/auth', () => ({
  login: vi.fn(),
  logout: vi.fn(),
  getMe: vi.fn(),
}))

import { login as loginApi, logout as logoutApi, getMe } from '@/api/auth'

const mockLoginResponse = {
  code: 0,
  message: 'success',
  data: {
    accessToken: 'test-token-abc',
    user: {
      id: 'u1',
      username: 'admin',
      displayName: '管理者',
      email: 'admin@test.com',
      roles: ['ADMIN'],
      permissions: ['customer:list', 'customer:create'],
      status: 'ACTIVE' as const,
    },
  },
}

const mockUserInfoResponse = {
  code: 0,
  message: 'success',
  data: {
    id: 'u1',
    username: 'admin',
    displayName: '管理者',
    email: 'admin@test.com',
    roles: ['ADMIN'],
    permissions: ['customer:list', 'customer:create'],
    status: 'ACTIVE' as const,
  },
}

describe('useUserStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.clearAllMocks()
  })

  describe('initial state', () => {
    it('should start with empty token and null userInfo', () => {
      const store = useUserStore()
      expect(store.token).toBe('')
      expect(store.userInfo).toBeNull()
      expect(store.isLoggedIn).toBe(false)
    })

    it('should restore token from localStorage', () => {
      localStorage.setItem('access_token', 'saved-token')
      setActivePinia(createPinia())
      const store = useUserStore()
      expect(store.token).toBe('saved-token')
      expect(store.isLoggedIn).toBe(true)
    })
  })

  describe('login', () => {
    it('should store token and user info on success', async () => {
      vi.mocked(loginApi).mockResolvedValue(mockLoginResponse)
      const store = useUserStore()

      await store.login({ username: 'admin', password: 'admin123' })

      expect(store.token).toBe('test-token-abc')
      expect(store.userInfo).toEqual(mockLoginResponse.data.user)
      expect(store.isLoggedIn).toBe(true)
      expect(localStorage.getItem('access_token')).toBe('test-token-abc')
    })

    it('should propagate API errors', async () => {
      vi.mocked(loginApi).mockRejectedValue(new Error('Bad credentials'))
      const store = useUserStore()

      await expect(
        store.login({ username: 'bad', password: 'wrong' }),
      ).rejects.toThrow('Bad credentials')
      expect(store.token).toBe('')
      expect(store.isLoggedIn).toBe(false)
    })
  })

  describe('logout', () => {
    it('should clear token and user info', async () => {
      vi.mocked(loginApi).mockResolvedValue(mockLoginResponse)
      vi.mocked(logoutApi).mockResolvedValue({ code: 0, message: 'success', data: undefined })
      const store = useUserStore()

      await store.login({ username: 'admin', password: 'admin123' })
      expect(store.isLoggedIn).toBe(true)

      await store.logout()
      expect(store.token).toBe('')
      expect(store.userInfo).toBeNull()
      expect(store.isLoggedIn).toBe(false)
      expect(localStorage.getItem('access_token')).toBeNull()
    })

    it('should clear state even if API call fails', async () => {
      vi.mocked(logoutApi).mockRejectedValue(new Error('Network error'))
      const store = useUserStore()
      store.token = 'some-token'
      localStorage.setItem('access_token', 'some-token')

      await store.logout().catch(() => {})
      expect(store.token).toBe('')
      expect(localStorage.getItem('access_token')).toBeNull()
    })
  })

  describe('fetchUserInfo', () => {
    it('should populate userInfo from API', async () => {
      vi.mocked(getMe).mockResolvedValue(mockUserInfoResponse)
      const store = useUserStore()

      await store.fetchUserInfo()
      expect(store.userInfo).toEqual(mockUserInfoResponse.data)
    })
  })

  describe('permissions', () => {
    it('should compute permissions from userInfo', async () => {
      vi.mocked(loginApi).mockResolvedValue(mockLoginResponse)
      const store = useUserStore()
      await store.login({ username: 'admin', password: 'admin123' })

      expect(store.permissions).toEqual(['customer:list', 'customer:create'])
      expect(store.roles).toEqual(['ADMIN'])
    })

    it('hasPermission should check permission existence', async () => {
      vi.mocked(loginApi).mockResolvedValue(mockLoginResponse)
      const store = useUserStore()
      await store.login({ username: 'admin', password: 'admin123' })

      expect(store.hasPermission('customer:list')).toBe(true)
      expect(store.hasPermission('finance:create')).toBe(false)
    })
  })

  describe('resetState', () => {
    it('should clear all state and localStorage', async () => {
      vi.mocked(loginApi).mockResolvedValue(mockLoginResponse)
      const store = useUserStore()
      await store.login({ username: 'admin', password: 'admin123' })

      store.resetState()
      expect(store.token).toBe('')
      expect(store.userInfo).toBeNull()
      expect(localStorage.getItem('access_token')).toBeNull()
    })
  })
})
