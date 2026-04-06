import { computed } from 'vue'
import { useRoute } from 'vue-router'

import { resolveCustomerDetailSimpleBackMessageKey } from '@/utils/customer-detail-return-navigation'

/**
 * 简化客户详情页「返回」按钮的 i18n 消息键，与 `CustomerDetailSimpleView` 的 `goBack` 落点判断对齐。
 *
 * @returns 供全局 `t()` 使用的完整消息键（`ComputedRef<string>`）
 */
export function useCustomerSimpleDetailBackLabel() {
  const route = useRoute()
  return computed((): string =>
    resolveCustomerDetailSimpleBackMessageKey(
      route.query,
      typeof window !== 'undefined' ? window.history.state?.back : undefined,
      route.fullPath,
    ),
  )
}
