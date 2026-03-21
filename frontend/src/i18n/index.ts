import { createI18n } from 'vue-i18n'
import jaMessages from './messages/ja'
import zhCNMessages from './messages/zh-CN'

export const SUPPORTED_LOCALES = ['zh-CN', 'ja'] as const

export type AppLocale = (typeof SUPPORTED_LOCALES)[number]

export const DEFAULT_LOCALE: AppLocale = 'ja'

export function isAppLocale(value: string): value is AppLocale {
  return SUPPORTED_LOCALES.includes(value as AppLocale)
}

export const i18n = createI18n({
  legacy: false,
  locale: DEFAULT_LOCALE,
  fallbackLocale: DEFAULT_LOCALE,
  messages: {
    'zh-CN': zhCNMessages,
    ja: jaMessages,
  },
})

export function setI18nLocale(locale: AppLocale) {
  i18n.global.locale.value = locale
}

export function translate(key: string, params: Record<string, unknown> = {}) {
  return i18n.global.t(key, params)
}
