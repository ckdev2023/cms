/**
 * 向导内「行内新建客户」取消会话时的补偿删除，避免未提交案件时留下空壳主档。
 */
import { deleteCustomer } from '@/api/customer'
import { runSequentially } from '@/utils/run-sequentially'

import type { PendingMember } from './types'

/**
 * 对标记为向导内联创建的家属客户逐条调用删除接口，忽略单条失败（权限或已关联数据等）。
 *
 * @param members - 当前待提交家属列表快照（须在 reset 前拷贝）
 */
export async function rollbackWizardInlineCustomers(
  members: PendingMember[],
): Promise<void> {
  const ids = members
    .filter((m) => m.createdViaWizardInline)
    .map((m) => m.customerId)
  await runSequentially(ids, async (id) => {
    try {
      await deleteCustomer(id)
    } catch {
      /* 单条删除失败不阻断其余回滚 */
    }
  })
}
