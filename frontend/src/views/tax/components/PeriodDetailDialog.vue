<script setup lang="ts">
import { ref, reactive, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { FormInstance, FormRules } from 'element-plus'
import { ElMessage } from 'element-plus'
import {
  Plus,
  Delete,
} from '@element-plus/icons-vue'
import {
  getTaxPeriod,
  updateTaxPeriodStatus,
  createTaxDocument,
  updateTaxDocument,
  deleteTaxDocument,
  createTaxWorkItem,
  updateTaxWorkItem,
  deleteTaxWorkItem,
} from '@/api/tax'
import { MonthlyStatus, MaterialStatus } from '@/constants/enums'
import { MonthlyStatusLabel, MaterialStatusLabel } from '@/constants/enum-labels'
import { useConfirm } from '@/composables/useConfirm'
import { useLocaleFormatter } from '@/utils/locale-format'
import type {
  TaxPeriodDetail,
  TaxMonthlyDocumentItem,
  TaxMonthlyWorkItemItem,
} from '@/types/tax'

defineOptions({ name: 'PeriodDetailDialog' })
const { t } = useI18n()
const { formatDate } = useLocaleFormatter()

const props = defineProps<{
  modelValue: boolean
  contractId: string
  periodId: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'updated'): void
}>()

const { confirmDelete } = useConfirm()
const loading = ref(false)
const period = ref<TaxPeriodDetail | null>(null)
const statusUpdating = ref(false)

// ── Document form ────────────────────────────────────────
const docFormRef = ref<FormInstance>()
const showDocForm = ref(false)
const docSubmitting = ref(false)
const docForm = reactive({ documentName: '', remark: '' })
const docFormRules: FormRules = {
  documentName: [
    { required: true, message: t('common.enterField', { field: t('dialogs.periodDetail.documentName') }), trigger: 'blur' },
  ],
}

// ── Work item form ───────────────────────────────────────
const workFormRef = ref<FormInstance>()
const showWorkForm = ref(false)
const workSubmitting = ref(false)
const workForm = reactive({ itemName: '', remark: '' })
const workFormRules: FormRules = {
  itemName: [
    { required: true, message: t('common.enterField', { field: t('dialogs.periodDetail.workItemName') }), trigger: 'blur' },
  ],
}

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

async function fetchPeriod() {
  loading.value = true
  try {
    const res = await getTaxPeriod(props.contractId, props.periodId)
    period.value = res.data
  } finally {
    loading.value = false
  }
}

function handleClose() {
  emit('update:modelValue', false)
  showDocForm.value = false
  showWorkForm.value = false
}

// ── Status ───────────────────────────────────────────────

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

// ── Documents ────────────────────────────────────────────

function openDocForm() {
  docForm.documentName = ''
  docForm.remark = ''
  showDocForm.value = true
}

function cancelDocForm() {
  showDocForm.value = false
  docFormRef.value?.resetFields()
}

async function handleDocSubmit() {
  const valid = await docFormRef.value?.validate().catch(() => false)
  if (!valid) return

  docSubmitting.value = true
  try {
    await createTaxDocument(props.contractId, props.periodId, {
      documentName: docForm.documentName,
      remark: docForm.remark || undefined,
    })
    ElMessage.success(t('dialogs.periodDetail.documentAdded'))
    cancelDocForm()
    await fetchPeriod()
    emit('updated')
  } catch {
    // handled
  } finally {
    docSubmitting.value = false
  }
}

async function toggleDocReceived(doc: TaxMonthlyDocumentItem) {
  try {
    await updateTaxDocument(props.contractId, props.periodId, doc.id, {
      received: !doc.received,
    })
    await fetchPeriod()
    emit('updated')
  } catch {
    // handled
  }
}

async function handleDocDelete(doc: TaxMonthlyDocumentItem) {
  const confirmed = await confirmDelete(doc.documentName)
  if (!confirmed) return

  try {
    await deleteTaxDocument(props.contractId, props.periodId, doc.id)
    ElMessage.success(t('dialogs.periodDetail.documentDeleted'))
    await fetchPeriod()
    emit('updated')
  } catch {
    // handled
  }
}

// ── Work Items ───────────────────────────────────────────

function openWorkForm() {
  workForm.itemName = ''
  workForm.remark = ''
  showWorkForm.value = true
}

function cancelWorkForm() {
  showWorkForm.value = false
  workFormRef.value?.resetFields()
}

async function handleWorkSubmit() {
  const valid = await workFormRef.value?.validate().catch(() => false)
  if (!valid) return

  workSubmitting.value = true
  try {
    const maxSort = period.value?.workItems.reduce(
      (max, w) => Math.max(max, w.sortOrder),
      0,
    ) ?? 0
    await createTaxWorkItem(props.contractId, props.periodId, {
      itemName: workForm.itemName,
      remark: workForm.remark || undefined,
      sortOrder: maxSort + 1,
    })
    ElMessage.success(t('dialogs.periodDetail.workItemAdded'))
    cancelWorkForm()
    await fetchPeriod()
    emit('updated')
  } catch {
    // handled
  } finally {
    workSubmitting.value = false
  }
}

async function toggleWorkCompleted(item: TaxMonthlyWorkItemItem) {
  try {
    await updateTaxWorkItem(props.contractId, props.periodId, item.id, {
      completed: !item.completed,
    })
    await fetchPeriod()
    emit('updated')
  } catch {
    // handled
  }
}

async function handleWorkDelete(item: TaxMonthlyWorkItemItem) {
  const confirmed = await confirmDelete(item.itemName)
  if (!confirmed) return

  try {
    await deleteTaxWorkItem(props.contractId, props.periodId, item.id)
    ElMessage.success(t('dialogs.periodDetail.workItemDeleted'))
    await fetchPeriod()
    emit('updated')
  } catch {
    // handled
  }
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

        <!-- Documents Section -->
        <div class="period-detail__section">
          <div class="period-detail__section-header">
            <h4>{{ t('dialogs.periodDetail.documentsTitle') }}</h4>
            <el-button type="primary" :icon="Plus" size="small" text @click="openDocForm">
              {{ t('dialogs.periodDetail.addDocument') }}
            </el-button>
          </div>

          <el-card v-if="showDocForm" shadow="never" class="period-detail__inline-form">
            <el-form
              ref="docFormRef"
              :model="docForm"
              :rules="docFormRules"
              label-position="top"
              size="small"
            >
              <el-form-item :label="t('dialogs.periodDetail.documentName')" prop="documentName">
                <el-input v-model="docForm.documentName" :placeholder="t('dialogs.periodDetail.documentName')" maxlength="200" />
              </el-form-item>
              <el-form-item :label="t('common.remark')" prop="remark">
                <el-input v-model="docForm.remark" :placeholder="t('common.remark')" maxlength="500" />
              </el-form-item>
              <div class="period-detail__form-actions">
                <el-button size="small" @click="cancelDocForm">{{ t('common.cancel') }}</el-button>
                <el-button type="primary" size="small" :loading="docSubmitting" @click="handleDocSubmit">
                  {{ t('common.create') }}
                </el-button>
              </div>
            </el-form>
          </el-card>

          <div v-if="period.documents.length === 0 && !showDocForm" class="period-detail__empty">
            {{ t('dialogs.periodDetail.noDocuments') }}
          </div>

          <div v-else class="period-detail__checklist">
            <div
              v-for="doc in period.documents"
              :key="doc.id"
              class="period-detail__check-item"
              :class="{ 'period-detail__check-item--done': doc.received }"
            >
              <el-checkbox
                :model-value="doc.received"
                @change="toggleDocReceived(doc)"
              >
                <span :class="{ 'text-through': doc.received }">
                  {{ doc.documentName }}
                </span>
              </el-checkbox>
              <span v-if="doc.receivedAt" class="period-detail__check-date">
                {{ t('dialogs.periodDetail.receivedAt', { date: formatDate(doc.receivedAt) }) }}
              </span>
              <span v-if="doc.remark" class="period-detail__check-remark">
                {{ doc.remark }}
              </span>
              <el-button
                :icon="Delete"
                size="small"
                type="danger"
                text
                class="period-detail__check-delete"
                @click="handleDocDelete(doc)"
              />
            </div>
          </div>
        </div>

        <!-- Work Items Section -->
        <div class="period-detail__section">
          <div class="period-detail__section-header">
            <h4>{{ t('dialogs.periodDetail.workItemsTitle') }}</h4>
            <el-button type="primary" :icon="Plus" size="small" text @click="openWorkForm">
              {{ t('dialogs.periodDetail.addWorkItem') }}
            </el-button>
          </div>

          <el-card v-if="showWorkForm" shadow="never" class="period-detail__inline-form">
            <el-form
              ref="workFormRef"
              :model="workForm"
              :rules="workFormRules"
              label-position="top"
              size="small"
            >
              <el-form-item :label="t('dialogs.periodDetail.workItemName')" prop="itemName">
                <el-input v-model="workForm.itemName" :placeholder="t('dialogs.periodDetail.workItemName')" maxlength="200" />
              </el-form-item>
              <el-form-item :label="t('common.remark')" prop="remark">
                <el-input v-model="workForm.remark" :placeholder="t('common.remark')" maxlength="500" />
              </el-form-item>
              <div class="period-detail__form-actions">
                <el-button size="small" @click="cancelWorkForm">{{ t('common.cancel') }}</el-button>
                <el-button type="primary" size="small" :loading="workSubmitting" @click="handleWorkSubmit">
                  {{ t('common.create') }}
                </el-button>
              </div>
            </el-form>
          </el-card>

          <div v-if="period.workItems.length === 0 && !showWorkForm" class="period-detail__empty">
            {{ t('dialogs.periodDetail.noWorkItems') }}
          </div>

          <div v-else class="period-detail__checklist">
            <div
              v-for="item in period.workItems"
              :key="item.id"
              class="period-detail__check-item"
              :class="{ 'period-detail__check-item--done': item.completed }"
            >
              <el-checkbox
                :model-value="item.completed"
                @change="toggleWorkCompleted(item)"
              >
                <span :class="{ 'text-through': item.completed }">
                  {{ item.itemName }}
                </span>
              </el-checkbox>
              <span v-if="item.completedAt" class="period-detail__check-date">
                {{ formatDate(item.completedAt) }}
                <template v-if="item.completedByName">
                  ({{ item.completedByName }})
                </template>
              </span>
              <span v-if="item.remark" class="period-detail__check-remark">
                {{ item.remark }}
              </span>
              <el-button
                :icon="Delete"
                size="small"
                type="danger"
                text
                class="period-detail__check-delete"
                @click="handleWorkDelete(item)"
              />
            </div>
          </div>
        </div>
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
    padding: 8px 12px;
    background: #f5f7fa;
    border-radius: 6px;
  }

  &__status-label {
    font-size: 13px;
    color: #606266;
    white-space: nowrap;
  }

  &__section {
    margin-top: 20px;

    h4 {
      margin: 0;
      font-size: 14px;
      font-weight: 600;
      color: #303133;
    }
  }

  &__section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }

  &__inline-form {
    margin-bottom: 12px;
  }

  &__form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  &__empty {
    padding: 16px 0;
    text-align: center;
    font-size: 13px;
    color: #c0c4cc;
  }

  &__checklist {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  &__check-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    border-radius: 4px;
    transition: background-color 0.15s;

    &:hover {
      background: #f5f7fa;
    }

    &--done {
      opacity: 0.7;
    }
  }

  &__check-date {
    font-size: 12px;
    color: #909399;
    white-space: nowrap;
  }

  &__check-remark {
    font-size: 12px;
    color: #a8abb2;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 200px;
  }

  &__check-delete {
    margin-left: auto;
    flex-shrink: 0;
  }
}

.text-through {
  text-decoration: line-through;
  color: #909399;
}
</style>
