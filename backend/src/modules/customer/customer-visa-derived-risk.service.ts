import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { VisaCaseStatus, VisaReminderType } from '../../common/constants/enums';
import { VisaCase } from '../visa-case/entities/visa-case.entity';
import { applyVisaCaseDataScopeToQueryBuilder } from '../visa-case/visa-case-data-scope.query';
import type { ResolvedVisaDataScope } from '../visa-case/visa-case-data-scope.types';
import {
  buildOpenCasePrimaryBucketRankCaseSql,
  mapMinRankToVisaReminderType,
} from './customer-visa-derived-risk.query';

/**
 * 批量聚合开放签证案件的派生提醒桶（只读、不落库），供客户列表页摘要使用。
 */
@Injectable()
export class CustomerVisaDerivedRiskService {
  constructor(
    @InjectRepository(VisaCase)
    private readonly visaCaseRepo: Repository<VisaCase>,
  ) {}

  /**
   * 批量计算客户在当前日历日下的签证派生风险（开放案件 MIN 桶序号再映射），单次聚合查询、不落库。
   *
   * @param customerIds - 当前页客户主键列表
   * @param todayStr - 当日 YYYY-MM-DD（与提醒服务一致）
   * @param supplementIds - 最新案件日志命中补件规则的案件 ID
   * @param resolved - 已解析的签证数据范围（与列表 EXISTS 一致）
   * @returns 客户 ID → 最高优先级提醒桶；无开放案件或桶为空的客户映射为 null
   */
  async fetchCustomerVisaDerivedRiskMap(
    customerIds: string[],
    todayStr: string,
    supplementIds: string[],
    resolved: ResolvedVisaDataScope,
  ): Promise<Map<string, VisaReminderType | null>> {
    const map = new Map<string, VisaReminderType | null>();
    for (const id of customerIds) {
      map.set(id, null);
    }
    if (customerIds.length === 0) {
      return map;
    }

    const rankSql = buildOpenCasePrimaryBucketRankCaseSql(
      'vc',
      supplementIds.length > 0,
    );
    const qb = this.visaCaseRepo
      .createQueryBuilder('vc')
      .select('vc.customerId', 'customerId')
      .addSelect(`MIN(${rankSql})`, 'minRank')
      .where('vc.customerId IN (:...cvDrIds)', { cvDrIds: customerIds })
      .andWhere('vc.deletedAt IS NULL')
      .andWhere('vc.caseStatus NOT IN (:...cvDrEx)', {
        cvDrEx: [VisaCaseStatus.COMPLETED, VisaCaseStatus.CANCELLED],
      });

    applyVisaCaseDataScopeToQueryBuilder(qb, 'vc', resolved, 'cvDrScope');

    qb.groupBy('vc.customerId');

    qb.setParameter('cvDrToday', todayStr);
    qb.setParameter('cvDrSupSt', VisaCaseStatus.SUPPLEMENT);
    if (supplementIds.length > 0) {
      qb.setParameter('cvDrSupIds', supplementIds);
    }

    const rows = await qb.getRawMany<Record<string, unknown>>();
    for (const row of rows) {
      const cid = this.pickRawGroupedCustomerId(row);
      if (!cid) {
        continue;
      }
      map.set(cid, mapMinRankToVisaReminderType(this.pickRawMinRank(row)));
    }
    return map;
  }

  /**
   * 从 `GROUP BY customerId` 的原始行中解析客户主键，兼容驱动返回的大小写/别名差异。
   *
   * @param row - `getRawMany` 单行
   * @returns 客户 UUID 或 undefined
   */
  private pickRawGroupedCustomerId(
    row: Record<string, unknown>,
  ): string | undefined {
    const v =
      row.customerId ??
      row.customer_id ??
      row.vc_customer_id ??
      row.vc_customerId;
    return typeof v === 'string' ? v : undefined;
  }

  /**
   * 从聚合查询原始行中解析 `MIN(桶序号)`，兼容列名别名差异。
   *
   * @param row - `getRawMany` 单行
   * @returns 桶序号或 null
   */
  private pickRawMinRank(row: Record<string, unknown>): string | number | null {
    const v = row.minRank ?? row.min_rank ?? row.MIN ?? row.min;
    if (v === null || v === undefined) {
      return null;
    }
    if (typeof v === 'number') {
      return v;
    }
    if (typeof v === 'string') {
      return v;
    }
    return null;
  }
}
