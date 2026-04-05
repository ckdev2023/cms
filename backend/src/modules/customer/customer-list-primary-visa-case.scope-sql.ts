import type { ResolvedVisaDataScope } from '../visa-case/visa-case-data-scope.types';

/**
 * 为客户列表「主展示案件」原生 SQL 追加 `assigned_to` 范围谓词，与 `buildVisaCaseDataScopeExistsFragment` 语义一致（蛇形列名）。
 *
 * @param tableAlias - 子查询内 `visa_cases` 别名（如 `vc`）
 * @param resolved - `VisaCaseDataScopeService.resolve` 结果
 * @returns 以 ` AND …` 开头的片段与按顺序追加的占位参数值（用于 `$4` 起）
 */
export function buildPrimaryVisaCaseRawScopeClause(
  tableAlias: string,
  resolved: ResolvedVisaDataScope,
): { sql: string; paramValues: unknown[] } {
  if (resolved.mode === 'all') {
    return { sql: '', paramValues: [] };
  }
  if (resolved.mode === 'mine') {
    return {
      sql: ` AND ${tableAlias}.assigned_to = $4`,
      paramValues: [resolved.userId],
    };
  }
  return {
    sql: ` AND (${tableAlias}.assigned_to = $4 OR (${tableAlias}.assigned_to IS NOT NULL AND ${tableAlias}.assigned_to = ANY($5::uuid[])))`,
    paramValues: [resolved.currentUserId, resolved.teamAssigneeIds],
  };
}
