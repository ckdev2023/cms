/**
 * 初始化签证案件创建向导的 ref、reactive 表单与枚举派生 computed。
 */
import { useI18n } from 'vue-i18n'

import { createVisaCaseWizardBaseRefs } from './visaCaseWizardBaseRefs'
import { loadVisaCaseWizardCaseTypeOptions } from './visaCaseWizardCaseTypes'
import { createVisaCaseWizardComputeds } from './visaCaseWizardComputeds'
import { useContextApplicantDisplay } from './visaCaseWizardContextApplicant'
import { resetVisaCaseWizardCoreState } from './visaCaseWizardResetState'
import { loadVisaCaseWizardStaffOptions } from './visaCaseWizardStaff'

type WizardProps = {
  visible: boolean
  customerId: string
  contextCustomerName?: string
}

type ResetStatePayload = Parameters<typeof resetVisaCaseWizardCoreState>[0]
type BaseRefs = ReturnType<typeof createVisaCaseWizardBaseRefs>

function buildResetStatePayload(baseRefs: BaseRefs): ResetStatePayload {
  return {
    form: baseRefs.form,
    currentStep: baseRefs.currentStep,
    pendingMembers: baseRefs.pendingMembers,
    showAddForm: baseRefs.showAddForm,
    memberAddMode: baseRefs.memberAddMode,
    creatingInlineMember: baseRefs.creatingInlineMember,
    wizardSessionCommitted: baseRefs.wizardSessionCommitted,
    primaryCustomerOptions: baseRefs.primaryCustomerOptions,
    memberCustomerOptions: baseRefs.memberCustomerOptions,
    newMemberForm: baseRefs.newMemberForm,
    inlineMiniForm: baseRefs.inlineMiniForm,
    submitting: baseRefs.submitting,
  }
}

/**
 * 创建向导所需的 i18n 文案函数 T / CT 与全局 t。
 *
 * @returns 供步骤标题与按钮文案使用的翻译函数
 */
export function useWizardI18n(): {
  T: (key: string, params?: Record<string, unknown>) => string
  CT: (key: string) => string
  t: ReturnType<typeof useI18n>['t']
} {
  const { t } = useI18n({ useScope: 'global' })
  const T = (key: string, params?: Record<string, unknown>): string =>
    t(`detailViews.customer.visaCaseWizard.${key}`, params ?? {})
  const CT = (key: string): string => t(`detailViews.customer.visaCasesTab.${key}`)
  return { T, CT, t }
}

export type VisaCaseWizardCore = ReturnType<typeof initVisaCaseWizardCore>

/**
 * 初始化向导 refs、表单、computed 以及 reset / loadStaff 回调。
 *
 * @param props - 对话框可见性与当前客户 ID（用于后续提交）
 */
export function initVisaCaseWizardCore(props: WizardProps) {
  const { T, CT, t } = useWizardI18n()

  const baseRefs = createVisaCaseWizardBaseRefs()
  const {
    currentStep,
    submitting,
    staffOptions,
    caseTypeOptions,
    primaryCustomerOptions,
    primaryCustomerSearchLoading,
    pendingMembers,
    showAddForm,
    memberAddMode,
    creatingInlineMember,
    wizardSessionCommitted,
    memberCustomerOptions,
    memberCustomerSearchLoading,
    newMemberForm,
    inlineMiniForm,
    form,
  } = baseRefs

  const contextApplicantDisplay = useContextApplicantDisplay(props)

  const computeds = createVisaCaseWizardComputeds(
    form,
    primaryCustomerOptions,
    pendingMembers,
    newMemberForm,
    memberAddMode,
    inlineMiniForm,
  )

  const resetWizard = (): void =>
    resetVisaCaseWizardCoreState(buildResetStatePayload(baseRefs))

  const loadStaffOptions = async (): Promise<void> =>
    loadVisaCaseWizardStaffOptions(staffOptions)

  const loadCaseTypeOptions = async (): Promise<void> =>
    loadVisaCaseWizardCaseTypeOptions(caseTypeOptions)

  return {
    props,
    T,
    CT,
    t,
    currentStep,
    submitting,
    staffOptions,
    caseTypeOptions,
    primaryCustomerOptions,
    primaryCustomerSearchLoading,
    pendingMembers,
    showAddForm,
    memberAddMode,
    creatingInlineMember,
    wizardSessionCommitted,
    memberCustomerOptions,
    memberCustomerSearchLoading,
    newMemberForm,
    inlineMiniForm,
    form,
    contextApplicantDisplay,
    computeds,
    resetWizard,
    loadStaffOptions,
    loadCaseTypeOptions,
  }
}
