/**
 * 向导内远程搜索客户并写入下拉候选项，供主申人与家属成员选择器复用。
 */
import type { Ref } from 'vue'

import { getCustomers } from '@/api/customer'
import type { CustomerItem } from '@/types/customer'

import type { SelectOption } from './types'

/**
 * 按关键字拉取客户列表并写入目标 ref，关键字过短时清空候选项并跳过请求。
 *
 * @param keyword - 远程搜索关键字
 * @param target - 接收映射后选项的 ref
 * @param loading - 请求进行中的 loading ref
 */
export async function runWizardCustomerRemoteSearch(
  keyword: string,
  target: Ref<SelectOption[]>,
  loading: Ref<boolean>,
): Promise<void> {
  if (keyword.length < 1) {
    target.value = []
    return
  }
  loading.value = true
  try {
    const res = await getCustomers({ page: 1, pageSize: 50, keyword })
    target.value = res.data.items.map((c: CustomerItem) => ({
      label: c.customerName,
      value: c.id,
    }))
  } catch {
    target.value = []
  } finally {
    loading.value = false
  }
}
