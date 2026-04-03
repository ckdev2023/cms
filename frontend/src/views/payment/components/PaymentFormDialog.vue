<script setup lang="ts">
import { Delete, Plus } from '@element-plus/icons-vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { getCustomers } from '@/api/customer'
import { getInvoices } from '@/api/invoice'
import { createPayment } from '@/api/payment'
import { useSubmitLock } from '@/composables/useSubmitLock'
import { PaymentMethodLabel } from '@/constants/enum-labels'
import { InvoiceStatus, PaymentMethod } from '@/constants/enums'
import type { CustomerItem } from '@/types/customer'
import type { InvoiceListItem } from '@/types/invoice'
import type { CreatePaymentParams } from '@/types/payment'
import { useLocaleFormatter } from '@/utils/locale-format'

const props = defineProps<{
  modelValue: boolean
  defaultCustomerId?: string
  defaultInvoiceId?: string
}>()
const emit = defineEmits<{
  'update:modelValue': [val: boolean]
  saved: []
}>()
defineOptions({ name: 'PaymentFormDialog' })
const { t } = useI18n()
const { formatNumber } = useLocaleFormatter()

const formRef = ref<FormInstance>()
const { submitting, withLock } = useSubmitLock()
const customerOptions = ref<CustomerItem[]>([])
const customerLoading = ref(false)
const invoiceOptions = ref<InvoiceListItem[]>([])
const invoiceLoading = ref(false)

interface AllocationRow {
  invoiceId: string
  allocatedAmount: number
  invoiceNo: string
  invoiceTotal: number
  invoiceStatus: string
  remaining: number
}

interface FormModel {
  customerId: string
  paymentDate: string
  paymentAmount: number
  paymentMethod: PaymentMethod
  remark: string
  allocations: AllocationRow[]
}

const form = reactive<FormModel>({
  customerId: '',
  paymentDate: new Date().toISOString().slice(0, 10),
  paymentAmount: 0,
  paymentMethod: PaymentMethod.BANK,
  remark: '',
  allocations: [],
})

const rules: FormRules = {
  customerId: [{ required: true, message: t('common.selectField', { field: t('common.customer') }), trigger: 'change' }],
  paymentDate: [{ required: true, message: t('common.selectField', { field: t('dialogs.paymentForm.paymentDate') }), trigger: 'change' }],
  paymentAmount: [
    { required: true, message: t('common.enterField', { field: t('dialogs.paymentForm.paymentAmount') }), trigger: 'blur' },
    { type: 'number', min: 1, message: t('validation.minValue', { field: t('dialogs.paymentForm.paymentAmount'), min: 1 }), trigger: 'blur' },
  ],
  paymentMethod: [{ required: true, message: t('common.selectField', { field: t('dialogs.paymentForm.paymentMethod') }), trigger: 'change' }],
}

const allocationTotal = computed(() =>
  form.allocations.reduce((sum, a) => sum + (a.allocatedAmount || 0), 0),
)

const unallocated = computed(() =>
  Math.round((form.paymentAmount - allocationTotal.value) * 100) / 100,
)

const methodOptions = Object.entries(PaymentMethodLabel).map(([value, label]) => ({
  value,
  label,
}))

watch(
  () => props.modelValue,
  (visible) => {
    if (visible) {
      nextTick(() => {
        resetForm()
        if (customerOptions.value.length === 0) {
          fetchCustomers('')
        }
      })
    }
  },
)

watch(
  () => form.customerId,
  (customerId) => {
    if (customerId) {
      fetchInvoices(customerId)
    } else {
      invoiceOptions.value = []
      form.allocations = []
    }
  },
)

/**
 * 根据默认值重置收款表单，并清理校验状态。
 */
function resetForm() {
  form.customerId = props.defaultCustomerId ?? ''
  form.paymentDate = new Date().toISOString().slice(0, 10)
  form.paymentAmount = 0
  form.paymentMethod = PaymentMethod.BANK
  form.remark = ''
  form.allocations = []
  nextTick(() => formRef.value?.clearValidate())
}

/**
 * 按关键字拉取可选客户列表。
 *
 * @param query - 客户远程搜索输入关键字
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
 * 根据当前客户加载可分配的发票列表。
 *
 * @param customerId - 当前选中的客户 ID
 */
async function fetchInvoices(customerId: string) {
  invoiceLoading.value = true
  try {
    const res = await getInvoices({
      customerId,
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
 * 在分配表格中新增一条空白的发票分配行。
 */
function addAllocation() {
  form.allocations.push({
    invoiceId: '',
    allocatedAmount: 0,
    invoiceNo: '',
    invoiceTotal: 0,
    invoiceStatus: '',
    remaining: 0,
  })
}

function removeAllocation(index: number) {
  form.allocations.splice(index, 1)
}

/**
 * 选择发票后回填金额与剩余可分配额度。
 *
 * @param index - 当前分配行索引
 */
function onInvoiceSelect(index: number) {
  const row = form.allocations[index]
  const invoice = invoiceOptions.value.find((i) => i.id === row.invoiceId)
  if (invoice) {
    row.invoiceNo = invoice.invoiceNo
    row.invoiceTotal = Number(invoice.totalAmount)
    row.invoiceStatus = invoice.status

    const allocatedByOtherRows = form.allocations
      .filter((a, i) => i !== index && a.invoiceId === row.invoiceId)
      .reduce((sum, a) => sum + (a.allocatedAmount || 0), 0)
    row.remaining = Math.round((row.invoiceTotal - allocatedByOtherRows) * 100) / 100
    row.allocatedAmount = Math.min(row.remaining, Math.max(0, unallocated.value + (row.allocatedAmount || 0)))
  }
}

/**
 * 过滤当前行可选的未重复发票。
 *
 * @param currentIndex - 当前编辑的分配行索引
 * @returns 当前行允许选择的发票列表
 */
function getAvailableInvoices(currentIndex: number) {
  const selectedIds = new Set(
    form.allocations
      .filter((_, i) => i !== currentIndex)
      .map((a) => a.invoiceId)
      .filter(Boolean),
  )
  return invoiceOptions.value.filter((inv) => !selectedIds.has(inv.id))
}

/**
 * 组装新建收款接口需要的提交载荷。
 *
 * @returns 可直接传给收款创建接口的请求参数
 */
function buildPayload(): CreatePaymentParams {
  return {
    customerId: form.customerId,
    paymentDate: form.paymentDate,
    paymentAmount: form.paymentAmount,
    paymentMethod: form.paymentMethod,
    remark: form.remark || undefined,
    allocations: form.allocations.map((a) => ({
      invoiceId: a.invoiceId,
      allocatedAmount: a.allocatedAmount,
    })),
  }
}

/**
 * 校验收款表单与发票分配后提交新增请求。
 */
async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  if (form.allocations.length === 0) {
    ElMessage.warning(t('dialogs.paymentForm.addAtLeastOneAllocation'))
    return
  }

  if (form.allocations.some((a) => !a.invoiceId)) {
    ElMessage.warning(t('dialogs.paymentForm.selectInvoiceForAll'))
    return
  }

  if (form.allocations.some((a) => !a.allocatedAmount || a.allocatedAmount <= 0)) {
    ElMessage.warning(t('dialogs.paymentForm.allocationAmountPositive'))
    return
  }

  if (Math.abs(unallocated.value) > 0.01) {
    ElMessage.warning(
      t('dialogs.paymentForm.allocationMismatch', { amount: formatNumber(unallocated.value) }),
    )
    return
  }

  await withLock(async () => {
    await createPayment(buildPayload())
    ElMessage.success(t('dialogs.paymentForm.created'))
    emit('update:modelValue', false)
    emit('saved')
  })
}

function handleClose() {
  emit('update:modelValue', false)
}

function formatAmount(val: number): string {
  return formatNumber(val)
}
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    :title="t('dialogs.paymentForm.title')"
    width="860px"
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
      <el-row :gutter="16">
        <el-col :span="12">
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
        </el-col>
        <el-col :span="12">
          <el-form-item :label="t('dialogs.paymentForm.paymentDate')" prop="paymentDate">
            <el-date-picker
              v-model="form.paymentDate"
              type="date"
              :placeholder="t('common.selectField', { field: t('dialogs.paymentForm.paymentDate') })"
              value-format="YYYY-MM-DD"
              style="width: 100%"
            />
          </el-form-item>
        </el-col>
      </el-row>

      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item :label="t('dialogs.paymentForm.paymentAmount')" prop="paymentAmount">
            <el-input-number
              v-model="form.paymentAmount"
              :min="0"
              :precision="0"
              :controls="false"
              :placeholder="t('common.enterField', { field: t('dialogs.paymentForm.paymentAmount') })"
              style="width: 100%"
            />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item :label="t('dialogs.paymentForm.paymentMethod')" prop="paymentMethod">
            <el-select v-model="form.paymentMethod" style="width: 100%">
              <el-option
                v-for="opt in methodOptions"
                :key="opt.value"
                :label="opt.label"
                :value="opt.value"
              />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>

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

      <el-divider content-position="left">{{ t('dialogs.paymentForm.allocatedInvoices') }}</el-divider>

      <div v-if="!form.customerId" class="alloc-placeholder">
        <el-empty :description="t('dialogs.paymentForm.chooseCustomerForInvoices')" :image-size="60" />
      </div>

      <div v-else class="alloc-table">
        <el-table :data="form.allocations" border size="small">
          <el-table-column label="#" width="50" align="center">
            <template #default="{ $index }">{{ $index + 1 }}</template>
          </el-table-column>
          <el-table-column :label="t('dialogs.paymentForm.invoice')" min-width="240">
            <template #default="{ row, $index }">
              <el-select
                v-model="row.invoiceId"
                :placeholder="t('common.selectField', { field: t('dialogs.paymentForm.invoice') })"
                :loading="invoiceLoading"
                style="width: 100%"
                @change="onInvoiceSelect($index)"
              >
                <el-option
                  v-for="inv in getAvailableInvoices($index)"
                  :key="inv.id"
                  :label="`${inv.invoiceNo}（¥${formatAmount(Number(inv.totalAmount))}）`"
                  :value="inv.id"
                />
              </el-select>
            </template>
          </el-table-column>
          <el-table-column :label="t('dialogs.paymentForm.invoiceAmount')" width="130" align="right">
            <template #default="{ row }">
              {{ row.invoiceTotal ? `¥ ${formatAmount(row.invoiceTotal)}` : '-' }}
            </template>
          </el-table-column>
          <el-table-column :label="t('dialogs.paymentForm.allocatedAmount')" width="150" align="right">
            <template #default="{ row }">
              <el-input-number
                v-model="row.allocatedAmount"
                :min="0"
                :max="row.remaining || undefined"
                :precision="0"
                :controls="false"
                size="small"
                style="width: 120px"
              />
            </template>
          </el-table-column>
          <el-table-column label="" width="60" align="center">
            <template #default="{ $index }">
              <el-button
                type="danger"
                :icon="Delete"
                link
                size="small"
                @click="removeAllocation($index)"
              />
            </template>
          </el-table-column>
        </el-table>

        <div class="alloc-footer">
          <el-button
            :icon="Plus"
            size="small"
            :disabled="invoiceOptions.length === 0"
            @click="addAllocation"
          >
            {{ t('dialogs.paymentForm.addAllocation') }}
          </el-button>
          <div class="alloc-summary">
            <span>{{ t('dialogs.paymentForm.allocationTotal') }}：<strong>¥ {{ formatAmount(allocationTotal) }}</strong></span>
            <span
              :class="{ 'unalloc-warning': Math.abs(unallocated) > 0.01 }"
            >
              {{ t('dialogs.paymentForm.unallocated') }}：¥ {{ formatAmount(unallocated) }}
            </span>
          </div>
        </div>
      </div>
    </el-form>

    <template #footer>
      <el-button @click="handleClose">{{ t('common.cancel') }}</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSubmit">
        {{ t('common.save') }}
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">
.alloc-placeholder {
  padding: 20px 0;
}

.alloc-table {
  margin-bottom: 16px;
}

.alloc-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 12px;
  padding: 0 8px;
}

.alloc-summary {
  display: flex;
  gap: var(--app-spacing-lg);
  font-size: var(--app-font-size-base);
  color: var(--app-text-primary);

  strong {
    color: var(--app-color-primary);
    font-size: var(--app-font-size-lg);
  }
}

.unalloc-warning {
  color: var(--app-color-danger);
  font-weight: var(--app-font-weight-semibold);
}
</style>
