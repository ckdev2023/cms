import { VisaDataScope } from '@/constants/enums'
import { P } from '@/constants/permissions'

/**
 * 将路由或表单中的原始值解析为 `VisaDataScope`，非法时返回 `undefined` 以交由缺省与收窄逻辑处理。
 *
 * @param raw - `route.query.dataScope` 等原始输入（可为数组）
 * @returns 小写枚举值或无法识别时 `undefined`
 */
export function parseVisaDataScopeQuery(raw: unknown): VisaDataScope | undefined {
  if (raw === undefined || raw === null || raw === '') {
    return undefined
  }
  if (Array.isArray(raw)) {
    return parseVisaDataScopeQuery(raw[0])
  }
  if (typeof raw !== 'string') {
    return undefined
  }
  const lower = raw.trim().toLowerCase()
  const allowed = new Set<string>(Object.values(VisaDataScope))
  if (!allowed.has(lower)) {
    return undefined
  }
  return lower as VisaDataScope
}

/**
 * 按 RBAC 权限码计算当前用户在签证域可选的最宽数据范围（与后端 `VisaCaseDataScopePermissionService` 对齐）。
 *
 * @param hasPermission - 与 `useUserStore().hasPermission` 同构的校验函数
 * @returns 最宽允许的 `VisaDataScope`
 */
export function getMaxAllowedVisaDataScope(
  hasPermission: (code: string) => boolean,
): VisaDataScope {
  if (hasPermission('*')) {
    return VisaDataScope.ALL
  }
  if (hasPermission('visaCase:*')) {
    return VisaDataScope.ALL
  }
  const hasExplicit =
    hasPermission(P.VISA_CASE_DATA_SCOPE_ALL) ||
    hasPermission(P.VISA_CASE_DATA_SCOPE_TEAM) ||
    hasPermission(P.VISA_CASE_DATA_SCOPE_MINE)
  if (!hasExplicit) {
    return VisaDataScope.ALL
  }
  if (hasPermission(P.VISA_CASE_DATA_SCOPE_ALL)) {
    return VisaDataScope.ALL
  }
  if (hasPermission(P.VISA_CASE_DATA_SCOPE_TEAM)) {
    return VisaDataScope.TEAM
  }
  return VisaDataScope.MINE
}

/**
 * 将范围档位映射为可比较的宽度序号，`all` 最宽。
 *
 * @param scope - 数据范围枚举
 * @returns 越大表示可见数据集越宽
 */
export function visaDataScopeWideness(scope: VisaDataScope): number {
  switch (scope) {
    case VisaDataScope.MINE:
      return 0
    case VisaDataScope.TEAM:
      return 1
    case VisaDataScope.ALL:
      return 2
    default:
      return 0
  }
}

/**
 * 将请求范围限制在用户授权上限之内；缺省请求按「全部」理解后再收窄。
 *
 * @param requested - Query 解析结果，缺省视为 `ALL`
 * @param max - 当前用户允许的最宽范围
 * @returns 可安全传给接口的枚举值
 */
export function clampVisaDataScope(
  requested: VisaDataScope | undefined,
  max: VisaDataScope,
): VisaDataScope {
  const req = requested ?? VisaDataScope.ALL
  if (visaDataScopeWideness(req) > visaDataScopeWideness(max)) {
    return max
  }
  return req
}

/**
 * 根据路由 query 的 `dataScope` 与用户 RBAC 上限解析最终范围，与 `useVisaDataScopeRoute` 的 `dataScopeForApi` 一致且不触发路由改写。
 *
 * 缺省 query 先按「全部」理解再收窄到授权上限，故仅具备本人范围权限时得到 `mine`。
 *
 * @param queryDataScope - `route.query.dataScope` 原始值（可为数组）
 * @param hasPermission - 与 `useUserStore().hasPermission` 同构的校验函数
 * @returns 可安全传给签证域列表与聚合接口的枚举值
 */
export function resolveEffectiveVisaDataScope(
  queryDataScope: unknown,
  hasPermission: (code: string) => boolean,
): VisaDataScope {
  const max = getMaxAllowedVisaDataScope(hasPermission)
  const parsed = parseVisaDataScopeQuery(queryDataScope)
  return clampVisaDataScope(parsed, max)
}

/**
 * 列出不超过授权上限的全部可选档位（由窄到宽），供分段控件渲染。
 *
 * @param max - 当前用户允许的最宽范围
 * @returns 可选的 `VisaDataScope` 数组
 */
export function selectableVisaDataScopes(max: VisaDataScope): VisaDataScope[] {
  const order = [VisaDataScope.MINE, VisaDataScope.TEAM, VisaDataScope.ALL]
  return order.filter((s) => visaDataScopeWideness(s) <= visaDataScopeWideness(max))
}
