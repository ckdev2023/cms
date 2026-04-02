<script setup lang="ts">
import { UploadFilled } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  createAdminCaseDocument,
  deleteAdminCaseDocument,
  getAdminCaseDocuments,
  updateAdminCaseDocument,
} from '@/api/admin-case'
import { downloadFile, getFilePreviewUrl, uploadFile } from '@/api/file'
import { BusinessType } from '@/constants/enums'
import type { AdminCaseDocumentItem } from '@/types/admin-case'
import { useLocaleFormatter } from '@/utils/locale-format'

const props = defineProps<{
  caseId: string
  customerId?: string
}>()

defineOptions({ name: 'AdminCaseFilesTab' })

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
const ALLOWED_EXTENSIONS = ALLOWED_ACCEPT.split(',')
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp']
const PREVIEWABLE_EXTENSIONS = [...IMAGE_EXTENSIONS, '.pdf']

onMounted(() => {
  fetchDocuments()
})

/**
 * 拉取案件关联的文件列表，并同步表格加载状态。
 *
 * @returns 请求完成后更新当前案件的文件集合
 */
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

/**
 * 校验并逐个上传用户选择的文件，然后写入案件文件记录。
 *
 * 超限或后缀不合法的文件会被跳过，并给出逐项提示。
 *
 * @param e - 原生文件输入框的 change 事件对象
 * @returns 上传流程完成后恢复按钮状态，并在成功时刷新文件列表
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
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
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

/**
 * 下载指定案件文件的原始附件。
 *
 * @param doc - 当前操作的案件文件记录
 * @returns 下载请求完成后结束；失败时显示统一错误提示
 */
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

/**
 * 打开文件元信息编辑弹窗，并回填当前文档备注与类型。
 *
 * @param doc - 当前准备编辑的案件文件记录
 */
function handleEdit(doc: AdminCaseDocumentItem) {
  editingDoc.value = doc
  editForm.value = {
    documentType: doc.documentType ?? '',
    remark: doc.remark ?? '',
  }
  editVisible.value = true
}

/**
 * 提交文件备注与文档类型的更新请求。
 *
 * @returns 保存完成后关闭弹窗并刷新当前文件列表
 */
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

/**
 * 确认后删除案件文件记录，并在成功后刷新表格。
 *
 * @param doc - 当前准备删除的案件文件记录
 * @returns 删除确认被取消或请求结束后完成处理
 */
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

/**
 * 将字节数格式化为适合表格展示的容量字符串。
 *
 * @param bytes - 文件大小字节数；无值时显示占位符
 * @returns 已按 B、KB、MB 自动换算的文本结果
 */
function formatSize(bytes: number | null): string {
  if (bytes === null) return '-'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function isPreviewable(doc: AdminCaseDocumentItem): boolean {
  return !!doc.file?.fileExt && PREVIEWABLE_EXTENSIONS.includes(doc.file.fileExt)
}

function getPreviewUrl(doc: AdminCaseDocumentItem): string {
  return doc.file ? getFilePreviewUrl(doc.file.id) : ''
}

const isImage = (doc: AdminCaseDocumentItem) =>
  !!doc.file?.fileExt && IMAGE_EXTENSIONS.includes(doc.file.fileExt)

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
      close-on-click-modal
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
