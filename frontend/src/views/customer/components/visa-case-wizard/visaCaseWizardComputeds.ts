/**
 * 签证案件创建向导的 computed 选项与派生状态，与 useVisaCaseWizard 中的 reactive 表单组合使用。
 */
import type { ComputedRef, Reactive, Ref } from 'vue'
import { computed } from 'vue'

import { FamilyLinkMode } from '@/constants/enums'

import type { CaseFormModel, PendingMember, SelectOption } from './types'
import { createVisaCaseWizardEnumOptionComputeds } from './visaCaseWizardEnumOptionComputeds'
import { canProceedVisaWizardStep1 } from './wizardStepValidation'

type NewMemberForm = {
  customerId: string
  memberRole: string
  displayNameSnapshot: string
}

type InlineMiniForm = {
  customerName: string
  phone: string
}

type ComputedBag = {
  totalSteps: ComputedRef<number>
  showInternalPrimary: ComputedRef<boolean>
  showExternalPrimary: ComputedRef<boolean>
  selectedPrimaryName: ComputedRef<string>
  canProceedStep1: ComputedRef<boolean>
  canAddMember: ComputedRef<boolean>
  isDuplicateMember: ComputedRef<boolean>
  caseStatusOptions: ComputedRef<SelectOption[]>
  materialStatusOptions: ComputedRef<SelectOption[]>
  feeStatusOptions: ComputedRef<SelectOption[]>
  familyLinkModeOptions: ComputedRef<SelectOption[]>
  familyRelationOptions: ComputedRef<SelectOption[]>
  memberRoleOptions: ComputedRef<SelectOption[]>
}

/**
 * 基于当前表单与选项 ref 构造向导所需的全部 computed（步骤数、主申人展示名、枚举下拉等）。
 *
 * @param form - 向导第一步 reactive 表单
 * @param primaryCustomerOptions - 内部主申人远程搜索候选项
 * @param pendingMembers - 待提交家属列表
 * @param newMemberForm - 新增家属行内表单
 * @param memberAddMode - 选择已有客户或行内快速建档
 * @param inlineMiniForm - 快速建档姓名与电话
 * @returns 供模板与注入上下文使用的 computed 集合
 */
export function createVisaCaseWizardComputeds(
  form: CaseFormModel,
  primaryCustomerOptions: Ref<SelectOption[]>,
  pendingMembers: Ref<PendingMember[]>,
  newMemberForm: NewMemberForm,
  memberAddMode: Ref<'existing' | 'inline'>,
  inlineMiniForm: Reactive<InlineMiniForm>,
): ComputedBag {
  const totalSteps = computed(() => (form.isFamilyCase ? 2 : 1))

  const showInternalPrimary = computed(
    () => form.isFamilyCase && form.familyLinkMode === FamilyLinkMode.INTERNAL,
  )

  const showExternalPrimary = computed(
    () => form.isFamilyCase && form.familyLinkMode === FamilyLinkMode.EXTERNAL,
  )

  const selectedPrimaryName = computed(() => {
    if (showInternalPrimary.value && form.internalPrimaryCustomerId) {
      return (
        primaryCustomerOptions.value.find(
          (o) => o.value === form.internalPrimaryCustomerId,
        )?.label ?? ''
      )
    }
    if (showExternalPrimary.value) {
      return form.externalPrimaryName
    }
    return ''
  })

  const canProceedStep1 = computed(() => canProceedVisaWizardStep1(form))

  const canAddMember = computed((): boolean => {
    if (!newMemberForm.memberRole) {
      return false
    }
    if (memberAddMode.value === 'inline') {
      return Boolean(inlineMiniForm.customerName.trim())
    }
    return Boolean(
      newMemberForm.customerId &&
        newMemberForm.memberRole &&
        newMemberForm.displayNameSnapshot.trim(),
    )
  })

  const isDuplicateMember = computed(() =>
    pendingMembers.value.some((m) => m.customerId === newMemberForm.customerId),
  )

  const enumOptions = createVisaCaseWizardEnumOptionComputeds()

  return {
    totalSteps,
    showInternalPrimary,
    showExternalPrimary,
    selectedPrimaryName,
    canProceedStep1,
    canAddMember,
    isDuplicateMember,
    ...enumOptions,
  }
}
