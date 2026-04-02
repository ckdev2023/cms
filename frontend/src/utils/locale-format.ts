import { computed, type ComputedRef } from 'vue'
import { useI18n } from 'vue-i18n'

/**
 * 将应用语言代码映射为浏览器国际化格式化所需的 locale。
 *
 * @param appLocale - 当前应用语言代码，支持 `zh-CN` 与默认日语分支
 * @returns 可直接传给 `Intl` 与 `toLocaleString` 的地区代码
 */
function getIntlLocale(appLocale: string): 'zh-CN' | 'ja-JP' {
  return appLocale === 'zh-CN' ? 'zh-CN' : 'ja-JP'
}

/**
 * 提供随当前界面语言切换的日期、时间与金额格式化方法。
 *
 * @returns 包含国际化 locale 与常用格式化函数的工具对象
 */
export function useLocaleFormatter(): {
  intlLocale: ComputedRef<'zh-CN' | 'ja-JP'>
  formatDate: (dateStr: string | null | undefined) => string
  formatDateTime: (dateStr: string | null | undefined) => string
  formatNumber: (value: number | string) => string
  formatCurrency: (value: number | string, prefix?: string) => string
} {
  const { locale } = useI18n()

  const intlLocale = computed(() => getIntlLocale(locale.value))

  /**
   * 将可选日期字符串格式化为当前语言对应的短日期文本。
   *
   * @param dateStr - 后端返回的日期字符串；为空时回退为占位符
   * @returns 本地化日期文本；无值时返回 `-`
   */
  function formatDate(dateStr: string | null | undefined): string {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString(intlLocale.value)
  }

  /**
   * 将可选日期字符串格式化为当前语言对应的日期时间文本。
   *
   * @param dateStr - 后端返回的日期时间字符串；为空时回退为占位符
   * @returns 包含日期与小时分钟的本地化时间文本；无值时返回 `-`
   */
  function formatDateTime(dateStr: string | null | undefined): string {
    if (!dateStr) return '-'
    const date = new Date(dateStr)
    return `${date.toLocaleDateString(intlLocale.value)} ${date.toLocaleTimeString(intlLocale.value, {
      hour: '2-digit',
      minute: '2-digit',
    })}`
  }

  /**
   * 按当前语言为数字添加千分位分隔格式。
   *
   * @param value - 需要展示的金额或数量值，允许数字与数字字符串
   * @returns 适合界面展示的本地化数字文本
   */
  function formatNumber(value: number | string): string {
    return Number(value).toLocaleString(intlLocale.value)
  }

  /**
   * 按当前语言拼接货币前缀并输出带千分位的金额文本。
   *
   * @param value - 需要展示的金额值，允许数字与数字字符串
   * @param prefix - 货币前缀，默认使用日元符号
   * @returns 带货币前缀的本地化金额文本
   */
  function formatCurrency(value: number | string, prefix = '¥ '): string {
    return `${prefix}${formatNumber(value)}`
  }

  return {
    intlLocale,
    formatDate,
    formatDateTime,
    formatNumber,
    formatCurrency,
  }
}
