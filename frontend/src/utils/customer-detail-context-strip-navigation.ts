import type { Router } from 'vue-router'

import type { CustomerListPrimaryVisaCaseSummary } from '@/types/customer'

/** 摘要条 `router.push` 时与 `pickCustomerDetailDeepLinkPreserve` 对齐的扁平 query 片段 */
export type ContextStripQueryBase = Record<string, string>

/**
 * 跳转客户详情签证域并打开主展示案件编辑上下文（`openVisaCaseId`）。
 *
 * @param router - Vue Router 实例
 * @param base - 须保留的深链 query 基底
 * @param customerId - 当前客户 UUID
 * @param visaCaseId - 主展示案件 UUID
 */
export function pushContextStripOpenPrimaryCase(
  router: Router,
  base: ContextStripQueryBase,
  customerId: string,
  visaCaseId: string,
): void {
  void router.push({
    path: `/customers/${customerId}`,
    query: {
      ...base,
      tab: 'visa-domain',
      openVisaCaseId: visaCaseId,
    },
  })
}

/**
 * 跳转签证域材料子块并锁定给定案件（`visaDomainBlock` + `materialsVisaCaseId`）。
 *
 * @param router - Vue Router 实例
 * @param base - 须保留的深链 query 基底
 * @param customerId - 当前客户 UUID
 * @param visaCaseId - 材料清单目标案件 UUID
 */
export function pushContextStripOpenMaterials(
  router: Router,
  base: ContextStripQueryBase,
  customerId: string,
  visaCaseId: string,
): void {
  void router.push({
    path: `/customers/${customerId}`,
    query: {
      ...base,
      tab: 'visa-domain',
      visaDomainBlock: 'materials',
      materialsVisaCaseId: visaCaseId,
    },
  })
}

/**
 * 跳转签证域日志子块并打开新建案件日志表单（`logVisaCaseId` + `openVisaCaseLogForm`）。
 *
 * @param router - Vue Router 实例
 * @param base - 须保留的深链 query 基底
 * @param customerId - 当前客户 UUID
 * @param pc - 主展示案件摘要（用于案件 id 与可选 `suggestedNextFollowUpAt`）
 */
export function pushContextStripOpenWriteLog(
  router: Router,
  base: ContextStripQueryBase,
  customerId: string,
  pc: CustomerListPrimaryVisaCaseSummary,
): void {
  const query: Record<string, string> = {
    ...base,
    tab: 'visa-domain',
    visaDomainBlock: 'logs',
    logVisaCaseId: pc.visaCaseId,
    openVisaCaseLogForm: '1',
  }
  if (pc.nextFollowUpAt) {
    query.suggestedNextFollowUpAt = pc.nextFollowUpAt
  }
  void router.push({
    path: `/customers/${customerId}`,
    query,
  })
}

/**
 * 打开签证域建案向导入口（`openVisaCaseWizard=1`）。
 *
 * @param router - Vue Router 实例
 * @param base - 须保留的深链 query 基底
 * @param customerId - 当前客户 UUID
 */
export function pushContextStripGoVisaWizard(
  router: Router,
  base: ContextStripQueryBase,
  customerId: string,
): void {
  void router.push({
    path: `/customers/${customerId}`,
    query: {
      ...base,
      tab: 'visa-domain',
      openVisaCaseWizard: '1',
    },
  })
}

/**
 * 进入签证域「案件」子块以查看本客户全部签证案件。
 *
 * @param router - Vue Router 实例
 * @param base - 须保留的深链 query 基底
 * @param customerId - 当前客户 UUID
 */
export function pushContextStripOpenAllVisaCases(
  router: Router,
  base: ContextStripQueryBase,
  customerId: string,
): void {
  void router.push({
    path: `/customers/${customerId}`,
    query: {
      ...base,
      tab: 'visa-domain',
      visaDomainBlock: 'cases',
    },
  })
}
