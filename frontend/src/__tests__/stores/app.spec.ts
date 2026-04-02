import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { setI18nLocale } = vi.hoisted(() => ({
  setI18nLocale: vi.fn(),
}))

vi.mock('@/i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/i18n')>()
  return {
    ...actual,
    setI18nLocale,
  }
})

import { DEFAULT_LOCALE } from '@/i18n'
import { useAppStore } from '@/stores/app'

describe('useAppStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    setI18nLocale.mockReset()
  })

  it('should initialize locale from default value when no preference is stored', () => {
    const store = useAppStore()

    expect(store.locale).toBe(DEFAULT_LOCALE)
    expect(store.sidebarCollapsed).toBe(false)
    expect(setI18nLocale).toHaveBeenCalledWith(DEFAULT_LOCALE)
  })

  it('should restore a valid locale from localStorage', () => {
    localStorage.setItem('app_locale', 'zh-CN')

    const store = useAppStore()

    expect(store.locale).toBe('zh-CN')
    expect(setI18nLocale).toHaveBeenCalledWith('zh-CN')
  })

  it('should ignore unsupported locale values stored locally', () => {
    localStorage.setItem('app_locale', 'en')

    const store = useAppStore()

    expect(store.locale).toBe(DEFAULT_LOCALE)
    expect(setI18nLocale).toHaveBeenCalledWith(DEFAULT_LOCALE)
  })

  it('should toggle sidebar collapsed state', () => {
    const store = useAppStore()

    store.toggleSidebar()
    expect(store.sidebarCollapsed).toBe(true)

    store.toggleSidebar()
    expect(store.sidebarCollapsed).toBe(false)
  })

  it('should persist locale changes and sync i18n state', () => {
    const store = useAppStore()

    store.setLocale('zh-CN')

    expect(store.locale).toBe('zh-CN')
    expect(localStorage.getItem('app_locale')).toBe('zh-CN')
    expect(setI18nLocale).toHaveBeenLastCalledWith('zh-CN')
  })
})
