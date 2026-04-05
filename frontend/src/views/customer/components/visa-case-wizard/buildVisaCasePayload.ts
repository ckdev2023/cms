/**
 * 将向导表单组装为 createVisaCase 请求体，并按当前家庭关联模式剔除无关字段。
 */
import {
  FamilyLinkMode,
  type FamilyRelation,
  VisaCaseFeeStatus,
} from '@/constants/enums'
import type { CreateVisaCaseParams } from '@/types/visa-case'

import type { CaseFormModel } from './types'

/**
 * 将表单中的下次跟进时间字段解析为 ISO 字符串，未填写时返回 undefined。
 *
 * @param form - 向导第一步表单
 */
function nextFollowUpIso(form: CaseFormModel): string | undefined {
  if (!form.nextFollowUpAt) {return undefined}
  return new Date(form.nextFollowUpAt).toISOString()
}

/**
 * 根据家庭内部/外部主申人模式填充主申人相关可选字段。
 *
 * @param form - 向导第一步表单
 */
function familyPrimaryFields(
  form: CaseFormModel,
): Pick<
  CreateVisaCaseParams,
  | 'familyLinkMode'
  | 'internalPrimaryCustomerId'
  | 'externalPrimaryName'
  | 'externalPrimaryCaseType'
  | 'externalPrimaryExpireDate'
  | 'externalPrimaryRelationToApplicant'
> {
  const isInternal =
    form.isFamilyCase && form.familyLinkMode === FamilyLinkMode.INTERNAL
  const isExternal =
    form.isFamilyCase && form.familyLinkMode === FamilyLinkMode.EXTERNAL

  return {
    familyLinkMode:
      form.isFamilyCase && form.familyLinkMode
        ? (form.familyLinkMode as FamilyLinkMode)
        : undefined,
    internalPrimaryCustomerId:
      isInternal && form.internalPrimaryCustomerId
        ? form.internalPrimaryCustomerId
        : undefined,
    externalPrimaryName:
      isExternal && form.externalPrimaryName
        ? form.externalPrimaryName
        : undefined,
    externalPrimaryCaseType:
      isExternal && form.externalPrimaryCaseType
        ? form.externalPrimaryCaseType
        : undefined,
    externalPrimaryExpireDate:
      isExternal && form.externalPrimaryExpireDate
        ? form.externalPrimaryExpireDate
        : undefined,
    externalPrimaryRelationToApplicant:
      isExternal && form.externalPrimaryRelationToApplicant
        ? (form.externalPrimaryRelationToApplicant as FamilyRelation)
        : undefined,
  }
}

/**
 * 根据表单状态与客户 ID 生成创建签证案件的 API 载荷，过滤非当前模式的冗余主申人字段。
 *
 * @param customerId - 当前客户页主键
 * @param form - 向导第一步表单快照
 * @returns 适用于 createVisaCase 的请求体
 */
export function buildVisaCasePayload(
  customerId: string,
  form: CaseFormModel,
): CreateVisaCaseParams {
  return {
    customerId,
    caseType: form.caseType || undefined,
    caseStatus: form.caseStatus,
    assignedTo: form.assignedTo || undefined,
    expireDate: form.expireDate || undefined,
    nextFollowUpAt: nextFollowUpIso(form),
    materialStatus: form.materialStatus || undefined,
    feeStatus: (form.feeStatus as VisaCaseFeeStatus) || undefined,
    isFamilyCase: form.isFamilyCase,
    memo: form.memo || undefined,
    ...familyPrimaryFields(form),
  }
}
