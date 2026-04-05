import { Brackets, type ObjectLiteral, SelectQueryBuilder } from 'typeorm';

import type { ResolvedVisaDataScope } from './visa-case-data-scope.types';

/**
 * 在已 alias 的签证案件 QueryBuilder 上追加 `assigned_to` 数据范围条件（mine / team / all）。
 *
 * @param qb - TypeORM 查询构造器
 * @param alias - `visa_cases` 根别名（如 `vc`）
 * @param resolved - `VisaCaseDataScopeService.resolve` 的解析结果
 * @param paramPrefix - 绑定参数名前缀，避免同条查询内与其它条件冲突
 */
export function applyVisaCaseDataScopeToQueryBuilder(
  qb: SelectQueryBuilder<ObjectLiteral>,
  alias: string,
  resolved: ResolvedVisaDataScope,
  paramPrefix: string,
): void {
  if (resolved.mode === 'all') {
    return;
  }
  if (resolved.mode === 'mine') {
    qb.andWhere(`${alias}.assignedTo = :${paramPrefix}Mine`, {
      [`${paramPrefix}Mine`]: resolved.userId,
    });
    return;
  }
  qb.andWhere(
    new Brackets((w) => {
      w.where(`${alias}.assignedTo = :${paramPrefix}Self`, {
        [`${paramPrefix}Self`]: resolved.currentUserId,
      }).orWhere(
        new Brackets((inner) => {
          inner
            .where(`${alias}.assignedTo IS NOT NULL`)
            .andWhere(`${alias}.assignedTo IN (:...${paramPrefix}Team)`);
        }),
      );
    }),
  );
  qb.setParameter(`${paramPrefix}Team`, resolved.teamAssigneeIds);
}

/**
 * 生成追加在 EXISTS 子查询 WHERE 中的 `assigned_to` 范围片段（蛇形列名，供原生 SQL 使用）。
 *
 * 性能：`visa_cases (customer_id, assigned_to)` 开放案件部分索引
 * `IDX_visa_cases_customer_assigned_open`（见 migration `1776300000000`）与
 * `customer_id` + `assigned_to` 等值/IN 条件可组合使用；调整谓词语义时请核对索引 WHERE。
 *
 * @param tableAlias - 子查询内表别名（如 `vf`）
 * @param resolved - 解析后的数据范围
 * @param paramPrefix - QueryBuilder `setParameter` 键前缀
 * @returns 以 ` AND …` 开头或空的 SQL 片段及待合并参数
 */
export function buildVisaCaseDataScopeExistsFragment(
  tableAlias: string,
  resolved: ResolvedVisaDataScope,
  paramPrefix: string,
): { sql: string; params: Record<string, unknown> } {
  if (resolved.mode === 'all') {
    return { sql: '', params: {} };
  }
  if (resolved.mode === 'mine') {
    return {
      sql: ` AND ${tableAlias}.assigned_to = :${paramPrefix}Mine`,
      params: { [`${paramPrefix}Mine`]: resolved.userId },
    };
  }
  return {
    sql: ` AND (${tableAlias}.assigned_to = :${paramPrefix}Uid OR (${tableAlias}.assigned_to IS NOT NULL AND ${tableAlias}.assigned_to IN (:...${paramPrefix}Team)))`,
    params: {
      [`${paramPrefix}Uid`]: resolved.currentUserId,
      [`${paramPrefix}Team`]: resolved.teamAssigneeIds,
    },
  };
}
