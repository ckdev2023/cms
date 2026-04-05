/**
 * 行内新建家属客户前，按电话号码做一次弱重复提示，减少重复建档。
 */
import { ElMessageBox } from 'element-plus'

import { getCustomers } from '@/api/customer'

/**
 * 当用户填写了电话时检索可能已存在的客户；若命中则弹出确认框，取消则中止新建。
 *
 * @param phone - 用户输入的电话号码（已 trim）
 * @param buildMessage - 由调用方用 i18n 拼接命中客户展示名后的完整正文
 * @param title - 弹窗标题
 * @param confirmButtonText - 确认仍要新建按钮
 * @param cancelButtonText - 取消按钮（返回列表选择）
 * @returns 允许继续新建时为 true；用户点取消或关闭为 false
 */
export async function confirmProceedWhenPhoneMayMatchExisting(
  phone: string,
  buildMessage: (namesJoined: string) => string,
  title: string,
  confirmButtonText: string,
  cancelButtonText: string,
): Promise<boolean> {
  const trimmed = phone.trim()
  if (trimmed.length < 2) {
    return true
  }
  const res = await getCustomers({ page: 1, pageSize: 20, keyword: trimmed })
  const normalized = trimmed.replace(/\s+/g, '')
  const hits = res.data.items.filter(
    (c) => c.phone && c.phone.replace(/\s+/g, '') === normalized,
  )
  if (hits.length === 0) {
    return true
  }
  const namesJoined = hits
    .slice(0, 3)
    .map((c) => c.customerName)
    .join('、')
  const body = buildMessage(namesJoined)
  try {
    await ElMessageBox.confirm(body, title, {
      type: 'warning',
      confirmButtonText,
      cancelButtonText,
    })
    return true
  } catch {
    return false
  }
}
