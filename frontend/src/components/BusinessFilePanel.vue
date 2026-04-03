<script setup lang="ts">
import { UploadFilled } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { deleteFile, downloadFile, getFilePreviewUrl, getFiles, uploadFile } from '@/api/file'
import type { BusinessType } from '@/constants/enums'
import type { FileItem } from '@/types/file'
import { useLocaleFormatter } from '@/utils/locale-format'

const props = defineProps<{
  businessType: BusinessType
  customerId?: string
  relatedId?: string
}>()

defineOptions({ name: 'BusinessFilePanel' })

const { t } = useI18n({ useScope: 'global' })
const { formatDateTime } = useLocaleFormatter()
const loading = ref(false)
const files = ref<FileItem[]>([])
const previewVisible = ref(false)
const previewFile = ref<FileItem | null>(null)

const uploading = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)

const MAX_SIZE_MB = 50
const ALLOWED_ACCEPT = '.jpg,.jpeg,.png,.gif,.webp,.pdf,.xlsx,.xls,.docx,.doc,.txt,.csv'

onMounted(() => {
  fetchFiles()
})

/**
 * 按业务对象与关联记录刷新附件列表。
 */
async function fetchFiles() {
  loading.value = true
  try {
    const res = await getFiles({
      businessType: props.businessType,
      customerId: props.customerId,
      relatedId: props.relatedId,
      pageSize: 200,
      sortBy: 'createdAt',
      sortOrder: 'DESC',
    })
    files.value = res.data?.items ?? []
  } finally {
    loading.value = false
  }
}

function handleClickUpload() {
  fileInputRef.value?.click()
}

/**
 * 校验并上传用户本次选中的附件集合。
 *
 * @param e - 原生文件输入框触发的变更事件
 */
async function handleFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  if (!input.files?.length) return

  const selected = Array.from(input.files)
  input.value = ''

  uploading.value = true
  let successCount = 0
  try {
    for (const file of selected) {
      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        ElMessage.warning(t('dialogs.fileUpload.fileTooLarge', { name: file.name, maxSize: MAX_SIZE_MB }))
        continue
      }
      const ext = '.' + (file.name.split('.').pop()?.toLowerCase() ?? '')
      if (!ALLOWED_ACCEPT.split(',').includes(ext)) {
        ElMessage.warning(t('dialogs.fileUpload.invalidFileType', { name: file.name }))
        continue
      }
      await uploadFile({
        file,
        businessType: props.businessType,
        customerId: props.customerId,
        relatedId: props.relatedId,
      })
      successCount++
    }
    if (successCount > 0) {
      ElMessage.success(t('dialogs.fileUpload.success', { count: successCount }))
      fetchFiles()
    }
  } catch {
    if (successCount > 0) {
      ElMessage.warning(t('dialogs.fileUpload.partialSuccess', { success: successCount, total: selected.length }))
      fetchFiles()
    }
  } finally {
    uploading.value = false
  }
}

/**
 * 下载当前附件并在失败时提示用户。
 *
 * @param file - 需要下载的附件记录
 */
async function handleDownload(file: FileItem) {
  try {
    await downloadFile(file.id, file.fileName)
  } catch {
    ElMessage.error(t('request.downloadFailed'))
  }
}

function handlePreview(file: FileItem) {
  previewFile.value = file
  previewVisible.value = true
}

/**
 * 确认后删除当前附件并刷新列表。
 *
 * @param file - 需要删除的附件记录
 */
async function handleDelete(file: FileItem) {
  try {
    await ElMessageBox.confirm(
      t('detailViews.filePanel.deleteMessage', { name: file.fileName }),
      t('confirm.deleteTitle'),
      { confirmButtonText: t('common.delete'), cancelButtonText: t('common.cancel'), type: 'warning' },
    )
    await deleteFile(file.id)
    ElMessage.success(t('pages.files.deleteSuccess'))
    fetchFiles()
  } catch {
    // cancelled or error
  }
}

/**
 * 将字节数转换为附件列表展示用的可读文本。
 *
 * @param bytes - 附件原始大小，可能为空
 * @returns 适合表格展示的大小文本
 */
function formatSize(bytes: number | null): string {
  if (bytes === null || bytes === undefined) return '-'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function isPreviewable(file: FileItem): boolean {
  const exts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf']
  return !!file.fileExt && exts.includes(file.fileExt)
}

function getPreviewUrl(file: FileItem): string {
  return getFilePreviewUrl(file.id)
}

const isImage = (file: FileItem) =>
  !!file.fileExt && ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(file.fileExt)

const isPdf = (file: FileItem) => file.fileExt === '.pdf'

defineExpose({ refresh: fetchFiles })
</script>

<template>
  <div class="business-file-panel">
    <div class="panel-toolbar">
      <span class="panel-toolbar__count">
        {{ t('detailViews.filePanel.countLabel', { count: files.length }) }}
      </span>
      <el-button
        type="primary"
        size="small"
        :icon="UploadFilled"
        :loading="uploading"
        @click="handleClickUpload"
      >
        {{ t('common.upload') }}
      </el-button>
      <input
        ref="fileInputRef"
        type="file"
        :accept="ALLOWED_ACCEPT"
        multiple
        style="display: none"
        @change="handleFileChange"
      />
    </div>

    <el-table
      v-loading="loading"
      :data="files"
      stripe
      size="small"
      :empty-text="t('detailViews.filePanel.empty')"
      style="width: 100%"
    >
      <el-table-column :label="t('pages.files.fileName')" min-width="200" show-overflow-tooltip>
        <template #default="{ row }">
          <el-link
            v-if="isPreviewable(row)"
            type="primary"
            :underline="false"
            @click="handlePreview(row)"
          >
            {{ row.fileName }}
          </el-link>
          <span v-else>{{ row.fileName }}</span>
        </template>
      </el-table-column>
      <el-table-column :label="t('pages.files.size')" width="100" align="right">
        <template #default="{ row }">
          {{ formatSize(row.fileSize) }}
        </template>
      </el-table-column>
      <el-table-column :label="t('pages.files.uploader')" width="120" show-overflow-tooltip>
        <template #default="{ row }">
          {{ row.uploaderName ?? '-' }}
        </template>
      </el-table-column>
      <el-table-column :label="t('pages.files.uploadedAt')" width="160">
        <template #default="{ row }">
          {{ formatDateTime(row.createdAt) }}
        </template>
      </el-table-column>
      <el-table-column :label="t('common.actions')" width="160" fixed="right">
        <template #default="{ row }">
          <el-button
            v-if="isPreviewable(row)"
            type="primary"
            link
            size="small"
            @click="handlePreview(row)"
          >
            {{ t('common.preview') }}
          </el-button>
          <el-button type="primary" link size="small" @click="handleDownload(row)">
            {{ t('common.downloadShort') }}
          </el-button>
          <el-button type="danger" link size="small" @click="handleDelete(row)">
            {{ t('common.delete') }}
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog
      v-model="previewVisible"
      :title="previewFile?.fileName || t('dialogs.filePreview.defaultTitle')"
      width="80%"
      close-on-click-modal
      destroy-on-close
    >
      <div v-if="previewFile" class="preview-container">
        <img
          v-if="isImage(previewFile)"
          :src="getPreviewUrl(previewFile)"
          :alt="previewFile.fileName"
          class="preview-image"
        />
        <iframe
          v-else-if="isPdf(previewFile)"
          :src="getPreviewUrl(previewFile)"
          class="preview-pdf"
          frameborder="0"
        />
      </div>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.business-file-panel {
  width: 100%;
}

.panel-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--app-spacing-md);

  &__count {
    font-size: var(--app-font-size-sm);
    color: var(--app-text-secondary);
  }
}

.preview-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  max-height: 75vh;
  overflow: auto;
  background: var(--el-fill-color-light);
}

.preview-image {
  max-width: 100%;
  max-height: 75vh;
  object-fit: contain;
}

.preview-pdf {
  width: 100%;
  height: 75vh;
}
</style>
