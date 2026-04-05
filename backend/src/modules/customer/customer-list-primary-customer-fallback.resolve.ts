import { CustomerType } from '../../common/constants/enums';
import type {
  CustomerListPrimaryVisaCaseSummaryDto,
  ListPrimaryVisaCaseSource,
} from './customer.service.types';
import type { Customer } from './entities/customer.entity';

/**
 * 单客户列表行上「主展示案件摘要 + 来源 + 回退主档 ID」的纯解析结果，字段名与 `CustomerListItemResponseDto` 对齐，供 `findAll` / `findOne` 装配层直接展开。
 */
export type CustomerListPrimaryVisaCaseDisplayResolution = {
  listPrimaryVisaCase: CustomerListPrimaryVisaCaseSummaryDto | null;
  listPrimaryVisaCaseSource: ListPrimaryVisaCaseSource;
  primaryCustomerIdForListFallback: string | null;
};

/**
 * 在已知的「本人摘要」与「主客户 ID → 主展示摘要」映射上，按 docs/31 §5.2 合并有效列表摘要与来源标注；不访问数据库。
 *
 * 约定：`primaryCaseMap` 须由对主客户 ID 批量调用 `fetchCustomerListPrimaryVisaCaseMap` 等方式构建，使非空摘要对应的 `visa_cases.customer_id` 等于该 map 键（§5.2.4）；本函数仅按键读取，不校验摘要内案件归属。
 *
 * @param customer - 当前列表行客户实体（须含 `personInfo` 以判断家属与 `primary_customer_id`）
 * @param selfSummary - 本人在当前 dataScope 下的主展示案件摘要；非空时一律视为 `SELF`
 * @param primaryCaseMap - 主客户 ID → 其主展示摘要；不可见或无案件时为 `null`
 * @param existingPrimaryCustomerIds - 未软删、确实存在的主客户 ID 集合（§5.2.3）
 * @returns 有效摘要、`listPrimaryVisaCaseSource` 与回退时主档 UUID
 */
export function resolveCustomerListPrimaryVisaCaseDisplay(
  customer: Customer,
  selfSummary: CustomerListPrimaryVisaCaseSummaryDto | null,
  primaryCaseMap: ReadonlyMap<
    string,
    CustomerListPrimaryVisaCaseSummaryDto | null
  >,
  existingPrimaryCustomerIds: ReadonlySet<string>,
): CustomerListPrimaryVisaCaseDisplayResolution {
  if (selfSummary !== null) {
    return {
      listPrimaryVisaCase: selfSummary,
      listPrimaryVisaCaseSource: 'SELF',
      primaryCustomerIdForListFallback: null,
    };
  }

  if (customer.customerType !== CustomerType.PERSONAL) {
    return {
      listPrimaryVisaCase: null,
      listPrimaryVisaCaseSource: null,
      primaryCustomerIdForListFallback: null,
    };
  }

  const person = customer.personInfo;
  if (
    person === null ||
    person.isFamilyMember !== true ||
    person.primaryCustomerId === null ||
    person.primaryCustomerId === ''
  ) {
    return {
      listPrimaryVisaCase: null,
      listPrimaryVisaCaseSource: null,
      primaryCustomerIdForListFallback: null,
    };
  }

  const primaryId = person.primaryCustomerId;
  if (primaryId === customer.id) {
    return {
      listPrimaryVisaCase: null,
      listPrimaryVisaCaseSource: null,
      primaryCustomerIdForListFallback: null,
    };
  }

  if (!existingPrimaryCustomerIds.has(primaryId)) {
    return {
      listPrimaryVisaCase: null,
      listPrimaryVisaCaseSource: null,
      primaryCustomerIdForListFallback: null,
    };
  }

  const primarySummary = primaryCaseMap.get(primaryId) ?? null;
  if (primarySummary === null) {
    return {
      listPrimaryVisaCase: null,
      listPrimaryVisaCaseSource: null,
      primaryCustomerIdForListFallback: null,
    };
  }

  return {
    listPrimaryVisaCase: primarySummary,
    listPrimaryVisaCaseSource: 'PRIMARY_CUSTOMER_FALLBACK',
    primaryCustomerIdForListFallback: primaryId,
  };
}
