import { Brackets, type SelectQueryBuilder } from 'typeorm';

import { FamilyLinkMode, VisaCaseStatus } from '../../common/constants/enums';
import { buildVisaCaseDataScopeExistsFragment } from '../visa-case/visa-case-data-scope.query';
import type { ResolvedVisaDataScope } from '../visa-case/visa-case-data-scope.types';
import { applyCustomerListVisaReminderBucketExists } from './customer-visa-derived-risk.query';
import type { QueryCustomerDto } from './dto/query-customer.dto';
import type { Customer } from './entities/customer.entity';
import { addCalendarDaysLocal, formatLocalDateOnly } from './visa-alert.util';

/**
 * 为客户列表关键字叠加主表联系方式与 person_info 护照号等 ILIKE OR 条件组。
 *
 * @param qb - 已建立 `c` 别名并 left join `pi` 的客户查询构造器
 * @param keyword - 用户输入的列表关键词（原样参与模糊匹配）
 */
/**
 * 为客户列表追加微信与 LINE 主档模糊条件（ILIKE）。
 *
 * @param qb - 客户主表 alias 为 `c` 的查询构造器
 * @param query - 含 `wechatId` / `lineId` 的查询 DTO
 */
function applyCustomerListWechatLineFilters(
  qb: SelectQueryBuilder<Customer>,
  query: QueryCustomerDto,
): void {
  const wechatFilter = query.wechatId?.trim();
  if (wechatFilter) {
    qb.andWhere('c.wechatId ILIKE :wechatIdFilter', {
      wechatIdFilter: `%${wechatFilter}%`,
    });
  }
  const lineFilter = query.lineId?.trim();
  if (lineFilter) {
    qb.andWhere('c.lineId ILIKE :lineIdFilter', {
      lineIdFilter: `%${lineFilter}%`,
    });
  }
}

function applyCustomerListKeywordFilter(
  qb: SelectQueryBuilder<Customer>,
  keyword: string,
): void {
  const kw = `%${keyword}%`;
  qb.andWhere(
    new Brackets((sub) => {
      sub
        .where('c.customerName ILIKE :kw', { kw })
        .orWhere('c.customerCode ILIKE :kw', { kw })
        .orWhere('c.phone ILIKE :kw', { kw })
        .orWhere('c.email ILIKE :kw', { kw })
        .orWhere('c.wechatId ILIKE :kw', { kw })
        .orWhere('c.lineId ILIKE :kw', { kw })
        .orWhere('pi.passportNumber ILIKE :kw', { kw });
    }),
  );
}

/**
 * 为客户列表追加「主展示案件行」多维 EXISTS，与 `CustomerListPrimaryVisaCaseService` 的 DISTINCT ON 规则及 `dataScope` 一致（docs/17 §1.11）。
 *
 * @param qb - 客户主表 alias 为 `c` 的查询构造器
 * @param filters - 可选状态、家族签、主申模式；至少一项有值时才追加条件
 * @param resolved - 与派生风险、主摘要同源的数据范围
 */
export function applyCustomerListListPrimaryVisaCaseRowFilters(
  qb: SelectQueryBuilder<Customer>,
  filters: {
    status?: VisaCaseStatus;
    isFamilyCase?: boolean;
    familyLinkMode?: FamilyLinkMode;
  },
  resolved: ResolvedVisaDataScope,
): void {
  const hasStatus = filters.status !== undefined;
  const hasFamily = filters.isFamilyCase !== undefined;
  const hasMode = filters.familyLinkMode !== undefined;
  if (!hasStatus && !hasFamily && !hasMode) {
    return;
  }

  const scopeFrag = buildVisaCaseDataScopeExistsFragment(
    'vpc',
    resolved,
    'pclpVds',
  );
  for (const [k, v] of Object.entries(scopeFrag.params)) {
    qb.setParameter(k, v);
  }
  const terminal = `('${VisaCaseStatus.COMPLETED}', '${VisaCaseStatus.CANCELLED}')`;

  const whereParts: string[] = [];
  const params: Record<string, unknown> = {};
  if (hasStatus) {
    whereParts.push('prim.pclp_cs = :pclpWantStatus');
    params.pclpWantStatus = filters.status;
  }
  if (hasFamily) {
    whereParts.push('prim.pclp_ifc = :pclpWantFamily');
    params.pclpWantFamily = filters.isFamilyCase;
  }
  if (hasMode) {
    whereParts.push('prim.pclp_flm = :pclpWantFlm');
    params.pclpWantFlm = filters.familyLinkMode;
  }

  qb.andWhere(
    `EXISTS (
      SELECT 1 FROM (
        SELECT DISTINCT ON (vpc.customer_id)
          vpc.case_status AS pclp_cs,
          vpc.is_family_case AS pclp_ifc,
          vpc.family_link_mode AS pclp_flm
        FROM visa_cases vpc
        WHERE vpc.deleted_at IS NULL
          AND vpc.customer_id = c.id${scopeFrag.sql}
        ORDER BY
          vpc.customer_id,
          CASE WHEN vpc.case_status IN ${terminal} THEN 1 ELSE 0 END,
          (CASE WHEN vpc.case_status NOT IN ${terminal} THEN vpc.next_follow_up_at END) ASC NULLS LAST,
          (CASE WHEN vpc.case_status NOT IN ${terminal} THEN vpc.expire_date END) ASC NULLS LAST,
          vpc.updated_at DESC,
          vpc.id DESC
      ) prim
      WHERE ${whereParts.join(' AND ')}
    )`,
    params,
  );
}

/**
 * 当 Query DTO 含主展示案件相关筛选项时，叠加与摘要同源的 DISTINCT ON EXISTS 条件。
 *
 * @param qb - 客户主表 alias 为 `c` 的查询构造器
 * @param query - 客户列表查询 DTO
 * @param resolved - 签证数据范围
 */
function applyOptionalListPrimaryVisaCaseFiltersFromDto(
  qb: SelectQueryBuilder<Customer>,
  query: QueryCustomerDto,
  resolved: ResolvedVisaDataScope,
): void {
  if (
    !query.listPrimaryVisaCaseStatus &&
    query.listPrimaryIsFamilyCase === undefined &&
    !query.listPrimaryFamilyLinkMode
  ) {
    return;
  }
  applyCustomerListListPrimaryVisaCaseRowFilters(
    qb,
    {
      status: query.listPrimaryVisaCaseStatus,
      isFamilyCase: query.listPrimaryIsFamilyCase,
      familyLinkMode: query.listPrimaryFamilyLinkMode,
    },
    resolved,
  );
}

/**
 * 为客户列表追加「名下未软删签证案件 case_type ILIKE」EXISTS 条件（与 `visa_cases.case_type` 对齐）。
 *
 * @param qb - 客户主表 alias 为 `c` 的查询构造器
 * @param trimmedKeyword - 已 trim 的用户输入（非空）
 */
function applyCustomerListVisaCaseTypeKeywordFilter(
  qb: SelectQueryBuilder<Customer>,
  trimmedKeyword: string,
): void {
  qb.andWhere(
    `EXISTS (
        SELECT 1 FROM visa_cases vct
        WHERE vct.deleted_at IS NULL
          AND vct.customer_id = c.id
          AND vct.case_type ILIKE :vctCaseTypeKw
      )`,
    { vctCaseTypeKw: `%${trimmedKeyword}%` },
  );
}

/**
 * 在「在留期限 N 自然日内」条件成立时，为客户列表追加 `person_info.residence_expire_date` 上界过滤。
 *
 * @param qb - 已建立 `pi` join 的客户查询构造器
 * @param residenceDays - `residenceExpireWithinDays` 原始值（无效时直接返回）
 * @param todayStr - 列表基準日 YYYY-MM-DD（与 `visa-alert` 本地日历一致）
 */
function applyCustomerListResidenceExpireWithinDaysFilter(
  qb: SelectQueryBuilder<Customer>,
  residenceDays: number | undefined | null,
  todayStr: string,
): void {
  if (
    residenceDays === undefined ||
    residenceDays === null ||
    !Number.isFinite(residenceDays)
  ) {
    return;
  }
  const parts = todayStr.split('-').map((v) => Number(v));
  const y = parts[0];
  const mo = parts[1];
  const day = parts[2];
  const todayLocal = new Date(y, mo - 1, day);
  const upper = formatLocalDateOnly(
    addCalendarDaysLocal(todayLocal, residenceDays),
  );
  qb.andWhere('pi.residenceExpireDate IS NOT NULL');
  qb.andWhere('pi.residenceExpireDate <= :residenceExpireUpper', {
    residenceExpireUpper: upper,
  });
}

/**
 * 为客户列表 QueryBuilder 叠加关键字、业务枚举筛选、微信/LINE 条件、签证类目 EXISTS 与签证提醒桶 EXISTS 条件。
 *
 * @param qb - 已建立 `c` 别名并 join 附属表的客户查询构造器
 * @param query - 列表筛选参数（含 keyword、wechatId、lineId、类型、签证类目、签证桶、在留 N 日内、主档下家属 primaryCustomerId 等）
 * @param todayStr - 当日 YYYY-MM-DD（与提醒桶子查询一致）
 * @param supplementLogCaseIds - 补件日志命中的案件 ID 列表
 * @param resolved - 已解析的签证数据范围（与 EXISTS 子查询一致）
 */
export function applyCustomerListFiltersToQueryBuilder(
  qb: SelectQueryBuilder<Customer>,
  query: QueryCustomerDto,
  todayStr: string,
  supplementLogCaseIds: string[],
  resolved: ResolvedVisaDataScope,
): void {
  const { keyword } = query;

  if (keyword) {
    applyCustomerListKeywordFilter(qb, keyword);
  }

  applyCustomerListWechatLineFilters(qb, query);

  if (query.customerType) {
    qb.andWhere('c.customerType = :customerType', {
      customerType: query.customerType,
    });
  }

  if (query.serviceType) {
    qb.andWhere('c.serviceType = :serviceType', {
      serviceType: query.serviceType,
    });
  }

  const visaCaseTypeKw = query.visaCaseTypeKeyword?.trim();
  if (visaCaseTypeKw) {
    applyCustomerListVisaCaseTypeKeywordFilter(qb, visaCaseTypeKw);
  }

  if (query.status) {
    qb.andWhere('c.status = :status', { status: query.status });
  }

  if (query.ownerUserId) {
    qb.andWhere('c.ownerUserId = :ownerUserId', {
      ownerUserId: query.ownerUserId,
    });
  }

  if (query.primaryCustomerId) {
    qb.andWhere('pi.primaryCustomerId = :familyOfPrimaryCustomerId', {
      familyOfPrimaryCustomerId: query.primaryCustomerId,
    });
    qb.andWhere('pi.isFamilyMember = :familyMemberOnlyTrue', {
      familyMemberOnlyTrue: true,
    });
  }

  applyOptionalListPrimaryVisaCaseFiltersFromDto(qb, query, resolved);

  if (query.visaReminderBucket) {
    applyCustomerListVisaReminderBucketExists(
      qb,
      query.visaReminderBucket,
      todayStr,
      supplementLogCaseIds,
      resolved,
    );
  }

  applyCustomerListResidenceExpireWithinDaysFilter(
    qb,
    query.residenceExpireWithinDays,
    todayStr,
  );
}
