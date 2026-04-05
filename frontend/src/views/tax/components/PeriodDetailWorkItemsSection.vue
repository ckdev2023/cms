<script setup lang="ts">
import { Delete, Plus } from '@element-plus/icons-vue'
import type { FormInstance, FormRules } from 'element-plus'
import { ElMessage } from 'element-plus'
import { reactive,ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { createTaxWorkItem, deleteTaxWorkItem, updateTaxWorkItem } from '@/api/tax'
import { useConfirm } from '@/composables/useConfirm'
import type { TaxMonthlyWorkItemItem } from '@/types/tax'
import { useLocaleFormatter } from '@/utils/locale-format'

const props = defineProps<{
  contractId: string
  periodId: string
  workItems: TaxMonthlyWorkItemItem[]
}>()

const emit = defineEmits<{
  updated: []
}>()

defineOptions({ name: 'PeriodDetailWorkItemsSection' })

const { t } = useI18n()
const { confirmDelete } = useConfirm()
const { formatDate } = useLocaleFormatter()

const workFormRef = ref<FormInstance>()
const showWorkForm = ref(false)
const submitting = ref(false)
const workForm = reactive({ itemName: '', remark: '' })
const workFormRules: FormRules = {
  itemName: [
    {
      required: true,
      message: t('common.enterField', { field: t('dialogs.periodDetail.workItemName') }),
      trigger: 'blur',
    },
  ],
}

function openWorkForm() {
  workForm.itemName = ''
  workForm.remark = ''
  showWorkForm.value = true
}

function cancelWorkForm() {
  showWorkForm.value = false
  workFormRef.value?.resetFields()
}

/**
 * 新建当前期间的工作项并在成功后刷新父层详情数据。
 *
 * @returns 校验失败时提前结束；成功提交后触发更新事件
 */
async function handleWorkSubmit() {
  const valid = await workFormRef.value?.validate().catch(() => false)
  if (!valid) {return}

  submitting.value = true
  try {
    const maxSort = props.workItems.reduce(
      (max, item) => Math.max(max, item.sortOrder),
      0,
    )
    await createTaxWorkItem(props.contractId, props.periodId, {
      itemName: workForm.itemName,
      remark: workForm.remark || undefined,
      sortOrder: maxSort + 1,
    })
    ElMessage.success(t('dialogs.periodDetail.workItemAdded'))
    cancelWorkForm()
    emit('updated')
  } catch {
    // handled by interceptor
  } finally {
    submitting.value = false
  }
}

/**
 * 切换工作项完成状态并通知父层重新获取期间详情。
 *
 * @param item 当前操作的工作项
 * @returns 完成状态更新后触发父层刷新
 */
async function toggleWorkCompleted(item: TaxMonthlyWorkItemItem) {
  try {
    await updateTaxWorkItem(props.contractId, props.periodId, item.id, {
      completed: !item.completed,
    })
    emit('updated')
  } catch {
    // handled by interceptor
  }
}

/**
 * 删除指定工作项并在成功后刷新父层期间详情。
 *
 * @param item 待删除的工作项
 * @returns 用户取消时提前结束；删除成功后触发更新事件
 */
async function handleWorkDelete(item: TaxMonthlyWorkItemItem) {
  const confirmed = await confirmDelete(item.itemName)
  if (!confirmed) {return}

  try {
    await deleteTaxWorkItem(props.contractId, props.periodId, item.id)
    ElMessage.success(t('dialogs.periodDetail.workItemDeleted'))
    emit('updated')
  } catch {
    // handled by interceptor
  }
}
</script>

<template>
  <div class="period-detail-section">
    <div class="period-detail-section__header">
      <h4>{{ t('dialogs.periodDetail.workItemsTitle') }}</h4>
      <el-button type="primary" :icon="Plus" size="small" text @click="openWorkForm">
        {{ t('dialogs.periodDetail.addWorkItem') }}
      </el-button>
    </div>

    <el-card v-if="showWorkForm" shadow="never" class="period-detail-section__inline-form">
      <el-form
        ref="workFormRef"
        :model="workForm"
        :rules="workFormRules"
        label-position="top"
        size="small"
      >
        <el-form-item :label="t('dialogs.periodDetail.workItemName')" prop="itemName">
          <el-input
            v-model="workForm.itemName"
            :placeholder="t('dialogs.periodDetail.workItemName')"
            maxlength="200"
          />
        </el-form-item>
        <el-form-item :label="t('common.remark')" prop="remark">
          <el-input
            v-model="workForm.remark"
            :placeholder="t('common.remark')"
            maxlength="500"
          />
        </el-form-item>
        <div class="period-detail-section__form-actions">
          <el-button size="small" @click="cancelWorkForm">{{ t('common.cancel') }}</el-button>
          <el-button type="primary" size="small" :loading="submitting" @click="handleWorkSubmit">
            {{ t('common.create') }}
          </el-button>
        </div>
      </el-form>
    </el-card>

    <div v-if="workItems.length === 0 && !showWorkForm" class="period-detail-section__empty">
      {{ t('dialogs.periodDetail.noWorkItems') }}
    </div>

    <div v-else class="period-detail-section__checklist">
      <div
        v-for="item in workItems"
        :key="item.id"
        class="period-detail-section__check-item"
        :class="{ 'period-detail-section__check-item--done': item.completed }"
      >
        <el-checkbox :model-value="item.completed" @change="toggleWorkCompleted(item)">
          <span :class="{ 'period-detail-section__text-through': item.completed }">
            {{ item.itemName }}
          </span>
        </el-checkbox>
        <span v-if="item.completedAt" class="period-detail-section__check-date">
          {{ formatDate(item.completedAt) }}
          <template v-if="item.completedByName">
            ({{ item.completedByName }})
          </template>
        </span>
        <span v-if="item.remark" class="period-detail-section__check-remark">
          {{ item.remark }}
        </span>
        <el-button
          :icon="Delete"
          size="small"
          type="danger"
          text
          class="period-detail-section__check-delete"
          @click="handleWorkDelete(item)"
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
