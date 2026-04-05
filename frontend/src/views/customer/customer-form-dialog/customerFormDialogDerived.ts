import { computed, type ComputedRef } from 'vue'

import { FamilyRelationLabel, ServiceTypeLabel } from '@/constants/enum-labels'
import { CustomerType } from '@/constants/enums'
import type { FormModel } from '@/views/customer/customerFormDialogModel'
import { hasCompanyExtension } from '@/views/customer/customerFormDialogModel'

/**
 * 客户抽屉中与「个人/法人列禁用、随附家属是否展示」相关的派生状态与下拉静态选项。
 *
 * @param form - 客户表单模型
 * @param isEdit - 是否为编辑模式
 * @returns 供模板绑定的 `computed` 与选项数组
 */
export function useCustomerFormDialogDerived(form: FormModel, isEdit: ComputedRef<boolean>) {
  const personalColumnDisabled = computed(() => isEdit.value && form.customerType === CustomerType.COMPANY)
  const companyColumnDisabled = computed(() => isEdit.value && form.customerType === CustomerType.PERSONAL)

  const accompanyingFamilyFeatureActive = computed((): boolean => {
    if (personalColumnDisabled.value) {
      return false
    }
    if (isEdit.value && form.isFamilyMember) {
      return false
    }
    if (isEdit.value) {
      return form.customerType === CustomerType.PERSONAL
    }
    return !hasCompanyExtension(form)
  })

  const serviceTypeOptions = Object.entries(ServiceTypeLabel).map(([value, label]) => ({
    value,
    label,
  }))

  const familyRelationOptions = Object.entries(FamilyRelationLabel).map(([value, label]) => ({
    value,
    label,
  }))

  return {
    accompanyingFamilyFeatureActive,
    companyColumnDisabled,
    familyRelationOptions,
    personalColumnDisabled,
    serviceTypeOptions,
  }
}
