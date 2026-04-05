import type { FormRules } from 'element-plus'
import type { ComputedRef } from 'vue'
import type { ComposerTranslation } from 'vue-i18n'

import { CustomerType } from '@/constants/enums'
import type { FormModel } from '@/views/customer/customerFormDialogModel'
import { hasCompanyExtension } from '@/views/customer/customerFormDialogModel'

/**
 * 构建客户新建/编辑抽屉的 Element Plus 表单校验规则（含法人决算月与家族关系条件校验）。
 *
 * @param t - vue-i18n 翻译函数
 * @param form - 客户表单响应式模型（校验器闭包读取当前值）
 * @param isEdit - 是否为编辑模式
 * @returns 供 `el-form` 使用的 `rules` 对象
 */
export function buildCustomerFormDialogFormRules(
  t: ComposerTranslation,
  form: FormModel,
  isEdit: ComputedRef<boolean>,
): FormRules {
  return {
    customerName: [
      {
        required: true,
        message: t('common.enterField', { field: t('dialogs.customerForm.customerName') }),
        trigger: 'blur',
      },
      { max: 200, message: t('validation.maxChars', { max: 200 }), trigger: 'blur' },
    ],
    serviceType: [
      {
        required: true,
        message: t('common.selectField', { field: t('dialogs.customerForm.serviceType') }),
        trigger: 'change',
      },
    ],
    email: [{ type: 'email', message: t('validation.invalidEmail'), trigger: 'blur' }],
    wechatId: [{ max: 50, message: t('validation.maxChars', { max: 50 }), trigger: 'blur' }],
    lineId: [{ max: 50, message: t('validation.maxChars', { max: 50 }), trigger: 'blur' }],
    passportNumber: [{ max: 64, message: t('validation.maxChars', { max: 64 }), trigger: 'blur' }],
    fiscalMonth: [
      {
        validator: (_rule, value, callback) => {
          const companySideActive =
            hasCompanyExtension(form) || (isEdit.value && form.customerType === CustomerType.COMPANY)
          if (!companySideActive) {
            callback()
            return
          }
          if (value === undefined || value === null || value === '') {
            callback()
            return
          }
          const n = Number(value)
          if (Number.isNaN(n) || n < 1 || n > 12) {
            callback(new Error(t('validation.numberRange', { min: 1, max: 12 })))
            return
          }
          callback()
        },
        trigger: 'blur',
      },
    ],
    familyRelation: [
      {
        validator: (_rule, value, callback) => {
          if (form.isFamilyMember && !value) {
            callback(new Error(t('common.selectField', { field: t('dialogs.customerForm.familyRelation') })))
            return
          }
          callback()
        },
        trigger: 'change',
      },
    ],
    remindDaysBefore: [
      {
        validator: (_rule, value, callback) => {
          if (value === undefined || value === null || value === '') {
            callback()
            return
          }
          const n = Number(value)
          if (Number.isNaN(n) || n < 1 || n > 365) {
            callback(new Error(t('validation.numberRange', { min: 1, max: 365 })))
            return
          }
          callback()
        },
        trigger: 'blur',
      },
    ],
  }
}
