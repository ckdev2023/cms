/**
 * 签证案件创建向导提交：创建案件后批量添加待提交家属。
 */
import { ElMessage } from 'element-plus'
import type { Ref } from 'vue'

import { addFamilyMember, createVisaCase } from '@/api/visa-case'
import { runSequentially } from '@/utils/run-sequentially'

import { buildVisaCasePayload } from './buildVisaCasePayload'
import type { CaseFormModel, PendingMember } from './types'

type SubmitDeps = {
  customerId: string
  form: CaseFormModel
  pendingMembers: Ref<PendingMember[]>
  submitting: Ref<boolean>
  T: (key: string, params?: Record<string, unknown>) => string
  CT: (key: string) => string
  /** 案件主档已成功创建后调用，用于跳过关闭向导时的行内客户回滚 */
  markSessionCommitted?: () => void
  onSuccess: () => void
}

/**
 * 组装载荷创建案件并逐条添加家属；部分失败时提示部分成功，仍关闭向导。
 *
 * @param deps - 当前客户、表单、待提交列表与回调
 */
export async function submitVisaCaseWizard(deps: SubmitDeps): Promise<void> {
  const { customerId, form, pendingMembers, submitting, T, CT, markSessionCommitted, onSuccess } =
    deps
  submitting.value = true
  try {
    const payload = buildVisaCasePayload(customerId, form)
    const res = await createVisaCase(customerId, payload)
    const caseId = res.data.id
    markSessionCommitted?.()

    let memberErrors = 0
    const membersSnapshot = [...pendingMembers.value]
    await runSequentially(membersSnapshot, async (member) => {
      try {
        await addFamilyMember(caseId, {
          customerId: member.customerId,
          memberRole: member.memberRole,
          displayNameSnapshot: member.displayNameSnapshot,
        })
      } catch {
        memberErrors++
      }
    })

    if (memberErrors > 0) {
      ElMessage.warning(T('partialSuccess', { failed: memberErrors }))
    } else {
      ElMessage.success(CT('createdSuccess'))
    }

    onSuccess()
  } finally {
    submitting.value = false
  }
}
