import { In, type Repository } from 'typeorm';

import { CustomerType } from '../../common/constants/enums';
import type { ResolvedVisaDataScope } from '../visa-case/visa-case-data-scope.types';
import type { CustomerListPrimaryVisaCaseSummaryDto } from './customer.service.types';
import type { Customer } from './entities/customer.entity';

/**
 * 从当前页客户与本人主展示摘要映射中，筛出可能需要「主客户摘要回退」的主档 ID 列表（去重、不含自指）。
 *
 * @param items - 当前页 `getManyAndCount` 得到的客户实体
 * @param selfPrimaryCaseMap - 页内客户 ID → 本人主展示摘要（无可见案件为 null）
 * @returns 待做存在性校验与第二轮摘要查询的主客户 UUID 列表
 */
export function collectCandidatePrimaryCustomerIdsForListFallback(
  items: Customer[],
  selfPrimaryCaseMap: ReadonlyMap<
    string,
    CustomerListPrimaryVisaCaseSummaryDto | null
  >,
): string[] {
  const candidatePrimaryIds: string[] = [];
  const seen = new Set<string>();
  for (const customer of items) {
    const selfSummary = selfPrimaryCaseMap.get(customer.id) ?? null;
    if (selfSummary !== null) {
      continue;
    }
    if (customer.customerType !== CustomerType.PERSONAL) {
      continue;
    }
    const person = customer.personInfo;
    if (
      person === null ||
      person.isFamilyMember !== true ||
      person.primaryCustomerId === null ||
      person.primaryCustomerId === ''
    ) {
      continue;
    }
    const primaryId = person.primaryCustomerId;
    if (primaryId === customer.id) {
      continue;
    }
    if (!seen.has(primaryId)) {
      seen.add(primaryId);
      candidatePrimaryIds.push(primaryId);
    }
  }
  return candidatePrimaryIds;
}

/**
 * 供 `loadFallbackPrimaryVisaCaseMapForListPage` 注入的仓库与摘要查询回调。
 */
export type LoadFallbackPrimaryVisaCaseMapDeps = {
  customerRepo: Repository<Customer>;
  fetchCustomerListPrimaryVisaCaseMap: (
    customerIds: string[],
    resolved: ResolvedVisaDataScope,
  ) => Promise<Map<string, CustomerListPrimaryVisaCaseSummaryDto | null>>;
};

/**
 * 批量确认主客户未软删后，在同一 `resolved` 下查询其主展示案件摘要映射，供列表行回退装配。
 *
 * @param deps - 客户仓库与 `fetchCustomerListPrimaryVisaCaseMap` 实现
 * @param candidatePrimaryIds - 候选主客户 ID（通常来自 `collectCandidatePrimaryCustomerIdsForListFallback`）
 * @param resolved - 与列表第一轮摘要相同的签证数据范围
 * @returns 确实存在的主客户 ID 集合及其摘要映射（无案件值为 null）
 */
export async function loadFallbackPrimaryVisaCaseMapForListPage(
  deps: LoadFallbackPrimaryVisaCaseMapDeps,
  candidatePrimaryIds: string[],
  resolved: ResolvedVisaDataScope,
): Promise<{
  existingPrimaryCustomerIds: Set<string>;
  fallbackPrimaryCaseMap: Map<
    string,
    CustomerListPrimaryVisaCaseSummaryDto | null
  >;
}> {
  const emptyExisting = new Set<string>();
  const emptyMap = new Map<
    string,
    CustomerListPrimaryVisaCaseSummaryDto | null
  >();
  if (candidatePrimaryIds.length === 0) {
    return {
      existingPrimaryCustomerIds: emptyExisting,
      fallbackPrimaryCaseMap: emptyMap,
    };
  }

  const existingRows = await deps.customerRepo.find({
    where: { id: In(candidatePrimaryIds) },
    select: ['id'],
  });
  const existingPrimaryCustomerIds = new Set(existingRows.map((row) => row.id));
  if (existingPrimaryCustomerIds.size === 0) {
    return { existingPrimaryCustomerIds, fallbackPrimaryCaseMap: emptyMap };
  }

  const fallbackPrimaryCaseMap = await deps.fetchCustomerListPrimaryVisaCaseMap(
    [...existingPrimaryCustomerIds],
    resolved,
  );
  return { existingPrimaryCustomerIds, fallbackPrimaryCaseMap };
}
