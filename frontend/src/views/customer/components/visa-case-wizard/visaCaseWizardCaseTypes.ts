/**
 * 从系统字典加载签证案件申请类目候选项，供建案向导案件类型下拉使用。
 */
import type { Ref } from 'vue'

import { getDictByType } from '@/api/dictionary'
import { VisaCaseApplicationCategoryLabel } from '@/constants/enum-labels'
import { VisaCaseApplicationCategory } from '@/constants/enums'

import type { SelectOption } from './types'

/** 字典类型键，与后端 `DictionaryController` 中 `LABEL_MAPS` 一致。 */
export const VISA_CASE_APPLICATION_TYPE_DICT = 'visa_case_application_type'

/**
 * 字典接口失败或返回空时的候选顺序（与后端枚举定义一致）。
 */
const VISA_CASE_APPLICATION_TYPE_ORDER: VisaCaseApplicationCategory[] = [
  VisaCaseApplicationCategory.PR,
  VisaCaseApplicationCategory.NATURALIZATION,
  VisaCaseApplicationCategory.FAMILY_STAY,
  VisaCaseApplicationCategory.TECH_HUMANITIES_INTERNATIONAL,
  VisaCaseApplicationCategory.DEPENDENT_SPOUSE,
  VisaCaseApplicationCategory.STUDENT,
  VisaCaseApplicationCategory.WORK_OTHER,
  VisaCaseApplicationCategory.STARTUP,
  VisaCaseApplicationCategory.OTHER,
]

/**
 * 解析下拉展示文案：优先使用前端 i18n 标签映射，缺失时回退字典日文 label 或原 value。
 *
 * @param value - 字典或自定义的 case_type 取值
 * @param dictLabel - 后端字典项上的日文标签
 * @returns 当前语言下的展示用短文本
 */
function resolveCaseTypeOptionLabel(value: string, dictLabel: string): string {
  const mapped = (VisaCaseApplicationCategoryLabel as Record<string, string | undefined>)[
    value
  ]
  if (mapped) {
    return mapped
  }
  return dictLabel || value
}

/**
 * 首次打开向导时拉取 `visa_case_application_type` 字典；失败或空列表时回退为冻结枚举顺序。
 *
 * @param caseTypeOptions - 案件类型下拉选项 ref
 */
export async function loadVisaCaseWizardCaseTypeOptions(
  caseTypeOptions: Ref<SelectOption[]>,
): Promise<void> {
  if (caseTypeOptions.value.length > 0) {
    return
  }
  try {
    const res = await getDictByType(VISA_CASE_APPLICATION_TYPE_DICT)
    const raw = res.data ?? []
    if (raw.length > 0) {
      caseTypeOptions.value = raw.map((item) => ({
        value: item.value,
        label: resolveCaseTypeOptionLabel(item.value, item.label),
      }))
      return
    }
  } catch {
    // 回退到本地枚举顺序
  }
  caseTypeOptions.value = VISA_CASE_APPLICATION_TYPE_ORDER.map((value) => ({
    value,
    label:
      (VisaCaseApplicationCategoryLabel as Record<string, string | undefined>)[value] ??
      value,
  }))
}
