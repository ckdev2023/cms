import {
  ALLOWED_CUSTOMER_LIST_SORT_FIELDS,
  type AllowedCustomerListSortField,
} from './customer.service.types';

/**
 * 校验排序字段是否属于白名单，避免动态排序时注入非法列名。
 *
 * @param sortBy - 查询参数中的排序字段
 * @returns 命中白名单时返回 true
 */
export function isAllowedCustomerListSortField(
  sortBy?: string,
): sortBy is AllowedCustomerListSortField {
  return (
    typeof sortBy === 'string' &&
    ALLOWED_CUSTOMER_LIST_SORT_FIELDS.includes(
      sortBy as AllowedCustomerListSortField,
    )
  );
}
