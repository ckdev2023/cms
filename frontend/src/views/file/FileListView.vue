<script setup lang="ts">
import { computed, ref, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import {
  Plus,
  Search,
  Refresh,
  Download,
  View,
  Edit,
  Delete,
} from '@element-plus/icons-vue'
import PageList from '@/components/PageList.vue'
import ProTable from '@/components/ProTable.vue'
import FileUploadDialog from './components/FileUploadDialog.vue'
import FileEditDialog from './components/FileEditDialog.vue'
import FilePreviewDialog from './components/FilePreviewDialog.vue'
import { useAppStore } from '@/stores/app'
import { getFiles, deleteFile, downloadFile } from '@/api/file'
import { useProTable } from '@/composables/useProTable'
import { useConfirm } from '@/composables/useConfirm'
import { BusinessType } from '@/constants/enums'
import { BusinessTypeLabel } from '@/constants/enum-labels'
import type { ProTableColumn } from '@/types/components'
import type { FileItem, FileQueryParams } from '@/types/file'
import { useI18n } from 'vue-i18n'

defineOptions({ name: 'FileListView' })

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
} = useProTable<FileItem>(getFiles)

const uploadVisible = ref(false)
const editVisible = ref(false)
const previewVisible = ref(false)
const editingFile = ref<FileItem | null>(null)
const previewFile = ref<FileItem | null>(null)

function handleUpload() {
  uploadVisible.value = true
}

function handleEdit(row: FileItem) {
  editingFile.value = row
  editVisible.value = true
}

function handlePreview(row: FileItem) {
  const previewable = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf']
  if (!row.fileExt || !previewable.includes(row.fileExt)) {
    ElMessage.info(t('common.unsupportedPreview'))
    return
  }
  previewFile.value = row
  previewVisible.value = true
}

async function handleDownload(row: FileItem) {
  try {
    await downloadFile(row.id, row.fileName)
  } catch {
    ElMessage.error(t('common.downloadFailed'))
  }
}

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

function doSearch() {
  const params: Record<string, any> = {}
  if (searchForm.keyword) params.keyword = searchForm.keyword
  if (searchForm.businessType) params.businessType = searchForm.businessType
  if (searchForm.fileExt) params.fileExt = searchForm.fileExt
  handleSearch(params)
}

function doReset() {
  searchForm.keyword = ''
  searchForm.businessType = undefined
  searchForm.fileExt = undefined
  handleReset()
}

function handleSortChange(sort: { prop: string; order: string }) {
  const params: Record<string, any> = {}
  if (sort.prop && sort.order) {
    params.sortBy = sort.prop
    params.sortOrder = sort.order === 'ascending' ? 'ASC' : 'DESC'
  }
  handleSearch({ ...searchForm, ...params })
}

function formatDate(dateStr: string) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString(appStore.locale === 'zh-CN' ? 'zh-CN' : 'ja-JP')
}

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
