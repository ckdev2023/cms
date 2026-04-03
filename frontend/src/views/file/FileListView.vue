<script setup lang="ts">
import { Delete, Download, Edit, Plus, Refresh, Search, View } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { computed, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { deleteFile, downloadFile, getFiles } from '@/api/file'
import PageList from '@/components/PageList.vue'
import ProTable from '@/components/ProTable.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useProTable } from '@/composables/useProTable'
import { BusinessTypeLabel } from '@/constants/enum-labels'
import { BusinessType } from '@/constants/enums'
import { useAppStore } from '@/stores/app'
import type { ProTableColumn } from '@/types/components'
import type { FileItem, FileQueryParams } from '@/types/file'

import FileEditDialog from './components/FileEditDialog.vue'
import FilePreviewDialog from './components/FilePreviewDialog.vue'
import FileUploadDialog from './components/FileUploadDialog.vue'

defineOptions({ name: 'FileListView' })

type FileSortChange = {
  prop: string
  order: string | null
}

type FileListSearchParams = Partial<FileQueryParams> & Record<string, unknown>

const { confirmDelete } = useConfirm()
const appStore = useAppStore()
const { t } = useI18n({ useScope: 'global' })

const columns = computed<ProTableColumn[]>(() => [
  { prop: 'fileName', label: t('pages.files.fileName'), minWidth: 220, showOverflowTooltip: true },
  { prop: 'businessType', label: t('pages.files.category'), width: 90, slot: 'businessType', align: 'center' },
  { prop: 'fileExt', label: t('pages.files.format'), width: 80, slot: 'fileExt', align: 'center' },
  { prop: 'fileSize', label: t('pages.files.size'), width: 100, slot: 'fileSize', align: 'right', sortable: 'custom' },
  { prop: 'uploaderName', label: t('pages.files.uploader'), width: 120 },
  { prop: 'description', label: t('common.description'), minWidth: 150, showOverflowTooltip: true },
  { prop: 'createdAt', label: t('pages.files.uploadedAt'), width: 130, slot: 'createdAt', sortable: 'custom' },
])

const searchForm = reactive<FileQueryParams>({
  keyword: '',
  businessType: undefined,
  fileExt: undefined,
})

const {
  loading,
  data,
  total,
  page,
  pageSize,
  fetchData,
  handlePageChange,
  handleSizeChange,
  handleSearch,
  handleReset,
} = useProTable<FileItem, FileListSearchParams>(getFiles)

const uploadVisible = ref(false)
const editVisible = ref(false)
const previewVisible = ref(false)
const editingFile = ref<FileItem | null>(null)
const previewFile = ref<FileItem | null>(null)
const previewableExtensions = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf'])

function handleUpload() {
  uploadVisible.value = true
}

function handleEdit(row: FileItem) {
  editingFile.value = row
  editVisible.value = true
}

/**
 * 在文件支持在线预览时打开预览弹窗。
 *
 * 不支持预览的扩展名会直接提示用户，避免打开空白预览窗口。
 *
 * @param row - 当前选中的文件记录
 */
function handlePreview(row: FileItem) {
  if (!row.fileExt || !previewableExtensions.has(row.fileExt)) {
    ElMessage.info(t('common.unsupportedPreview'))
    return
  }
  previewFile.value = row
  previewVisible.value = true
}

/**
 * 下载当前文件到本地。
 *
 * @param row - 当前选中的文件记录
 */
async function handleDownload(row: FileItem) {
  try {
    await downloadFile(row.id, row.fileName)
  } catch {
    ElMessage.error(t('common.downloadFailed'))
  }
}

/**
 * 确认后删除指定文件并刷新列表。
 *
 * @param row - 当前选中的文件记录
 */
async function handleDelete(row: FileItem) {
  const ok = await confirmDelete(row.fileName)
  if (!ok) return

  try {
    await deleteFile(row.id)
    ElMessage.success(t('pages.files.deleteSuccess'))
    fetchData()
  } catch {
    // handled by interceptor
  }
}

function handleSaved() {
  fetchData()
}

/**
 * 根据当前文件筛选表单构造列表查询参数。
 *
 * 仅保留已填写的筛选项，避免把空字符串或未选择值传入文件列表接口。
 *
 * @returns 可直接传给 `handleSearch` 的文件列表查询参数
 */
function buildSearchParams(): FileListSearchParams {
  const params: FileListSearchParams = {}
  if (searchForm.keyword) params.keyword = searchForm.keyword
  if (searchForm.businessType) params.businessType = searchForm.businessType
  if (searchForm.fileExt) params.fileExt = searchForm.fileExt

  return params
}

function doSearch() {
  handleSearch(buildSearchParams())
}

/**
 * 清空当前文件筛选条件并恢复默认列表。
 */
function doReset() {
  searchForm.keyword = ''
  searchForm.businessType = undefined
  searchForm.fileExt = undefined
  handleReset()
}

/**
 * 按当前筛选条件和表格排序状态重新拉取文件列表。
 *
 * @param sort - 当前表格返回的排序字段和方向
 */
function handleSortChange(sort: FileSortChange) {
  const params = buildSearchParams()
  if (sort.prop && sort.order) {
    params.sortBy = sort.prop
    params.sortOrder = sort.order === 'ascending' ? 'ASC' : 'DESC'
  }
  handleSearch(params)
}

function formatDate(dateStr: string) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString(appStore.locale === 'zh-CN' ? 'zh-CN' : 'ja-JP')
}

/**
 * 将字节数格式化为便于列表展示的文本。
 *
 * @param bytes - 文件大小的字节数
 * @returns 适合表格展示的文件大小文本
 */
function formatSize(bytes: number | null): string {
  if (bytes === null || bytes === undefined) return '-'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function formatExt(ext: string | null): string {
  if (!ext) return '-'
  return ext.replace('.', '').toUpperCase()
}

const businessTypeTagType: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'primary'> = {
  [BusinessType.CUSTOMER]: 'primary',
  [BusinessType.ADMIN]: 'success',
  [BusinessType.TAX]: 'warning',
  [BusinessType.FINANCE]: 'danger',
  [BusinessType.INTERNAL]: 'info',
}

const extOptions = [
  { label: 'PDF', value: '.pdf' },
  { label: 'JPG', value: '.jpg' },
  { label: 'PNG', value: '.png' },
  { label: 'XLSX', value: '.xlsx' },
  { label: 'DOCX', value: '.docx' },
  { label: 'CSV', value: '.csv' },
  { label: 'TXT', value: '.txt' },
]
</script>

<template>
  <PageList :title="t('pages.files.title')">
    <template #headerExtra>
      <el-button type="primary" :icon="Plus" @click="handleUpload">
        {{ t('common.upload') }}
      </el-button>
    </template>

    <template #search>
      <el-form :model="searchForm" inline>
        <el-form-item :label="t('common.keyword')">
          <el-input
            v-model="searchForm.keyword"
            :placeholder="t('pages.files.keywordPlaceholder')"
            clearable
            style="width: 200px"
            @keyup.enter="doSearch"
          />
        </el-form-item>
        <el-form-item :label="t('pages.files.category')">
          <el-select
            v-model="searchForm.businessType"
            :placeholder="t('common.all')"
            clearable
            style="width: 120px"
          >
            <el-option
              v-for="(label, key) in BusinessTypeLabel"
              :key="key"
              :label="label"
              :value="key"
            />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('pages.files.format')">
          <el-select
            v-model="searchForm.fileExt"
            :placeholder="t('common.all')"
            clearable
            style="width: 110px"
          >
            <el-option
              v-for="opt in extOptions"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search" @click="doSearch">{{ t('common.search') }}</el-button>
          <el-button :icon="Refresh" @click="doReset">{{ t('common.reset') }}</el-button>
        </el-form-item>
      </el-form>
    </template>

    <ProTable
      :columns="columns"
      :data="data"
      :loading="loading"
      :total="total"
      :page="page"
      :page-size="pageSize"
      :actions-width="220"
      @page-change="handlePageChange"
      @size-change="handleSizeChange"
      @sort-change="handleSortChange"
    >
      <template #businessType="{ row }">
        <el-tag size="small" :type="businessTypeTagType[row.businessType] ?? 'info'">
          {{ BusinessTypeLabel[row.businessType as BusinessType] ?? row.businessType }}
        </el-tag>
      </template>

      <template #fileExt="{ row }">
        {{ formatExt(row.fileExt) }}
      </template>

      <template #fileSize="{ row }">
        {{ formatSize(row.fileSize) }}
      </template>

      <template #createdAt="{ row }">
        {{ formatDate(row.createdAt) }}
      </template>

      <template #actions="{ row }">
        <el-button type="primary" link size="small" :icon="View" @click.stop="handlePreview(row)">
          {{ t('common.preview') }}
        </el-button>
        <el-button type="primary" link size="small" :icon="Download" @click.stop="handleDownload(row)">
          {{ t('common.downloadShort') }}
        </el-button>
        <el-button type="primary" link size="small" :icon="Edit" @click.stop="handleEdit(row)">
          {{ t('common.edit') }}
        </el-button>
        <el-button type="danger" link size="small" :icon="Delete" @click.stop="handleDelete(row)">
          {{ t('common.delete') }}
        </el-button>
      </template>
    </ProTable>

    <FileUploadDialog v-model="uploadVisible" @saved="handleSaved" />
    <FileEditDialog v-model="editVisible" :edit-data="editingFile" @saved="handleSaved" />
    <FilePreviewDialog v-model="previewVisible" :file="previewFile" />
  </PageList>
</template>
