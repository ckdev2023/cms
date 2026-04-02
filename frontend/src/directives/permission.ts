import type { Directive, DirectiveBinding } from 'vue'

import { useUserStore } from '@/stores/user'

type PermissionBindingValue = string | string[] | undefined

const PERMISSION_DISPLAY_KEY = 'permissionDisplay'

/**
 * 将指令绑定值整理为可校验的权限码列表，并过滤空白权限项。
 *
 * @param value - `v-permission` 传入的单个权限码或权限码数组，省略时视为不限制
 * @returns 去除空字符串后的权限码列表；为空数组时表示无需执行权限隐藏
 */
function normalizeRequiredPermissions(value: PermissionBindingValue): string[] {
  if (!value) {
    return []
  }

  return (Array.isArray(value) ? value : [value])
    .map((permission) => permission.trim())
    .filter((permission) => permission.length > 0)
}

/**
 * 根据权限校验结果切换元素显隐，并保留原始 display 样式以便恢复。
 *
 * 副作用：会修改目标元素的 `style.display` 与 `dataset.permissionDisplay`。
 *
 * @param el - 需要根据权限控制显隐状态的 DOM 元素
 * @param canAccess - 当前用户是否具备访问该元素所需的任一权限
 */
function toggleElementVisibility(el: HTMLElement, canAccess: boolean): void {
  if (canAccess) {
    const originalDisplay = el.dataset[PERMISSION_DISPLAY_KEY]
    if (originalDisplay !== undefined) {
      el.style.display = originalDisplay
      delete el.dataset[PERMISSION_DISPLAY_KEY]
    }
    return
  }

  if (el.dataset[PERMISSION_DISPLAY_KEY] === undefined) {
    el.dataset[PERMISSION_DISPLAY_KEY] = el.style.display
  }
  el.style.display = 'none'
}

/**
 * 根据当前用户权限刷新指令元素的可见状态，支持单权限和多权限任一命中。
 *
 * @param el - 绑定 `v-permission` 的 DOM 元素
 * @param binding - Vue 指令绑定对象，`value` 中携带需要校验的权限码
 */
function applyPermissionState(
  el: HTMLElement,
  binding: DirectiveBinding<PermissionBindingValue>,
): void {
  const requiredPermissions = normalizeRequiredPermissions(binding.value)
  if (requiredPermissions.length === 0) {
    toggleElementVisibility(el, true)
    return
  }

  const userStore = useUserStore()
  const canAccess = requiredPermissions.some((permission) => userStore.hasPermission(permission))
  toggleElementVisibility(el, canAccess)
}

export const permissionDirective: Directive<HTMLElement, PermissionBindingValue> = {
  mounted(el, binding) {
    applyPermissionState(el, binding)
  },
  updated(el, binding) {
    applyPermissionState(el, binding)
  },
}
