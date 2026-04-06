import type { LocationQuery } from 'vue-router'

import { parseVisaDomainBlockFromLocationHash } from '@/utils/customer-detail-visa-domain-deeplink'

/**
 * 读取路由 query 中指定键的首个非空字符串（忽略空串与重复键中的空值）。
 *
 * @param query - Vue Router `LocationQuery`
 * @param key - query 键名
 * @returns 非空字符串；缺失或为空时返回空串
 */
function firstNonEmptyQueryString(query: LocationQuery, key: string): string {
  const v = query[key]
  if (typeof v === 'string' && v !== '') {
    return v
  }
  if (Array.isArray(v) && typeof v[0] === 'string' && v[0] !== '') {
    return v[0]
  }
  return ''
}

/**
 * 判断访问 `/customers/:id`（非 `/simple`）时是否必须挂载标准 Tab 详情页而非跳转简化 Stitch 详情。
 *
 * 与 `CustomerDetailView` 消费的 query、`#visa-domain-*` hash 深链对齐；存在任一键时保留标准详情，以兼容列表快捷列、工作台、新建主档后签证引导等入口。
 *
 * @param query - 目标路由的 `LocationQuery`
 * @param hash - 目标路由的 `hash`（含 `#` 前缀）
 * @returns 需要标准详情时为 true；否则可安全重定向至 `/customers/:id/simple`
 */
export function customerDetailRouteRequiresFullPage(query: LocationQuery, hash: string): boolean {
  if (firstNonEmptyQueryString(query, 'tab')) {
    return true
  }
  const deepKeys = [
    'visaDomainBlock',
    'openVisaCaseId',
    'logVisaCaseId',
    'openVisaCaseWizard',
    'openVisaCaseLogForm',
    'suggestedNextFollowUpAt',
    'materialsVisaCaseId',
  ] as const
  for (const k of deepKeys) {
    if (firstNonEmptyQueryString(query, k)) {
      return true
    }
  }
  return parseVisaDomainBlockFromLocationHash(hash) !== null
}
