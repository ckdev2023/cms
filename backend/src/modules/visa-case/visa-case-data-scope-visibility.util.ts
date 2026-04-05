import type { ResolvedVisaDataScope } from './visa-case-data-scope.types';

/**
 * 判断单条签证案件行的 `assigned_to` 是否落入已解析的数据范围（与 QueryBuilder 条件语义一致）。
 *
 * @param assignedTo - 案件负责人用户 id；未指派时为 null
 * @param resolved - `VisaCaseDataScopeService.resolve` 的输出
 * @returns 该行对当前用户可见（可读/可筛）时返回 true
 */
export function isVisaCaseAssignedRowInResolvedScope(
  assignedTo: string | null,
  resolved: ResolvedVisaDataScope,
): boolean {
  if (resolved.mode === 'all') {
    return true;
  }
  if (resolved.mode === 'mine') {
    return assignedTo !== null && assignedTo === resolved.userId;
  }
  const { currentUserId, teamAssigneeIds } = resolved;
  if (assignedTo === currentUserId) {
    return true;
  }
  if (assignedTo === null) {
    return false;
  }
  return teamAssigneeIds.includes(assignedTo);
}
