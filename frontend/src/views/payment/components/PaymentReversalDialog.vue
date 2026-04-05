<script setup lang="ts">
import type { FormInstance, FormRules } from 'element-plus'
import { ElMessage } from 'element-plus'
import { nextTick, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { reversePayment } from '@/api/payment'
import { useSubmitLock } from '@/composables/useSubmitLock'

const props = defineProps<{
  modelValue: boolean
  paymentId: string
  paymentNo: string
}>()
const emit = defineEmits<{
  'update:modelValue': [val: boolean]
  reversed: []
}>()
defineOptions({ name: 'PaymentReversalDialog' })
const { t } = useI18n()

const formRef = ref<FormInstance>()
const { submitting, withLock } = useSubmitLock()

const form = reactive({
  reversalReason: '',
})

const rules: FormRules = {
  reversalReason: [
    { required: true, message: t('common.enterField', { field: t('dialogs.paymentReversal.reason') }), trigger: 'blur' },
    { max: 500, message: t('validation.maxChars', { max: 500 }), trigger: 'blur' },
  ],
}

watch(
  () => props.modelValue,
  (visible) => {
    if (visible) {
      nextTick(() => {
        form.reversalReason = ''
        formRef.value?.clearValidate()
      })
    }
  },
)

/**
 * 校验冲正原因并提交收款冲正请求。
 */
async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) {return}

  await withLock(async () => {
    await reversePayment(props.paymentId, {
      reversalReason: form.reversalReason,
    })
    ElMessage.success(t('dialogs.paymentReversal.success'))
    emit('update:modelValue', false)
    emit('reversed')
  })
}

function handleClose() {
  emit('update:modelValue', false)
}
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    :title="t('dialogs.paymentReversal.title')"
    width="500px"
    destroy-on-close
    @close="handleClose"
  >
    <el-alert
      type="warning"
      :closable="false"
      show-icon
      style="margin-bottom: 16px"
    >
      <template #title>
        {{ t('dialogs.paymentReversal.warning', { paymentNo }) }}
      </template>
    </el-alert>

    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-width="100px"
      label-position="right"
    >
      <el-form-item :label="t('dialogs.paymentReversal.reason')" prop="reversalReason">
        <el-input
          v-model="form.reversalReason"
          type="textarea"
          :rows="3"
          :placeholder="t('dialogs.paymentReversal.reasonPlaceholder')"
          maxlength="500"
          show-word-limit
        />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="handleClose">{{ t('common.cancel') }}</el-button>
      <el-button type="danger" :loading="submitting" @click="handleSubmit">
        {{ t('dialogs.paymentReversal.submit') }}
      </el-button>
    </template>
  </el-dialog>
</template>
