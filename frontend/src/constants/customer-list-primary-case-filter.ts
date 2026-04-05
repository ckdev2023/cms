import { VisaCaseStatus } from '@/constants/enums'

/**
 * 客户列表「主展示案件状态」筛选项，与后端 `QueryCustomerDto.listPrimaryVisaCaseStatus` 枚举取值一致。
 */
export const PRIMARY_CASE_STATUS_FILTER_OPTIONS = Object.freeze(
  Object.values(VisaCaseStatus).filter((v): v is VisaCaseStatus => typeof v === 'string'),
)
