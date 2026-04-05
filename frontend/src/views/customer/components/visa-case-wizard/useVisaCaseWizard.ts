/**
 * 签证案件创建向导的状态、枚举选项与提交流程，供 CustomerVisaCaseWizard 与子步骤注入使用。
 */
import type { InjectionKey } from 'vue'
import { provide } from 'vue'

import { VisaCaseMemberRoleLabel } from '@/constants/enum-labels'

import { initVisaCaseWizardCore } from './visaCaseWizardCore'
import { createVisaCaseWizardHandlers } from './visaCaseWizardHandlers'
import { registerVisaCaseWizardWatchers } from './visaCaseWizardWatchers'

type WizardProps = {
  visible: boolean
  customerId: string
  /** 本页客户显示名（用于向导侧栏「申请人」预览；缺省时回退为 customerId） */
  contextCustomerName?: string
}

type WizardEmit = {
  (e: 'update:visible', value: boolean): void
  (e: 'created'): void
}

/** 子步骤通过 inject 获取的向导上下文（表单、选项与操作）。 */
export type VisaCaseWizardContext = ReturnType<typeof createVisaCaseWizardContext>

export const VISA_CASE_WIZARD_KEY: InjectionKey<VisaCaseWizardContext> = Symbol(
  'visaCaseWizard',
)

function createVisaCaseWizardContext(props: WizardProps, emit: WizardEmit) {
  const core = initVisaCaseWizardCore(props)
  registerVisaCaseWizardWatchers({
    props: core.props,
    form: core.form,
    currentStep: core.currentStep,
    pendingMembers: core.pendingMembers,
    wizardSessionCommitted: core.wizardSessionCommitted,
    resetWizard: core.resetWizard,
    loadStaffOptions: core.loadStaffOptions,
    loadCaseTypeOptions: core.loadCaseTypeOptions,
  })
  const handlers = createVisaCaseWizardHandlers(core, emit)

  return {
    form: core.form,
    contextApplicantDisplay: core.contextApplicantDisplay,
    T: core.T,
    CT: core.CT,
    t: core.t,
    currentStep: core.currentStep,
    submitting: core.submitting,
    staffOptions: core.staffOptions,
    caseTypeOptions: core.caseTypeOptions,
    primaryCustomerOptions: core.primaryCustomerOptions,
    primaryCustomerSearchLoading: core.primaryCustomerSearchLoading,
    pendingMembers: core.pendingMembers,
    showAddForm: core.showAddForm,
    memberAddMode: core.memberAddMode,
    creatingInlineMember: core.creatingInlineMember,
    inlineMiniForm: core.inlineMiniForm,
    memberCustomerOptions: core.memberCustomerOptions,
    memberCustomerSearchLoading: core.memberCustomerSearchLoading,
    newMemberForm: core.newMemberForm,
    ...core.computeds,
    VisaCaseMemberRoleLabel,
    ...handlers,
  }
}

/**
 * 在 CustomerVisaCaseWizard 根组件 setup 中初始化向导状态并向子步骤 provide 上下文。
 *
 * @param props - 对话框可见性与当前客户 ID
 * @param emit - 关闭对话框与创建成功事件
 * @returns 供模板绑定与同模块 provide 使用的上下文对象
 */
export function useVisaCaseWizard(
  props: WizardProps,
  emit: WizardEmit,
): VisaCaseWizardContext {
  const ctx = createVisaCaseWizardContext(props, emit)
  provide(VISA_CASE_WIZARD_KEY, ctx)
  return ctx
}
