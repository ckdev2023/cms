/**
 * 签证案件创建向导第一步（案件信息 + 家庭关联）的纯校验逻辑，供 composable 与单测复用。
 */
import { FamilyLinkMode } from '@/constants/enums'

import type { CaseFormModel } from './types'

/**
 * 判断当前表单是否满足从第一步进入下一步或提交创建的条件（家庭案时须补齐关联方式与主申人信息）。
 *
 * @param form - 向导第一步绑定的案件表单
 * @returns 为 true 时表示非家庭案或家庭案下主申人信息已满足最低要求
 */
export function canProceedVisaWizardStep1(form: CaseFormModel): boolean {
  if (!form.isFamilyCase) {return true}
  if (!form.familyLinkMode) {return false}
  if (form.familyLinkMode === FamilyLinkMode.INTERNAL && !form.internalPrimaryCustomerId) {
    return false
  }
  if (form.familyLinkMode === FamilyLinkMode.EXTERNAL && !form.externalPrimaryName) {
    return false
  }
  return true
}
