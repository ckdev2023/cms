import { computed, type ComputedRef } from 'vue'
import { useI18n } from 'vue-i18n'

import { allMenuItems } from '@/layouts/main-layout-menu.config'
import {
  filterVisibleMainLayoutMenuItems,
  localizeMainLayoutMenuItems,
  visaMenuDefaultOpenedsFromItems,
} from '@/layouts/main-layout-menu.logic'
import type { LocalizedMenuItem, MenuItem } from '@/layouts/main-layout-menu.types'
import { useUserStore } from '@/stores/user'

/**
 * 根据当前用户权限与签证域构建期开关，计算侧栏可见菜单及 i18n 后的展示结构。
 *
 * @returns 含 `localizedMenuItems` 与 `visaMenuDefaultOpeneds` 的计算属性引用
 */
export function useMainLayoutMenu(): {
  localizedMenuItems: ComputedRef<LocalizedMenuItem[]>
  visaMenuDefaultOpeneds: ComputedRef<string[]>
} {
  const userStore = useUserStore()
  const { t } = useI18n({ useScope: 'global' })

  const menuItems = computed<MenuItem[]>(() =>
    filterVisibleMainLayoutMenuItems(allMenuItems, (perms) => {
      if (!perms?.length) {return true}
      return perms.some((p) => userStore.hasPermission(p))
    }),
  )

  const localizedMenuItems = computed(() => localizeMainLayoutMenuItems(menuItems.value, t))

  const visaMenuDefaultOpeneds = computed(() => visaMenuDefaultOpenedsFromItems(menuItems.value))

  return { localizedMenuItems, visaMenuDefaultOpeneds }
}
