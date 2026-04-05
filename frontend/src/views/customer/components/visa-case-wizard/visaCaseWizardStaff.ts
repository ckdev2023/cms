/**
 * 加载负责人下拉数据，供签证案件创建向导 staff select 使用。
 */
import type { Ref } from 'vue'

import { getUsers } from '@/api/system'
import type { SystemUser } from '@/types/system'

import type { SelectOption } from './types'

/**
 * 首次请求活跃用户列表并写入 staffOptions，失败时置空候选项。
 *
 * @param staffOptions - 负责人下拉选项 ref
 */
export async function loadVisaCaseWizardStaffOptions(
  staffOptions: Ref<SelectOption[]>,
): Promise<void> {
  if (staffOptions.value.length > 0) {return}
  try {
    const res = await getUsers({ page: 1, pageSize: 200, status: 'ACTIVE' })
    staffOptions.value = res.data.items.map((user: SystemUser) => ({
      label: user.displayName,
      value: user.id,
    }))
  } catch {
    staffOptions.value = []
  }
}
