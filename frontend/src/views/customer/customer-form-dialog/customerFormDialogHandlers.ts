import type { FormInstance } from 'element-plus'
import type { ComputedRef, Ref } from 'vue'
import type { ComposerTranslation } from 'vue-i18n'
import type { Router } from 'vue-router'

import { useUserStore } from '@/stores/user'
import { submitCustomerFormDialog } from '@/views/customer/customer-form-dialog/customerFormDialogSubmit'
import { searchPrimaryCustomersForDialog } from '@/views/customer/customer-form-dialog/customerFormDialogSync'
import type { CustomerFormDialogEmitDecl, CustomerFormDialogProps } from '@/views/customer/customer-form-dialog/customerFormDialogTypes'
import type { FormModel } from '@/views/customer/customerFormDialogModel'

type EmitFn = <
  K extends keyof CustomerFormDialogEmitDecl,
>(e: K, ...args: CustomerFormDialogEmitDecl[K]) => void

export type CustomerFormDialogHandlersParams = {
  accompanyingFamilyFeatureActive: ComputedRef<boolean>
  accompanyingInitialIds: Ref<Set<string>>
  confirmDialog: (opts: { message: string; type: 'warning' }) => Promise<boolean>
  emit: EmitFn
  form: FormModel
  formRef: Ref<FormInstance | undefined>
  isEdit: ComputedRef<boolean>
  primaryCustomerLoading: Ref<boolean>
  primaryCustomerOptions: Ref<{ value: string; label: string }[]>
  props: CustomerFormDialogProps
  router: Router
  submitting: Ref<boolean>
  t: ComposerTranslation
  userStore: ReturnType<typeof useUserStore>
}

/**
 * 生成客户抽屉内主客户搜索、提交与关闭等需传入模板的回调。
 *
 * @param p - 表单、emit 与路由等依赖
 * @returns `searchPrimaryCustomers` / `handleSubmit` / `handleClose`
 */
export function createCustomerFormDialogHandlers(p: CustomerFormDialogHandlersParams) {
  async function searchPrimaryCustomers(query: string): Promise<void> {
    await searchPrimaryCustomersForDialog(
      query,
      p.props.editData?.id,
      p.primaryCustomerOptions,
      p.primaryCustomerLoading,
    )
  }

  async function handleSubmit(): Promise<void> {
    await submitCustomerFormDialog({
      accompanyingFamilyFeatureActive: p.accompanyingFamilyFeatureActive,
      accompanyingInitialIds: p.accompanyingInitialIds,
      confirmDialog: p.confirmDialog,
      editData: p.props.editData,
      emit: p.emit,
      form: p.form,
      formRef: p.formRef,
      isEdit: p.isEdit,
      router: p.router,
      submitting: p.submitting,
      t: p.t,
      userStore: p.userStore,
    })
  }

  function handleClose(): void {
    p.emit('update:modelValue', false)
  }

  return { handleClose, handleSubmit, searchPrimaryCustomers }
}
