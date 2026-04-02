<script setup lang="ts">
import type { FormInstance, FormRules } from 'element-plus'
import { ElMessage } from 'element-plus'
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { depositOffset } from '@/api/deposit'
import { getInvoices } from '@/api/invoice'
import { useSubmitLock } from '@/composables/useSubmitLock'
import { InvoiceStatusLabel } from '@/constants/enum-labels'
import { InvoiceStatus } from '@/constants/enums'
import type { CreateDepositOffsetParams } from '@/types/deposit'
import type { InvoiceListItem } from '@/types/invoice'
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
defineOptions({ name: 'DepositOffsetDialog' })
const { t } = useI18n()
const { formatCurrency } = useLocaleFormatter()

const formRef = ref<FormInstance>()
const { submitting, withLock } = useSubmitLock()
const invoiceOptions = ref<InvoiceListItem[]>([])
const invoiceLoading = ref(false)

interface FormModel {
  invoiceId: string
  amount: number
  remark: string
}

const form = reactive<FormModel>({
  invoiceId: '',
  amount: 0,
  remark: '',
})

const selectedInvoice = computed(() =>
  invoiceOptions.value.find((inv) => inv.id === form.invoiceId),
)

const maxAmount = computed(() => {
  const invTotal = selectedInvoice.value
    ? Number(selectedInvoice.value.totalAmount)
    : 0
  return Math.min(props.balance, invTotal)
})

const rules: FormRules = {
  invoiceId: [
    { required: true, message: t('common.selectField', { field: t('dialogs.depositOffset.invoice') }), trigger: 'change' },
  ],
  amount: [
    { required: true, message: t('common.enterField', { field: t('dialogs.depositOffset.amount') }), trigger: 'blur' },
    {
      type: 'number',
      min: 1,
      message: t('validation.minValue', { field: t('dialogs.depositOffset.amount'), min: 1 }),
      trigger: 'blur',
    },
  ],
}

watch(
  () => props.modelValue,
  (visible) => {
    if (visible) {
      nextTick(() => {
        resetForm()
        fetchInvoices()
      })
    }
  },
)

/**
 * 在弹窗打开时重置核销表单，并清理上次校验状态。
 */
function resetForm() {
  form.invoiceId = ''
  form.amount = 0
  form.remark = ''
  nextTick(() => formRef.value?.clearValidate())
}

/**
 * 查询当前客户可用于预存款核销的发票列表。
 */
async function fetchInvoices() {
  invoiceLoading.value = true
  try {
    const res = await getInvoices({
      customerId: props.customerId,
      pageSize: 100,
      sortBy: 'createdAt',
      sortOrder: 'DESC',
    })
    invoiceOptions.value = res.data.items.filter(
      (inv) =>
        inv.status === InvoiceStatus.SENT ||
        inv.status === InvoiceStatus.PARTIAL,
    )
  } finally {
    invoiceLoading.value = false
  }
}

/**
 * 选中发票后按余额与发票金额自动回填建议核销金额。
 */
function onInvoiceSelect() {
  if (selectedInvoice.value) {
    form.amount = Math.min(
      props.balance,
      Number(selectedInvoice.value.totalAmount),
    )
  }
}

/**
 * 将弹窗表单值转换为预存款核销接口所需的请求体。
 *
 * @returns 包含客户、发票、金额与备注信息的核销参数
 */
function buildPayload(): CreateDepositOffsetParams {
  return {
    customerId: props.customerId,
    invoiceId: form.invoiceId,
    amount: form.amount,
    remark: form.remark || undefined,
  }
}

/**
 * 校验核销表单并提交预存款核销请求。
 */
async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  if (form.amount > props.balance) {
    ElMessage.warning(t('dialogs.depositOffset.exceedBalance'))
    return
  }

  await withLock(async () => {
    await depositOffset(buildPayload())
    ElMessage.success(t('dialogs.depositOffset.success'))
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
    :title="t('dialogs.depositOffset.title')"
    width="580px"
    destroy-on-close
    @close="handleClose"
  >
    <el-alert
      type="info"
      :closable="false"
      show-icon
      class="balance-alert"
    >
      {{ t('dialogs.depositOffset.currentBalance') }}
      <strong>{{ formatCurrency(balance) }}</strong>
    </el-alert>

    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-width="120px"
      label-position="right"
    >
      <el-form-item :label="t('dialogs.depositOffset.invoice')" prop="invoiceId">
        <el-select
          v-model="form.invoiceId"
          :placeholder="t('dialogs.depositOffset.invoicePlaceholder')"
          :loading="invoiceLoading"
          style="width: 100%"
          @change="onInvoiceSelect"
        >
          <el-option
            v-for="inv in invoiceOptions"
            :key="inv.id"
            :label="`${inv.invoiceNo}（${formatCurrency(inv.totalAmount)} - ${InvoiceStatusLabel[inv.status as InvoiceStatus] ?? inv.status}）`"
            :value="inv.id"
          />
        </el-select>
      </el-form-item>

      <el-form-item v-if="selectedInvoice" :label="t('dialogs.depositOffset.invoiceAmount')">
        <span class="static-value">
          {{ formatCurrency(selectedInvoice.totalAmount) }}
        </span>
      </el-form-item>

      <el-form-item :label="t('dialogs.depositOffset.amount')" prop="amount">
        <el-input-number
          v-model="form.amount"
          :min="0"
          :max="maxAmount || undefined"
          :precision="0"
          :controls="false"
          :placeholder="t('common.enterField', { field: t('dialogs.depositOffset.amount') })"
          style="width: 100%"
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
      <el-button type="primary" :loading="submitting" @click="handleSubmit">
        {{ t('dialogs.depositOffset.submit') }}
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">
.balance-alert {
  margin-bottom: var(--app-spacing-lg);

  strong {
    font-size: var(--app-font-size-lg);
    color: var(--app-color-primary);
  }
}

.static-value {
  font-weight: var(--app-font-weight-semibold);
  color: var(--app-text-primary);
}
</style>
