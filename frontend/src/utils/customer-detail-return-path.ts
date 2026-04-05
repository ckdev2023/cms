import type { LocationQuery } from 'vue-router'

import { customerCenterTabDefs } from '@/layouts/customer-center-tabs.config'
import { VISA_CASE_IMPORT_LOCAL_UUID_RE } from '@/utils/visa-case-import-csv-local-helpers'
import {
  pickVisaReminderListQueryPreserve,
  reminderTypeFromQuery,
} from '@/utils/visa-reminder-route-query'

/**
 * 客户详情 URL 上与 `ccFrom` 并行的「pathname 级」返回锚点键，供 `goBack` 优先消费并合并可恢复筛选 query。
 */
export const CUSTOMER_DETAIL_RETURN_FROM_QUERY_KEY = 'from' as const

const CUSTOMER_CENTER_HUB_PATHS: ReadonlySet<string> = new Set(
  customerCenterTabDefs.map((d) => d.fullPath),
)

/**
 * 判断路径是否为客户主档详情 `/customers/:customerId`（UUID）。
 *
 * @param pathname - 已规范化的 pathname
 * @returns 匹配受控 UUID 格式时返回 true
 */
function pathnameIsCustomerProfileDetail(pathname: string): boolean {
  const m = pathname.match(/^\/customers\/([^/]+)$/u)
  return m !== null && VISA_CASE_IMPORT_LOCAL_UUID_RE.test(m[1])
}

/**
 * 判断路径是否为行政案件详情 `/customers/admin-cases/:id`。
 *
 * @param pathname - 已规范化的 pathname
 * @returns 案件 ID 段为合法 UUID 时返回 true
 */
function pathnameIsAdminCaseDetail(pathname: string): boolean {
  const m = pathname.match(/^\/customers\/admin-cases\/([^/]+)$/u)
  return m !== null && VISA_CASE_IMPORT_LOCAL_UUID_RE.test(m[1])
}

/**
 * 判断路径是否为税務契約详情 `/tax-contracts/:id`。
 *
 * @param pathname - 已规范化的 pathname
 * @returns 契约 ID 为合法 UUID 时返回 true
 */
function pathnameIsTaxContractDetail(pathname: string): boolean {
  const m = pathname.match(/^\/tax-contracts\/([^/]+)$/u)
  return m !== null && VISA_CASE_IMPORT_LOCAL_UUID_RE.test(m[1])
}

/**
 * 判断路径是否为财务模块下单据详情（请求书/入金/预金）。
 *
 * @param pathname - 已规范化的 pathname
 * @returns 匹配已知前缀且末段为 UUID 时返回 true
 */
function pathnameIsFinanceDetail(pathname: string): boolean {
  const prefixes = ['/finance/invoices/', '/finance/payments/', '/finance/deposits/'] as const
  for (const prefix of prefixes) {
    if (!pathname.startsWith(prefix)) {
      continue
    }
    const rest = pathname.slice(prefix.length)
    if (rest.includes('/')) {
      continue
    }
    return VISA_CASE_IMPORT_LOCAL_UUID_RE.test(rest)
  }
  return false
}

/**
 * 校验 pathname 是否可作为客户详情「返回」落点，防止开放重定向。
 *
 * @param raw - 通常来自 `query.from` 或 `history.state.back` 经剥离后的 pathname
 * @returns 白名单通过时返回规范化 pathname；否则返回 null
 */
export function parseSafeCustomerDetailReturnPath(raw: string): string | null {
  const trimmed = raw.trim()
  if (trimmed === '' || !trimmed.startsWith('/') || trimmed.startsWith('//')) {
    return null
  }
  if (trimmed.includes('..')) {
    return null
  }
  const noHash = trimmed.split('#')[0] ?? trimmed
  const pathname = (noHash.split('?')[0] ?? noHash).trim()
  if (pathname === '/dashboard') {
    return pathname
  }
  if (CUSTOMER_CENTER_HUB_PATHS.has(pathname)) {
    return pathname
  }
  if (
    pathnameIsCustomerProfileDetail(pathname) ||
    pathnameIsAdminCaseDetail(pathname) ||
    pathnameIsTaxContractDetail(pathname) ||
    pathnameIsFinanceDetail(pathname)
  ) {
    return pathname
  }
  return null
}

/**
 * 从当前路由 query 提取返回 Hub/列表时应保留的片段（`dataScope`、`reminderType`、在留筛选等）。
 *
 * @param query - 一般为详情页 `route.query`
 * @returns 可合并进 `router.push` 的扁平 query
 */
export function pickCustomerHubReturnQueryPreserve(
  query: LocationQuery,
): Record<string, string> {
  const out: Record<string, string> = { ...pickVisaReminderListQueryPreserve(query) }
  const rt = reminderTypeFromQuery(query.reminderType)
  if (rt) {
    out.reminderType = rt
  }
  const red = query.residenceExpireWithinDays
  if (typeof red === 'string' && /^\d{1,4}$/u.test(red)) {
    out.residenceExpireWithinDays = red
  }
  return out
}

/**
 * 生成写入客户详情跳转的 `from` query 片段（pathname 须通过 `parseSafeCustomerDetailReturnPath`）。
 *
 * @param returnPathname - 进入详情前所在页的 `route.path`
 * @returns 含 `from` 的对象；无法通过校验时返回空对象
 */
export function buildCustomerDetailReturnFromQuery(
  returnPathname: string,
): Record<string, string> {
  const safe = parseSafeCustomerDetailReturnPath(returnPathname)
  if (!safe) {
    return {}
  }
  return { [CUSTOMER_DETAIL_RETURN_FROM_QUERY_KEY]: safe }
}
