/**
 * 签证案件创建向导（CustomerVisaCaseWizard）专用的表单与待提交家属类型。
 */
import type { FamilyRelation, VisaCaseStatus } from '@/constants/enums'

/** 与主档 `FamilyRelation` 枚举值一致的可空字符串（空串表示未选择）。 */
export type ExternalPrimaryRelationFormValue = '' | FamilyRelation

/** 下拉选项的通用结构，供负责人与客户远程搜索候选项复用。 */
export type SelectOption = { label: string; value: string }

/** 向导第二步中待随案件一并提交的家属行（仅内存，尚未落库）。 */
export type PendingMember = {
  tempId: number
  customerId: string
  memberRole: string
  displayNameSnapshot: string
  /** 为 true 时表示本行客户由向导内「快速新建」创建，取消向导或移除行时可尝试删除主档 */
  createdViaWizardInline?: boolean
}

/** 向导第一步绑定的案件字段模型，与 CreateVisaCaseParams 字段对齐。 */
export type CaseFormModel = {
  caseType: string
  caseStatus: VisaCaseStatus
  assignedTo: string
  expireDate: string
  nextFollowUpAt: string
  materialStatus: string
  feeStatus: string
  isFamilyCase: boolean
  familyLinkMode: string
  internalPrimaryCustomerId: string
  externalPrimaryName: string
  externalPrimaryCaseType: string
  externalPrimaryExpireDate: string
  externalPrimaryRelationToApplicant: ExternalPrimaryRelationFormValue
  memo: string
}
