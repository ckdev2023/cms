<script setup lang="ts">
import type { FormInstance, FormRules } from 'element-plus'
import { ElMessage } from 'element-plus'
import { reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { generateTaxPeriods } from '@/api/tax'

const props = defineProps<{
  modelValue: boolean
  contractId: string
}>()
const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'generated'): void
}>()
defineOptions({ name: 'PeriodGenerateDialog' })
const { t } = useI18n()

const formRef = ref<FormInstance>()
const submitting = ref(false)

const formModel = reactive({
  startYm: '',
  endYm: '',
  deadlineDay: 10,
  useDeadline: true,
})

const formRules: FormRules = {
  startYm: [
    { required: true, message: t('common.selectField', { field: t('dialogs.periodGenerate.startYm') }), trigger: 'change' },
  ],
  endYm: [
    { required: true, message: t('common.selectField', { field: t('dialogs.periodGenerate.endYm') }), trigger: 'change' },
  ],
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      const now = new Date()
      const y = now.getFullYear()
      const m = now.getMonth() + 1
      formModel.startYm = `${y}-${String(m).padStart(2, '0')}`
      const endMonth = m === 1 ? 12 : m - 1
      const endYear = m === 1 ? y : y + 1
      formModel.endYm = `${endYear}-${String(endMonth).padStart(2, '0')}`
      formModel.deadlineDay = 10
      formModel.useDeadline = true
    }
  },
)

/**
 * 关闭期间批量生成对话框并重置表单校验。
 */
function handleClose() {
  emit('update:modelValue', false)
  formRef.value?.resetFields()
}

/**
 * 提交批量生成期间请求，并在成功后通知父层刷新列表。
 *
 * @returns 校验失败或区间非法时提前结束；成功后关闭对话框
 */
async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  if (formModel.startYm > formModel.endYm) {
    ElMessage.warning(t('dialogs.periodGenerate.invalidRange'))
    return
  }

  submitting.value = true
  try {
    const res = await generateTaxPeriods(props.contractId, {
      startYm: formModel.startYm,
      endYm: formModel.endYm,
      deadlineDay: formModel.useDeadline ? formModel.deadlineDay : undefined,
    })
    const count = Array.isArray(res.data) ? res.data.length : 0
    if (count > 0) {
      ElMessage.success(t('dialogs.periodGenerate.generated', { count }))
    } else {
      ElMessage.info(t('dialogs.periodGenerate.noneGenerated'))
    }
    emit('generated')
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
    :title="t('dialogs.periodGenerate.title')"
    width="500px"
    :close-on-click-modal="false"
    @update:model-value="emit('update:modelValue', $event)"
    @closed="handleClose"
  >
    <el-alert
      type="info"
      :closable="false"
      show-icon
      style="margin-bottom: 16px"
    >
      {{ t('dialogs.periodGenerate.intro') }}
    </el-alert>

    <el-form
      ref="formRef"
      :model="formModel"
      :rules="formRules"
      label-width="120px"
      label-position="top"
    >
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item :label="t('dialogs.periodGenerate.startYm')" prop="startYm">
            <el-date-picker
              v-model="formModel.startYm"
              type="month"
              :placeholder="t('dialogs.periodGenerate.startYm')"
              value-format="YYYY-MM"
              style="width: 100%"
            />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item :label="t('dialogs.periodGenerate.endYm')" prop="endYm">
            <el-date-picker
              v-model="formModel.endYm"
              type="month"
              :placeholder="t('dialogs.periodGenerate.endYm')"
              value-format="YYYY-MM"
              style="width: 100%"
            />
          </el-form-item>
        </el-col>
      </el-row>

      <el-form-item :label="t('dialogs.periodGenerate.autoDeadline')">
        <el-switch v-model="formModel.useDeadline" />
        <span v-if="formModel.useDeadline" style="margin-left: 12px">
          {{ t('dialogs.periodGenerate.nextMonth') }}
          <el-input-number
            v-model="formModel.deadlineDay"
            :min="1"
            :max="31"
            size="small"
            style="width: 80px; margin: 0 4px"
          />
          {{ t('dialogs.periodGenerate.day') }}
        </span>
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="handleClose">{{ t('common.cancel') }}</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSubmit">
        {{ t('dialogs.periodGenerate.generate') }}
      </el-button>
    </template>
  </el-dialog>
</template>
