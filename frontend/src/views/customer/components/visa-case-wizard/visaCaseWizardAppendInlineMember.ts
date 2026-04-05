/**
 * 向导家属步骤：调用 createCustomer 后将新主档挂入待提交家属列表。
 */
import { ElMessage } from 'element-plus'
import type { ComputedRef, Ref } from 'vue'

import { createCustomer } from '@/api/customer'
import { CustomerType, ServiceType } from '@/constants/enums'

import type { CaseFormModel, PendingMember } from './types'
import { confirmProceedWhenPhoneMayMatchExisting } from './visaCaseWizardInlineDuplicate'
import { rollbackWizardInlineCustomers } from './visaCaseWizardRollback'
import { allocTempMemberId } from './visaCaseWizardTempId'

type AppendInlineMemberI18n = {
  T: (key: string, params?: Record<string, unknown>) => string
  t: (key: string) => string
}

type AppendInlineMemberArgs = AppendInlineMemberI18n & {
  props: { customerId: string }
  form: CaseFormModel
  pendingMembers: Ref<PendingMember[]>
  showAddForm: Ref<boolean>
  creatingInlineMember: Ref<boolean>
  memberAddMode: Ref<'existing' | 'inline'>
  inlineMiniForm: { customerName: string; phone: string }
  newMemberForm: { memberRole: string }
  canAddMember: ComputedRef<boolean>
}

/**
 * 校验电话查重提示后创建个人客户，成功则写入 pendingMembers 并收起表单。
 *
 * @param args - 当前客户上下文、表单与向导 refs
 */
export async function appendInlineDependentMember(
  args: AppendInlineMemberArgs,
): Promise<void> {
  const {
    props,
    form,
    pendingMembers,
    showAddForm,
    creatingInlineMember,
    memberAddMode,
    inlineMiniForm,
    newMemberForm,
    canAddMember,
    T,
    t,
  } = args
  if (memberAddMode.value !== 'inline') {return}
  if (!canAddMember.value || creatingInlineMember.value) {return}
  const name = inlineMiniForm.customerName.trim()
  if (!name || !newMemberForm.memberRole) {return}
  const phone = inlineMiniForm.phone.trim()
  const proceed = await confirmProceedWhenPhoneMayMatchExisting(
    phone,
    (namesJoined) => T('duplicatePhoneInlineBody', { names: namesJoined }),
    T('duplicatePhoneInlineTitle'),
    T('duplicatePhoneInlineConfirm'),
    t('common.cancel'),
  )
  if (!proceed) {return}
  creatingInlineMember.value = true
  try {
    const res = await createCustomer({
      customerType: CustomerType.PERSONAL,
      customerName: name,
      phone: phone || undefined,
      serviceType: ServiceType.ADMIN,
      ownerUserId: form.assignedTo || undefined,
    })
    const newId = res.data.id
    const rollbackOne = (): void => {
      void rollbackWizardInlineCustomers([
        {
          tempId: 0,
          customerId: newId,
          memberRole: newMemberForm.memberRole,
          displayNameSnapshot: name,
          createdViaWizardInline: true,
        },
      ])
    }
    if (newId === props.customerId) {
      ElMessage.warning(T('cannotAddApplicantAsMember'))
      rollbackOne()
      return
    }
    if (form.internalPrimaryCustomerId && newId === form.internalPrimaryCustomerId) {
      ElMessage.warning(T('cannotAddInternalPrimaryAsMember'))
      rollbackOne()
      return
    }
    if (pendingMembers.value.some((m) => m.customerId === newId)) {
      ElMessage.warning(T('duplicateMember'))
      rollbackOne()
      return
    }
    pendingMembers.value.push({
      tempId: allocTempMemberId(),
      customerId: newId,
      memberRole: newMemberForm.memberRole,
      displayNameSnapshot: name,
      createdViaWizardInline: true,
    })
    showAddForm.value = false
  } finally {
    creatingInlineMember.value = false
  }
}
