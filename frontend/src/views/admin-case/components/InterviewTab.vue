<script setup lang="ts">
import { ChatLineSquare, Delete, Edit, Location } from '@element-plus/icons-vue'
import type { FormInstance, FormRules } from 'element-plus'
import { ElMessage } from 'element-plus'
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  createInterview,
  deleteInterview,
  getInterviews,
  updateInterview,
} from '@/api/admin-case'
import { useConfirm } from '@/composables/useConfirm'
import type { InterviewItem, InterviewQueryParams } from '@/types/admin-case'
import { useLocaleFormatter } from '@/utils/locale-format'

const props = defineProps<{
  caseId: string
}>()

defineOptions({ name: 'InterviewTab' })

const { confirmDelete } = useConfirm()
const { t } = useI18n({ useScope: 'global' })
const { formatDate, formatDateTime } = useLocaleFormatter()

const loading = ref(false)
const interviews = ref<InterviewItem[]>([])
const total = ref(0)
const queryParams = reactive<InterviewQueryParams>({
  page: 1,
  pageSize: 20,
  sortOrder: 'DESC',
})

const formRef = ref<FormInstance>()
const submitting = ref(false)
const editingInterview = ref<InterviewItem | null>(null)
const showForm = ref(false)

const formModel = reactive({
  interviewDate: '',
  interviewLocation: '',
  content: '',
})

const formRules = computed<FormRules>(() => ({
  interviewDate: [
    { required: true, message: t('common.selectField', { field: t('detailViews.adminCase.interviewsTab.interviewDate') }), trigger: 'change' },
  ],
  content: [
    { required: true, message: t('common.enterField', { field: t('detailViews.adminCase.interviewsTab.content') }), trigger: 'blur' },
  ],
}))

const isEdit = computed(() => !!editingInterview.value)

watch(
  () => props.caseId,
  () => {
    if (props.caseId) {
      queryParams.page = 1
      fetchInterviews()
    }
  },
  { immediate: true },
)

/**
 * 按当前分页条件拉取面谈记录时间线。
 *
 * @returns 请求完成后更新面谈列表、总数与加载状态
 */
async function fetchInterviews() {
  loading.value = true
  try {
    const res = await getInterviews(props.caseId, queryParams)
    interviews.value = res.data.items
    total.value = res.data.total
  } finally {
    loading.value = false
  }
}

function handlePageChange(page: number) {
  queryParams.page = page
  fetchInterviews()
}

/**
 * 打开新增面谈表单，并填充默认日期与空白字段。
 */
function openCreateForm() {
  editingInterview.value = null
  formModel.interviewDate = new Date().toISOString().slice(0, 10)
  formModel.interviewLocation = ''
  formModel.content = ''
  showForm.value = true
}

/**
 * 将既有面谈记录写入表单，进入编辑模式。
 *
 * @param item - 用户选中的面谈记录
 */
function openEditForm(item: InterviewItem) {
  editingInterview.value = item
  formModel.interviewDate = item.interviewDate?.slice(0, 10) ?? ''
  formModel.interviewLocation = item.interviewLocation ?? ''
  formModel.content = item.content
  showForm.value = true
}

function cancelForm() {
  showForm.value = false
  editingInterview.value = null
  formRef.value?.resetFields()
}

/**
 * 校验面谈表单后提交新增或更新请求。
 *
 * @returns 当校验失败或请求结束时完成提交流程
 */
async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  submitting.value = true
  try {
    const payload = {
      interviewDate: formModel.interviewDate,
      interviewLocation: formModel.interviewLocation || undefined,
      content: formModel.content,
    }

    if (isEdit.value && editingInterview.value) {
      await updateInterview(props.caseId, editingInterview.value.id, payload)
      ElMessage.success(t('detailViews.adminCase.interviewsTab.updatedSuccess'))
    } else {
      await createInterview(props.caseId, payload)
      ElMessage.success(t('detailViews.adminCase.interviewsTab.createdSuccess'))
    }
    cancelForm()
    queryParams.page = 1
    fetchInterviews()
  } catch {
    // request interceptor handles the error
  } finally {
    submitting.value = false
  }
}

/**
 * 确认后删除指定面谈记录。
 *
 * @param item - 当前准备删除的面谈记录
 * @returns 用户取消确认或请求结束后完成删除流程
 */
async function handleDelete(item: InterviewItem) {
  const confirmed = await confirmDelete(t('detailViews.adminCase.interviewsTab.deleteName'))
  if (!confirmed) return

  try {
    await deleteInterview(props.caseId, item.id)
    ElMessage.success(t('detailViews.adminCase.interviewsTab.deletedSuccess'))
    fetchInterviews()
  } catch {
    // request interceptor handles the error
  }
}

</script>

<template>
  <div class="interview-tab">
    <div class="interview-tab__toolbar">
      <span class="interview-tab__count">{{ t('detailViews.adminCase.interviewsTab.countLabel', { count: total }) }}</span>
      <el-button type="primary" @click="openCreateForm">
        {{ t('detailViews.adminCase.interviewsTab.add') }}
      </el-button>
    </div>

    <el-card v-if="showForm" shadow="never" class="interview-tab__form-card">
      <template #header>
        <span>{{ isEdit ? t('detailViews.adminCase.interviewsTab.editTitle') : t('detailViews.adminCase.interviewsTab.createTitle') }}</span>
      </template>
      <el-form
        ref="formRef"
        :model="formModel"
        :rules="formRules"
        label-width="100px"
        label-position="top"
      >
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item :label="t('detailViews.adminCase.interviewsTab.interviewDate')" prop="interviewDate">
              <el-date-picker
                v-model="formModel.interviewDate"
                type="date"
                :placeholder="t('detailViews.adminCase.interviewsTab.interviewDatePlaceholder')"
                value-format="YYYY-MM-DD"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="t('detailViews.adminCase.interviewsTab.interviewLocation')" prop="interviewLocation">
              <el-input
                v-model="formModel.interviewLocation"
                :placeholder="t('detailViews.adminCase.interviewsTab.interviewLocationPlaceholder')"
                maxlength="200"
              />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item :label="t('detailViews.adminCase.interviewsTab.content')" prop="content">
          <el-input
            v-model="formModel.content"
            type="textarea"
            :rows="5"
            :placeholder="t('detailViews.adminCase.interviewsTab.contentPlaceholder')"
          />
        </el-form-item>
        <div class="interview-tab__form-actions">
          <el-button @click="cancelForm">{{ t('common.cancel') }}</el-button>
          <el-button type="primary" :loading="submitting" @click="handleSubmit">
            {{ isEdit ? t('common.update') : t('common.create') }}
          </el-button>
        </div>
      </el-form>
    </el-card>

    <div v-loading="loading" class="interview-tab__timeline">
      <el-empty v-if="!loading && interviews.length === 0" :description="t('detailViews.adminCase.interviewsTab.empty')" />

      <el-timeline v-else>
        <el-timeline-item
          v-for="item in interviews"
          :key="item.id"
          :timestamp="formatDate(item.interviewDate)"
          placement="top"
        >
          <el-card shadow="hover" class="interview-tab__card">
            <div class="interview-tab__card-header">
              <div class="interview-tab__card-meta">
                <span v-if="item.interviewLocation" class="interview-tab__location">
                  <el-icon><Location /></el-icon>
                  {{ item.interviewLocation }}
                </span>
                <span v-if="item.creatorName" class="interview-tab__author">
                  <el-icon><ChatLineSquare /></el-icon>
                  {{ item.creatorName }}
                </span>
              </div>
              <div class="interview-tab__card-actions">
                <el-button
                  :icon="Edit"
                  size="small"
                  text
                  type="primary"
                  @click="openEditForm(item)"
                >
                  {{ t('common.edit') }}
                </el-button>
                <el-button
                  :icon="Delete"
                  size="small"
                  text
                  type="danger"
                  @click="handleDelete(item)"
                >
                  {{ t('common.delete') }}
                </el-button>
              </div>
            </div>
            <div class="interview-tab__content">{{ item.content }}</div>
            <div class="interview-tab__footer">
              {{ t('detailViews.adminCase.interviewsTab.createdAtLabel') }}: {{ formatDateTime(item.createdAt) }}
            </div>
          </el-card>
        </el-timeline-item>
      </el-timeline>

      <div v-if="total > queryParams.pageSize!" class="interview-tab__pagination">
        <el-pagination
          :current-page="queryParams.page"
          :page-size="queryParams.pageSize"
          :total="total"
          layout="prev, pager, next"
          @current-change="handlePageChange"
        />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.interview-tab {
  &__toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
  }

  &__count {
    font-size: var(--app-font-size-sm);
    color: var(--app-text-secondary);
  }

  &__form-card {
    margin-bottom: 20px;
  }

  &__form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  &__card {
    :deep(.el-card__body) {
      padding: 12px 16px;
    }
  }

  &__card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }

  &__card-meta {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  &__location,
  &__author {
    font-size: var(--app-font-size-sm);
    color: var(--app-text-secondary);
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  &__card-actions {
    display: flex;
    gap: 4px;
  }

  &__content {
    font-size: var(--app-font-size-base);
    line-height: 1.6;
    color: var(--app-text-primary);
    white-space: pre-wrap;
    word-break: break-word;
  }

  &__footer {
    margin-top: var(--app-spacing-sm);
    font-size: var(--app-font-size-xs);
    color: var(--app-text-disabled);
  }

  &__pagination {
    display: flex;
    justify-content: center;
    margin-top: 16px;
  }
}
</style>
