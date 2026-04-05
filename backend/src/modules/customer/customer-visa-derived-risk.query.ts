import { Brackets, SelectQueryBuilder } from 'typeorm';

import { VisaCaseStatus, VisaReminderType } from '../../common/constants/enums';
import { buildVisaCaseDataScopeExistsFragment } from '../visa-case/visa-case-data-scope.query';
import type { ResolvedVisaDataScope } from '../visa-case/visa-case-data-scope.types';
import { Customer } from './entities/customer.entity';

/**
 * 将聚合后的最小桶序号映射为 `VisaReminderType`，与 `/visa-reminders` 单案去重优先级一致。
 *
 * @param minRank - `MIN(CASE … END)` 的聚合结果（字符串或数字），无命中时为 null
 * @returns 派生风险枚举；无风险时返回 null
 */
export function mapMinRankToVisaReminderType(
  minRank: string | number | null | undefined,
): VisaReminderType | null {
  if (minRank === null || minRank === undefined || minRank === '') {
    return null;
  }
  const n = typeof minRank === 'string' ? Number(minRank) : minRank;
  if (Number.isNaN(n)) {
    return null;
  }
  if (n === 0) return VisaReminderType.SUPPLEMENT;
  if (n === 1) return VisaReminderType.TODAY_FOLLOW_UP;
  if (n === 2) return VisaReminderType.EXPIRING_7_DAYS;
  if (n === 3) return VisaReminderType.EXPIRING_2_MONTHS;
  return null;
}

/**
 * 生成单条开放案件的主提醒桶序号 SQL 片段（0–3），语义与 `VisaCaseReminderService.resolveReminderBucket` 一致。
 *
 * @param alias - QueryBuilder 中 `visa_cases` 表别名（如 `vc`）
 * @param includeSupplementIdList - 是否将最新补件日志命中的案件 ID 并入补件判定
 * @returns 可嵌入 `MIN(...)` 的 CASE 表达式字符串；调用方须设置 `:cvDrToday`、`:cvDrSupSt` 及可选 `:...cvDrSupIds`
 */
export function buildOpenCasePrimaryBucketRankCaseSql(
  alias: string,
  includeSupplementIdList: boolean,
): string {
  const supplementCond = includeSupplementIdList
    ? `(${alias}.caseStatus = :cvDrSupSt OR ${alias}.id IN (:...cvDrSupIds))`
    : `${alias}.caseStatus = :cvDrSupSt`;

  return `CASE
    WHEN ${supplementCond} THEN 0
    WHEN DATE(${alias}.nextFollowUpAt) = CAST(:cvDrToday AS date) THEN 1
    WHEN ${alias}.expireDate IS NOT NULL AND (${alias}.expireDate - CAST(:cvDrToday AS date)) <= 7 THEN 2
    WHEN ${alias}.expireDate IS NOT NULL
      AND (${alias}.expireDate - CAST(:cvDrToday AS date)) > 7
      AND (${alias}.expireDate - CAST(:cvDrToday AS date)) <= 60 THEN 3
    ELSE NULL
  END`;
}

const REMINDER_EXCLUDED_STATUSES = [
  VisaCaseStatus.COMPLETED,
  VisaCaseStatus.CANCELLED,
] as const;

function appendClexSupplementExists(
  qb: SelectQueryBuilder<Customer>,
  openCaseSql: string,
  supplementIds: string[],
): void {
  qb.andWhere(
    new Brackets((w) => {
      if (supplementIds.length > 0) {
        w.where(
          `EXISTS (
            SELECT 1 FROM visa_cases vf
            WHERE ${openCaseSql}
              AND (vf.case_status = :clexSupSt OR vf.id IN (:...clexSuppIds))
          )`,
        );
      } else {
        w.where(
          `EXISTS (
            SELECT 1 FROM visa_cases vf
            WHERE ${openCaseSql}
              AND vf.case_status = :clexSupSt
          )`,
        );
      }
    }),
  );
}

function appendClexExpireWindowExists(
  qb: SelectQueryBuilder<Customer>,
  openCaseSql: string,
  notSupplementSql: string,
  notTodayFollowUpSql: string,
  minDaysExclusive: number,
  maxDaysInclusive: number,
): void {
  const cmp =
    minDaysExclusive === 0
      ? `(vf.expire_date - CAST(:clexToday AS date)) <= ${maxDaysInclusive}`
      : `(vf.expire_date - CAST(:clexToday AS date)) > ${minDaysExclusive}
            AND (vf.expire_date - CAST(:clexToday AS date)) <= ${maxDaysInclusive}`;
  qb.andWhere(
    `EXISTS (
      SELECT 1 FROM visa_cases vf
      WHERE ${openCaseSql}
        AND ${notSupplementSql}
        AND ${notTodayFollowUpSql}
        AND vf.expire_date IS NOT NULL
        AND ${cmp}
    )`,
  );
}

/**
 * 为客户列表查询追加「派生风险桶」EXISTS 筛选，语义与全局案件列表 `reminderBucket` 及 docs/25 §4.4 一致。
 *
 * @param qb - 客户主表 alias 为 `c` 的查询构造器
 * @param bucket - 目标提醒桶
 * @param todayStr - 当日 YYYY-MM-DD（与提醒服务本地日历一致）
 * @param supplementIds - 最新案件日志命中补件规则的案件 ID
 * @param dataScope - 与 `GET /visa-cases` 一致的负责人范围；缺省为全部
 */
export function applyCustomerListVisaReminderBucketExists(
  qb: SelectQueryBuilder<Customer>,
  bucket: VisaReminderType,
  todayStr: string,
  supplementIds: string[],
  dataScope: ResolvedVisaDataScope = { mode: 'all' },
): void {
  qb.setParameter('clexToday', todayStr);
  qb.setParameter('clexExcluded', [...REMINDER_EXCLUDED_STATUSES]);
  qb.setParameter('clexSupSt', VisaCaseStatus.SUPPLEMENT);

  const scopeFrag = buildVisaCaseDataScopeExistsFragment(
    'vf',
    dataScope,
    'clexVds',
  );
  for (const [k, v] of Object.entries(scopeFrag.params)) {
    qb.setParameter(k, v);
  }

  const openCaseSql = `vf.deleted_at IS NULL
    AND vf.case_status NOT IN (:...clexExcluded)
    AND vf.customer_id = c.id${scopeFrag.sql}`;

  const notSupplementSql =
    supplementIds.length > 0
      ? `(vf.case_status != :clexSupSt AND vf.id NOT IN (:...clexSuppIds))`
      : `vf.case_status != :clexSupSt`;

  if (supplementIds.length > 0) {
    qb.setParameter('clexSuppIds', supplementIds);
  }

  const notTodayFollowUpSql = `(vf.next_follow_up_at IS NULL OR DATE(vf.next_follow_up_at) != CAST(:clexToday AS date))`;

  switch (bucket) {
    case VisaReminderType.SUPPLEMENT:
      appendClexSupplementExists(qb, openCaseSql, supplementIds);
      break;
    case VisaReminderType.TODAY_FOLLOW_UP:
      qb.andWhere(
        `EXISTS (
          SELECT 1 FROM visa_cases vf
          WHERE ${openCaseSql}
            AND ${notSupplementSql}
            AND DATE(vf.next_follow_up_at) = CAST(:clexToday AS date)
        )`,
      );
      break;
    case VisaReminderType.EXPIRING_7_DAYS:
      appendClexExpireWindowExists(
        qb,
        openCaseSql,
        notSupplementSql,
        notTodayFollowUpSql,
        0,
        7,
      );
      break;
    case VisaReminderType.EXPIRING_2_MONTHS:
      appendClexExpireWindowExists(
        qb,
        openCaseSql,
        notSupplementSql,
        notTodayFollowUpSql,
        7,
        60,
      );
      break;
    default:
      break;
  }
}
