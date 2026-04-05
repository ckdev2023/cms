/**
 * 解析后的签证数据范围，供 QueryBuilder 与原生 EXISTS 子查询共用同一套语义。
 */
export type ResolvedVisaDataScope =
  | { mode: 'all' }
  | { mode: 'mine'; userId: string }
  | {
      mode: 'team';
      currentUserId: string;
      teamAssigneeIds: string[];
    };
