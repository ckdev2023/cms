/**
 * 向导表单默认值工厂，与新建签证案件后端可选字段初始状态一致。
 */
import { VisaCaseStatus } from '@/constants/enums'

import type { CaseFormModel } from './types'

/**
 * 构造向导第一步表单的初始空状态（草稿案件、未选负责人与材料/费用状态）。
 *
 * @returns 可赋给 reactive 的 CaseFormModel 快照
 */
export function defaultCaseForm(): CaseFormModel {
  return {
    caseType: '',
    caseStatus: VisaCaseStatus.DRAFT,
    assignedTo: '',
    expireDate: '',
    nextFollowUpAt: '',
    materialStatus: '',
    feeStatus: '',
    isFamilyCase: false,
    familyLinkMode: '',
    internalPrimaryCustomerId: '',
    externalPrimaryName: '',
    externalPrimaryCaseType: '',
    externalPrimaryExpireDate: '',
    externalPrimaryRelationToApplicant: '',
    memo: '',
  }
}
