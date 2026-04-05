import type { ComputedRef, Ref } from 'vue'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  type CustomerListColumnPresetId,
  normalizeCustomerListColumnPresetId,
} from '@/constants/customer-list-column-presets'

const STORAGE_KEY = 'cms.customerList.columnPreset.v1'

/**
 * 从浏览器 `localStorage` 读取客户列表列预设并容错解析。
 *
 * @returns 紧凑 / 标准 / 完整之一；SSR 或读取失败时为 `standard`
 */
function readStoredCustomerListColumnPreset(): CustomerListColumnPresetId {
  if (typeof window === 'undefined') {
    return 'standard'
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return normalizeCustomerListColumnPresetId(raw)
  } catch {
    return 'standard'
  }
}

/**
 * 将客户列表列预设写入 `localStorage`，写入失败时静默忽略。
 *
 * @param preset - 当前选中的预设
 */
function persistCustomerListColumnPreset(
  preset: CustomerListColumnPresetId,
): void {
  if (typeof window === 'undefined') {
    return
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, preset)
  } catch {
    // 私密模式或配额不足时不阻断界面
  }
}

/**
 * 管理客户列表表格列显示预设（紧凑 / 标准 / 完整）及本机持久化，供列表页下拉切换。
 *
 * @returns 当前预设 ref、供 `el-option` 使用的选项列表
 */
export function useCustomerListColumnPreset(): {
  preset: Ref<CustomerListColumnPresetId>
  presetSelectOptions: ComputedRef<
    Array<{ value: CustomerListColumnPresetId; label: string }>
  >
} {
  const { t } = useI18n({ useScope: 'global' })
  const preset = ref<CustomerListColumnPresetId>(
    readStoredCustomerListColumnPreset(),
  )

  watch(
    preset,
    (v) => {
      persistCustomerListColumnPreset(v)
    },
    { flush: 'post' },
  )

  const presetSelectOptions = computed(() => [
    {
      value: 'compact' as const,
      label: t('pages.customers.columnPresetCompact'),
    },
    {
      value: 'standard' as const,
      label: t('pages.customers.columnPresetStandard'),
    },
    {
      value: 'full' as const,
      label: t('pages.customers.columnPresetFull'),
    },
  ])

  return { preset, presetSelectOptions }
}
