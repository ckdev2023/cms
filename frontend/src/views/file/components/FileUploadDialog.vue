<script setup lang="ts">
import { UploadFilled } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { computed, ref, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { uploadFile } from '@/api/file'
import { BusinessTypeLabel } from '@/constants/enum-labels'
import { BusinessType } from '@/constants/enums'
import type { UploadFileParams } from '@/types/file'

const emit = defineEmits<{ saved: [] }>()
defineOptions({ name: 'FileUploadDialog' })
const { t } = useI18n()

const visible = defineModel<boolean>({ default: false })
const MAX_SIZE_MB = 50
const ALLOWED_ACCEPT = '.jpg,.jpeg,.png,.gif,.webp,.pdf,.xlsx,.xls,.docx,.doc,.txt,.csv'
const allowedExtensions = new Set(ALLOWED_ACCEPT.split(','))

const uploading = ref(false)
const selectedFiles = ref<File[]>([])
const businessType = ref<BusinessType>(BusinessType.INTERNAL)
const description = ref('')

const fileInputRef = useTemplateRef<HTMLInputElement>('fileInputRef')

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

/**
 * 接收用户拖拽到上传区域的文件并加入待上传列表。
 *
 * @param e - 浏览器拖拽事件对象
 */
function handleDrop(e: DragEvent) {
  e.preventDefault()
  if (e.dataTransfer?.files) {
    addFiles(Array.from(e.dataTransfer.files))
  }
}

function handleClickSelect() {
  fileInputRef.value?.click()
}

/**
 * 处理原生文件选择器返回的文件列表。
 *
 * @param e - 文件输入框的 change 事件
 */
function handleFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files) {
    addFiles(Array.from(input.files))
    input.value = ''
  }
}

/**
 * 校验并收集用户本次待上传的文件。
 *
 * 超出大小限制或扩展名不在白名单内的文件会即时提示，并跳过加入待上传列表。
 *
 * @param files - 用户通过拖拽或文件选择器提供的原始文件列表
 */
function addFiles(files: File[]) {
  for (const file of files) {
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      ElMessage.warning(t('dialogs.fileUpload.fileTooLarge', { name: file.name, maxSize: MAX_SIZE_MB }))
      continue
    }
    const ext = '.' + file.name.split('.').pop()?.toLowerCase()
    if (!allowedExtensions.has(ext)) {
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

/**
 * 按当前分类和说明批量上传已选择的文件。
 *
 * 上传成功后关闭弹窗并通知父级刷新；若中途失败，则保留已成功数量用于提示部分成功结果。
 */
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
          <el-icon :size="40" class="upload-zone__icon"><UploadFilled /></el-icon>
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
  border: 2px dashed var(--app-border-color);
  border-radius: var(--app-radius-md);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: border-color var(--app-transition-base);
  padding: var(--app-spacing-base);

  &:hover {
    border-color: var(--app-color-primary);
  }

  &__icon {
    color: var(--app-text-disabled);
  }

  &__text {
    margin: var(--app-spacing-sm) 0 var(--app-spacing-xs);
    font-size: var(--app-font-size-base);
    color: var(--app-text-regular);
  }

  &__hint {
    margin: 0;
    font-size: var(--app-font-size-xs);
    color: var(--app-text-secondary);
  }
}

.file-list {
  margin-top: var(--app-spacing-md);
  max-height: 200px;
  overflow-y: auto;

  &__item {
    display: flex;
    align-items: center;
    padding: var(--app-spacing-xs) var(--app-spacing-sm);
    border-radius: var(--app-radius-sm);
    gap: var(--app-spacing-sm);

    &:hover {
      background: var(--app-bg-hover);
    }
  }

  &__name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: var(--app-font-size-sm);
    color: var(--app-text-primary);
  }

  &__size {
    flex-shrink: 0;
    font-size: var(--app-font-size-xs);
    color: var(--app-text-secondary);
  }
}
</style>
