import type { FormInstance } from 'element-plus'
import { type ComputedRef, nextTick, type Ref,watch } from 'vue'
import type { ComposerTranslation } from 'vue-i18n'

import type { CustomerItem } from '@/types/customer'
import {
  ensureOwnerStaffOptionFromEdit,
  loadAccompanyingFamilyMembersForForm,
  loadStaffOptionsIntoRef,
  populateCustomerFormFromItem,
  resetCustomerFormDialogForm,
  type StaffOption,
} from '@/views/customer/customer-form-dialog/customerFormDialogSync'
import type { FormModel } from '@/views/customer/customerFormDialogModel'

export type CustomerFormDialogModelValueWatchParams = {
  accompanyingFamilyFeatureActive: ComputedRef<boolean>
  accompanyingInitialIds: Ref<Set<string>>
  form: FormModel
  formRef: Ref<FormInstance | undefined>
  primaryCustomerOptions: Ref<{ value: string; label: string }[]>
  props: { editData: CustomerItem | null; modelValue: boolean }
  staffLoading: Ref<boolean>
  staffOptions: Ref<StaffOption[]>
  t: ComposerTranslation
}

/**
 * 监听抽屉打开：回填或重置表单、同步负责人列表与随附家属子档。
 *
 * @param p - 抽屉 props、表单与选项 ref 集合
 */
export function registerCustomerFormDialogModelValueWatch(p: CustomerFormDialogModelValueWatchParams): void {
  watch(
    () => p.props.modelValue,
    (visible) => {
      if (!visible) {
        return
      }
      void (async () => {
        await nextTick()
        if (p.props.editData) {
          populateCustomerFormFromItem(p.form, p.props.editData)
        } else {
          resetCustomerFormDialogForm(
            p.form,
            p.accompanyingInitialIds,
            p.primaryCustomerOptions,
            p.formRef,
          )
        }
        await loadStaffOptionsIntoRef(p.staffOptions, p.staffLoading)
        ensureOwnerStaffOptionFromEdit(p.props.editData, p.staffOptions)
        if (p.props.editData && p.accompanyingFamilyFeatureActive.value) {
          await loadAccompanyingFamilyMembersForForm(
            p.props.editData.id,
            p.form,
            p.accompanyingInitialIds,
            p.t,
          )
        } else {
          p.form.accompanyingMembers = []
          p.accompanyingInitialIds.value = new Set()
        }
      })()
    },
  )
}

/**
 * 监听扩展字段变化并在抽屉打开时清除相关字段的校验红字，避免编辑中途误报。
 *
 * @param props - 仅使用 `modelValue` 判断抽屉是否打开
 * @param form - 客户表单模型
 * @param formRef - `el-form` 实例引用
 */
export function registerCustomerFormDialogClearValidateWatch(
  props: { modelValue: boolean },
  form: FormModel,
  formRef: Ref<FormInstance | undefined>,
): void {
  watch(
    () => [
      form.corporationNumber,
      form.representativeName,
      form.fiscalMonth,
      form.nationality,
      form.residenceStatus,
      form.passportNumber,
      form.residenceExpireDate,
      form.customerType,
      form.isFamilyMember,
      form.familyRelation,
      form.remindDaysBefore,
      form.wechatId,
      form.lineId,
    ],
    () => {
      if (!props.modelValue) {return}
      nextTick(() => {
        formRef.value?.clearValidate([
          'fiscalMonth',
          'corporationNumber',
          'representativeName',
          'nationality',
          'residenceStatus',
          'passportNumber',
          'residenceExpireDate',
          'familyRelation',
          'remindDaysBefore',
          'wechatId',
          'lineId',
        ])
      })
    },
    { deep: true },
  )
}
