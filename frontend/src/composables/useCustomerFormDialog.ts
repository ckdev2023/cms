import type { FormInstance, FormRules } from 'element-plus'
import { computed, provide, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import { useConfirm } from '@/composables/useConfirm'
import { useUserStore } from '@/stores/user'
import { useCustomerFormDialogDerived } from '@/views/customer/customer-form-dialog/customerFormDialogDerived'
import { createCustomerFormDialogHandlers } from '@/views/customer/customer-form-dialog/customerFormDialogHandlers'
import type { StaffOption } from '@/views/customer/customer-form-dialog/customerFormDialogSync'
import type {
  CustomerFormDialogEmitDecl,
  CustomerFormDialogProps,
} from '@/views/customer/customer-form-dialog/customerFormDialogTypes'
import {
  registerCustomerFormDialogClearValidateWatch,
  registerCustomerFormDialogModelValueWatch,
} from '@/views/customer/customer-form-dialog/customerFormDialogWatchers'
import { buildCustomerFormDialogFormRules } from '@/views/customer/customerFormDialogFormRules'
import { customerFormModelKey } from '@/views/customer/customerFormDialogInjection'
import { createDefaultFormModel, type FormModel } from '@/views/customer/customerFormDialogModel'

export type { CustomerFormDialogEmitDecl, CustomerFormDialogProps } from '@/views/customer/customer-form-dialog/customerFormDialogTypes'

/**
 * 客户新建/编辑抽屉：表单状态、校验规则、负责人/主客户选项、随附家属同步与提交流程。
 *
 * @param props - 抽屉可见性与编辑回填数据
 * @param emit - 关闭抽屉与保存成功事件
 * @returns 供 `CustomerFormDialog.vue` 模板绑定的状态与方法集合
 */
export function useCustomerFormDialog(
  props: CustomerFormDialogProps,
  emit: <
    K extends keyof CustomerFormDialogEmitDecl,
  >(
    e: K,
    ...args: CustomerFormDialogEmitDecl[K]
  ) => void,
) {
  const { t } = useI18n()
  const router = useRouter()
  const userStore = useUserStore()
  const { confirm: confirmDialog } = useConfirm()
  const formRef = ref<FormInstance>()
  const submitting = ref(false)
  const accompanyingInitialIds = ref<Set<string>>(new Set())
  const isEdit = computed(() => !!props.editData)
  const dialogTitle = computed(() =>
    isEdit.value ? t('dialogs.customerForm.editTitle') : t('dialogs.customerForm.createTitle'),
  )
  const form = reactive<FormModel>(createDefaultFormModel())
  provide(customerFormModelKey, form)
  const rules = computed<FormRules>(() => buildCustomerFormDialogFormRules(t, form, isEdit))
  const derived = useCustomerFormDialogDerived(form, isEdit)
  const primaryCustomerOptions = ref<{ value: string; label: string }[]>([])
  const primaryCustomerLoading = ref(false)
  const staffOptions = ref<StaffOption[]>([])
  const staffLoading = ref(false)
  registerCustomerFormDialogModelValueWatch({
    accompanyingFamilyFeatureActive: derived.accompanyingFamilyFeatureActive,
    accompanyingInitialIds,
    form,
    formRef,
    primaryCustomerOptions,
    props,
    staffLoading,
    staffOptions,
    t,
  })
  registerCustomerFormDialogClearValidateWatch(props, form, formRef)
  const { handleClose, handleSubmit, searchPrimaryCustomers } = createCustomerFormDialogHandlers({
    accompanyingFamilyFeatureActive: derived.accompanyingFamilyFeatureActive,
    accompanyingInitialIds,
    confirmDialog,
    emit,
    form,
    formRef,
    isEdit,
    primaryCustomerLoading,
    primaryCustomerOptions,
    props,
    router,
    submitting,
    t,
    userStore,
  })
  return {
    accompanyingFamilyFeatureActive: derived.accompanyingFamilyFeatureActive,
    companyColumnDisabled: derived.companyColumnDisabled,
    dialogTitle,
    familyRelationOptions: derived.familyRelationOptions,
    form,
    formRef,
    handleClose,
    handleSubmit,
    isEdit,
    personalColumnDisabled: derived.personalColumnDisabled,
    primaryCustomerLoading,
    primaryCustomerOptions,
    rules,
    searchPrimaryCustomers,
    serviceTypeOptions: derived.serviceTypeOptions,
    staffLoading,
    staffOptions,
    submitting,
    t,
  }
}
