/**
 * 签证案件创建向导的事件处理函数（远程搜索、家属行、步骤切换与提交）。
 */
import { ElMessage } from 'element-plus'

import { deleteCustomer } from '@/api/customer'

import { appendInlineDependentMember } from './visaCaseWizardAppendInlineMember'
import type { VisaCaseWizardCore } from './visaCaseWizardCore'
import { runWizardCustomerRemoteSearch } from './visaCaseWizardCustomerSearch'
import { submitVisaCaseWizard } from './visaCaseWizardSubmit'
import { allocTempMemberId } from './visaCaseWizardTempId'

type WizardEmit = {
  (e: 'update:visible', value: boolean): void
  (e: 'created'): void
}

type SearchHandlers = {
  searchPrimaryCustomers: (keyword: string) => Promise<void>
  searchMemberCustomers: (keyword: string) => Promise<void>
}

/**
 * 构造主申人与家属客户远程搜索的 handler。
 *
 * @param core - 含选项 ref 与 loading 的向导核心状态
 */
function createSearchHandlers(core: VisaCaseWizardCore): SearchHandlers {
  return {
    searchPrimaryCustomers: async (keyword: string): Promise<void> => {
      await runWizardCustomerRemoteSearch(
        keyword,
        core.primaryCustomerOptions,
        core.primaryCustomerSearchLoading,
      )
    },
    searchMemberCustomers: async (keyword: string): Promise<void> => {
      await runWizardCustomerRemoteSearch(
        keyword,
        core.memberCustomerOptions,
        core.memberCustomerSearchLoading,
      )
    },
  }
}

type MemberHandlers = {
  handleMemberCustomerChange: (customerId: string) => void
  handleShowAddForm: () => void
  handleAddPendingMember: () => void
  handleCreateInlineMemberAndAdd: () => Promise<void>
  handleRemovePendingMember: (id: number) => void
}

/**
 * 构造家属行增删与姓名快照填充的 handler。
 *
 * @param core - 含 newMemberForm、pendingMembers 与校验用 computed 的核心状态
 */
function createMemberHandlers(core: VisaCaseWizardCore): MemberHandlers {
  const {
    props,
    form,
    pendingMembers,
    showAddForm,
    memberAddMode,
    creatingInlineMember,
    memberCustomerOptions,
    newMemberForm,
    inlineMiniForm,
    computeds,
    T,
    t,
  } = core

  return {
    handleMemberCustomerChange: (customerId: string): void => {
      const selected = memberCustomerOptions.value.find((o) => o.value === customerId)
      if (selected) {
        newMemberForm.displayNameSnapshot = selected.label
      }
    },
    handleShowAddForm: (): void => {
      newMemberForm.customerId = ''
      newMemberForm.memberRole = ''
      newMemberForm.displayNameSnapshot = ''
      inlineMiniForm.customerName = ''
      inlineMiniForm.phone = ''
      memberAddMode.value = 'existing'
      memberCustomerOptions.value = []
      showAddForm.value = true
    },
    handleAddPendingMember: (): void => {
      if (memberAddMode.value !== 'existing') {return}
      if (!computeds.canAddMember.value || computeds.isDuplicateMember.value) {return}
      if (newMemberForm.customerId === props.customerId) {
        ElMessage.warning(T('cannotAddApplicantAsMember'))
        return
      }
      if (
        form.internalPrimaryCustomerId &&
        newMemberForm.customerId === form.internalPrimaryCustomerId
      ) {
        ElMessage.warning(T('cannotAddInternalPrimaryAsMember'))
        return
      }
      pendingMembers.value.push({
        tempId: allocTempMemberId(),
        customerId: newMemberForm.customerId,
        memberRole: newMemberForm.memberRole,
        displayNameSnapshot: newMemberForm.displayNameSnapshot,
      })
      showAddForm.value = false
    },
    handleCreateInlineMemberAndAdd: (): Promise<void> =>
      appendInlineDependentMember({
        props,
        form,
        pendingMembers,
        showAddForm,
        creatingInlineMember,
        memberAddMode,
        inlineMiniForm,
        newMemberForm,
        canAddMember: computeds.canAddMember,
        T,
        t,
      }),
    handleRemovePendingMember: (id: number): void => {
      const found = pendingMembers.value.find((m) => m.tempId === id)
      pendingMembers.value = pendingMembers.value.filter((m) => m.tempId !== id)
      if (found?.createdViaWizardInline) {
        void deleteCustomer(found.customerId).catch(() => {})
      }
    },
  }
}

type NavHandlers = {
  handleNext: () => void
  handlePrev: () => void
}

/**
 * 构造步骤条前进/后退的 handler。
 *
 * @param core - 含 currentStep 与 totalSteps 的核心状态
 */
function createNavHandlers(core: VisaCaseWizardCore): NavHandlers {
  const { currentStep, computeds } = core
  return {
    handleNext: (): void => {
      if (currentStep.value < computeds.totalSteps.value - 1) {
        currentStep.value++
      }
    },
    handlePrev: (): void => {
      if (currentStep.value > 0) {
        currentStep.value--
      }
    },
  }
}

type DialogHandlers = {
  handleSubmit: () => Promise<void>
  closeDialog: () => void
}

/**
 * 构造提交创建与关闭对话框的 handler。
 *
 * @param core - 含 props、表单与 pendingMembers 的核心状态
 * @param emit - 对话框与 created 事件
 */
function createDialogHandlers(
  core: VisaCaseWizardCore,
  emit: WizardEmit,
): DialogHandlers {
  const { props, T, CT, form, pendingMembers, submitting, wizardSessionCommitted } = core
  return {
    handleSubmit: async (): Promise<void> => {
      await submitVisaCaseWizard({
        customerId: props.customerId,
        form,
        pendingMembers,
        submitting,
        T,
        CT,
        markSessionCommitted: () => {
          wizardSessionCommitted.value = true
        },
        onSuccess: () => {
          emit('update:visible', false)
          emit('created')
        },
      })
    },
    closeDialog: (): void => {
      emit('update:visible', false)
    },
  }
}

/**
 * 基于 core 状态构造向导所需的全部事件处理函数。
 *
 * @param core - initVisaCaseWizardCore 返回的状态包
 * @param emit - 关闭对话框与创建成功事件
 */
export function createVisaCaseWizardHandlers(
  core: VisaCaseWizardCore,
  emit: WizardEmit,
): SearchHandlers &
  MemberHandlers &
  NavHandlers &
  DialogHandlers {
  return {
    ...createSearchHandlers(core),
    ...createMemberHandlers(core),
    ...createNavHandlers(core),
    ...createDialogHandlers(core, emit),
  }
}
