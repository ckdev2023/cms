import type { FormModel } from '@/views/customer/customerFormDialogModel'
import { validateAccompanyingMemberRows } from '@/views/customer/customerFormDialogModel'

/**
 * 随附家属行未通过业务校验时返回对应 i18n 键，否则返回 `null`。
 *
 * @param accompanyingFeatureActive - 随附家属区块是否参与保存
 * @param accompanyingMembers - 随附家属行数据
 * @returns 错误文案键或 `null`
 */
export function resolveAccompanyingValidationErrorI18nKeyForDialog(
  accompanyingFeatureActive: boolean,
  accompanyingMembers: FormModel['accompanyingMembers'],
): string | null {
  if (!accompanyingFeatureActive) {
    return null
  }
  const rowIssue = validateAccompanyingMemberRows(accompanyingMembers)
  if (!rowIssue) {
    return null
  }
  if (rowIssue === 'nameRequired') {
    return 'dialogs.customerForm.accompanyingFamilyValidationName'
  }
  if (rowIssue === 'relationRequired') {
    return 'dialogs.customerForm.accompanyingFamilyValidationRelation'
  }
  return 'dialogs.customerForm.accompanyingFamilyValidationOrphan'
}
