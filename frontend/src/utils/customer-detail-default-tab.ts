import { VisaCaseStatus } from '@/constants/enums'
import type { CustomerListPrimaryVisaCaseSummary } from '@/types/customer'

/**
 * 客户详情默认签证 Tab 与签证域汇总条「未结案」件数共用状态集合（含 DRAFT）。
 *
 * docs/17 §1.11 以 `COMPLETED` / `CANCELLED` 为终态界定主展示候选集 A「未结案」；本集合为界面统计选用的
 * 未结案管道子集（起草 + 进行中/提出/补件），不含 `APPROVED` / `REJECTED` 等终态前停驻状态。
 *
 * @see docs/17_业务口径冻结确认表.md §1.11（客户列表主展示案件选取与多案件排序规则）
 */
export const CUSTOMER_DETAIL_VISA_WORK_IN_PROGRESS_STATUSES = new Set<VisaCaseStatus>([
  VisaCaseStatus.DRAFT,
  VisaCaseStatus.IN_PROGRESS,
  VisaCaseStatus.SUBMITTED,
  VisaCaseStatus.SUPPLEMENT,
])

/**
 * 判断客户详情是否应默认选中签证域 Tab（无显式 `?tab=` 时由视图层消费）。
 *
 * @param customer - 已拉取详情的客户对象（与 `GET /customers/:id` 响应字段一致）
 * @param customer.listPrimaryVisaCase - 主展示签证案件摘要；缺省或 null 表示无用于默认 Tab 的主展示行
 * @returns 主展示案件状态属于未结案管道（含草稿）时返回 true
 */
export function customerDetailPrefersVisaDomainTab(customer: {
  listPrimaryVisaCase?: CustomerListPrimaryVisaCaseSummary | null
}): boolean {
  const primary = customer.listPrimaryVisaCase
  if (!primary) {
    return false
  }
  return CUSTOMER_DETAIL_VISA_WORK_IN_PROGRESS_STATUSES.has(primary.caseStatus)
}
