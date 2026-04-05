/**
 * 向导根级 ref / reactive 草稿状态工厂，供 initVisaCaseWizardCore 组合使用以控制函数行数。
 */
import { reactive, ref } from 'vue'

import { defaultCaseForm } from './defaultCaseForm'
import type { PendingMember, SelectOption } from './types'

/**
 * 创建步骤、下拉选项、待提交家属与双模式添加表单等可变状态。
 *
 * @returns 与案件向导根组件绑定的一组 ref 与 reactive 对象
 */
export function createVisaCaseWizardBaseRefs() {
  const currentStep = ref(0)
  const submitting = ref(false)
  const staffOptions = ref<SelectOption[]>([])
  const caseTypeOptions = ref<SelectOption[]>([])
  const primaryCustomerOptions = ref<SelectOption[]>([])
  const primaryCustomerSearchLoading = ref(false)
  const pendingMembers = ref<PendingMember[]>([])
  const showAddForm = ref(false)
  const memberAddMode = ref<'existing' | 'inline'>('existing')
  const creatingInlineMember = ref(false)
  const wizardSessionCommitted = ref(false)
  const memberCustomerOptions = ref<SelectOption[]>([])
  const memberCustomerSearchLoading = ref(false)
  const newMemberForm = reactive({
    customerId: '',
    memberRole: '',
    displayNameSnapshot: '',
  })
  const inlineMiniForm = reactive({
    customerName: '',
    phone: '',
  })
  const form = reactive(defaultCaseForm())
  return {
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
  }
}
