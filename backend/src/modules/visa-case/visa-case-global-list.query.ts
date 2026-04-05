import { Brackets, SelectQueryBuilder } from 'typeorm';

import { VisaCaseStatus, VisaReminderType } from '../../common/constants/enums';
import type { QueryGlobalVisaCaseListDto } from './dto/query-global-visa-case-list.dto';
import type { VisaCase } from './entities/visa-case.entity';

function applyGlobalVisaCaseListCustomerAndStatusFilters(
  qb: SelectQueryBuilder<VisaCase>,
  query: QueryGlobalVisaCaseListDto,
): void {
  if (query.customerId) {
    qb.andWhere('vc.customerId = :customerId', {
      customerId: query.customerId,
    });
  }
  if (query.customerKeyword?.trim()) {
    const custKw = `%${query.customerKeyword.trim()}%`;
    qb.andWhere(
      `EXISTS (
        SELECT 1 FROM customers gvc_cust_kw
        WHERE gvc_cust_kw.id = vc.customerId
          AND (
            gvc_cust_kw.customer_name ILIKE :gvcListCustKw
            OR gvc_cust_kw.customer_code ILIKE :gvcListCustKw
          )
      )`,
      { gvcListCustKw: custKw },
    );
  }
  if (query.caseStatuses?.length) {
    qb.andWhere('vc.caseStatus IN (:...caseStatuses)', {
      caseStatuses: query.caseStatuses,
    });
  }
  if (query.unassignedOnly === true) {
    qb.andWhere('vc.assignedTo IS NULL');
  } else if (query.assignedToIds?.length) {
    qb.andWhere('vc.assignedTo IN (:...assignedToIds)', {
      assignedToIds: query.assignedToIds,
    });
  }
  if (query.materialStatuses?.length) {
    qb.andWhere('vc.materialStatus IN (:...materialStatuses)', {
      materialStatuses: query.materialStatuses,
    });
  }
  if (query.feeStatuses?.length) {
    qb.andWhere('vc.feeStatus IN (:...feeStatuses)', {
      feeStatuses: query.feeStatuses,
    });
  }
}

function applyGlobalVisaCaseListDatesAndFamilyFilters(
  qb: SelectQueryBuilder<VisaCase>,
  query: QueryGlobalVisaCaseListDto,
): void {
  if (query.expireDateFrom) {
    qb.andWhere('vc.expireDate >= :expireDateFrom', {
      expireDateFrom: query.expireDateFrom,
    });
  }
  if (query.expireDateTo) {
    qb.andWhere('vc.expireDate <= :expireDateTo', {
      expireDateTo: query.expireDateTo,
    });
  }
  if (query.nextFollowUpAtFrom) {
    qb.andWhere('vc.nextFollowUpAt >= :nfFrom', {
      nfFrom: new Date(query.nextFollowUpAtFrom),
    });
  }
  if (query.nextFollowUpAtTo) {
    qb.andWhere('vc.nextFollowUpAt <= :nfTo', {
      nfTo: new Date(query.nextFollowUpAtTo),
    });
  }
  if (query.isFamilyCase === true || query.isFamilyCase === false) {
    qb.andWhere('vc.isFamilyCase = :isFam', { isFam: query.isFamilyCase });
  }
  if (query.familyLinkMode) {
    qb.andWhere('vc.familyLinkMode = :flm', { flm: query.familyLinkMode });
  }
}

function applyGlobalVisaCaseListSupplementAndCaseKeyword(
  qb: SelectQueryBuilder<VisaCase>,
  query: QueryGlobalVisaCaseListDto,
  supplementIds: string[],
): void {
  if (query.supplementRelated === true) {
    qb.andWhere(
      new Brackets((q) => {
        q.where('vc.caseStatus = :supplementStatus', {
          supplementStatus: VisaCaseStatus.SUPPLEMENT,
        });
        if (supplementIds.length > 0) {
          q.orWhere('vc.id IN (:...supplementRelIds)', {
            supplementRelIds: supplementIds,
          });
        }
      }),
    );
  }
  const caseKwRaw = query.keyword?.trim();
  if (caseKwRaw) {
    const caseKw = `%${caseKwRaw}%`;
    qb.andWhere(
      new Brackets((q) => {
        q.where('vc.caseType ILIKE :caseKw', { caseKw }).orWhere(
          'vc.memo ILIKE :caseKw',
          { caseKw },
        );
      }),
    );
  }
}

/**
 * 为跨客户案件查询追加 S4a 冻結标量与集合筛选条件（不含提醒桶专用条件）。
 *
 * @param qb - 已 alias 为 `vc` 的查询构造器（客户关键字走 EXISTS，无需 join customers）
 * @param query - 全局列表查询 DTO
 * @param supplementIds - 补件日志命中案件 ID，供 `supplementRelated` 使用
 */
export function applyGlobalVisaCaseListScalarFilters(
  qb: SelectQueryBuilder<VisaCase>,
  query: QueryGlobalVisaCaseListDto,
  supplementIds: string[],
): void {
  applyGlobalVisaCaseListCustomerAndStatusFilters(qb, query);
  applyGlobalVisaCaseListDatesAndFamilyFilters(qb, query);
  applyGlobalVisaCaseListSupplementAndCaseKeyword(qb, query, supplementIds);
}

/**
 * 为全局列表追加「主提醒桶」筛选，语义与 `/visa-reminders` 单案去重一致。
 *
 * @param qb - 已 join 客户与关联的案件查询构造器
 * @param bucket - 目标提醒桶
 * @param todayStr - 当日 YYYY-MM-DD（与提醒服务本地日历一致）
 * @param supplementIds - 最新日志命中补件规则的案件 ID
 */
export function applyGlobalReminderBucketFilter(
  qb: SelectQueryBuilder<VisaCase>,
  bucket: VisaReminderType,
  todayStr: string,
  supplementIds: string[],
): void {
  qb.andWhere('vc.caseStatus NOT IN (:...rbExcluded)', {
    rbExcluded: [VisaCaseStatus.COMPLETED, VisaCaseStatus.CANCELLED],
  });
  qb.setParameter('bucketToday', todayStr);

  const notSupplement = (): void => {
    qb.andWhere(
      new Brackets((q) => {
        q.where('vc.caseStatus != :bSupSt', {
          bSupSt: VisaCaseStatus.SUPPLEMENT,
        });
        if (supplementIds.length > 0) {
          q.andWhere('vc.id NOT IN (:...bSupIds)', {
            bSupIds: supplementIds,
          });
        }
      }),
    );
  };

  const notTodayFollowUp = (): void => {
    qb.andWhere(
      new Brackets((q) => {
        q.where('vc.nextFollowUpAt IS NULL').orWhere(
          'DATE(vc.nextFollowUpAt) != CAST(:bucketToday AS date)',
        );
      }),
    );
  };

  switch (bucket) {
    case VisaReminderType.SUPPLEMENT:
      qb.andWhere(
        new Brackets((q) => {
          q.where('vc.caseStatus = :bSupOnly', {
            bSupOnly: VisaCaseStatus.SUPPLEMENT,
          });
          if (supplementIds.length > 0) {
            q.orWhere('vc.id IN (:...bSupOrIds)', {
              bSupOrIds: supplementIds,
            });
          }
        }),
      );
      break;
    case VisaReminderType.TODAY_FOLLOW_UP:
      notSupplement();
      qb.andWhere('DATE(vc.nextFollowUpAt) = CAST(:bucketToday AS date)');
      break;
    case VisaReminderType.EXPIRING_7_DAYS:
      notSupplement();
      notTodayFollowUp();
      qb.andWhere('vc.expireDate IS NOT NULL');
      qb.andWhere('(vc.expireDate - CAST(:bucketToday AS date)) <= 7');
      break;
    case VisaReminderType.EXPIRING_2_MONTHS:
      notSupplement();
      notTodayFollowUp();
      qb.andWhere('vc.expireDate IS NOT NULL');
      qb.andWhere('(vc.expireDate - CAST(:bucketToday AS date)) > 7');
      qb.andWhere('(vc.expireDate - CAST(:bucketToday AS date)) <= 60');
      break;
    default:
      break;
  }
}

/**
 * 按提醒桶优先级、到期日与更新时间对全局列表排序（与 P0 去重优先级一致）。
 *
 * @param qb - 案件查询构造器
 * @param todayStr - 当日 YYYY-MM-DD
 * @param supplementIds - 补件日志命中的案件 ID
 */
export function applyGlobalVisaCaseListSort(
  qb: SelectQueryBuilder<VisaCase>,
  todayStr: string,
  supplementIds: string[],
): void {
  qb.setParameter('sortToday', todayStr);
  qb.setParameter('sortSupplementStatus', VisaCaseStatus.SUPPLEMENT);
  let caseExpr: string;
  if (supplementIds.length > 0) {
    qb.setParameter('sortSupplementIds', supplementIds);
    caseExpr = `CASE
        WHEN vc.caseStatus = :sortSupplementStatus OR vc.id IN (:...sortSupplementIds) THEN 0
        WHEN DATE(vc.nextFollowUpAt) = CAST(:sortToday AS date) THEN 1
        WHEN vc.expireDate IS NOT NULL AND (vc.expireDate - CAST(:sortToday AS date)) <= 7 THEN 2
        WHEN vc.expireDate IS NOT NULL AND (vc.expireDate - CAST(:sortToday AS date)) > 7
          AND (vc.expireDate - CAST(:sortToday AS date)) <= 60 THEN 3
        ELSE 99
      END`;
  } else {
    caseExpr = `CASE
        WHEN vc.caseStatus = :sortSupplementStatus THEN 0
        WHEN DATE(vc.nextFollowUpAt) = CAST(:sortToday AS date) THEN 1
        WHEN vc.expireDate IS NOT NULL AND (vc.expireDate - CAST(:sortToday AS date)) <= 7 THEN 2
        WHEN vc.expireDate IS NOT NULL AND (vc.expireDate - CAST(:sortToday AS date)) > 7
          AND (vc.expireDate - CAST(:sortToday AS date)) <= 60 THEN 3
        ELSE 99
      END`;
  }
  /**
   * 无 join 时走单条 SQL 的 ORDER BY，可安全使用含 `vc.` 的 CASE 表达式。
   * （若存在 join + skip/take，TypeORM 会生成 DISTINCT 子查询并把 orderBy 误解析为 alias.property，全局列表因此不得带 join。）
   */
  qb.orderBy(caseExpr, 'ASC');
  qb.addOrderBy('vc.expireDate', 'ASC', 'NULLS LAST');
  qb.addOrderBy('vc.updatedAt', 'DESC');
}
