import type { LocationQuery, RouteLocationNormalizedLoaded, RouteLocationRaw } from 'vue-router'

import {
  buildCustomerDetailReturnFromQuery,
  CUSTOMER_DETAIL_RETURN_FROM_QUERY_KEY,
  parseSafeCustomerDetailReturnPath,
  pickCustomerHubReturnQueryPreserve,
} from '@/utils/customer-detail-return-path'

/**
 * 客户详情「返回」锚点：列表/工作台等写入来源 `fullPath`（含 query），供 `goBack` 与深链保留；键名 `ccFrom` 与 `query.from`（pathname）并行。
 */
export const CUSTOMER_DETAIL_RETURN_QUERY_KEY = 'ccFrom' as const

/**
 * 判断字符串是否为可安全写入 `ccFrom` 的站内 `fullPath`（pathname 须通过白名单；禁止外链与路径穿越）。
 *
 * @param fullPath - 通常为 `route.fullPath`，可含 query
 * @returns 允许作为返回目标时为 true
 */
export function isSafeCustomerDetailReturnPath(fullPath: string): boolean {
  if (typeof fullPath !== 'string' || fullPath.length === 0) {
    return false
  }
  if (fullPath.length > 2048) {
    return false
  }
  if (!fullPath.startsWith('/') || fullPath.startsWith('//')) {
    return false
  }
  if (fullPath.includes('..')) {
    return false
  }
  const lower = fullPath.toLowerCase()
  if (lower.includes('://')) {
    return false
  }
  if (lower.startsWith('/\\') || lower.includes('%2e%2e')) {
    return false
  }
  const pathname = fullPath.split('?')[0]?.split('#')[0] ?? ''
  return parseSafeCustomerDetailReturnPath(pathname) !== null
}

/**
 * 将 `ccFrom` 中 `?` 后的片段解析为扁平对象，供 `pickCustomerHubReturnQueryPreserve` 过滤。
 *
 * @param search - `fullPath` 去掉 pathname 后的 query 段（不含 `?`）
 * @returns 供白名单过滤用的类 `LocationQuery` 对象
 */
function locationQueryFromReturnSearchString(search: string): LocationQuery {
  if (!search) {
    return {}
  }
  const flat: LocationQuery = {}
  for (const [k, v] of new URLSearchParams(search)) {
    if (v !== '') {
      flat[k] = v
    }
  }
  return flat
}

/**
 * 从详情页路由 query 解析返回目标；pathname 白名单通过后仅恢复允许的 query 键。
 *
 * @param query - 当前客户详情路由的 `query`
 * @returns 可传入 `router.push` 的对象；非法或缺失时返回 null
 */
export function parseCustomerDetailReturnTarget(query: LocationQuery): RouteLocationRaw | null {
  const raw = query[CUSTOMER_DETAIL_RETURN_QUERY_KEY]
  const s =
    typeof raw === 'string'
      ? raw
      : Array.isArray(raw) && typeof raw[0] === 'string'
        ? raw[0]
        : ''
  if (!s) {
    return null
  }
  const pathnameOnly = s.split('?')[0]?.split('#')[0] ?? ''
  if (!pathnameOnly.startsWith('/') || pathnameOnly.includes('..')) {
    return null
  }
  const pathSafe = parseSafeCustomerDetailReturnPath(pathnameOnly)
  if (!pathSafe) {
    return null
  }
  const qIdx = s.indexOf('?')
  const search = qIdx === -1 ? '' : (s.slice(qIdx + 1).split('#')[0] ?? '')
  const preserved = pickCustomerHubReturnQueryPreserve(locationQueryFromReturnSearchString(search))
  return Object.keys(preserved).length > 0 ? { path: pathSafe, query: preserved } : { path: pathSafe }
}

/**
 * 将来源页 `fullPath`（或覆盖值）写入待跳转详情的 `ccFrom`，并写入受信 `query.from`（pathname）。
 *
 * @param query - 目标详情 `router.push` 的 query 对象（就地写入）
 * @param fromRoute - 来源页 `useRoute()` 返回值
 * @param options - 可选覆盖项
 * @param options.overrideFullPath - 从客户 A 链向客户 B 时写入 A 的 profile `fullPath` 作为 `ccFrom`
 */
export function mergeCustomerDetailReturnQuery(
  query: Record<string, string>,
  fromRoute: RouteLocationNormalizedLoaded,
  options?: { overrideFullPath?: string },
): void {
  const fp = options?.overrideFullPath ?? fromRoute.fullPath
  if (!isSafeCustomerDetailReturnPath(fp)) {
    return
  }
  query[CUSTOMER_DETAIL_RETURN_QUERY_KEY] = fp
  Object.assign(query, buildCustomerDetailReturnFromQuery(fromRoute.path))
}

/**
 * 深链至签证域子块时保留 `dataScope` / `assignedTo` / 在留筛选以及 `ccFrom`、`from`（若原 URL 已带且安全）。
 *
 * @param query - 通常为详情页 `route.query`
 * @returns 扁平 query 片段，可直接 spread 进新的 `router.push`
 */
export function pickCustomerDetailDeepLinkPreserve(query: LocationQuery): Record<string, string> {
  const out = pickCustomerHubReturnQueryPreserve(query)
  const rawCc = query[CUSTOMER_DETAIL_RETURN_QUERY_KEY]
  const sCc =
    typeof rawCc === 'string'
      ? rawCc
      : Array.isArray(rawCc) && typeof rawCc[0] === 'string'
        ? rawCc[0]
        : ''
  if (sCc && isSafeCustomerDetailReturnPath(sCc)) {
    out[CUSTOMER_DETAIL_RETURN_QUERY_KEY] = sCc
  }
  const rawFrom = query[CUSTOMER_DETAIL_RETURN_FROM_QUERY_KEY]
  const sFrom =
    typeof rawFrom === 'string'
      ? rawFrom
      : Array.isArray(rawFrom) && typeof rawFrom[0] === 'string'
        ? rawFrom[0]
        : ''
  const pathFrom = sFrom ? parseSafeCustomerDetailReturnPath(sFrom) : null
  if (pathFrom) {
    out[CUSTOMER_DETAIL_RETURN_FROM_QUERY_KEY] = pathFrom
  }
  return out
}

/**
 * 判断 `history.state.back` 是否指向受信站内页，以便在无 `ccFrom`/`from` 时安全使用 `router.back()`。
 *
 * @param raw - `window.history.state.back`
 * @param currentFullPath - 当前详情页 `route.fullPath`
 * @returns 可调用 `router.back()` 时返回 true
 */
export function isTrustedCustomerDetailHistoryBack(
  raw: unknown,
  currentFullPath: string,
): boolean {
  if (typeof raw !== 'string' || raw === currentFullPath) {
    return false
  }
  let pathPart = raw
  try {
    if (/^[a-z][a-z0-9+.-]*:\/\//iu.test(raw)) {
      pathPart = new URL(raw).pathname
    }
  } catch {
    return false
  }
  const pathname = pathPart.split('?')[0]?.split('#')[0] ?? ''
  return parseSafeCustomerDetailReturnPath(pathname) !== null
}
