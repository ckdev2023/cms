import type { CustomerItem } from '@/types/customer'

/** 客户新建/编辑抽屉组件入参 */
export type CustomerFormDialogProps = {
  modelValue: boolean
  editData: CustomerItem | null
}

/** 客户抽屉向父组件抛出的事件（与 `defineEmits` 载荷一致） */
export type CustomerFormDialogEmitDecl = {
  'update:modelValue': [val: boolean]
  saved: []
}
