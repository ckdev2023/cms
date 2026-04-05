import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  FamilyLinkMode,
  MaterialStatus,
  VisaCaseStatus,
} from '../../common/constants/enums';
import { VisaCase } from '../visa-case/entities/visa-case.entity';
import { computeSuggestedMaterialStatusFromChecklistCounts } from '../visa-case/material-checklist-suggested-status.util';
import type { ResolvedVisaDataScope } from '../visa-case/visa-case-data-scope.types';
import type { CustomerListPrimaryVisaCaseSummaryDto } from './customer.service.types';
import { buildPrimaryVisaCaseRawScopeClause } from './customer-list-primary-visa-case.scope-sql';

const COMPLETED = VisaCaseStatus.COMPLETED;
const CANCELLED = VisaCaseStatus.CANCELLED;

/**
 * 按 `docs/17` §1.11：在 **当前列表 `dataScope` 可见的签证案件集合** 内选取主展示行；排序键不含负责人；与 `visaDerivedRisk` 聚合同源范围。
 */
@Injectable()
export class CustomerListPrimaryVisaCaseService {
  constructor(
    @InjectRepository(VisaCase)
    private readonly visaCaseRepo: Repository<VisaCase>,
  ) {}

  /**
   * 为当前页客户批量查询各自唯一主展示签证案件摘要，单次 DISTINCT ON 查询、不落库。
   *
   * @param customerIds - 当前页客户主键列表
   * @param resolved - 与列表派生风险一致的签证数据范围
   * @returns 客户 ID → 摘要；无 **可见** 案件时为 null；输入 ID 均会出现在 Map 中
   */
  async fetchCustomerListPrimaryVisaCaseMap(
    customerIds: string[],
    resolved: ResolvedVisaDataScope,
  ): Promise<Map<string, CustomerListPrimaryVisaCaseSummaryDto | null>> {
    const map = new Map<string, CustomerListPrimaryVisaCaseSummaryDto | null>();
    for (const id of customerIds) {
      map.set(id, null);
    }
    if (customerIds.length === 0) {
      return map;
    }

    const { sql: scopeSql, paramValues: scopeParams } =
      buildPrimaryVisaCaseRawScopeClause('vc', resolved);
    const rawRows = await this.queryDistinctPrimaryVisaCaseRows(
      customerIds,
      scopeSql,
      scopeParams,
    );
    if (!Array.isArray(rawRows)) {
      return map;
    }

    for (const row of rawRows) {
      if (typeof row !== 'object' || row === null) {
        continue;
      }
      const parsed = this.mapRawRow(row as Record<string, unknown>);
      if (parsed) {
        map.set(parsed.customerId, parsed.summary);
      }
    }
    return map;
  }

  /**
   * 执行主展示案件 DISTINCT ON 原始查询，含 checklist 计数子查询（与 materials/summary 同源项表）。
   *
   * @param customerIds - 客户 ID 列表
   * @param scopeSql - 数据范围片段（已含前导空格）
   * @param scopeParams - 范围绑定参数
   * @returns 驱动返回的原始行数组或非标量
   */
  private async queryDistinctPrimaryVisaCaseRows(
    customerIds: string[],
    scopeSql: string,
    scopeParams: unknown[],
  ): Promise<unknown> {
    const sqlParams: unknown[] = [
      customerIds,
      COMPLETED,
      CANCELLED,
      ...scopeParams,
    ];
    return this.visaCaseRepo.query(
      `
      SELECT DISTINCT ON (vc.customer_id)
        vc.customer_id AS "customerId",
        vc.id AS "visaCaseId",
        vc.case_type AS "caseType",
        vc.case_status AS "caseStatus",
        vc.expire_date AS "expireDate",
        vc.next_follow_up_at AS "nextFollowUpAt",
        vc.assigned_to AS "assignedToUserId",
        u.display_name AS "assignedToDisplayName",
        vc.is_family_case AS "isFamilyCase",
        vc.family_link_mode AS "familyLinkMode",
        (
          SELECT COUNT(*)::int
          FROM visa_case_family_members fm
          WHERE fm.visa_case_id = vc.id
            AND fm.is_primary = false
        ) AS "familyDependentsCount",
        vc.material_status AS "materialStatus",
        (
          SELECT COUNT(*)::int
          FROM visa_case_material_items mi
          WHERE mi.visa_case_id = vc.id
        ) AS "materialChecklistTotal",
        (
          SELECT COUNT(*)::int
          FROM visa_case_material_items mi
          WHERE mi.visa_case_id = vc.id
            AND mi.item_status = 'COLLECTED'
        ) AS "materialChecklistCollected",
        (
          SELECT COUNT(*)::int
          FROM visa_case_material_items mi
          WHERE mi.visa_case_id = vc.id
            AND mi.item_status = 'NOT_APPLICABLE'
        ) AS "materialChecklistNotApplicable"
      FROM visa_cases vc
      LEFT JOIN users u
        ON u.id = vc.assigned_to
       AND u.deleted_at IS NULL
      WHERE vc.customer_id = ANY($1::uuid[])
        AND vc.deleted_at IS NULL
        ${scopeSql}
      ORDER BY
        vc.customer_id,
        CASE WHEN vc.case_status IN ($2, $3) THEN 1 ELSE 0 END,
        (CASE WHEN vc.case_status NOT IN ($2, $3) THEN vc.next_follow_up_at END) ASC NULLS LAST,
        (CASE WHEN vc.case_status NOT IN ($2, $3) THEN vc.expire_date END) ASC NULLS LAST,
        vc.updated_at DESC,
        vc.id DESC
      `,
      sqlParams,
    );
  }

  /**
   * 将 DISTINCT ON 查询原始行映射为摘要 DTO，并解析客户主键用于写回 Map。
   *
   * @param row - `query` 返回的单行
   * @returns 客户 ID 与摘要，字段不完整时返回 undefined
   */
  private mapRawRow(
    row: Record<string, unknown>,
  ):
    | { customerId: string; summary: CustomerListPrimaryVisaCaseSummaryDto }
    | undefined {
    const customerId = this.pickRowString(row, 'customerId', 'customer_id');
    const visaCaseId =
      this.pickRowString(row, 'visaCaseId', 'visa_case_id') ??
      (typeof row.id === 'string' ? row.id : undefined);
    const caseStatus = this.pickRowString(row, 'caseStatus', 'case_status');

    if (!customerId || !visaCaseId || !caseStatus) {
      return undefined;
    }

    return {
      customerId,
      summary: this.toPrimarySummaryFromRow(row, visaCaseId, caseStatus),
    };
  }

  /**
   * 在已校验主键与状态后，将原始行其余列装配为列表主展示案件摘要 DTO。
   *
   * @param row - 查询原始行
   * @param visaCaseId - 已校验的案件 ID
   * @param caseStatus - 已校验的案件状态字符串
   * @returns 摘要 DTO
   */
  private toPrimarySummaryFromRow(
    row: Record<string, unknown>,
    visaCaseId: string,
    caseStatus: string,
  ): CustomerListPrimaryVisaCaseSummaryDto {
    const caseTypeRaw = row.caseType ?? row.case_type;
    const assignedToUserId = this.pickRowString(
      row,
      'assignedToUserId',
      'assigned_to_user_id',
    );
    const assignedToDisplayName = this.pickRowString(
      row,
      'assignedToDisplayName',
      'assigned_to_display_name',
    );

    const materialStatus = this.parseRowEnumValue(
      row.materialStatus ?? row.material_status,
      Object.values(MaterialStatus) as MaterialStatus[],
    );
    const materialChecklistTotal = this.parseRowInt(
      row.materialChecklistTotal ?? row.material_checklist_total,
    );
    const materialChecklistCollected = this.parseRowInt(
      row.materialChecklistCollected ?? row.material_checklist_collected,
    );
    const materialChecklistNotApplicable = this.parseRowInt(
      row.materialChecklistNotApplicable ??
        row.material_checklist_not_applicable,
    );
    const materialChecklistSuggestedStatus =
      computeSuggestedMaterialStatusFromChecklistCounts(
        materialChecklistCollected,
        materialChecklistNotApplicable,
        materialChecklistTotal,
      );
    const persistedForCompare = materialStatus ?? MaterialStatus.NOT_RECEIVED;
    const materialChecklistOutOfSync =
      persistedForCompare !== materialChecklistSuggestedStatus;

    return {
      visaCaseId,
      caseType: typeof caseTypeRaw === 'string' ? caseTypeRaw : null,
      caseStatus: caseStatus as VisaCaseStatus,
      expireDate: this.parsePgTemporal(row.expireDate ?? row.expire_date),
      nextFollowUpAt: this.parsePgTemporal(
        row.nextFollowUpAt ?? row.next_follow_up_at,
      ),
      assignedToUserId: assignedToUserId ?? null,
      assignedToDisplayName: assignedToDisplayName ?? null,
      isFamilyCase: this.parseRowBoolean(
        row.isFamilyCase ?? row.is_family_case,
      ),
      familyLinkMode: this.parseRowEnumValue(
        row.familyLinkMode ?? row.family_link_mode,
        Object.values(FamilyLinkMode) as FamilyLinkMode[],
      ),
      familyDependentsCount: this.parseRowInt(
        row.familyDependentsCount ?? row.family_dependents_count,
      ),
      materialStatus,
      materialChecklistTotal,
      materialChecklistCollected,
      materialChecklistNotApplicable,
      materialChecklistSuggestedStatus,
      materialChecklistOutOfSync,
    };
  }

  /**
   * 将驱动返回的整型列解析为非负整数，无法识别时按 0 处理。
   *
   * @param value - 原始列值
   * @returns 非负整数
   */
  private parseRowInt(value: unknown): number {
    if (value === null || value === undefined) {
      return 0;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return Math.max(0, Math.trunc(value));
    }
    if (typeof value === 'string' && value !== '') {
      const n = Number.parseInt(value, 10);
      return Number.isFinite(n) ? Math.max(0, n) : 0;
    }
    return 0;
  }

  /**
   * 解析驱动返回的布尔列（兼容 `boolean` / `0|1`）。
   *
   * @param value - 原始列值
   * @returns 布尔值，无法识别时为 false
   */
  private parseRowBoolean(value: unknown): boolean {
    if (value === true || value === false) {
      return value;
    }
    if (value === 1 || value === '1' || value === 't' || value === 'true') {
      return true;
    }
    return false;
  }

  /**
   * 将原始列值收窄为已知枚举字符串，否则返回 null。
   *
   * @param value - 原始列值
   * @param allowed - 允许取值的枚举成员列表
   * @returns 命中枚举或 null
   */
  private parseRowEnumValue<T extends string>(
    value: unknown,
    allowed: readonly T[],
  ): T | null {
    if (value === null || value === undefined) {
      return null;
    }
    if (typeof value !== 'string') {
      return null;
    }
    return allowed.includes(value as T) ? (value as T) : null;
  }

  /**
   * 从原始行读取 camelCase 或 snake_case 字符串列，非字符串时返回 undefined。
   *
   * @param row - 查询原始行
   * @param camelKey - 驼峰别名
   * @param snakeKey - 蛇形别名（可与 camel 相同，用于 `id` 等单列）
   * @returns 非空字符串或 undefined
   */
  private pickRowString(
    row: Record<string, unknown>,
    camelKey: string,
    snakeKey: string,
  ): string | undefined {
    const v = row[camelKey] ?? row[snakeKey];
    return typeof v === 'string' ? v : undefined;
  }

  /**
   * 将 PostgreSQL `date` / `timestamptz` 驱动返回值规范为 `Date` 或 null。
   *
   * @param value - 原始列值
   * @returns 本地可用的 Date；无法解析时为 null
   */
  private parsePgTemporal(value: unknown): Date | null {
    if (value === null || value === undefined) {
      return null;
    }
    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : value;
    }
    if (typeof value === 'string') {
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    return null;
  }
}
