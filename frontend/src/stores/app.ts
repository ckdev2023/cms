import { defineStore } from 'pinia'
import { shallowRef } from 'vue'
import { DEFAULT_LOCALE, isAppLocale, setI18nLocale, type AppLocale } from '@/i18n'

export const useAppStore = defineStore('app', () => {
  const sidebarCollapsed = shallowRef(false)
  const storedLocale = localStorage.getItem('app_locale')
  const locale = shallowRef<AppLocale>(
    storedLocale && isAppLocale(storedLocale) ? storedLocale : DEFAULT_LOCALE,
  )

  setI18nLocale(locale.value)

  function toggleSidebar() {
    sidebarCollapsed.value = !sidebarCollapsed.value
  }

  function setLocale(nextLocale: AppLocale) {
    locale.value = nextLocale
    localStorage.setItem('app_locale', nextLocale)
    setI18nLocale(nextLocale)
  }

  return {
    sidebarCollapsed,
    locale,
    toggleSidebar,
    setLocale,
  }
})
