import type { FormInstance } from 'element-plus'
import { ElMessage } from 'element-plus'
import type { ComputedRef, Ref } from 'vue'
import type { ComposerTranslation } from 'vue-i18n'
import type { Router } from 'vue-router'

import { useUserStore } from '@/stores/user'
import type { CustomerItem } from '@/types/customer'
import {
  applyCreateCustomerWithAccompanying,
  applyEditCustomerWithAccompanying,
  confirmRemovedAccompanyingDeletesIfNeededForDialog,
} from '@/views/customer/customer-form-dialog/customerFormDialogAccompanyingSave'
import type { CustomerFormDialogEmitDecl } from '@/views/customer/customer-form-dialog/customerFormDialogTypes'
import { resolveAccompanyingValidationErrorI18nKeyForDialog } from '@/views/customer/customer-form-dialog/customerFormDialogValidation'
import { buildCustomerFormPayload, type FormModel } from '@/views/customer/customerFormDialogModel'
import { showPostCreateCustomerMessages } from '@/views/customer/customerFormDialogPostCreate'

type EmitFn = <
  K extends keyof CustomerFormDialogEmitDecl,
>(e: K, ...args: CustomerFormDialogEmitDecl[K]) => void

export type CustomerFormDialogSubmitContext = {
  accompanyingFamilyFeatureActive: ComputedRef<boolean>
  accompanyingInitialIds: Ref<Set<string>>
  confirmDialog: (opts: { message: string; type: 'warning' }) => Promise<boolean>
  editData: CustomerItem | null | undefined
  emit: EmitFn
  form: FormModel
  formRef: Ref<FormInstance | undefined>
  isEdit: ComputedRef<boolean>
  router: Router
  submitting: Ref<boolean>
  t: ComposerTranslation
  userStore: ReturnType<typeof useUserStore>
}

/**
 * 校验客户抽屉表单并执行创建或更新（含随附家属与确认删除）。
 *
 * @param ctx - 提交流程所需的表单、权限与路由依赖
 */
export async function submitCustomerFormDialog(ctx: CustomerFormDialogSubmitContext): Promise<void> {
  const valid = await ctx.formRef.value?.validate().catch(() => false)
  if (!valid) {
    return
  }

  const accompanyErrKey = resolveAccompanyingValidationErrorI18nKeyForDialog(
    ctx.accompanyingFamilyFeatureActive.value,
    ctx.form.accompanyingMembers,
  )
  if (accompanyErrKey) {
    ElMessage.error(ctx.t(accompanyErrKey))
    return
  }

  const removedAccompanyingIds = await confirmRemovedAccompanyingDeletesIfNeededForDialog(
    ctx.isEdit.value,
    ctx.editData,
    ctx.accompanyingFamilyFeatureActive.value,
    ctx.accompanyingInitialIds.value,
    ctx.form,
    ctx.confirmDialog,
    ctx.t,
  )
  if (removedAccompanyingIds === false) {
    return
  }

  ctx.submitting.value = true
  try {
    const payload = buildCustomerFormPayload(ctx.form, ctx.isEdit.value)
    if (ctx.isEdit.value && ctx.editData) {
      await applyEditCustomerWithAccompanying(
        ctx.editData.id,
        payload,
        removedAccompanyingIds,
        ctx.accompanyingFamilyFeatureActive.value,
        ctx.form,
        ctx.accompanyingInitialIds,
        ctx.t,
      )
      ElMessage.success(ctx.t('dialogs.customerForm.updated'))
    } else {
      const newId = await applyCreateCustomerWithAccompanying(
        payload,
        ctx.accompanyingFamilyFeatureActive.value,
        ctx.form,
        ctx.t,
      )
      showPostCreateCustomerMessages(newId, ctx.t, ctx.router, ctx.userStore)
    }
    ctx.emit('update:modelValue', false)
    ctx.emit('saved')
  } catch {
    // request interceptor already shows error
  } finally {
    ctx.submitting.value = false
  }
}
