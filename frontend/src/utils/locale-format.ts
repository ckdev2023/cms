import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

function getIntlLocale(appLocale: string) {
  return appLocale === 'zh-CN' ? 'zh-CN' : 'ja-JP'
}

export function useLocaleFormatter() {
  const { locale } = useI18n()

  const intlLocale = computed(() => getIntlLocale(locale.value))

  function formatDate(dateStr: string | null | undefined) {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString(intlLocale.value)
  }

  function formatDateTime(dateStr: string | null | undefined) {
    if (!dateStr) return '-'
    const date = new Date(dateStr)
    return `${date.toLocaleDateString(intlLocale.value)} ${date.toLocaleTimeString(intlLocale.value, {
      hour: '2-digit',
      minute: '2-digit',
    })}`
  }

  function formatNumber(value: number | string) {
    return Number(value).toLocaleString(intlLocale.value)
  }

  function formatCurrency(value: number | string, prefix = '¥ ') {
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
