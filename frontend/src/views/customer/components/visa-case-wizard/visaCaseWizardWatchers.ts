/**
 * 注册签证案件创建向导的副作用监听（打开时重置、家庭案切换时清理步骤与主申人字段）。
 */
import type { Reactive, Ref } from 'vue'
import { watch } from 'vue'

import type { CaseFormModel, PendingMember } from './types'
import { rollbackWizardInlineCustomers } from './visaCaseWizardRollback'

type WizardWatchDeps = {
  props: { visible: boolean }
  form: Reactive<CaseFormModel>
  currentStep: Ref<number>
  pendingMembers: Ref<PendingMember[]>
  wizardSessionCommitted: Ref<boolean>
  resetWizard: () => void
  loadStaffOptions: () => Promise<void>
  loadCaseTypeOptions: () => Promise<void>
}

/**
 * 绑定 visible、家庭案与家庭关联方式相关的 watch，避免逻辑散落在 composable 主函数内。
 *
 * @param deps - 表单、步骤与重置/加载回调
 */
export function registerVisaCaseWizardWatchers(deps: WizardWatchDeps): void {
  const {
    props,
    form,
    currentStep,
    pendingMembers,
    wizardSessionCommitted,
    resetWizard,
    loadStaffOptions,
    loadCaseTypeOptions,
  } = deps

  watch(
    () => props.visible,
    (visible) => {
      if (visible) {
        resetWizard()
        void loadStaffOptions()
        void loadCaseTypeOptions()
        return
      }
      void (async (): Promise<void> => {
        const snapshot = [...pendingMembers.value]
        if (!wizardSessionCommitted.value) {
          await rollbackWizardInlineCustomers(snapshot)
        }
        resetWizard()
      })()
    },
  )

  watch(
    () => form.isFamilyCase,
    (val) => {
      if (!val && currentStep.value > 0) {
        currentStep.value = 0
      }
      if (!val) {
        void (async (): Promise<void> => {
          const snapshot = [...pendingMembers.value]
          await rollbackWizardInlineCustomers(snapshot)
          pendingMembers.value = []
        })()
      }
    },
  )

  watch(
    () => form.familyLinkMode,
    (newMode, oldMode) => {
      if (oldMode && newMode !== oldMode) {
        form.internalPrimaryCustomerId = ''
        form.externalPrimaryName = ''
        form.externalPrimaryCaseType = ''
        form.externalPrimaryExpireDate = ''
        form.externalPrimaryRelationToApplicant = ''
      }
    },
  )
}
