<script setup lang="ts">
import { Delete, Plus } from '@element-plus/icons-vue'
import type { FormInstance, FormRules } from 'element-plus'
import { ElMessage } from 'element-plus'
import { reactive,ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { createTaxDocument, deleteTaxDocument, updateTaxDocument } from '@/api/tax'
import { useConfirm } from '@/composables/useConfirm'
import type { TaxMonthlyDocumentItem } from '@/types/tax'
import { useLocaleFormatter } from '@/utils/locale-format'

const props = defineProps<{
  contractId: string
  periodId: string
  documents: TaxMonthlyDocumentItem[]
}>()

const emit = defineEmits<{
  updated: []
}>()

defineOptions({ name: 'PeriodDetailDocumentsSection' })

const { t } = useI18n()
const { confirmDelete } = useConfirm()
const { formatDate } = useLocaleFormatter()

const docFormRef = ref<FormInstance>()
const showDocForm = ref(false)
const submitting = ref(false)
const docForm = reactive({ documentName: '', remark: '' })
const docFormRules: FormRules = {
  documentName: [
    {
      required: true,
      message: t('common.enterField', { field: t('dialogs.periodDetail.documentName') }),
      trigger: 'blur',
    },
  ],
}

function openDocForm() {
  docForm.documentName = ''
  docForm.remark = ''
  showDocForm.value = true
}

function cancelDocForm() {
  showDocForm.value = false
  docFormRef.value?.resetFields()
}

/**
 * 新建当前期间的资料收集项并通知父层刷新期间详情。
 *
 * @returns 校验失败时提前结束；成功时提交新增请求并触发更新事件
 */
async function handleDocSubmit() {
  const valid = await docFormRef.value?.validate().catch(() => false)
  if (!valid) return

  submitting.value = true
  try {
    await createTaxDocument(props.contractId, props.periodId, {
      documentName: docForm.documentName,
      remark: docForm.remark || undefined,
    })
    ElMessage.success(t('dialogs.periodDetail.documentAdded'))
    cancelDocForm()
    emit('updated')
  } catch {
    // handled by interceptor
  } finally {
    submitting.value = false
  }
}

/**
 * 切换单个资料项的接收状态并同步父层详情数据。
 *
 * @param doc 当前操作的资料项
 * @returns 完成更新请求后触发父层刷新
 */
async function toggleDocReceived(doc: TaxMonthlyDocumentItem) {
  try {
    await updateTaxDocument(props.contractId, props.periodId, doc.id, {
      received: !doc.received,
    })
    emit('updated')
  } catch {
    // handled by interceptor
  }
}

/**
 * 删除指定资料项并在成功后通知父层刷新清单。
 *
 * @param doc 待删除的资料项
 * @returns 用户取消时提前结束；成功删除后触发更新事件
 */
async function handleDocDelete(doc: TaxMonthlyDocumentItem) {
  const confirmed = await confirmDelete(doc.documentName)
  if (!confirmed) return

  try {
    await deleteTaxDocument(props.contractId, props.periodId, doc.id)
    ElMessage.success(t('dialogs.periodDetail.documentDeleted'))
    emit('updated')
  } catch {
    // handled by interceptor
  }
}
</script>

<template>
  <div class="period-detail-section">
    <div class="period-detail-section__header">
      <h4>{{ t('dialogs.periodDetail.documentsTitle') }}</h4>
      <el-button type="primary" :icon="Plus" size="small" text @click="openDocForm">
        {{ t('dialogs.periodDetail.addDocument') }}
      </el-button>
    </div>

    <el-card v-if="showDocForm" shadow="never" class="period-detail-section__inline-form">
      <el-form
        ref="docFormRef"
        :model="docForm"
        :rules="docFormRules"
        label-position="top"
        size="small"
      >
        <el-form-item :label="t('dialogs.periodDetail.documentName')" prop="documentName">
          <el-input
            v-model="docForm.documentName"
            :placeholder="t('dialogs.periodDetail.documentName')"
            maxlength="200"
          />
        </el-form-item>
        <el-form-item :label="t('common.remark')" prop="remark">
          <el-input
            v-model="docForm.remark"
            :placeholder="t('common.remark')"
            maxlength="500"
          />
        </el-form-item>
        <div class="period-detail-section__form-actions">
          <el-button size="small" @click="cancelDocForm">{{ t('common.cancel') }}</el-button>
          <el-button type="primary" size="small" :loading="submitting" @click="handleDocSubmit">
            {{ t('common.create') }}
          </el-button>
        </div>
      </el-form>
    </el-card>

    <div v-if="documents.length === 0 && !showDocForm" class="period-detail-section__empty">
      {{ t('dialogs.periodDetail.noDocuments') }}
    </div>

    <div v-else class="period-detail-section__checklist">
      <div
        v-for="doc in documents"
        :key="doc.id"
        class="period-detail-section__check-item"
        :class="{ 'period-detail-section__check-item--done': doc.received }"
      >
        <el-checkbox :model-value="doc.received" @change="toggleDocReceived(doc)">
          <span :class="{ 'period-detail-section__text-through': doc.received }">
            {{ doc.documentName }}
          </span>
        </el-checkbox>
        <span v-if="doc.receivedAt" class="period-detail-section__check-date">
          {{ t('dialogs.periodDetail.receivedAt', { date: formatDate(doc.receivedAt) }) }}
        </span>
        <span v-if="doc.remark" class="period-detail-section__check-remark">
          {{ doc.remark }}
        </span>
        <el-button
          :icon="Delete"
          size="small"
          type="danger"
          text
          class="period-detail-section__check-delete"
          @click="handleDocDelete(doc)"
        />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.period-detail-section {
  margin-top: 20px;

  h4 {
    margin: 0;
    font-size: var(--app-font-size-base);
    font-weight: var(--app-font-weight-semibold);
    color: var(--app-text-primary);
  }

  &__header {
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
    padding: var(--app-spacing-base) 0;
    text-align: center;
    font-size: var(--app-font-size-sm);
    color: var(--app-text-disabled);
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
      background: var(--app-bg-hover);
    }

    &--done {
      opacity: 0.7;
    }
  }

  &__check-date {
    font-size: var(--app-font-size-xs);
    color: var(--app-text-secondary);
    white-space: nowrap;
  }

  &__check-remark {
    font-size: 12px;
    color: var(--app-text-placeholder);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 200px;
  }

  &__check-delete {
    margin-left: auto;
    flex-shrink: 0;
  }

  &__text-through {
    text-decoration: line-through;
    color: var(--app-text-secondary);
  }
}
</style>
