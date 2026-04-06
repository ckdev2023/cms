<script setup lang="ts">
import { CopyDocument, Delete, Edit, InfoFilled, Plus } from '@element-plus/icons-vue'
import type { FormInstance, FormRules } from 'element-plus'
import { ElMessage } from 'element-plus'
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  createCustomerFilePath,
  deleteCustomerFilePath,
  getCustomerFilePaths,
  updateCustomerFilePath,
} from '@/api/visa-case'
import { useConfirm } from '@/composables/useConfirm'
import { FilePathTypeLabel } from '@/constants/enum-labels'
import { FilePathType } from '@/constants/enums'
import { P } from '@/constants/permissions'
import { useUserStore } from '@/stores/user'
import type { CustomerFilePathItem, CustomerFilePathQueryParams } from '@/types/visa-case'
import { useLocaleFormatter } from '@/utils/locale-format'

const props = defineProps<{
  customerId: string
}>()

defineOptions({ name: 'CustomerFilePathsTab' })

const { confirmDelete } = useConfirm()
const { t } = useI18n({ useScope: 'global' })
const { formatDateTime } = useLocaleFormatter()
const userStore = useUserStore()
const T = (key: string, params?: Record<string, unknown>) =>
  t(`detailViews.customer.filePathsTab.${key}`, params ?? {})

const canCreate = computed(() => userStore.hasPermission(P.CUSTOMER_FILE_PATH_CREATE))
const canEdit = computed(() => userStore.hasPermission(P.CUSTOMER_FILE_PATH_EDIT))
const canDelete = computed(() => userStore.hasPermission(P.CUSTOMER_FILE_PATH_DELETE))

const loading = ref(false)
const paths = ref<CustomerFilePathItem[]>([])
const total = ref(0)
const queryParams = reactive<CustomerFilePathQueryParams>({
  page: 1,
  pageSize: 20,
  pathType: undefined,
})

const formRef = ref<FormInstance>()
const submitting = ref(false)
const editingPath = ref<CustomerFilePathItem | null>(null)
const showForm = ref(false)

const formModel = reactive({
  pathType: FilePathType.CASE_DOCUMENT as FilePathType,
  filePath: '',
  displayName: '',
  remark: '',
})

const formRules = computed<FormRules>(() => ({
  filePath: [
    { required: true, message: T('filePathRequired'), trigger: 'blur' },
  ],
}))

const isEdit = computed(() => !!editingPath.value)

const pathTypeOptions = computed(() =>
  Object.values(FilePathType).map((value) => ({
    value,
    label: FilePathTypeLabel[value] ?? value,
  })),
)

const filterPathTypeOptions = computed(() => [
  { value: '', label: t('common.all') },
  ...pathTypeOptions.value,
])

const pathTypeTagType: Record<string, 'success' | 'warning' | 'info' | 'danger' | 'primary'> = {
  [FilePathType.CASE_DOCUMENT]: 'primary',
  [FilePathType.PERSONAL_DOCUMENT]: 'success',
  [FilePathType.CERTIFICATE]: 'warning',
  [FilePathType.CONTRACT]: 'info',
  [FilePathType.OTHER]: 'info',
}

watch(() => props.customerId, () => {
  if (props.customerId) {
    queryParams.page = 1
    fetchPaths()
  }
}, { immediate: true })

/**
 * 按当前筛选条件与分页加载客户名下的资料路径台账列表。
 *
 * @throws {Error} 路径列表接口请求失败时由请求层继续抛出
 */
async function fetchPaths(): Promise<void> {
  loading.value = true
  try {
    const res = await getCustomerFilePaths(props.customerId, queryParams)
    paths.value = res.data.items
    total.value = res.data.total
  } finally {
    loading.value = false
  }
}

function handleFilterChange(pathType: string): void {
  queryParams.pathType = pathType ? (pathType as FilePathType) : undefined
  queryParams.page = 1
  fetchPaths()
}

function handlePageChange(page: number): void {
  queryParams.page = page
  fetchPaths()
}

/**
 * 将指定文件路径复制到剪贴板并展示成功提示。
 *
 * @param filePath - 需要复制的服务器路径文本
 */
async function handleCopy(filePath: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(filePath)
    ElMessage.success(T('copySuccess'))
  } catch {
    const textarea = document.createElement('textarea')
    textarea.value = filePath
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
    ElMessage.success(T('copySuccess'))
  }
}

/**
 * 打开新增路径表单，重置编辑态与默认路径类型。
 */
function openCreateForm(): void {
  editingPath.value = null
  formModel.pathType = FilePathType.CASE_DOCUMENT
  formModel.filePath = ''
  formModel.displayName = ''
  formModel.remark = ''
  showForm.value = true
}

/**
 * 打开编辑表单，将选中路径的字段回填到表单模型。
 *
 * @param item - 准备编辑的路径记录
 */
function openEditForm(item: CustomerFilePathItem): void {
  editingPath.value = item
  formModel.pathType = item.pathType
  formModel.filePath = item.filePath
  formModel.displayName = item.displayName ?? ''
  formModel.remark = item.remark ?? ''
  showForm.value = true
}

function cancelForm(): void {
  showForm.value = false
  editingPath.value = null
  formRef.value?.resetFields()
}

/**
 * 校验路径表单并提交新增或编辑请求，成功后刷新列表。
 *
 * @throws {Error} 路径保存请求失败时由请求层统一提示并继续抛出
 */
async function handleSubmit(): Promise<void> {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) {return}

  submitting.value = true
  try {
    if (isEdit.value && editingPath.value) {
      await updateCustomerFilePath(editingPath.value.id, {
        pathType: formModel.pathType,
        filePath: formModel.filePath,
        displayName: formModel.displayName || undefined,
        remark: formModel.remark || undefined,
      })
      ElMessage.success(T('updatedSuccess'))
    } else {
      await createCustomerFilePath(props.customerId, {
        customerId: props.customerId,
        pathType: formModel.pathType,
        filePath: formModel.filePath,
        displayName: formModel.displayName || undefined,
        remark: formModel.remark || undefined,
      })
      ElMessage.success(T('createdSuccess'))
    }
    cancelForm()
    queryParams.page = 1
    fetchPaths()
  } catch {
    // request interceptor handles the error
  } finally {
    submitting.value = false
  }
}

/**
 * 删除指定资料路径记录，成功后刷新列表。
 *
 * @param item - 准备删除的路径记录
 * @throws {Error} 路径删除请求失败时由请求层统一提示并继续抛出
 */
async function handleDelete(item: CustomerFilePathItem): Promise<void> {
  const confirmed = await confirmDelete(T('pathDeleteName'))
  if (!confirmed) {return}

  try {
    await deleteCustomerFilePath(item.id)
    ElMessage.success(T('deletedSuccess'))
    fetchPaths()
  } catch {
    // request interceptor handles the error
  }
}

/**
 * 返回路径记录的显示名：优先 displayName，其次截取 filePath 末尾路径段。
 *
 * @param item - 路径记录
 * @returns 用于界面展示的名称字符串
 */
function displayLabel(item: CustomerFilePathItem): string {
  if (item.displayName) {return item.displayName}
  const parts = item.filePath.replace(/[\\/]+$/, '').split(/[\\/]/)
  return parts[parts.length - 1] || item.filePath
}
</script>

<template>
  <div class="file-paths-tab">
    <p class="file-paths-tab__hint" role="note">
      <el-icon class="file-paths-tab__hint-icon" aria-hidden>
        <InfoFilled />
      </el-icon>
      <span class="file-paths-tab__hint-text">{{ T('notUploadHint') }}</span>
    </p>

    <div class="file-paths-tab__toolbar">
      <div class="file-paths-tab__filter">
        <el-select
          :model-value="queryParams.pathType ?? ''"
          :placeholder="T('filterPlaceholder')"
          size="default"
          style="width: 180px"
          @change="handleFilterChange"
        >
          <el-option
            v-for="opt in filterPathTypeOptions"
            :key="opt.value"
            :label="opt.label"
            :value="opt.value"
          />
        </el-select>
        <span class="file-paths-tab__count">{{ T('countLabel', { count: total }) }}</span>
      </div>
      <el-button v-if="canCreate" type="primary" :icon="Plus" @click="openCreateForm">
        {{ T('add') }}
      </el-button>
    </div>

    <el-card v-if="showForm" shadow="never" class="file-paths-tab__form-card">
      <template #header>
        <span>{{ isEdit ? T('editTitle') : T('createTitle') }}</span>
      </template>
      <el-form
        ref="formRef"
        :model="formModel"
        :rules="formRules"
        label-width="120px"
        label-position="top"
      >
        <el-form-item :label="T('pathType')" prop="pathType">
          <el-radio-group v-model="formModel.pathType">
            <el-radio-button
              v-for="opt in pathTypeOptions"
              :key="opt.value"
              :value="opt.value"
            >
              {{ opt.label }}
            </el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item :label="T('filePath')" prop="filePath">
          <el-input
            v-model="formModel.filePath"
            :placeholder="T('filePathPlaceholder')"
            clearable
          />
        </el-form-item>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item :label="T('displayName')">
              <el-input
                v-model="formModel.displayName"
                :placeholder="T('displayNamePlaceholder')"
                clearable
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="T('remark')">
              <el-input
                v-model="formModel.remark"
                :placeholder="T('remarkPlaceholder')"
                clearable
              />
            </el-form-item>
          </el-col>
        </el-row>
        <div class="file-paths-tab__form-actions">
          <el-button @click="cancelForm">{{ t('common.cancel') }}</el-button>
          <el-button type="primary" :loading="submitting" @click="handleSubmit">
            {{ isEdit ? t('common.update') : t('common.create') }}
          </el-button>
        </div>
      </el-form>
    </el-card>

    <el-table
      v-loading="loading"
      :data="paths"
      stripe
      class="file-paths-tab__table"
    >
      <el-table-column :label="T('pathType')" width="130">
        <template #default="{ row }">
          <el-tag size="small" :type="pathTypeTagType[row.pathType] ?? 'info'">
            {{ FilePathTypeLabel[row.pathType as FilePathType] }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column :label="T('displayName')" min-width="150">
        <template #default="{ row }">
          {{ displayLabel(row) }}
        </template>
      </el-table-column>
      <el-table-column :label="T('filePath')" min-width="280">
        <template #default="{ row }">
          <div class="file-paths-tab__path-cell">
            <code class="file-paths-tab__path-text">{{ row.filePath }}</code>
            <el-button
              :icon="CopyDocument"
              size="small"
              text
              type="primary"
              class="file-paths-tab__copy-btn"
              @click="handleCopy(row.filePath)"
            />
          </div>
        </template>
      </el-table-column>
      <el-table-column :label="T('remark')" min-width="120" show-overflow-tooltip>
        <template #default="{ row }">
          {{ row.remark || '-' }}
        </template>
      </el-table-column>
      <el-table-column :label="T('createdBy')" width="100">
        <template #default="{ row }">
          {{ row.creatorName || '-' }}
        </template>
      </el-table-column>
      <el-table-column :label="T('createdAt')" width="160">
        <template #default="{ row }">
          {{ formatDateTime(row.createdAt) }}
        </template>
      </el-table-column>
      <el-table-column
        v-if="canEdit || canDelete"
        :label="t('common.actions')"
        width="140"
        fixed="right"
      >
        <template #default="{ row }">
          <el-button
            v-if="canEdit"
            :icon="Edit"
            size="small"
            text
            type="primary"
            @click="openEditForm(row)"
          >
            {{ t('common.edit') }}
          </el-button>
          <el-button
            v-if="canDelete"
            :icon="Delete"
            size="small"
            text
            type="danger"
            @click="handleDelete(row)"
          >
            {{ t('common.delete') }}
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-empty v-if="!loading && paths.length === 0" :description="T('empty')" />

    <div v-if="total > queryParams.pageSize!" class="file-paths-tab__pagination">
      <el-pagination
        :current-page="queryParams.page"
        :page-size="queryParams.pageSize"
        :total="total"
        layout="prev, pager, next"
        @current-change="handlePageChange"
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
.file-paths-tab {
  &__hint {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    margin: 0 0 var(--app-spacing-md);
    padding: 10px 12px;
    border-radius: calc(var(--el-border-radius-base) + 2px);
    background: var(--el-fill-color-lighter);
    border: 1px solid var(--el-border-color-lighter);
    font-size: var(--el-font-size-extra-small);
    line-height: 1.45;
    color: var(--el-text-color-secondary);
    letter-spacing: -0.01em;
  }

  &__hint-icon {
    flex-shrink: 0;
    margin-top: 1px;
    font-size: 14px;
    color: var(--el-color-info);
  }

  &__hint-text {
    flex: 1;
    min-width: 0;
  }

  &__toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--app-spacing-sm);
    margin-bottom: var(--app-spacing-md);
    padding: var(--app-spacing-sm) var(--app-spacing-md);
    border-radius: calc(var(--el-border-radius-base) + 2px);
    background: var(--el-fill-color-blank);
    border: 1px solid var(--el-border-color-extra-light);
  }

  &__filter {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--app-spacing-sm);
  }

  &__count {
    font-size: var(--el-font-size-small);
    font-weight: 500;
    color: var(--el-text-color-secondary);
    letter-spacing: -0.02em;
  }
  &__form-card { margin-bottom: 20px; }
  &__form-actions { display: flex; justify-content: flex-end; gap: 8px; }

  &__table {
    width: 100%;
  }

  &__path-cell {
    display: flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
  }

  &__path-text {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: var(--app-font-size-sm);
    background: var(--el-fill-color-lighter);
    padding: 2px 6px;
    border-radius: 3px;
    font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
    color: var(--app-text-primary);
  }

  &__copy-btn {
    flex-shrink: 0;
  }

  &__pagination { display: flex; justify-content: center; margin-top: 16px; }
}
</style>
