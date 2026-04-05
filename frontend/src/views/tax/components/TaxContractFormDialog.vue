<script setup lang="ts">
import type { FormInstance, FormRules } from 'element-plus'
import { ElMessage } from 'element-plus'
import { computed, nextTick,reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { getCustomers } from '@/api/customer'
import { createTaxContract, updateTaxContract } from '@/api/tax'
import { BillingCycleLabel } from '@/constants/enum-labels'
import { BillingCycle } from '@/constants/enums'
import type { CustomerItem } from '@/types/customer'
import type { CreateTaxContractParams,TaxContractItem } from '@/types/tax'

const props = defineProps<{
  modelValue: boolean
  editData: TaxContractItem | null
  defaultCustomerId?: string
}>()
const emit = defineEmits<{
  'update:modelValue': [val: boolean]
  saved: []
}>()
defineOptions({ name: 'TaxContractFormDialog' })
const { t } = useI18n()

const formRef = ref<FormInstance>()
const submitting = ref(false)
const customerOptions = ref<CustomerItem[]>([])
const customerLoading = ref(false)

const isEdit = computed(() => !!props.editData)
const dialogTitle = computed(() =>
  isEdit.value ? t('dialogs.taxContractForm.editTitle') : t('dialogs.taxContractForm.createTitle'),
)

interface FormModel {
  customerId: string
  contractName: string
  billingCycle: BillingCycle
  startDate: string
  endDate: string
  monthlyFee: number | undefined
  ownerUserId: string
}

const form = reactive<FormModel>({
  customerId: '',
  contractName: '',
  billingCycle: BillingCycle.MONTHLY,
  startDate: '',
  endDate: '',
  monthlyFee: undefined,
  ownerUserId: '',
})

const rules: FormRules = {
  customerId: [
    {
      required: true,
      message: t('common.selectField', { field: t('common.customer') }),
      trigger: 'change',
    },
  ],
  contractName: [
    {
      required: true,
      message: t('common.enterField', { field: t('dialogs.taxContractForm.contractName') }),
      trigger: 'blur',
    },
    {
      max: 200,
      message: t('validation.maxChars', { max: 200 }),
      trigger: 'blur',
    },
  ],
  startDate: [
    {
      required: true,
      message: t('common.selectField', { field: t('common.startDate') }),
      trigger: 'change',
    },
  ],
}

const billingCycleOptions = Object.entries(BillingCycleLabel).map(
  ([value, label]) => ({ value, label }),
)

watch(
  () => props.modelValue,
  (visible) => {
    if (visible) {
      nextTick(() => {
        if (props.editData) {
          populateForm(props.editData)
        } else {
          resetForm()
        }
        if (customerOptions.value.length === 0) {
          fetchCustomers('')
        }
      })
    }
  },
)

/**
 * 将编辑态的税务合约数据回填到表单模型。
 *
 * @param data 当前待编辑的税务合约数据
 */
function populateForm(data: TaxContractItem) {
  form.customerId = data.customerId
  form.contractName = data.contractName
  form.billingCycle = data.billingCycle
  form.startDate = data.startDate ?? ''
  form.endDate = data.endDate ?? ''
  form.monthlyFee = data.monthlyFee ?? undefined
  form.ownerUserId = data.ownerUserId ?? ''
}

/**
 * 重置表单为新建态默认值，并清空校验状态。
 */
function resetForm() {
  form.customerId = props.defaultCustomerId ?? ''
  form.contractName = ''
  form.billingCycle = BillingCycle.MONTHLY
  form.startDate = ''
  form.endDate = ''
  form.monthlyFee = undefined
  form.ownerUserId = ''
  nextTick(() => formRef.value?.clearValidate())
}

/**
 * 按关键字加载客户下拉选项，供税务合约选择客户。
 *
 * @param query 客户搜索关键字
 * @returns 完成请求后更新客户选项列表
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
 * 从表单模型中构造提交给后端的税务合约载荷。
 *
 * @returns 过滤空值后的创建/更新请求体
 */
function buildPayload(): CreateTaxContractParams {
  const payload: CreateTaxContractParams = {
    customerId: form.customerId,
    contractName: form.contractName,
    billingCycle: form.billingCycle,
    startDate: form.startDate,
  }

  if (form.endDate) {payload.endDate = form.endDate}
  if (form.monthlyFee !== undefined) {payload.monthlyFee = form.monthlyFee}
  if (form.ownerUserId) {payload.ownerUserId = form.ownerUserId}

  return payload
}

/**
 * 提交税务合约表单，并在成功后关闭弹窗通知父层刷新。
 *
 * @returns 校验失败时提前结束；成功后关闭对话框并触发保存事件
 */
async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) {return}

  submitting.value = true
  try {
    const payload = buildPayload()
    if (isEdit.value && props.editData) {
      await updateTaxContract(props.editData.id, payload)
      ElMessage.success(t('dialogs.taxContractForm.updated'))
    } else {
      await createTaxContract(payload)
      ElMessage.success(t('dialogs.taxContractForm.created'))
    }
    emit('update:modelValue', false)
    emit('saved')
  } catch {
    // request interceptor already shows error
  } finally {
    submitting.value = false
  }
}

function handleClose() {
  emit('update:modelValue', false)
}
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    :title="dialogTitle"
    width="680px"
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

      <el-form-item :label="t('dialogs.taxContractForm.contractName')" prop="contractName">
        <el-input
          v-model="form.contractName"
          :placeholder="t('common.enterField', { field: t('dialogs.taxContractForm.contractName') })"
          maxlength="200"
        />
      </el-form-item>

      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item :label="t('dialogs.taxContractForm.billingCycle')" prop="billingCycle">
            <el-select
              v-model="form.billingCycle"
              style="width: 100%"
            >
              <el-option
                v-for="opt in billingCycleOptions"
                :key="opt.value"
                :label="opt.label"
                :value="opt.value"
              />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item :label="t('dialogs.taxContractForm.monthlyFee')" prop="monthlyFee">
            <el-input-number
              v-model="form.monthlyFee"
              :min="0"
              :precision="0"
              :step="1000"
              :placeholder="t('dialogs.taxContractForm.monthlyFee')"
              style="width: 100%"
              controls-position="right"
            />
          </el-form-item>
        </el-col>
      </el-row>

      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item :label="t('common.startDate')" prop="startDate">
            <el-date-picker
              v-model="form.startDate"
              type="date"
              :placeholder="t('common.selectField', { field: t('common.startDate') })"
              value-format="YYYY-MM-DD"
              style="width: 100%"
            />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item :label="t('common.endDate')" prop="endDate">
            <el-date-picker
              v-model="form.endDate"
              type="date"
              :placeholder="t('common.selectField', { field: t('common.endDate') })"
              value-format="YYYY-MM-DD"
              style="width: 100%"
            />
          </el-form-item>
        </el-col>
      </el-row>
    </el-form>

    <template #footer>
      <el-button @click="handleClose">{{ t('common.cancel') }}</el-button>
      <el-button
        type="primary"
        :loading="submitting"
        @click="handleSubmit"
      >
        {{ isEdit ? t('common.update') : t('common.create') }}
      </el-button>
    </template>
  </el-dialog>
</template>
