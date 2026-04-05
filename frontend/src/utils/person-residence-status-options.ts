import type { Ref } from 'vue'

import { getDictByType } from '@/api/dictionary'

/** 与后端 `DictionaryController` 中 `person_residence_status` 字典类型键一致。 */
export const PERSON_RESIDENCE_STATUS_DICT = 'person_residence_status'

/** 在留资格下拉选项结构，与 Element Plus `el-option` 的 label/value 一致。 */
export type PersonResidenceStatusOption = { label: string; value: string }

/**
 * 从系统接口加载主档在留资格字典并写入选项 ref；请求失败时置空数组。
 *
 * @param optionsRef - 下拉选项 ref
 * @returns Promise，在字典写入 ref 后结束
 */
export async function loadPersonResidenceStatusOptions(
  optionsRef: Ref<PersonResidenceStatusOption[]>,
): Promise<void> {
  try {
    const res = await getDictByType(PERSON_RESIDENCE_STATUS_DICT)
    const raw = res.data ?? []
    optionsRef.value = raw.map((item) => ({
      value: item.value,
      label: item.label,
    }))
  } catch {
    optionsRef.value = []
  }
}

/**
 * 将不在字典内的历史自由文本合并进选项，保证编辑回显与 allow-create 选中值一致。
 *
 * @param optionsRef - 当前下拉选项列表
 * @param currentValue - 表单在留资格字段当前字符串
 * @returns void
 */
export function mergeLegacyPersonResidenceStatusOption(
  optionsRef: Ref<PersonResidenceStatusOption[]>,
  currentValue: string,
): void {
  const v = currentValue.trim()
  if (v.length === 0) {
    return
  }
  if (optionsRef.value.some((o) => o.value === v)) {
    return
  }
  optionsRef.value = [...optionsRef.value, { value: v, label: v }]
}
