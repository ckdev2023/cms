<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { updateFile } from '@/api/file'
import { BusinessType } from '@/constants/enums'
import { BusinessTypeLabel } from '@/constants/enum-labels'
import type { FileItem, UpdateFileParams } from '@/types/file'

defineOptions({ name: 'FileEditDialog' })
const { t } = useI18n()

const visible = defineModel<boolean>({ default: false })
const props = defineProps<{ editData: FileItem | null }>()
const emit = defineEmits<{ saved: [] }>()

const formRef = ref<FormInstance>()
const loading = ref(false)

const form = ref<UpdateFileParams>({
  fileName: '',
  description: '',
  businessType: BusinessType.INTERNAL,
})

const rules: FormRules = {
  fileName: [
    { required: true, message: t('common.enterField', { field: t('dialogs.fileEdit.fileName') }), trigger: 'blur' },
    { max: 255, message: t('validation.maxChars', { max: 255 }), trigger: 'blur' },
  ],
}

watch(
  () => props.editData,
  (data) => {
    if (data) {
      form.value = {
        fileName: data.fileName,
        description: data.description || '',
        businessType: data.businessType,
      }
      nextTick(() => formRef.value?.clearValidate())
    }
  },
  { immediate: true },
)

async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid || !props.editData) return

  loading.value = true
  try {
    await updateFile(props.editData.id, form.value)
    ElMessage.success(t('dialogs.fileEdit.success'))
    visible.value = false
    emit('saved')
  } catch {
    // handled by interceptor
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <el-dialog
    v-model="visible"
    :title="t('dialogs.fileEdit.title')"
    width="480px"
    :close-on-click-modal="false"
    destroy-on-close
  >
    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-width="100px"
    >
      <el-form-item :label="t('dialogs.fileEdit.fileName')" prop="fileName">
        <el-input v-model="form.fileName" maxlength="255" />
      </el-form-item>
      <el-form-item :label="t('common.description')">
        <el-input
          v-model="form.description"
          type="textarea"
          :rows="3"
          maxlength="500"
          show-word-limit
        />
      </el-form-item>
      <el-form-item :label="t('pages.files.category')">
        <el-select v-model="form.businessType" style="width: 100%">
          <el-option
            v-for="(label, key) in BusinessTypeLabel"
            :key="key"
            :label="label"
            :value="key"
          />
        </el-select>
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="visible = false">{{ t('common.cancel') }}</el-button>
      <el-button type="primary" :loading="loading" @click="handleSubmit">
        {{ t('common.save') }}
      </el-button>
    </template>
  </el-dialog>
</template>
