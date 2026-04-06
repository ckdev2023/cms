import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { VisaCaseStatus, VisaReminderType } from '../../common/constants/enums';
import type { QueryGlobalVisaCaseListDto } from './dto/query-global-visa-case-list.dto';
import { QueryVisaCaseStatsDto } from './dto/query-visa-case-stats.dto';
import { VisaCase } from './entities/visa-case.entity';
import { calendarDaysUntil, formatLocalDateYyyyMmDd } from './visa-case.mapper';
import type { VisaDomainStatsDto } from './visa-case.types';
import { applyVisaCaseDataScopeToQueryBuilder } from './visa-case-data-scope.query';
import { VisaCaseDataScopeService } from './visa-case-data-scope.service';
import type { ResolvedVisaDataScope } from './visa-case-data-scope.types';
import {
  applyGlobalReminderBucketFilter,
  applyGlobalVisaCaseListScalarFilters,
} from './visa-case-global-list.query';
import { resolveVisaReminderBucket } from './visa-case-reminder-bucket.util';
import { VisaCaseSupplementLogCaseIdsService } from './visa-case-supplement-log-case-ids.service';

/**
 * 签证域只读 KPI 聚合（状态计数、提醒桶、窗口内到期与补件/未指派件数），与全局列表筛选同构。
 */
@Injectable()
export class VisaCaseReminderDomainStatsService {
  constructor(
    @InjectRepository(VisaCase)
    private readonly visaCaseRepo: Repository<VisaCase>,
    private readonly visaCaseDataScope: VisaCaseDataScopeService,
    private readonly supplementLogCaseIds: VisaCaseSupplementLogCaseIdsService,
  ) {}

  /**
   * 聚合签证域只读 KPI：按状态计数、按提醒桶去重计数、窗口内到期与补件/未指派件数。
   *
   * 提醒桶与 `findVisaReminders` 共用 `resolveVisaReminderBucket` 与补件日志判定；未完结未取消全集上计算 `noBucket`。
   * 列表筛选与 `findAllGlobal` 共用 `applyGlobalVisaCaseListScalarFilters`（及可选 `reminderBucket` 条件）。
   *
   * @param query - 与 `GET /visa-cases` 同构的筛选子集及可选单一 `assignedTo` 收窄
   * @param currentUserId - 当前登录用户 ID
   * @returns 与 `docs/25` §5 对齐的统计载荷
   */
  async getVisaDomainStats(
    query: QueryVisaCaseStatsDto,
    currentUserId: string,
  ): Promise<VisaDomainStatsDto> {
    const today = new Date();
    const todayStr = formatLocalDateYyyyMmDd(today);

    const resolved = await this.visaCaseDataScope.resolve(
      currentUserId,
      query.dataScope,
    );

    const supplementLogCaseIds = await this.supplementLogCaseIds.findCaseIds();
    const supplementSet = new Set(supplementLogCaseIds);
    const listFilter = this.normalizeStatsQueryToListDto(query);

    const segment = await this.loadDomainStatsOpenCaseSegment(
      resolved,
      listFilter,
      supplementLogCaseIds,
      supplementSet,
      today,
      todayStr,
    );

    const caseStatusCounts = await this.loadDomainStatsCaseStatusCounts(
      resolved,
      listFilter,
      supplementLogCaseIds,
      todayStr,
    );

    const hasAssigneeSlice =
      query.assignedTo !== undefined ||
      (query.assignedToIds !== undefined && query.assignedToIds.length > 0) ||
      query.unassignedOnly === true;
    const suppressGlobalUnassigned =
      hasAssigneeSlice || resolved.mode !== 'all';
    const unassignedCount = suppressGlobalUnassigned
      ? 0
      : await this.countUnassignedWithinListFilters(
          listFilter,
          resolved,
          supplementLogCaseIds,
          todayStr,
        );

    return {
      caseStatusCounts,
      reminderBuckets: segment.reminderBuckets,
      expiringWithin7DaysWindow: segment.expiringWithin7DaysWindow,
      todayFollowUpCount: segment.todayFollowUpCount,
      supplementRelatedCount: segment.supplementRelatedCount,
      unassignedCount,
    };
  }

  /**
   * 在统计口径下查询未完结未取消开放案件并汇总提醒桶与窗口计数。
   *
   * @param resolved - 已解析的数据范围
   * @param listFilter - 与列表同构的筛选 DTO
   * @param supplementLogCaseIds - 补件日志命中案件 ID
   * @param supplementSet - 补件案件 ID 集合（段落统计用）
   * @param today - 判定基准日
   * @param todayStr - 当日 YYYY-MM-DD
   * @returns `aggregateOpenCaseSegmentStats` 的段落统计结果
   */
  private async loadDomainStatsOpenCaseSegment(
    resolved: ResolvedVisaDataScope,
    listFilter: QueryGlobalVisaCaseListDto,
    supplementLogCaseIds: string[],
    supplementSet: Set<string>,
    today: Date,
    todayStr: string,
  ): Promise<
    Pick<
      VisaDomainStatsDto,
      | 'reminderBuckets'
      | 'expiringWithin7DaysWindow'
      | 'todayFollowUpCount'
      | 'supplementRelatedCount'
    >
  > {
    const openQb = this.visaCaseRepo
      .createQueryBuilder('vc')
      .where('vc.caseStatus NOT IN (:...statsExcluded)', {
        statsExcluded: [VisaCaseStatus.COMPLETED, VisaCaseStatus.CANCELLED],
      });
    applyVisaCaseDataScopeToQueryBuilder(openQb, 'vc', resolved, 'statsScope');
    applyGlobalVisaCaseListScalarFilters(
      openQb,
      listFilter,
      supplementLogCaseIds,
    );
    if (listFilter.reminderBucket !== undefined) {
      applyGlobalReminderBucketFilter(
        openQb,
        listFilter.reminderBucket,
        todayStr,
        supplementLogCaseIds,
      );
    }
    const openCases = await openQb.getMany();
    return this.aggregateOpenCaseSegmentStats(
      openCases,
      today,
      todayStr,
      supplementSet,
    );
  }

  /**
   * 在统计口径下按 `case_status` 分组计数并展开为全枚举轴上的计数表。
   *
   * @param resolved - 已解析的数据范围
   * @param listFilter - 与列表同构的筛选 DTO
   * @param supplementLogCaseIds - 补件日志命中案件 ID
   * @param todayStr - 当日 YYYY-MM-DD
   * @returns 各 `VisaCaseStatus` 计数行
   */
  private async loadDomainStatsCaseStatusCounts(
    resolved: ResolvedVisaDataScope,
    listFilter: QueryGlobalVisaCaseListDto,
    supplementLogCaseIds: string[],
    todayStr: string,
  ): Promise<VisaDomainStatsDto['caseStatusCounts']> {
    const statusQb = this.visaCaseRepo
      .createQueryBuilder('vc')
      .select('vc.caseStatus', 'caseStatus')
      .addSelect('COUNT(vc.id)', 'count')
      .groupBy('vc.caseStatus');
    applyVisaCaseDataScopeToQueryBuilder(
      statusQb,
      'vc',
      resolved,
      'statsStScope',
    );
    applyGlobalVisaCaseListScalarFilters(
      statusQb,
      listFilter,
      supplementLogCaseIds,
    );
    if (listFilter.reminderBucket !== undefined) {
      applyGlobalReminderBucketFilter(
        statusQb,
        listFilter.reminderBucket,
        todayStr,
        supplementLogCaseIds,
      );
    }
    const statusRows = await statusQb.getRawMany<Record<string, string>>();
    const countByStatus = this.parseStatusCountRows(statusRows);

    return Object.values(VisaCaseStatus).map((caseStatus) => ({
      caseStatus,
      count: countByStatus.get(caseStatus) ?? 0,
    }));
  }

  /**
   * 将统计接口查询参数规范为全局列表 DTO 形态，供 `applyGlobalVisaCaseListScalarFilters` 复用。
   *
   * @param query - 原始统计查询（可含旧版 `assignedTo`）
   * @returns 仅用于筛选拼接的列表 DTO（分页字段占位）
   */
  private normalizeStatsQueryToListDto(
    query: QueryVisaCaseStatsDto,
  ): QueryGlobalVisaCaseListDto {
    const assignedToLegacy = query.assignedTo;
    const listFilter: QueryGlobalVisaCaseListDto = {
      page: 1,
      pageSize: 20,
      customerId: query.customerId,
      customerKeyword: query.customerKeyword,
      caseStatuses: query.caseStatuses,
      assignedToIds: query.assignedToIds,
      unassignedOnly: query.unassignedOnly,
      materialStatuses: query.materialStatuses,
      feeStatuses: query.feeStatuses,
      expireDateFrom: query.expireDateFrom,
      expireDateTo: query.expireDateTo,
      nextFollowUpAtFrom: query.nextFollowUpAtFrom,
      nextFollowUpAtTo: query.nextFollowUpAtTo,
      isFamilyCase: query.isFamilyCase,
      familyLinkMode: query.familyLinkMode,
      supplementRelated: query.supplementRelated,
      reminderBucket: query.reminderBucket,
      dataScope: query.dataScope,
      keyword: query.keyword,
    };

    if (
      assignedToLegacy &&
      (!listFilter.assignedToIds || listFilter.assignedToIds.length === 0) &&
      listFilter.unassignedOnly !== true
    ) {
      listFilter.assignedToIds = [assignedToLegacy];
    }

    return listFilter;
  }

  /**
   * 在「全部」数据范围且无负责人切片时，统计与当前列表筛选一致的未指派案件件数。
   *
   * @param listFilter - 与列表同构的筛选 DTO
   * @param resolved - 已解析的数据范围
   * @param supplementIds - 补件日志命中案件 ID
   * @param todayStr - 当日 YYYY-MM-DD（提醒桶筛选用）
   * @returns 满足筛选且 `assigned_to` 为空的案件数量
   */
  private async countUnassignedWithinListFilters(
    listFilter: QueryGlobalVisaCaseListDto,
    resolved: ResolvedVisaDataScope,
    supplementIds: string[],
    todayStr: string,
  ): Promise<number> {
    const qb = this.visaCaseRepo.createQueryBuilder('vc');
    applyVisaCaseDataScopeToQueryBuilder(qb, 'vc', resolved, 'unassCntScope');
    applyGlobalVisaCaseListScalarFilters(qb, listFilter, supplementIds);
    if (listFilter.reminderBucket !== undefined) {
      applyGlobalReminderBucketFilter(
        qb,
        listFilter.reminderBucket,
        todayStr,
        supplementIds,
      );
    }
    qb.andWhere('vc.assignedTo IS NULL');
    return qb.getCount();
  }

  /**
   * 在未完结未取消案件集合上累计提醒桶、7 日窗口到期、今日跟进与补件相关件数。
   *
   * @param openCases - 已按负责人可选筛选的开放案件
   * @param today - 判定基准日
   * @param todayStr - 当日 YYYY-MM-DD
   * @param supplementSet - 最新日志命中补件规则的案件 ID
   * @returns 段落统计字段
   */
  private aggregateOpenCaseSegmentStats(
    openCases: VisaCase[],
    today: Date,
    todayStr: string,
    supplementSet: Set<string>,
  ): Pick<
    VisaDomainStatsDto,
    | 'reminderBuckets'
    | 'expiringWithin7DaysWindow'
    | 'todayFollowUpCount'
    | 'supplementRelatedCount'
  > {
    const reminderBuckets: VisaDomainStatsDto['reminderBuckets'] = {
      supplement: 0,
      todayFollowUp: 0,
      expiring7Days: 0,
      expiring2Months: 0,
      noBucket: 0,
    };
    let expiringWithin7DaysWindow = 0;
    let todayFollowUpCount = 0;
    let supplementRelatedCount = 0;

    for (const vc of openCases) {
      this.incrementReminderBucketForStats(
        vc,
        today,
        todayStr,
        supplementSet,
        reminderBuckets,
      );

      if (
        vc.caseStatus === VisaCaseStatus.SUPPLEMENT ||
        supplementSet.has(vc.id)
      ) {
        supplementRelatedCount++;
      }
      if (
        vc.nextFollowUpAt &&
        formatLocalDateYyyyMmDd(vc.nextFollowUpAt) === todayStr
      ) {
        todayFollowUpCount++;
      }
      if (vc.expireDate) {
        const days = calendarDaysUntil(vc.expireDate, today);
        if (days <= 7) {
          expiringWithin7DaysWindow++;
        }
      }
    }

    return {
      reminderBuckets,
      expiringWithin7DaysWindow,
      todayFollowUpCount,
      supplementRelatedCount,
    };
  }

  /**
   * 为单条开放案件按 `resolveVisaReminderBucket` 结果累加对应提醒桶计数。
   *
   * @param vc - 签证案件实体
   * @param today - 判定基准日
   * @param todayStr - 当日 YYYY-MM-DD
   * @param supplementSet - 补件日志命中的案件 ID
   * @param reminderBuckets - 可变的桶计数器
   */
  private incrementReminderBucketForStats(
    vc: VisaCase,
    today: Date,
    todayStr: string,
    supplementSet: Set<string>,
    reminderBuckets: VisaDomainStatsDto['reminderBuckets'],
  ): void {
    const bucket = resolveVisaReminderBucket(
      vc,
      today,
      todayStr,
      supplementSet,
    );
    if (bucket === null) {
      reminderBuckets.noBucket++;
      return;
    }
    if (bucket === VisaReminderType.SUPPLEMENT) {
      reminderBuckets.supplement++;
    } else if (bucket === VisaReminderType.TODAY_FOLLOW_UP) {
      reminderBuckets.todayFollowUp++;
    } else if (bucket === VisaReminderType.EXPIRING_7_DAYS) {
      reminderBuckets.expiring7Days++;
    } else {
      reminderBuckets.expiring2Months++;
    }
  }

  /**
   * 将 `GROUP BY case_status` 的原始行解析为状态 → 件数映射，兼容驱动返回的列名大小写差异。
   *
   * @param rows - TypeORM `getRawMany` 结果
   * @returns 各 `VisaCaseStatus` 对应计数
   */
  private parseStatusCountRows(
    rows: Record<string, string>[],
  ): Map<VisaCaseStatus, number> {
    const map = new Map<VisaCaseStatus, number>();
    for (const row of rows) {
      const statusKey = row.caseStatus ?? row.case_status ?? row.vc_case_status;
      const countKey = row.count ?? row.COUNT;
      if (!statusKey || countKey === undefined) continue;
      map.set(statusKey as VisaCaseStatus, Number(countKey));
    }
    return map;
  }
}
