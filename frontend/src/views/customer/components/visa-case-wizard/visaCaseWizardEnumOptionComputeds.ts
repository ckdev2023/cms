/**
 * 签证案件向导第一步中案件状态、材料、费用、家庭关联与家属角色等枚举下拉选项。
 */
import type { ComputedRef } from 'vue'
import { computed } from 'vue'

import {
  FamilyLinkModeLabel,
  FamilyRelationLabel,
  MaterialStatusLabel,
  VisaCaseFeeStatusLabel,
  VisaCaseMemberRoleLabel,
  VisaCaseStatusLabel,
} from '@/constants/enum-labels'
import {
  FamilyLinkMode,
  FamilyRelation,
  MaterialStatus,
  VisaCaseFeeStatus,
  VisaCaseMemberRole,
  VisaCaseStatus,
} from '@/constants/enums'

import type { SelectOption } from './types'

type EnumOptionBag = {
  caseStatusOptions: ComputedRef<SelectOption[]>
  materialStatusOptions: ComputedRef<SelectOption[]>
  feeStatusOptions: ComputedRef<SelectOption[]>
  familyLinkModeOptions: ComputedRef<SelectOption[]>
  /** EXTERNAL 家族签下外部主申与本案申请人的家属关系下拉（与主档 `FamilyRelation` 一致）。 */
  familyRelationOptions: ComputedRef<SelectOption[]>
  memberRoleOptions: ComputedRef<SelectOption[]>
}

/**
 * 构造案件状态、材料、费用、家庭关联方式与家属角色等枚举对应的下拉选项 computed。
 *
 * @returns 各 el-select 使用的 options 集合
 */
export function createVisaCaseWizardEnumOptionComputeds(): EnumOptionBag {
  const caseStatusOptions = computed(() =>
    Object.values(VisaCaseStatus).map((v) => ({
      label: VisaCaseStatusLabel[v] ?? v,
      value: v,
    })),
  )

  const materialStatusOptions = computed(() =>
    Object.values(MaterialStatus).map((v) => ({
      label: MaterialStatusLabel[v] ?? v,
      value: v,
    })),
  )

  const feeStatusOptions = computed(() =>
    Object.values(VisaCaseFeeStatus).map((v) => ({
      label: VisaCaseFeeStatusLabel[v] ?? v,
      value: v,
    })),
  )

  const familyLinkModeOptions = computed(() =>
    Object.values(FamilyLinkMode).map((v) => ({
      label: FamilyLinkModeLabel[v] ?? v,
      value: v,
    })),
  )

  const familyRelationOptions = computed(() =>
    Object.values(FamilyRelation).map((v) => ({
      label: FamilyRelationLabel[v] ?? v,
      value: v,
    })),
  )

  const memberRoleOptions = computed(() =>
    Object.values(VisaCaseMemberRole).map((v) => ({
      label: VisaCaseMemberRoleLabel[v] ?? v,
      value: v,
    })),
  )

  return {
    caseStatusOptions,
    materialStatusOptions,
    feeStatusOptions,
    familyLinkModeOptions,
    familyRelationOptions,
    memberRoleOptions,
  }
}
