<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  getTaxPeriod, updateTaxPeriodStatus,
} from '@/api/tax'
import { MaterialStatusLabel,MonthlyStatusLabel } from '@/constants/enum-labels'
import { MaterialStatus,MonthlyStatus } from '@/constants/enums'
import type { TaxPeriodDetail } from '@/types/tax'
import { useLocaleFormatter } from '@/utils/locale-format'

import PeriodDetailDocumentsSection from './PeriodDetailDocumentsSection.vue'
import PeriodDetailWorkItemsSection from './PeriodDetailWorkItemsSection.vue'

const props = defineProps<{
  modelValue: boolean
  contractId: string
  periodId: string
}>()
const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'updated'): void
}>()
defineOptions({ name: 'PeriodDetailDialog' })
const { t } = useI18n()
const { formatDate } = useLocaleFormatter()

const loading = ref(false)
const period = ref<TaxPeriodDetail | null>(null)
const statusUpdating = ref(false)

watch(
  () => [props.modelValue, props.periodId],
  ([open, pid]) => {
    if (open && pid) {
      fetchPeriod()
    }
  },
  { immediate: true },
)

const periodLabel = computed(() => {
  if (!period.value) return ''
  const [y, m] = period.value.periodYm.split('-')
  return t('detailViews.taxContract.periodsTab.periodLabel', {
    year: y,
    month: parseInt(m, 10),
  })
})

const documentProgress = computed(() => {
  if (!period.value) return ''
  const docs = period.value.documents
  if (docs.length === 0) return t('dialogs.periodDetail.noDocumentSummary')
  const received = docs.filter((d) => d.received).length
  return t('dialogs.periodDetail.receivedSummary', { received, total: docs.length })
})

const workItemProgress = computed(() => {
  if (!period.value) return ''
  const items = period.value.workItems
  if (items.length === 0) return t('dialogs.periodDetail.noWorkSummary')
  const completed = items.filter((w) => w.completed).length
  return t('dialogs.periodDetail.completedSummary', { completed, total: items.length })
})

const nextStatuses = computed<MonthlyStatus[]>(() => {
  if (!period.value) return []
  const map: Record<MonthlyStatus, MonthlyStatus[]> = {
    [MonthlyStatus.NOT_STARTED]: [MonthlyStatus.IN_PROGRESS],
    [MonthlyStatus.IN_PROGRESS]: [
      MonthlyStatus.COMPLETED,
      MonthlyStatus.NOT_STARTED,
    ],
    [MonthlyStatus.COMPLETED]: [MonthlyStatus.IN_PROGRESS],
  }
  return map[period.value.monthlyStatus] ?? []
})

/**
 * 拉取当前期间详情并同步对话框内的展示数据。
 *
 * @returns 完成请求后刷新期间、资料和工作项状态
 */
async function fetchPeriod() {
  loading.value = true
  try {
    const res = await getTaxPeriod(props.contractId, props.periodId)
    period.value = res.data
  } finally {
    loading.value = false
  }
}

/**
 * 关闭对话框并通知父层更新可见状态。
 */
function handleClose() {
  emit('update:modelValue', false)
}

// ── Status ───────────────────────────────────────────────

/**
 * 提交期间主状态流转，并在成功后回刷当前期间详情。
 *
 * @param newStatus 用户选择的目标主状态
 * @returns 完成状态更新后刷新详情并通知父层更新
 */
async function handleStatusChange(newStatus: MonthlyStatus) {
  statusUpdating.value = true
  try {
    await updateTaxPeriodStatus(
      props.contractId,
      props.periodId,
      newStatus,
    )
    ElMessage.success(
      t('dialogs.periodDetail.statusChanged', { status: MonthlyStatusLabel[newStatus] }),
    )
    await fetchPeriod()
    emit('updated')
  } catch {
    // handled
  } finally {
    statusUpdating.value = false
  }
}

/**
 * 将月度主状态映射为页面标签颜色。
 *
 * @param status 当前期间的主状态
 * @returns Element Plus 标签类型
 */
function monthlyStatusTagType(
  status: MonthlyStatus,
): 'info' | 'success' | 'warning' {
  switch (status) {
    case MonthlyStatus.NOT_STARTED:
      return 'info'
    case MonthlyStatus.IN_PROGRESS:
      return 'warning'
    case MonthlyStatus.COMPLETED:
      return 'success'
    default:
      return 'info'
  }
}

/**
 * 将资料状态映射为页面标签颜色。
 *
 * @param status 当前期间的资料收集状态
 * @returns Element Plus 标签类型
 */
function materialStatusTagType(
  status: MaterialStatus,
): 'info' | 'success' | 'warning' {
  switch (status) {
    case MaterialStatus.NOT_RECEIVED:
      return 'info'
    case MaterialStatus.PARTIAL:
      return 'warning'
    case MaterialStatus.COMPLETE:
      return 'success'
    default:
      return 'info'
  }
}

/**
 * 收口子区块变更后的刷新逻辑，保证期间详情和父层列表一起同步。
 *
 * @returns 先刷新当前详情，再通知父层期间列表重新拉取
 */
async function handleDetailUpdated() {
  await fetchPeriod()
  emit('updated')
}
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    :title="t('dialogs.periodDetail.title', { period: periodLabel })"
    width="720px"
    :close-on-click-modal="false"
    @update:model-value="emit('update:modelValue', $event)"
    @closed="handleClose"
  >
    <div v-loading="loading">
      <template v-if="period">
        <!-- Basic Info -->
        <el-descriptions :column="3" border size="small" class="period-detail__info">
          <el-descriptions-item :label="t('dialogs.periodDetail.period')">
            {{ periodLabel }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('dialogs.periodDetail.declarationDeadline')">
            {{ formatDate(period.declarationDeadline) }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('dialogs.periodDetail.monthlyStatus')">
            <el-tag size="small" :type="monthlyStatusTagType(period.monthlyStatus)">
              {{ MonthlyStatusLabel[period.monthlyStatus] }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item :label="t('dialogs.periodDetail.materialStatus')">
            <el-tag size="small" :type="materialStatusTagType(period.materialStatus)">
              {{ MaterialStatusLabel[period.materialStatus] }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item :label="t('dialogs.periodDetail.documentProgress')">
            {{ documentProgress }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('dialogs.periodDetail.workProgress')">
            {{ workItemProgress }}
          </el-descriptions-item>
        </el-descriptions>

        <!-- Status Transition -->
        <div v-if="nextStatuses.length > 0" class="period-detail__status-actions">
          <span class="period-detail__status-label">{{ t('dialogs.periodDetail.changeStatus') }}</span>
          <el-button
            v-for="ns in nextStatuses"
            :key="ns"
            size="small"
            :type="ns === MonthlyStatus.COMPLETED ? 'success' : 'primary'"
            :loading="statusUpdating"
            @click="handleStatusChange(ns)"
          >
            {{ t('dialogs.periodDetail.moveToStatus', { status: MonthlyStatusLabel[ns] }) }}
          </el-button>
        </div>

        <PeriodDetailDocumentsSection
          :contract-id="contractId"
          :period-id="periodId"
          :documents="period.documents"
          @updated="handleDetailUpdated"
        />

        <PeriodDetailWorkItemsSection
          :contract-id="contractId"
          :period-id="periodId"
          :work-items="period.workItems"
          @updated="handleDetailUpdated"
        />
      </template>
    </div>

    <template #footer>
      <el-button @click="handleClose">{{ t('common.close') }}</el-button>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">
.period-detail {
  &__info {
    margin-bottom: 16px;
  }

  &__status-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 16px;
    padding: var(--app-spacing-sm) var(--app-spacing-md);
    background: var(--el-fill-color-light);
    border-radius: var(--app-radius-base);
  }

  &__status-label {
    font-size: 13px;
    color: var(--app-text-regular);
    white-space: nowrap;
  }
}
</style>
