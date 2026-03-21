import type { Directive, DirectiveBinding } from 'vue'
import { useUserStore } from '@/stores/user'

function checkPermission(el: HTMLElement, binding: DirectiveBinding) {
  const userStore = useUserStore()
  const value = binding.value as string | string[] | undefined

  if (!value) return

  const required = Array.isArray(value) ? value : [value]
  if (!required.length) return

  const hasAny = required.some((p) => userStore.hasPermission(p))
  if (!hasAny) {
    el.parentNode?.removeChild(el)
  }
}

export const permissionDirective: Directive = {
  mounted(el: HTMLElement, binding: DirectiveBinding) {
    checkPermission(el, binding)
  },
  updated(el: HTMLElement, binding: DirectiveBinding) {
    if (binding.value !== binding.oldValue) {
      checkPermission(el, binding)
    }
  },
}
