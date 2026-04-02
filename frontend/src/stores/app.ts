import { defineStore } from 'pinia'
import { shallowRef } from 'vue'

import { type AppLocale, DEFAULT_LOCALE, isAppLocale, setI18nLocale } from '@/i18n'

const APP_LOCALE_STORAGE_KEY = 'app_locale'

/**
 * 维护后台壳层的侧边栏折叠状态与界面语言偏好。
 *
 * 初始化时会读取 localStorage 中持久化的语言设置，并同步到 vue-i18n 全局实例。
 *
 * @returns 包含布局状态与语言切换 action 的 App store 实例
 */
export const useAppStore = defineStore('app', () => {
  const sidebarCollapsed = shallowRef(false)
  const storedLocale = localStorage.getItem(APP_LOCALE_STORAGE_KEY)
  const locale = shallowRef<AppLocale>(
    storedLocale && isAppLocale(storedLocale) ? storedLocale : DEFAULT_LOCALE,
  )

  setI18nLocale(locale.value)

  /**
   * 切换主布局侧边栏的折叠状态。
   */
  function toggleSidebar(): void {
    sidebarCollapsed.value = !sidebarCollapsed.value
  }

  /**
   * 更新当前后台语言并持久化到本地存储。
   *
   * 副作用：会同步写入 localStorage，并立即刷新 vue-i18n 的全局 locale。
   *
   * @param nextLocale - 用户选择的新界面语言，仅允许项目支持的语言代码
   */
  function setLocale(nextLocale: AppLocale): void {
    locale.value = nextLocale
    localStorage.setItem(APP_LOCALE_STORAGE_KEY, nextLocale)
    setI18nLocale(nextLocale)
  }

  return {
    sidebarCollapsed,
    locale,
    toggleSidebar,
    setLocale,
  }
})
