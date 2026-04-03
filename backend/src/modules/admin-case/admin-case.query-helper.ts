import { Brackets, type ObjectLiteral, type SelectQueryBuilder } from 'typeorm';

import type { QueryAdminCaseDto } from './dto/query-admin-case.dto';
import type { QueryInterviewDto } from './dto/query-interview.dto';
import type { AdminCase } from './entities/admin-case.entity';
import type { AdminCaseInterview } from './entities/admin-case-interview.entity';

const ADMIN_CASE_SORT_FIELDS = new Set([
  'caseName',
  'status',
  'expireDate',
  'createdAt',
  'updatedAt',
]);

/**
 * 为行政案件列表查询拼装筛选条件、排序和分页参数。
 *
 * @param qb - 行政案件列表查询构造器
 * @param query - 列表查询条件
 */
export function applyAdminCaseListQueryOptions(
  qb: SelectQueryBuilder<AdminCase>,
  query: QueryAdminCaseDto,
): void {
  applyAdminCaseListFilters(qb, query);
  applyAdminCaseListSorting(qb, query.sortBy, query.sortOrder);
  applyPagination(qb, query.page ?? 1, query.pageSize ?? 20);
}

/**
 * 为案件面谈列表查询拼装筛选条件、排序和分页参数。
 *
 * @param qb - 面谈列表查询构造器
 * @param query - 面谈列表查询条件
 */
export function applyAdminCaseInterviewQueryOptions(
  qb: SelectQueryBuilder<AdminCaseInterview>,
  query: QueryInterviewDto,
): void {
  applyAdminCaseInterviewFilters(qb, query);
  qb.orderBy('iv.interviewDate', query.sortOrder ?? 'DESC');
  applyPagination(qb, query.page ?? 1, query.pageSize ?? 20);
}

/**
 * 为行政案件列表查询追加筛选条件。
 *
 * @param qb - 行政案件列表查询构造器
 * @param query - 列表查询条件
 */
function applyAdminCaseListFilters(
  qb: SelectQueryBuilder<AdminCase>,
  query: QueryAdminCaseDto,
): void {
  if (query.keyword) {
    qb.andWhere(
      new Brackets((sub) => {
        sub
          .where('ac.caseName ILIKE :kw', { kw: `%${query.keyword}%` })
          .orWhere('ac.applicantName ILIKE :kw', { kw: `%${query.keyword}%` })
          .orWhere('customer.customerName ILIKE :kw', {
            kw: `%${query.keyword}%`,
          });
      }),
    );
  }

  if (query.status) {
    qb.andWhere('ac.status = :status', { status: query.status });
  }

  if (query.customerId) {
    qb.andWhere('ac.customerId = :customerId', {
      customerId: query.customerId,
    });
  }

  if (query.ownerUserId) {
    qb.andWhere('ac.ownerUserId = :ownerUserId', {
      ownerUserId: query.ownerUserId,
    });
  }

  if (query.expireDateFrom) {
    qb.andWhere('ac.expireDate >= :from', { from: query.expireDateFrom });
  }

  if (query.expireDateTo) {
    qb.andWhere('ac.expireDate <= :to', { to: query.expireDateTo });
  }
}

/**
 * 为行政案件列表查询追加排序条件。
 *
 * @param qb - 行政案件列表查询构造器
 * @param sortBy - 请求排序字段
 * @param sortOrder - 请求排序方向
 */
function applyAdminCaseListSorting(
  qb: SelectQueryBuilder<AdminCase>,
  sortBy?: string,
  sortOrder: 'ASC' | 'DESC' = 'DESC',
): void {
  const orderField =
    sortBy && ADMIN_CASE_SORT_FIELDS.has(sortBy) ? sortBy : 'createdAt';

  qb.orderBy(`ac.${orderField}`, sortOrder);
}

/**
 * 为案件面谈列表查询追加日期区间筛选条件。
 *
 * @param qb - 面谈列表查询构造器
 * @param query - 面谈列表查询条件
 */
function applyAdminCaseInterviewFilters(
  qb: SelectQueryBuilder<AdminCaseInterview>,
  query: QueryInterviewDto,
): void {
  if (query.dateFrom) {
    qb.andWhere('iv.interviewDate >= :dateFrom', {
      dateFrom: query.dateFrom,
    });
  }

  if (query.dateTo) {
    qb.andWhere('iv.interviewDate <= :dateTo', { dateTo: query.dateTo });
  }
}

/**
 * 为分页查询统一追加偏移量与页大小。
 *
 * @param qb - 任意 TypeORM 查询构造器
 * @param page - 当前页码
 * @param pageSize - 每页大小
 */
function applyPagination<Entity extends ObjectLiteral>(
  qb: SelectQueryBuilder<Entity>,
  page: number,
  pageSize: number,
): void {
  qb.skip((page - 1) * pageSize).take(pageSize);
}
