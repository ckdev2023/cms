/**
 * 客户表单弹窗子列通过 inject 读取同一套 reactive 表单模型，避免以 prop 传递导致 v-model 误判为修改 prop。
 */
import type { InjectionKey } from 'vue'

import type { FormModel } from '@/views/customer/customerFormDialogModel'

export const customerFormModelKey: InjectionKey<FormModel> = Symbol(
  'customerFormModel',
)
