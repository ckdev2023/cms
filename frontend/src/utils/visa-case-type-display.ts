import { VisaCaseApplicationCategoryLabel } from '@/constants/enum-labels'
import { VisaCaseApplicationCategory } from '@/constants/enums'

/** 与 `visa_cases.case_type` 冻结枚举值集合一致，用于判断展示层是否走 i18n 标签映射。 */
const VISA_CASE_APPLICATION_CATEGORY_VALUES = new Set<string>(
  Object.values(VisaCaseApplicationCategory),
)

/**
 * 将接口返回的签证案件 `case_type` 格式化为当前界面语言下的短文。
 *
 * 值为 `VisaCaseApplicationCategory` 枚举码（如 `TECH_HUMANITIES_INTERNATIONAL`）时使用
 * `VisaCaseApplicationCategoryLabel`（随 zh-CN / 日文切换）；自由文本或历史存量则原样返回。
 *
 * @param value - `case_type` 原始字符串，可为 null/undefined
 * @returns trim 后的展示文案；空值时返回空字符串
 */
export function formatVisaCaseTypeDisplay(value: string | null | undefined): string {
  if (value === undefined || value === null) {
    return ''
  }
  const v = String(value).trim()
  if (!v) {
    return ''
  }
  if (VISA_CASE_APPLICATION_CATEGORY_VALUES.has(v)) {
    const mapped = (VisaCaseApplicationCategoryLabel as Record<string, string | undefined>)[v]
    if (mapped) {
      return mapped
    }
  }
  return v
}
