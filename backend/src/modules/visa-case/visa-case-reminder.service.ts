import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { VisaCaseStatus, VisaReminderType } from '../../common/constants/enums';
import { resolveVisaAlertLevel } from '../customer/visa-alert.util';
import type { QueryVisaCaseStatsDto } from './dto/query-visa-case-stats.dto';
import type { QueryVisaReminderDto } from './dto/query-visa-reminder.dto';
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
import { resolveVisaReminderBucket } from './visa-case-reminder-bucket.util';
import { VisaCaseReminderDomainStatsService } from './visa-case-reminder-domain-stats.service';
import { VisaCaseSupplementLogCaseIdsService } from './visa-case-supplement-log-case-ids.service';

/**
 * 聚合四类签证提醒桶、补件日志判定与分页摘要，独立于案件 CRUD 以控制单文件体量。
 */
@Injectable()
export class VisaCaseReminderService {
  constructor(
    @InjectRepository(VisaCase)
    private readonly visaCaseRepo: Repository<VisaCase>,
    private readonly visaCaseDataScope: VisaCaseDataScopeService,
    private readonly domainStats: VisaCaseReminderDomainStatsService,
    private readonly supplementLogCaseIds: VisaCaseSupplementLogCaseIdsService,
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
   * 聚合签证域只读 KPI：按状态计数、按提醒桶去重计数、窗口内到期与补件/未指派件数。
   *
   * @param query - 与 `GET /visa-cases` 同构的筛选子集及可选单一 `assignedTo` 收窄
   * @param currentUserId - 当前登录用户 ID
   * @returns 与 `docs/25` §5 对齐的统计载荷
   */
  async getVisaDomainStats(
    query: QueryVisaCaseStatsDto,
    currentUserId: string,
  ): Promise<VisaDomainStatsDto> {
    return this.domainStats.getVisaDomainStats(query, currentUserId);
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

    const supplementLogCaseIds = await this.supplementLogCaseIds.findCaseIds();
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
      const bucket = resolveVisaReminderBucket(
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
   * 返回最新一条案件日志命中补件判定规则（与提醒桶 SUPPLEMENT 一致）的案件 ID 列表，供全局案件列表筛选与排序复用。
   *
   * @returns 命中的 `visa_cases.id` 数组（无重复）
   */
  async getSupplementLogCaseIds(): Promise<string[]> {
    return this.supplementLogCaseIds.findCaseIds();
  }
}
