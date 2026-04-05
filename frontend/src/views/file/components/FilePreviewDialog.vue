<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { getFilePreviewUrl } from '@/api/file'
import type { FileItem } from '@/types/file'

const props = defineProps<{ file: FileItem | null }>()
defineOptions({ name: 'FilePreviewDialog' })
const { t } = useI18n()

const visible = defineModel<boolean>({ default: false })
const imageExtensions = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp'])

const previewUrl = computed(() => {
  if (!props.file) {return ''}
  return getFilePreviewUrl(props.file.id)
})

const isImage = computed(() => {
  if (!props.file?.fileExt) {return false}
  return imageExtensions.has(props.file.fileExt)
})

const isPdf = computed(() => props.file?.fileExt === '.pdf')

const isPreviewable = computed(() => isImage.value || isPdf.value)
</script>

<template>
  <el-dialog
    v-model="visible"
    :title="file?.fileName || t('dialogs.filePreview.defaultTitle')"
    width="80%"
    close-on-click-modal
    destroy-on-close
    class="preview-dialog"
  >
    <div v-if="!isPreviewable" class="preview-unsupported">
      <el-empty :description="t('common.unsupportedPreview')" />
    </div>

    <div v-else class="preview-container">
      <img
        v-if="isImage"
        :src="previewUrl"
        :alt="file?.fileName"
        class="preview-image"
      />
      <iframe
        v-else-if="isPdf"
        :src="previewUrl"
        class="preview-pdf"
        frameborder="0"
      />
    </div>
  </el-dialog>
</template>

<style scoped lang="scss">
.preview-dialog {
  :deep(.el-dialog__body) {
    padding: 0;
    min-height: 300px;
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

.preview-unsupported {
  padding: 40px;
}
</style>
