<script setup lang="ts">
import type { FormInstance, FormRules } from 'element-plus'
import { ElMessage } from 'element-plus'
import { nextTick, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { depositRefund } from '@/api/deposit'
import { useSubmitLock } from '@/composables/useSubmitLock'
import type { CreateDepositRefundParams } from '@/types/deposit'
import { useLocaleFormatter } from '@/utils/locale-format'

const props = defineProps<{
  modelValue: boolean
  customerId: string
  balance: number
}>()
const emit = defineEmits<{
  'update:modelValue': [val: boolean]
  saved: []
}>()
defineOptions({ name: 'DepositRefundDialog' })
const { t } = useI18n()
const { formatCurrency } = useLocaleFormatter()

const formRef = ref<FormInstance>()
const { submitting, withLock } = useSubmitLock()

interface FormModel {
  amount: number
  reason: string
  remark: string
}

const form = reactive<FormModel>({
  amount: 0,
  reason: '',
  remark: '',
})

const rules: FormRules = {
  amount: [
    { required: true, message: t('common.enterField', { field: t('dialogs.depositRefund.amount') }), trigger: 'blur' },
    {
      type: 'number',
      min: 1,
      message: t('validation.minValue', { field: t('dialogs.depositRefund.amount'), min: 1 }),
      trigger: 'blur',
    },
  ],
  reason: [
    { required: true, message: t('dialogs.depositRefund.reasonRequired'), trigger: 'blur' },
  ],
}

watch(
  () => props.modelValue,
  (visible) => {
    if (visible) {
      nextTick(() => {
        form.amount = 0
        form.reason = ''
        form.remark = ''
        nextTick(() => formRef.value?.clearValidate())
      })
    }
  },
)

/**
 * 将退款表单值转换为预存款退款接口所需的请求体。
 *
 * @returns 包含客户、退款金额、退款原因与备注的请求参数
 */
function buildPayload(): CreateDepositRefundParams {
  return {
    customerId: props.customerId,
    amount: form.amount,
    reason: form.reason,
    remark: form.remark || undefined,
  }
}

/**
 * 校验退款表单并提交预存款退款请求。
 */
async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  if (form.amount > props.balance) {
    ElMessage.warning(t('dialogs.depositRefund.exceedBalance'))
    return
  }

  await withLock(async () => {
    await depositRefund(buildPayload())
    ElMessage.success(t('dialogs.depositRefund.success'))
    emit('update:modelValue', false)
    emit('saved')
  })
}

function handleClose() {
  emit('update:modelValue', false)
}

</script>

<template>
  <el-dialog
    :model-value="modelValue"
    :title="t('dialogs.depositRefund.title')"
    width="520px"
    destroy-on-close
    @close="handleClose"
  >
    <el-alert
      type="warning"
      :closable="false"
      show-icon
      class="balance-alert"
    >
      {{ t('dialogs.depositRefund.currentBalance') }}
      <strong>{{ formatCurrency(balance) }}</strong>
    </el-alert>

    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-width="120px"
      label-position="right"
    >
      <el-form-item :label="t('dialogs.depositRefund.amount')" prop="amount">
        <el-input-number
          v-model="form.amount"
          :min="0"
          :max="balance"
          :precision="0"
          :controls="false"
          :placeholder="t('common.enterField', { field: t('dialogs.depositRefund.amount') })"
          style="width: 100%"
        />
      </el-form-item>

      <el-form-item :label="t('dialogs.depositRefund.reason')" prop="reason">
        <el-input
          v-model="form.reason"
          type="textarea"
          :rows="2"
          :placeholder="t('dialogs.depositRefund.reasonRequired')"
          maxlength="200"
          show-word-limit
        />
      </el-form-item>

      <el-form-item :label="t('common.remark')">
        <el-input
          v-model="form.remark"
          type="textarea"
          :rows="2"
          :placeholder="t('common.enterField', { field: t('common.remark') })"
          maxlength="500"
          show-word-limit
        />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="handleClose">{{ t('common.cancel') }}</el-button>
      <el-button type="warning" :loading="submitting" @click="handleSubmit">
        {{ t('dialogs.depositRefund.submit') }}
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">
.balance-alert {
  margin-bottom: var(--app-spacing-lg);

  strong {
    font-size: var(--app-font-size-lg);
    color: var(--app-color-warning);
  }
}
</style>
