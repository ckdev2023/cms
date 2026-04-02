<script setup lang="ts">
import type { FormInstance, FormRules } from 'element-plus'
import { ElMessage } from 'element-plus'
import { computed,reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { createTaxPeriod, updateTaxPeriod } from '@/api/tax'
import type { TaxPeriodItem } from '@/types/tax'

const props = defineProps<{
  modelValue: boolean
  contractId: string
  editData: TaxPeriodItem | null
}>()
const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'saved'): void
}>()
defineOptions({ name: 'PeriodFormDialog' })
const { t } = useI18n()

const formRef = ref<FormInstance>()
const submitting = ref(false)

const formModel = reactive({
  periodYm: '',
  declarationDeadline: '',
})

const isEdit = computed(() => !!props.editData)

const formRules: FormRules = {
  periodYm: [
    { required: true, message: t('common.selectField', { field: t('dialogs.periodForm.period') }), trigger: 'change' },
  ],
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      if (props.editData) {
        formModel.periodYm = props.editData.periodYm
        formModel.declarationDeadline =
          props.editData.declarationDeadline?.slice(0, 10) ?? ''
      } else {
        formModel.periodYm = ''
        formModel.declarationDeadline = ''
      }
    }
  },
)

/**
 * 关闭期间表单对话框并重置校验状态。
 */
function handleClose() {
  emit('update:modelValue', false)
  formRef.value?.resetFields()
}

/**
 * 提交期间表单，并在成功后通知父层刷新期间列表。
 *
 * @returns 校验失败时提前结束；保存成功后关闭对话框
 */
async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  submitting.value = true
  try {
    const payload = {
      periodYm: formModel.periodYm,
      declarationDeadline: formModel.declarationDeadline || undefined,
    }

    if (isEdit.value && props.editData) {
      await updateTaxPeriod(props.contractId, props.editData.id, payload)
      ElMessage.success(t('dialogs.periodForm.updated'))
    } else {
      await createTaxPeriod(props.contractId, payload)
      ElMessage.success(t('dialogs.periodForm.created'))
    }
    emit('saved')
    handleClose()
  } catch {
    // handled by interceptor
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    :title="isEdit ? t('dialogs.periodForm.editTitle') : t('dialogs.periodForm.createTitle')"
    width="480px"
    :close-on-click-modal="false"
    @update:model-value="emit('update:modelValue', $event)"
    @closed="handleClose"
  >
    <el-form
      ref="formRef"
      :model="formModel"
      :rules="formRules"
      label-width="120px"
      label-position="top"
    >
      <el-form-item :label="t('dialogs.periodForm.period')" prop="periodYm">
        <el-date-picker
          v-model="formModel.periodYm"
          type="month"
          :placeholder="t('common.selectField', { field: t('dialogs.periodForm.period') })"
          value-format="YYYY-MM"
          style="width: 100%"
        />
      </el-form-item>
      <el-form-item :label="t('dialogs.periodForm.declarationDeadline')" prop="declarationDeadline">
        <el-date-picker
          v-model="formModel.declarationDeadline"
          type="date"
          :placeholder="t('common.selectField', { field: t('dialogs.periodForm.declarationDeadline') })"
          value-format="YYYY-MM-DD"
          style="width: 100%"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="handleClose">{{ t('common.cancel') }}</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSubmit">
        {{ isEdit ? t('common.update') : t('common.create') }}
      </el-button>
    </template>
  </el-dialog>
</template>
