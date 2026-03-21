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
  rules?: any[]
  options?: { label: string; value: any; disabled?: boolean }[]
  span?: number
  disabled?: boolean
  props?: Record<string, any>
  slot?: string
}
