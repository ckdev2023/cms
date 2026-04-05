/**
 * 定义通用表格列与表单字段组件共享的声明类型。
 */
import type { FormItemRule } from 'element-plus'

export type ProFormOptionValue = string | number

export interface ProFormOption {
  label: string
  value: ProFormOptionValue
  disabled?: boolean
}

export interface ProTableColumn {
  prop: string
  label: string
  width?: number | string
  minWidth?: number | string
  fixed?: 'left' | 'right' | boolean
  sortable?: boolean | 'custom'
  align?: 'left' | 'center' | 'right'
  showOverflowTooltip?: boolean
  slot?: string
  /**
   * 表头单元格旁展示提示图标，`content` 为完整说明（如列口径与主案件摘要差异，docs/31 §5.3）。
   */
  headerTooltip?: string
}

export interface ProFormField {
  prop: string
  label: string
  type:
    | 'input'
    | 'select'
    | 'date'
    | 'daterange'
    | 'textarea'
    | 'number'
    | 'radio'
    | 'checkbox'
    | 'switch'
  placeholder?: string
  rules?: FormItemRule[]
  options?: ProFormOption[]
  span?: number
  disabled?: boolean
  props?: Record<string, unknown>
  slot?: string
}
