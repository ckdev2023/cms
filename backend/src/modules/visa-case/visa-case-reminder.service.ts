import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { VisaCaseStatus, VisaReminderType } from '../../common/constants/enums';
import { Note } from '../customer/entities/note.entity';
import { resolveVisaAlertLevel } from '../customer/visa-alert.util';
import type { QueryGlobalVisaCaseListDto } from './dto/query-global-visa-case-list.dto';
import { QueryVisaCaseStatsDto } from './dto/query-visa-case-stats.dto';
import { QueryVisaReminderDto } from './dto/query-visa-reminder.dto';
import { VisaCase } from './entities/visa-case.entity';
import {
  addLocalCalendarDays,
  calendarDaysUntil,
  formatLocalDateYyyyMmDd,
} from './visa-case.mapper';
import type {
  VisaDomainStatsDto,
  VisaReminderItemDto,
  VisaReminderListResponse,
  VisaReminderSummary,
  VisaWorkbenchReminderPreviewsDto,
} from './visa-case.types';
import { applyVisaCaseDataScopeToQueryBuilder } from './visa-case-data-scope.query';
import { VisaCaseDataScopeService } from './visa-case-data-scope.service';
import type { ResolvedVisaDataScope } from './visa-case-data-scope.types';
import {
  applyGlobalReminderBucketFilter,
  applyGlobalVisaCaseListScalarFilters,
} from './visa-case-global-list.query';

/**
 * 聚合四类签证提醒桶、补件日志判定与分页摘要，独立于案件 CRUD 以控制单文件体量。
 */
@Injectable()
export class VisaCaseReminderService {
  constructor(
    @InjectRepository(VisaCase)
    private readonly visaCaseRepo: Repository<VisaCase>,
    @InjectRepository(Note)
    private readonly noteRepo: Repository<Note>,
    private readonly visaCaseDataScope: VisaCaseDataScopeService,
  ) {}

  /**
   * 按四类提醒桶聚合签证案件并返回去重后的分页提醒列表。
   *
   * 桶优先级：补件提醒 > 今日待跟进 > 7天内到期 > 2个月内到期。
   * 同一案件命中多个桶时保留最高优先级，已过期案件归入「7天内到期」桶。
   *
   * @param query - 含提醒桶类型与负责人筛选的查询参数
   * @param currentUserId - 当前登录用户 ID，用于 `dataScope` 解析
   * @returns 按优先级排序、应用分页的提醒列表
   */
  async findVisaReminders(
    query: QueryVisaReminderDto,
    currentUserId: string,
  ): Promise<VisaReminderListResponse> {
    const resolved = await this.visaCaseDataScope.resolve(
      currentUserId,
      query.dataScope,
    );
    const allClassified = await this.loadAndClassifyReminderItems(
      query,
      resolved,
    );
    const summary = this.summarizeReminderBuckets(allClassified);
    const { page, pageSize, items, total } = this.paginateFilteredReminders(
      allClassified,
      query,
    );

    return { items, total, page, pageSize, summary };
  }

  /**
   * 为工作台每桶截取 Top N 条提醒预览，排序与分页列表一致（桶优先级 → 余量天数升序）。
   *
   * @param query - 负责人与 `dataScope`，与统计接口一致
   * @param limitPerBucket - 每桶最大条数；≤0 时不查询候选案件并返回空数组
   * @param currentUserId - 当前登录用户 ID
   * @returns 四分桶各自的预览行
   */
  async getReminderPreviewsByBucket(
    query: Pick<QueryVisaReminderDto, 'assignedTo' | 'dataScope'>,
    limitPerBucket: number,
    currentUserId: string,
  ): Promise<VisaWorkbenchReminderPreviewsDto> {
    const empty: VisaWorkbenchReminderPreviewsDto = {
      supplement: [],
      todayFollowUp: [],
      expiring7Days: [],
      expiring2Months: [],
    };
    if (limitPerBucket <= 0) {
      return empty;
    }

    const resolved = await this.visaCaseDataScope.resolve(
      currentUserId,
      query.dataScope,
    );
    const allClassified = await this.loadAndClassifyReminderItems(
      query as QueryVisaReminderDto,
      resolved,
    );
    const sorted = this.sortReminderItemsByBucketAndExpiry(allClassified);
    const take = (bucket: VisaReminderType): VisaReminderItemDto[] =>
      sorted.filter((i) => i.reminderType === bucket).slice(0, limitPerBucket);

    return {
      supplement: take(VisaReminderType.SUPPLEMENT),
      todayFollowUp: take(VisaReminderType.TODAY_FOLLOW_UP),
      expiring7Days: take(VisaReminderType.EXPIRING_7_DAYS),
      expiring2Months: take(VisaReminderType.EXPIRING_2_MONTHS),
    };
  }

  /**
   * 拉取提醒候选案件并映射为去重桶后的提醒行（不含分页）。
   *
   * @param query - 提醒列表或工作台共用的查询参数
   * @param resolved - 数据范围解析结果
   * @returns 已分类提醒项全集
   */
  private async loadAndClassifyReminderItems(
    query: Pick<QueryVisaReminderDto, 'assignedTo'>,
    resolved: ResolvedVisaDataScope,
  ): Promise<VisaReminderItemDto[]> {
    const today = new Date();
    const todayStr = formatLocalDateYyyyMmDd(today);
    const twoMonthsCutoff = formatLocalDateYyyyMmDd(
      addLocalCalendarDays(today, 60),
    );

    const supplementLogCaseIds = await this.findSupplementLogCaseIds();
    const cases = await this.loadReminderCandidateCases(
      query as QueryVisaReminderDto,
      supplementLogCaseIds,
      todayStr,
      twoMonthsCutoff,
      resolved,
    );

    const supplementSet = new Set(supplementLogCaseIds);
    return this.classifyCasesToReminderItems(
      cases,
      today,
      todayStr,
      supplementSet,
    );
  }

  /**
   * 按提醒桶优先级与余量天数对提醒行排序，与列表 API 分页前顺序一致。
   *
   * @param items - 待排序的提醒行
   * @returns 新数组副本，按桶序与 daysLeft 升序
   */
  private sortReminderItemsByBucketAndExpiry(
    items: VisaReminderItemDto[],
  ): VisaReminderItemDto[] {
    const BUCKET_ORDER: Record<VisaReminderType, number> = {
      [VisaReminderType.SUPPLEMENT]: 0,
      [VisaReminderType.TODAY_FOLLOW_UP]: 1,
      [VisaReminderType.EXPIRING_7_DAYS]: 2,
      [VisaReminderType.EXPIRING_2_MONTHS]: 3,
    };
    const out = [...items];
    out.sort((a, b) => {
      const d = BUCKET_ORDER[a.reminderType] - BUCKET_ORDER[b.reminderType];
      if (d !== 0) return d;
      return (a.daysLeft ?? Infinity) - (b.daysLeft ?? Infinity);
    });
    return out;
  }

  /**
   * 聚合签证域只读 KPI：按状态计数、按提醒桶去重计数、窗口内到期与补件/未指派件数。
   *
   * 提醒桶与 `findVisaReminders` 共用 `resolveReminderBucket` 与补件日志判定；未完结未取消全集上计算 `noBucket`。
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

    const supplementLogCaseIds = await this.findSupplementLogCaseIds();
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
   * 为单条开放案件按 `resolveReminderBucket` 结果累加对应提醒桶计数。
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
    const bucket = this.resolveReminderBucket(
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

  /**
   * 按 OR 条件拉取可能落入任一类提醒桶的签证案件候选集。
   *
   * @param query - 含负责人筛选的查询参数
   * @param supplementLogCaseIds - 补件日志命中的案件 ID 列表
   * @param todayStr - 当日 YYYY-MM-DD
   * @param twoMonthsCutoff - 两个月窗口上界日 YYYY-MM-DD
   * @param resolved - 数据范围解析结果
   * @returns 候选案件实体数组
   */
  private async loadReminderCandidateCases(
    query: QueryVisaReminderDto,
    supplementLogCaseIds: string[],
    todayStr: string,
    twoMonthsCutoff: string,
    resolved: ResolvedVisaDataScope,
  ): Promise<VisaCase[]> {
    const qb = this.visaCaseRepo
      .createQueryBuilder('vc')
      .leftJoinAndSelect('vc.customer', 'customer')
      .leftJoinAndSelect('vc.assignee', 'assignee')
      .where('vc.caseStatus NOT IN (:...excludedStatuses)', {
        excludedStatuses: [VisaCaseStatus.COMPLETED, VisaCaseStatus.CANCELLED],
      });

    applyVisaCaseDataScopeToQueryBuilder(qb, 'vc', resolved, 'remScope');

    const orConditions: string[] = [
      'vc.caseStatus = :supplementStatus',
      'DATE(vc.nextFollowUpAt) = :todayDate',
      'vc.expireDate <= :twoMonthsCutoff',
    ];
    const orParams: Record<string, unknown> = {
      supplementStatus: VisaCaseStatus.SUPPLEMENT,
      todayDate: todayStr,
      twoMonthsCutoff,
    };

    if (supplementLogCaseIds.length > 0) {
      orConditions.push('vc.id IN (:...supplementLogIds)');
      orParams.supplementLogIds = supplementLogCaseIds;
    }

    qb.andWhere(`(${orConditions.join(' OR ')})`, orParams);

    if (query.assignedTo) {
      qb.andWhere('vc.assignedTo = :assignedTo', {
        assignedTo: query.assignedTo,
      });
    }

    return qb.getMany();
  }

  /**
   * 将候选案件逐条映射为提醒行（含桶类型与 alertLevel），跳过无桶命中者。
   *
   * @param cases - 查询得到的候选案件
   * @param today - 判定「今日跟进」的基准日
   * @param todayStr - 当日 YYYY-MM-DD
   * @param supplementLogIds - 补件日志命中的案件 ID 集合
   * @returns 已分类的提醒行列表
   */
  private classifyCasesToReminderItems(
    cases: VisaCase[],
    today: Date,
    todayStr: string,
    supplementLogIds: Set<string>,
  ): VisaReminderItemDto[] {
    const out: VisaReminderItemDto[] = [];
    for (const vc of cases) {
      const bucket = this.resolveReminderBucket(
        vc,
        today,
        todayStr,
        supplementLogIds,
      );
      if (!bucket) continue;

      const daysLeft = vc.expireDate
        ? calendarDaysUntil(vc.expireDate, today)
        : null;

      out.push({
        id: vc.id,
        customerId: vc.customerId,
        customerName: vc.customer?.customerName ?? '',
        caseType: vc.caseType,
        caseStatus: vc.caseStatus,
        assignedTo: vc.assignedTo,
        assigneeName: vc.assignee?.displayName ?? null,
        expireDate: vc.expireDate,
        nextFollowUpAt: vc.nextFollowUpAt,
        materialStatus: vc.materialStatus,
        reminderType: bucket,
        daysLeft,
        alertLevel: daysLeft !== null ? resolveVisaAlertLevel(daysLeft) : null,
      });
    }
    return out;
  }

  /**
   * 统计四类提醒桶在分类后列表中的出现次数（不受 reminderType 筛选影响）。
   *
   * @param items - 已分类的提醒行
   * @returns 各桶计数汇总
   */
  private summarizeReminderBuckets(
    items: VisaReminderItemDto[],
  ): VisaReminderSummary {
    const summary: VisaReminderSummary = {
      supplement: 0,
      todayFollowUp: 0,
      expiring7Days: 0,
      expiring2Months: 0,
    };
    for (const item of items) {
      switch (item.reminderType) {
        case VisaReminderType.SUPPLEMENT:
          summary.supplement++;
          break;
        case VisaReminderType.TODAY_FOLLOW_UP:
          summary.todayFollowUp++;
          break;
        case VisaReminderType.EXPIRING_7_DAYS:
          summary.expiring7Days++;
          break;
        case VisaReminderType.EXPIRING_2_MONTHS:
          summary.expiring2Months++;
          break;
      }
    }
    return summary;
  }

  /**
   * 按桶类型筛选、桶优先级与余量天数排序后分页切片。
   *
   * @param allClassified - 已分类的提醒行全集
   * @param query - 含桶筛选与分页参数
   * @returns 当前页数据与分页元信息
   */
  private paginateFilteredReminders(
    allClassified: VisaReminderItemDto[],
    query: QueryVisaReminderDto,
  ): {
    page: number;
    pageSize: number;
    items: VisaReminderItemDto[];
    total: number;
  } {
    let filtered = allClassified;
    if (query.reminderType) {
      filtered = allClassified.filter(
        (i) => i.reminderType === query.reminderType,
      );
    }

    const sorted = this.sortReminderItemsByBucketAndExpiry(filtered);

    const { page = 1, pageSize = 20 } = query;
    const total = sorted.length;
    const items = sorted.slice((page - 1) * pageSize, page * pageSize);
    return { page, pageSize, items, total };
  }

  /**
   * 按优先级为单个案件选定唯一提醒桶：
   * SUPPLEMENT > TODAY_FOLLOW_UP > EXPIRING_7_DAYS > EXPIRING_2_MONTHS。
   *
   * @param vc - 签证案件实体
   * @param today - 当前日期基准
   * @param todayStr - 当前日期 YYYY-MM-DD
   * @param supplementLogIds - 最新日志指示补件的案件 ID 集合
   * @returns 命中的提醒桶，全不命中时返回 null
   */
  private resolveReminderBucket(
    vc: VisaCase,
    today: Date,
    todayStr: string,
    supplementLogIds: Set<string>,
  ): VisaReminderType | null {
    if (
      vc.caseStatus === VisaCaseStatus.SUPPLEMENT ||
      supplementLogIds.has(vc.id)
    ) {
      return VisaReminderType.SUPPLEMENT;
    }

    if (vc.nextFollowUpAt) {
      const followUpStr = formatLocalDateYyyyMmDd(vc.nextFollowUpAt);
      if (followUpStr === todayStr) {
        return VisaReminderType.TODAY_FOLLOW_UP;
      }
    }

    if (vc.expireDate) {
      const days = calendarDaysUntil(vc.expireDate, today);
      if (days <= 7) return VisaReminderType.EXPIRING_7_DAYS;
      if (days <= 60) return VisaReminderType.EXPIRING_2_MONTHS;
    }

    return null;
  }

  /**
   * 查询最新案件日志指示「补件」的案件 ID 集合。
   *
   * 判定标准：该案件最新一条非软删日志的 log_type 为 SUPPLEMENT
   * 或 missing_items 非空。
   *
   * @returns 符合条件的签证案件 ID 数组
   */
  /**
   * 返回最新一条案件日志命中补件判定规则（与提醒桶 SUPPLEMENT 一致）的案件 ID 列表，供全局案件列表筛选与排序复用。
   *
   * @returns 命中的 `visa_cases.id` 数组（无重复）
   */
  async getSupplementLogCaseIds(): Promise<string[]> {
    return this.findSupplementLogCaseIds();
  }

  /**
   * 查询最新案件日志命中补件判定规则的案件 ID，与 `getSupplementLogCaseIds` 及提醒候选集共用。
   *
   * 性能：相关子查询按 `visa_case_id` 取最新 `created_at` 行，依赖
   * `IDX_notes_visa_case_created_desc_active`（migration `1776300000000`）降低顺序扫描。
   *
   * @returns 去重后的 `visa_case_id` 列表
   */
  private async findSupplementLogCaseIds(): Promise<string[]> {
    const results = await this.noteRepo.manager.query<
      { visa_case_id: string }[]
    >(
      `SELECT DISTINCT n.visa_case_id
       FROM notes n
       WHERE n.visa_case_id IS NOT NULL
         AND n.deleted_at IS NULL
         AND (n.log_type = 'SUPPLEMENT' OR (n.missing_items IS NOT NULL AND n.missing_items != ''))
         AND n.id = (
           SELECT n2.id FROM notes n2
           WHERE n2.visa_case_id = n.visa_case_id
             AND n2.deleted_at IS NULL
           ORDER BY n2.created_at DESC
           LIMIT 1
         )`,
    );
    return (results as { visa_case_id: string }[]).map((r) => r.visa_case_id);
  }
}
