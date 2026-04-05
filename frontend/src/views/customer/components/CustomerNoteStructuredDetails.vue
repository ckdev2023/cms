<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import { useLocaleFormatter } from '@/utils/locale-format'

const props = defineProps<{
  submittedItems?: string | null
  missingItems?: string | null
  nextAction?: string | null
  nextFollowUpAt?: string | null
}>()

defineOptions({ name: 'CustomerNoteStructuredDetails' })

const { t } = useI18n({ useScope: 'global' })
const { formatDateTime } = useLocaleFormatter()

/**
 * 复用案件日志 Tab 的 i18n 键渲染结构化字段标签。
 *
 * @param key - `detailViews.customer.visaCaseLogsTab` 下的子键
 * @returns 当前语言下的短标签
 */
function logFieldLabel(key: string): string {
  return t(`detailViews.customer.visaCaseLogsTab.${key}`)
}
</script>

<template>
  <div
    v-if="props.submittedItems || props.missingItems || props.nextAction || props.nextFollowUpAt"
    class="customer-note-structured-details"
  >
    <div v-if="props.submittedItems" class="customer-note-structured-details__row">
      <span class="customer-note-structured-details__label">{{ logFieldLabel('submittedItems') }}:</span>
      <span class="customer-note-structured-details__value">{{ props.submittedItems }}</span>
    </div>
    <div v-if="props.missingItems" class="customer-note-structured-details__row">
      <span class="customer-note-structured-details__label customer-note-structured-details__label--warning">
        {{ logFieldLabel('missingItems') }}:
      </span>
      <span class="customer-note-structured-details__value">{{ props.missingItems }}</span>
    </div>
    <div v-if="props.nextAction" class="customer-note-structured-details__row">
      <span class="customer-note-structured-details__label">{{ logFieldLabel('nextAction') }}:</span>
      <span class="customer-note-structured-details__value">{{ props.nextAction }}</span>
    </div>
    <div v-if="props.nextFollowUpAt" class="customer-note-structured-details__row">
      <span class="customer-note-structured-details__label">{{ logFieldLabel('nextFollowUpAt') }}:</span>
      <span class="customer-note-structured-details__value">{{ formatDateTime(props.nextFollowUpAt) }}</span>
    </div>
  </div>
</template>

<style scoped lang="scss">
.customer-note-structured-details {
  margin-top: 8px;
  padding: 8px 12px;
  background: var(--el-fill-color-lighter);
  border-radius: 4px;
  display: flex;
  flex-direction: column;
  gap: 4px;

  &__row {
    font-size: var(--app-font-size-sm);
    line-height: 1.5;
  }

  &__label {
    color: var(--app-text-secondary);
    font-weight: 500;

    &--warning {
      color: var(--el-color-warning);
    }
  }

  &__value {
    color: var(--app-text-primary);
    white-space: pre-wrap;
    word-break: break-word;
  }
}
</style>
