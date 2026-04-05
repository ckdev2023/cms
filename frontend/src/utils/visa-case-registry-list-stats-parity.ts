import type { VisaDataScope } from '@/constants/enums'
import type { GlobalVisaCaseQueryParams, VisaDomainStatsQueryParams } from '@/types/visa-case'

/**
 * 组装登记册 StatsPanel 与 `getVisaDomainStats` 使用的查询参数：与 `getGlobalVisaCases` 同一套筛选字段
 * 及 `dataScope`（无 `page` / `pageSize`），与后端 `QueryVisaCaseStatsDto` 及 `docs/25` §12 列表—统计对账一致。
 *
 * **手测清单（C1-frontend-registry-smoke）**
 * - 变更任意筛选（状态、负责人、材料、日期、提醒桶等）后，DevTools 中 `GET /visa-cases` 与 `GET /visa-cases/stats`
 *   的 query 除 `page` / `pageSize` 外应一致，且均含当前 `dataScope`。
 * - 切换数据范围分段后，上述两请求均携带相同 `dataScope` 并重载成功。
 * - 带筛选书签刷新 `/visa-cases?...` 后，表格与统计区同时反映相同筛选（与 `useVisaDataScopeRoute` 一致）。
 *
 * @param search - `useProTable` 保存的检索条件（通常不含分页字段）
 * @param dataScope - 与列表请求注入的 `dataScope` 相同
 * @returns 传入 `getVisaDomainStats` 的扁平参数对象
 */
export function buildVisaRegistryStatsQueryParams(
  search: Partial<GlobalVisaCaseQueryParams>,
  dataScope: VisaDataScope,
): VisaDomainStatsQueryParams {
  return { ...search, dataScope }
}
