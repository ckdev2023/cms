<script setup lang="ts">
import type { FormInstance, FormRules } from 'element-plus'
import { ElMessage } from 'element-plus'
import { nextTick, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { getCustomers } from '@/api/customer'
import { depositRecharge } from '@/api/deposit'
import { useSubmitLock } from '@/composables/useSubmitLock'
import { PaymentMethodLabel } from '@/constants/enum-labels'
import { PaymentMethod } from '@/constants/enums'
import type { CustomerItem } from '@/types/customer'
import type { CreateDepositRechargeParams } from '@/types/deposit'

const props = defineProps<{
  modelValue: boolean
  defaultCustomerId?: string
}>()
const emit = defineEmits<{
  'update:modelValue': [val: boolean]
  saved: []
}>()
defineOptions({ name: 'DepositRechargeDialog' })
const { t } = useI18n()

const formRef = ref<FormInstance>()
const { submitting, withLock } = useSubmitLock()
const customerOptions = ref<CustomerItem[]>([])
const customerLoading = ref(false)

interface FormModel {
  customerId: string
  amount: number
  paymentMethod: PaymentMethod
  remark: string
}

const form = reactive<FormModel>({
  customerId: '',
  amount: 0,
  paymentMethod: PaymentMethod.BANK,
  remark: '',
})

const rules: FormRules = {
  customerId: [
    { required: true, message: t('common.selectField', { field: t('common.customer') }), trigger: 'change' },
  ],
  amount: [
    {
      required: true,
      message: t('common.enterField', { field: t('dialogs.depositRecharge.amount') }),
      trigger: 'blur',
    },
    {
      type: 'number',
      min: 1,
      message: t('validation.minValue', { field: t('dialogs.depositRecharge.amount'), min: 1 }),
      trigger: 'blur',
    },
  ],
}

const methodOptions = Object.entries(PaymentMethodLabel).map(
  ([value, label]) => ({ value, label }),
)

watch(
  () => props.modelValue,
  (visible) => {
    if (visible) {
      nextTick(() => {
        resetForm()
        if (!props.defaultCustomerId && customerOptions.value.length === 0) {
          fetchCustomers('')
        }
      })
    }
  },
)

/**
 * 按默认客户与初始支付方式重置充值表单状态。
 */
function resetForm() {
  form.customerId = props.defaultCustomerId ?? ''
  form.amount = 0
  form.paymentMethod = PaymentMethod.BANK
  form.remark = ''
  nextTick(() => formRef.value?.clearValidate())
}

/**
 * 按远程搜索关键字加载可充值的客户选项列表。
 *
 * @param query - 客户编号或名称关键字，空字符串时加载默认候选集
 */
async function fetchCustomers(query: string) {
  customerLoading.value = true
  try {
    const res = await getCustomers({ keyword: query, pageSize: 50 })
    customerOptions.value = res.data.items
  } finally {
    customerLoading.value = false
  }
}

/**
 * 将充值表单值转换为预存款充值接口所需的请求体。
 *
 * @returns 包含客户、充值金额、收款方式与备注的请求参数
 */
function buildPayload(): CreateDepositRechargeParams {
  return {
    customerId: form.customerId,
    amount: form.amount,
    paymentMethod: form.paymentMethod,
    remark: form.remark || undefined,
  }
}

/**
 * 校验充值表单并提交预存款充值请求。
 */
async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) {return}

  await withLock(async () => {
    await depositRecharge(buildPayload())
    ElMessage.success(t('dialogs.depositRecharge.success'))
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
    :title="t('dialogs.depositRecharge.title')"
    width="520px"
    destroy-on-close
    @close="handleClose"
  >
    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-width="120px"
      label-position="right"
    >
      <el-form-item :label="t('common.customer')" prop="customerId">
        <el-select
          v-model="form.customerId"
          filterable
          remote
          :remote-method="fetchCustomers"
          :loading="customerLoading"
          :placeholder="t('common.selectField', { field: t('common.customer') })"
          style="width: 100%"
          :disabled="!!defaultCustomerId"
        >
          <el-option
            v-for="c in customerOptions"
            :key="c.id"
            :label="`${c.customerCode} - ${c.customerName}`"
            :value="c.id"
          />
        </el-select>
      </el-form-item>

      <el-form-item :label="t('dialogs.depositRecharge.amount')" prop="amount">
        <el-input-number
          v-model="form.amount"
          :min="0"
          :precision="0"
          :controls="false"
          :placeholder="t('common.enterField', { field: t('dialogs.depositRecharge.amount') })"
          style="width: 100%"
        />
      </el-form-item>

      <el-form-item :label="t('detailViews.payment.paymentMethod')">
        <el-select v-model="form.paymentMethod" style="width: 100%">
          <el-option
            v-for="opt in methodOptions"
            :key="opt.value"
            :label="opt.label"
            :value="opt.value"
          />
        </el-select>
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
        {{ t('dialogs.depositRecharge.submit') }}
      </el-button>
    </template>
  </el-dialog>
</template>
