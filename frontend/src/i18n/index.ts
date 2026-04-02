import { createI18n } from 'vue-i18n'

import type { AppMessageSchema } from './messages/ja'
import jaMessages from './messages/ja'
import zhCNMessages from './messages/zh-CN'

export const SUPPORTED_LOCALES = ['zh-CN', 'ja'] as const

export type AppLocale = (typeof SUPPORTED_LOCALES)[number]

export const DEFAULT_LOCALE: AppLocale = 'ja'

const messages = {
  'zh-CN': zhCNMessages,
  ja: jaMessages,
} satisfies Record<AppLocale, AppMessageSchema>

/**
 * 判断传入语言代码是否属于系统支持的界面语言。
 *
 * @param value - 待校验的语言代码，通常来自本地存储或路由参数
 * @returns 当值属于受支持的语言集合时返回 true
 */
export function isAppLocale(value: string): value is AppLocale {
  return SUPPORTED_LOCALES.includes(value as AppLocale)
}

export const i18n = createI18n({
  legacy: false,
  locale: DEFAULT_LOCALE,
  fallbackLocale: DEFAULT_LOCALE,
  messages,
})

/**
 * 切换全局界面语言并同步更新 vue-i18n 当前 locale。
 *
 * @param locale - 已通过校验的目标语言代码
 */
export function setI18nLocale(locale: AppLocale) {
  i18n.global.locale.value = locale
}

/**
 * 读取当前语言环境下的翻译文案，并注入可选占位参数。
 *
 * @param key - vue-i18n 文案键路径，例如 `common.confirm`
 * @param params - 文案占位参数；省略时按空对象处理
 * @returns 当前语言解析后的最终文案字符串
 */
export function translate(key: string, params: Record<string, unknown> = {}) {
  return i18n.global.t(key, params)
}
