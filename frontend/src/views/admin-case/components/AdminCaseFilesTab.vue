<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { UploadFilled } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'
import {
  getAdminCaseDocuments,
  createAdminCaseDocument,
  updateAdminCaseDocument,
  deleteAdminCaseDocument,
} from '@/api/admin-case'
import { uploadFile, downloadFile, getFilePreviewUrl } from '@/api/file'
import { BusinessType } from '@/constants/enums'
import { useLocaleFormatter } from '@/utils/locale-format'
import type { AdminCaseDocumentItem } from '@/types/admin-case'

defineOptions({ name: 'AdminCaseFilesTab' })

const props = defineProps<{
  caseId: string
  customerId?: string
}>()

const { t } = useI18n({ useScope: 'global' })
const { formatDateTime } = useLocaleFormatter()
const loading = ref(false)
const documents = ref<AdminCaseDocumentItem[]>([])
const uploading = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)

const previewVisible = ref(false)
const previewDoc = ref<AdminCaseDocumentItem | null>(null)

const editVisible = ref(false)
const editLoading = ref(false)
const editingDoc = ref<AdminCaseDocumentItem | null>(null)
const editForm = ref({ documentType: '', remark: '' })

const MAX_SIZE_MB = 50
const ALLOWED_ACCEPT = '.jpg,.jpeg,.png,.gif,.webp,.pdf,.xlsx,.xls,.docx,.doc,.txt,.csv'

onMounted(() => {
  fetchDocuments()
})

async function fetchDocuments() {
  loading.value = true
  try {
    const res = await getAdminCaseDocuments(props.caseId)
    documents.value = res.data ?? []
  } finally {
    loading.value = false
  }
}

function handleClickUpload() {
  fileInputRef.value?.click()
}

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

      const uploadRes = await uploadFile({
        file,
        businessType: BusinessType.ADMIN,
        customerId: props.customerId,
        relatedId: props.caseId,
      })

      await createAdminCaseDocument(props.caseId, {
        fileId: uploadRes.data.id,
      })
      successCount++
    }
    if (successCount > 0) {
      ElMessage.success(t('dialogs.fileUpload.success', { count: successCount }))
      fetchDocuments()
    }
  } catch {
    if (successCount > 0) {
      ElMessage.warning(t('dialogs.fileUpload.partialSuccess', { success: successCount, total: selected.length }))
      fetchDocuments()
    }
  } finally {
    uploading.value = false
  }
}

async function handleDownload(doc: AdminCaseDocumentItem) {
  if (!doc.file) return
  try {
    await downloadFile(doc.file.id, doc.file.fileName)
  } catch {
    ElMessage.error(t('request.downloadFailed'))
  }
}

function handlePreview(doc: AdminCaseDocumentItem) {
  previewDoc.value = doc
  previewVisible.value = true
}

function handleEdit(doc: AdminCaseDocumentItem) {
  editingDoc.value = doc
  editForm.value = {
    documentType: doc.documentType ?? '',
    remark: doc.remark ?? '',
  }
  editVisible.value = true
}

async function handleEditSubmit() {
  if (!editingDoc.value) return
  editLoading.value = true
  try {
    await updateAdminCaseDocument(props.caseId, editingDoc.value.id, {
      documentType: editForm.value.documentType || undefined,
      remark: editForm.value.remark || undefined,
    })
    ElMessage.success(t('detailViews.adminCase.filesTab.updatedSuccess'))
    editVisible.value = false
    fetchDocuments()
  } finally {
    editLoading.value = false
  }
}

async function handleDelete(doc: AdminCaseDocumentItem) {
  const name = doc.file?.fileName ?? doc.id
  try {
    await ElMessageBox.confirm(
      t('detailViews.adminCase.filesTab.deleteMessage', { name }),
      t('confirm.deleteTitle'),
      { confirmButtonText: t('common.delete'), cancelButtonText: t('common.cancel'), type: 'warning' },
    )
    await deleteAdminCaseDocument(props.caseId, doc.id)
    ElMessage.success(t('detailViews.adminCase.filesTab.deletedSuccess'))
    fetchDocuments()
  } catch {
    // cancelled
  }
}

function formatSize(bytes: number | null): string {
  if (bytes == null) return '-'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function isPreviewable(doc: AdminCaseDocumentItem): boolean {
  const exts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf']
  return !!doc.file?.fileExt && exts.includes(doc.file.fileExt)
}

function getPreviewUrl(doc: AdminCaseDocumentItem): string {
  return doc.file ? getFilePreviewUrl(doc.file.id) : ''
}

const isImage = (doc: AdminCaseDocumentItem) =>
  !!doc.file?.fileExt && ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(doc.file.fileExt)

const isPdf = (doc: AdminCaseDocumentItem) => doc.file?.fileExt === '.pdf'
</script>

<template>
  <div class="admin-case-files-tab">
    <div class="panel-toolbar">
      <span class="panel-toolbar__count">
        {{ t('detailViews.adminCase.filesTab.countLabel', { count: documents.length }) }}
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
      :data="documents"
      stripe
      size="small"
      :empty-text="t('detailViews.adminCase.filesTab.empty')"
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
            {{ row.file?.fileName ?? '-' }}
          </el-link>
          <span v-else>{{ row.file?.fileName ?? '-' }}</span>
        </template>
      </el-table-column>
      <el-table-column :label="t('detailViews.adminCase.filesTab.documentType')" width="120" show-overflow-tooltip>
        <template #default="{ row }">
          {{ row.documentType ?? '-' }}
        </template>
      </el-table-column>
      <el-table-column :label="t('pages.files.size')" width="100" align="right">
        <template #default="{ row }">
          {{ formatSize(row.file?.fileSize ?? null) }}
        </template>
      </el-table-column>
      <el-table-column :label="t('pages.files.uploader')" width="120" show-overflow-tooltip>
        <template #default="{ row }">
          {{ row.file?.uploaderName ?? '-' }}
        </template>
      </el-table-column>
      <el-table-column :label="t('detailViews.adminCase.filesTab.registeredAt')" width="160">
        <template #default="{ row }">
          {{ formatDateTime(row.createdAt) }}
        </template>
      </el-table-column>
      <el-table-column :label="t('detailViews.adminCase.filesTab.remark')" min-width="120" show-overflow-tooltip>
        <template #default="{ row }">
          {{ row.remark ?? '-' }}
        </template>
      </el-table-column>
      <el-table-column :label="t('common.actions')" width="200" fixed="right">
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
          <el-button type="primary" link size="small" @click="handleEdit(row)">
            {{ t('common.edit') }}
          </el-button>
          <el-button type="danger" link size="small" @click="handleDelete(row)">
            {{ t('common.delete') }}
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- Preview Dialog -->
    <el-dialog
      v-model="previewVisible"
      :title="previewDoc?.file?.fileName || t('dialogs.filePreview.defaultTitle')"
      width="80%"
      :close-on-click-modal="true"
      destroy-on-close
    >
      <div v-if="previewDoc" class="preview-container">
        <img
          v-if="isImage(previewDoc)"
          :src="getPreviewUrl(previewDoc)"
          :alt="previewDoc.file?.fileName"
          class="preview-image"
        />
        <iframe
          v-else-if="isPdf(previewDoc)"
          :src="getPreviewUrl(previewDoc)"
          class="preview-pdf"
          frameborder="0"
        />
      </div>
    </el-dialog>

    <!-- Edit Dialog -->
    <el-dialog
      v-model="editVisible"
      :title="t('detailViews.adminCase.filesTab.editTitle')"
      width="480px"
      :close-on-click-modal="false"
      destroy-on-close
    >
      <el-form label-width="100px">
        <el-form-item :label="t('detailViews.adminCase.filesTab.documentType')">
          <el-input
            v-model="editForm.documentType"
            maxlength="50"
            :placeholder="t('detailViews.adminCase.filesTab.documentTypePlaceholder')"
          />
        </el-form-item>
        <el-form-item :label="t('detailViews.adminCase.filesTab.remark')">
          <el-input
            v-model="editForm.remark"
            type="textarea"
            :rows="3"
            maxlength="500"
            show-word-limit
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editVisible = false">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" :loading="editLoading" @click="handleEditSubmit">
          {{ t('common.save') }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.panel-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;

  &__count {
    font-size: 13px;
    color: #909399;
  }
}

.preview-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  max-height: 75vh;
  overflow: auto;
  background: #f5f7fa;
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
