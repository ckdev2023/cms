/**
 * 将向导内存状态恢复为初始草稿，供打开对话框或取消会话时复用。
 */
import type { Reactive, Ref } from 'vue'

import { defaultCaseForm } from './defaultCaseForm'
import type { CaseFormModel, PendingMember, SelectOption } from './types'
import { resetTempMemberIds } from './visaCaseWizardTempId'

type NewMemberFormShape = {
  customerId: string
  memberRole: string
  displayNameSnapshot: string
}

type InlineMiniFormShape = {
  customerName: string
  phone: string
}

/**
 * 清空步骤、待提交家属、搜索缓存与表单草稿，并重置行内新建相关标记。
 *
 * @param args - 向导核心中需一并清零的 ref / reactive 句柄
 */
export function resetVisaCaseWizardCoreState(args: {
  form: Reactive<CaseFormModel>
  currentStep: Ref<number>
  pendingMembers: Ref<PendingMember[]>
  showAddForm: Ref<boolean>
  memberAddMode: Ref<'existing' | 'inline'>
  creatingInlineMember: Ref<boolean>
  wizardSessionCommitted: Ref<boolean>
  primaryCustomerOptions: Ref<SelectOption[]>
  memberCustomerOptions: Ref<SelectOption[]>
  newMemberForm: NewMemberFormShape
  inlineMiniForm: InlineMiniFormShape
  submitting: Ref<boolean>
}): void {
  Object.assign(args.form, defaultCaseForm())
  args.currentStep.value = 0
  args.pendingMembers.value = []
  args.showAddForm.value = false
  args.memberAddMode.value = 'existing'
  args.creatingInlineMember.value = false
  args.wizardSessionCommitted.value = false
  args.primaryCustomerOptions.value = []
  args.memberCustomerOptions.value = []
  args.newMemberForm.customerId = ''
  args.newMemberForm.memberRole = ''
  args.newMemberForm.displayNameSnapshot = ''
  args.inlineMiniForm.customerName = ''
  args.inlineMiniForm.phone = ''
  args.submitting.value = false
  resetTempMemberIds()
}
