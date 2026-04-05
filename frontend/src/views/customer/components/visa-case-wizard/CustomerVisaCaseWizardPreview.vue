<script setup lang="ts">
import { computed, inject } from 'vue'

import { FamilyLinkMode } from '@/constants/enums'
import { formatVisaCaseTypeDisplay } from '@/utils/visa-case-type-display'

import {
  VISA_CASE_WIZARD_KEY,
  type VisaCaseWizardContext,
} from './useVisaCaseWizard'

const wizard = inject(VISA_CASE_WIZARD_KEY) as VisaCaseWizardContext | undefined
if (!wizard) {
  throw new Error(
    'CustomerVisaCaseWizardPreview must be used inside CustomerVisaCaseWizard',
  )
}

const { form, T, contextApplicantDisplay, caseTypeOptions, pendingMembers } =
  wizard

/**
 * 将案件类型表单值解析为预览文案：优先匹配字典选项标签，否则回退为自由文本。
 *
 * @returns 非空案件类型展示串，未填写时返回占位文案
 */
const previewCaseTypeLabel = computed((): string => {
  const raw = form.caseType.trim()
  if (!raw) {return T('previewCaseTypeUnset')}
  const hit = caseTypeOptions.value.find((o) => o.value === raw)
  return hit?.label ?? (formatVisaCaseTypeDisplay(raw) || raw)
})

/**
 * 汇总家族签主申关联方式与主申人展示名，供侧栏只读展示。
 *
 * @returns 主申模式一行摘要
 */
const previewPrimaryModeLine = computed((): string => {
  if (!form.isFamilyCase) {return T('previewModeNonFamily')}
  if (form.familyLinkMode === FamilyLinkMode.INTERNAL) {
    const name = wizard.selectedPrimaryName.value.trim()
    return `${T('previewLinkInternal')}: ${name || T('previewUnset')}`
  }
  if (form.familyLinkMode === FamilyLinkMode.EXTERNAL) {
    const name = form.externalPrimaryName.trim()
    return `${T('previewLinkExternal')}: ${name || T('previewUnset')}`
  }
  return T('previewFamilyModePending')
})

const previewMemberCount = computed((): number => pendingMembers.value.length)
</script>

<template>
  <div class="visa-wizard-preview">
    <div class="visa-wizard-preview__title">
      {{ T('previewTitle') }}
    </div>
    <el-descriptions
      class="visa-wizard-preview__desc"
      :column="1"
      border
      size="small"
    >
      <el-descriptions-item :label="T('previewApplicant')">
        {{ contextApplicantDisplay }}
      </el-descriptions-item>
      <el-descriptions-item :label="T('previewCaseType')">
        {{ previewCaseTypeLabel }}
      </el-descriptions-item>
      <el-descriptions-item :label="T('previewPrimaryMode')">
        {{ previewPrimaryModeLine }}
      </el-descriptions-item>
      <el-descriptions-item :label="T('previewMemberCount')">
        {{ previewMemberCount }}
      </el-descriptions-item>
    </el-descriptions>
  </div>
</template>

<style scoped lang="scss">
.visa-wizard-preview {
  &__title {
    margin-bottom: 10px;
    font-size: var(--el-font-size-base);
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  &__desc {
    :deep(.el-descriptions__label) {
      width: 96px;
      font-size: var(--app-font-size-sm);
    }

    :deep(.el-descriptions__content) {
      font-size: var(--app-font-size-sm);
      word-break: break-word;
    }
  }
}
</style>
