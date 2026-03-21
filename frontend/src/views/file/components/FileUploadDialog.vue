<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { UploadFilled } from '@element-plus/icons-vue'
import { uploadFile } from '@/api/file'
import { BusinessType } from '@/constants/enums'
import { BusinessTypeLabel } from '@/constants/enum-labels'
import type { UploadFileParams } from '@/types/file'

defineOptions({ name: 'FileUploadDialog' })
const { t } = useI18n()

const visible = defineModel<boolean>({ default: false })
const emit = defineEmits<{ saved: [] }>()

const MAX_SIZE_MB = 50
const ALLOWED_ACCEPT = '.jpg,.jpeg,.png,.gif,.webp,.pdf,.xlsx,.xls,.docx,.doc,.txt,.csv'

const uploading = ref(false)
const selectedFiles = ref<File[]>([])
const businessType = ref<BusinessType>(BusinessType.INTERNAL)
const description = ref('')

const fileInputRef = ref<HTMLInputElement | null>(null)

watch(visible, (val) => {
  if (!val) {
    selectedFiles.value = []
    businessType.value = BusinessType.INTERNAL
    description.value = ''
  }
})

function handleDragOver(e: DragEvent) {
  e.preventDefault()
}

function handleDrop(e: DragEvent) {
  e.preventDefault()
  if (e.dataTransfer?.files) {
    addFiles(Array.from(e.dataTransfer.files))
  }
}

function handleClickSelect() {
  fileInputRef.value?.click()
}

function handleFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files) {
    addFiles(Array.from(input.files))
    input.value = ''
  }
}

function addFiles(files: File[]) {
  for (const file of files) {
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      ElMessage.warning(t('dialogs.fileUpload.fileTooLarge', { name: file.name, maxSize: MAX_SIZE_MB }))
      continue
    }
    const ext = '.' + file.name.split('.').pop()?.toLowerCase()
    if (!ALLOWED_ACCEPT.split(',').includes(ext)) {
      ElMessage.warning(t('dialogs.fileUpload.invalidFileType', { name: file.name }))
      continue
    }
    selectedFiles.value.push(file)
  }
}

function removeFile(index: number) {
  selectedFiles.value.splice(index, 1)
}

const canSubmit = computed(
  () => selectedFiles.value.length > 0 && !uploading.value,
)

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

async function handleSubmit() {
  if (!canSubmit.value) return
  uploading.value = true

  let successCount = 0
  try {
    for (const file of selectedFiles.value) {
      const params: UploadFileParams = {
        file,
        businessType: businessType.value,
        description: description.value || undefined,
      }
      await uploadFile(params)
      successCount++
    }
    ElMessage.success(t('dialogs.fileUpload.success', { count: successCount }))
    visible.value = false
    emit('saved')
  } catch {
    if (successCount > 0) {
      ElMessage.warning(
        t('dialogs.fileUpload.partialSuccess', {
          success: successCount,
          total: selectedFiles.value.length,
        }),
      )
    }
  } finally {
    uploading.value = false
  }
}
</script>

<template>
  <el-dialog
    v-model="visible"
    :title="t('dialogs.fileUpload.title')"
    width="560px"
    :close-on-click-modal="false"
    destroy-on-close
  >
    <el-form label-width="100px">
      <el-form-item :label="t('pages.files.category')" required>
        <el-select v-model="businessType" style="width: 100%">
          <el-option
            v-for="(label, key) in BusinessTypeLabel"
            :key="key"
            :label="label"
            :value="key"
          />
        </el-select>
      </el-form-item>
      <el-form-item :label="t('common.description')">
        <el-input
          v-model="description"
          type="textarea"
          :rows="2"
          :placeholder="t('dialogs.fileUpload.optionalDescription')"
          maxlength="500"
          show-word-limit
        />
      </el-form-item>
      <el-form-item :label="t('pages.files.fileName')" required>
        <div
          class="upload-zone"
          @dragover="handleDragOver"
          @drop="handleDrop"
          @click="handleClickSelect"
        >
          <el-icon :size="40" color="#c0c4cc"><UploadFilled /></el-icon>
          <p class="upload-zone__text">
            {{ t('dialogs.fileUpload.selectHint') }}
          </p>
          <p class="upload-zone__hint">
            {{ t('dialogs.fileUpload.formatsHint', { maxSize: MAX_SIZE_MB }) }}
          </p>
        </div>
        <input
          ref="fileInputRef"
          type="file"
          :accept="ALLOWED_ACCEPT"
          multiple
          style="display: none"
          @change="handleFileChange"
        />
      </el-form-item>
    </el-form>

    <div v-if="selectedFiles.length > 0" class="file-list">
      <div
        v-for="(file, index) in selectedFiles"
        :key="index"
        class="file-list__item"
      >
        <span class="file-list__name" :title="file.name">{{ file.name }}</span>
        <span class="file-list__size">{{ formatSize(file.size) }}</span>
        <el-button
          type="danger"
          link
          size="small"
          :disabled="uploading"
          @click="removeFile(index)"
        >
          {{ t('dialogs.fileUpload.delete') }}
        </el-button>
      </div>
    </div>

    <template #footer>
      <el-button :disabled="uploading" @click="visible = false">
        {{ t('common.cancel') }}
      </el-button>
      <el-button
        type="primary"
        :loading="uploading"
        :disabled="!canSubmit"
        @click="handleSubmit"
      >
        {{ t('common.upload') }}
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">
.upload-zone {
  width: 100%;
  min-height: 120px;
  border: 2px dashed #dcdfe6;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: border-color 0.2s;
  padding: 16px;

  &:hover {
    border-color: #409eff;
  }

  &__text {
    margin: 8px 0 4px;
    font-size: 14px;
    color: #606266;
  }

  &__hint {
    margin: 0;
    font-size: 12px;
    color: #909399;
  }
}

.file-list {
  margin-top: 12px;
  max-height: 200px;
  overflow-y: auto;

  &__item {
    display: flex;
    align-items: center;
    padding: 6px 8px;
    border-radius: 4px;
    gap: 8px;

    &:hover {
      background: #f5f7fa;
    }
  }

  &__name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 13px;
    color: #303133;
  }

  &__size {
    flex-shrink: 0;
    font-size: 12px;
    color: #909399;
  }
}
</style>
