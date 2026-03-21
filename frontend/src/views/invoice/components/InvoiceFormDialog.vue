<script setup lang="ts">
import { ref, reactive, computed, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import type { FormInstance, FormRules } from 'element-plus'
import { ElMessage } from 'element-plus'
import { Plus, Delete } from '@element-plus/icons-vue'
import { InvoiceType, BusinessType } from '@/constants/enums'
import { InvoiceTypeLabel, BusinessTypeLabel } from '@/constants/enum-labels'
import { createInvoice, updateInvoice } from '@/api/invoice'
import { getCustomers } from '@/api/customer'
import { useSubmitLock } from '@/composables/useSubmitLock'
import { useLocaleFormatter } from '@/utils/locale-format'
import type { InvoiceListItem, CreateInvoiceParams, CreateInvoiceItemParams } from '@/types/invoice'
import type { CustomerItem } from '@/types/customer'

defineOptions({ name: 'InvoiceFormDialog' })
const { t } = useI18n()
const { formatNumber } = useLocaleFormatter()

const props = defineProps<{
  modelValue: boolean
  editData: InvoiceListItem | null
  editItems?: CreateInvoiceItemParams[]
  defaultCustomerId?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [val: boolean]
  saved: []
}>()

const formRef = ref<FormInstance>()
const { submitting, withLock } = useSubmitLock()
const customerOptions = ref<CustomerItem[]>([])
const customerLoading = ref(false)

const isEdit = computed(() => !!props.editData)
const dialogTitle = computed(() =>
  isEdit.value ? t('dialogs.invoiceForm.editTitle') : t('dialogs.invoiceForm.createTitle'),
)

interface ItemRow {
  description: string
  quantity: number
  unitPrice: number
  amount: number
}

interface FormModel {
  customerId: string
  invoiceType: InvoiceType
  dueDate: string
  relatedId: string
  relatedType: BusinessType | ''
  remark: string
  items: ItemRow[]
}

const form = reactive<FormModel>({
  customerId: '',
  invoiceType: InvoiceType.ADMIN,
  dueDate: '',
  relatedId: '',
  relatedType: '',
  remark: '',
  items: [{ description: '', quantity: 1, unitPrice: 0, amount: 0 }],
})

const rules: FormRules = {
  customerId: [{ required: true, message: t('common.selectField', { field: t('common.customer') }), trigger: 'change' }],
  invoiceType: [{ required: true, message: t('common.selectField', { field: t('dialogs.invoiceForm.invoiceType') }), trigger: 'change' }],
}

const totalAmount = computed(() =>
  form.items.reduce((sum, it) => sum + it.amount, 0),
)

const invoiceTypeOptions = Object.entries(InvoiceTypeLabel).map(([value, label]) => ({
  value,
  label,
}))

const businessTypeOptions = Object.entries(BusinessTypeLabel).map(([value, label]) => ({
  value,
  label,
}))

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

function populateForm(data: InvoiceListItem) {
  form.customerId = data.customerId
  form.invoiceType = data.invoiceType
  form.dueDate = data.dueDate ?? ''
  form.relatedId = ''
  form.relatedType = ''
  form.remark = ''
  if (props.editItems?.length) {
    form.items = props.editItems.map((it) => ({
      description: it.description,
      quantity: it.quantity ?? 1,
      unitPrice: it.unitPrice,
      amount: (it.quantity ?? 1) * it.unitPrice,
    }))
  } else {
    form.items = [{ description: '', quantity: 1, unitPrice: 0, amount: 0 }]
  }
}

function resetForm() {
  form.customerId = props.defaultCustomerId ?? ''
  form.invoiceType = InvoiceType.ADMIN
  form.dueDate = ''
  form.relatedId = ''
  form.relatedType = ''
  form.remark = ''
  form.items = [{ description: '', quantity: 1, unitPrice: 0, amount: 0 }]
  nextTick(() => formRef.value?.clearValidate())
}

async function fetchCustomers(query: string) {
  customerLoading.value = true
  try {
    const res = await getCustomers({ keyword: query, pageSize: 50 })
    customerOptions.value = res.data.items
  } finally {
    customerLoading.value = false
  }
}

function addItem() {
  form.items.push({ description: '', quantity: 1, unitPrice: 0, amount: 0 })
}

function removeItem(index: number) {
  if (form.items.length <= 1) return
  form.items.splice(index, 1)
}

function recalcItem(index: number) {
  const it = form.items[index]
  it.amount = Math.round(it.quantity * it.unitPrice * 100) / 100
}

function buildPayload(): CreateInvoiceParams {
  const payload: CreateInvoiceParams = {
    customerId: form.customerId,
    invoiceType: form.invoiceType,
    items: form.items.map((it, idx) => ({
      description: it.description,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      sortOrder: idx,
    })),
  }

  if (form.dueDate) payload.dueDate = form.dueDate
  if (form.relatedId) payload.relatedId = form.relatedId
  if (form.relatedType) payload.relatedType = form.relatedType as BusinessType
  if (form.remark) payload.remark = form.remark

  return payload
}

async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  const hasEmptyItem = form.items.some((it) => !it.description.trim())
  if (hasEmptyItem) {
    ElMessage.warning(t('dialogs.invoiceForm.emptyItemDescription'))
    return
  }

  await withLock(async () => {
    const payload = buildPayload()
    if (isEdit.value && props.editData) {
      const { customerId: _, ...updatePayload } = payload
      await updateInvoice(props.editData.id, updatePayload)
      ElMessage.success(t('dialogs.invoiceForm.updated'))
    } else {
      await createInvoice(payload)
      ElMessage.success(t('dialogs.invoiceForm.created'))
    }
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
    :title="dialogTitle"
    width="800px"
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
              :disabled="isEdit || !!defaultCustomerId"
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
          <el-form-item :label="t('dialogs.invoiceForm.invoiceType')" prop="invoiceType">
            <el-select v-model="form.invoiceType" style="width: 100%">
              <el-option
                v-for="opt in invoiceTypeOptions"
                :key="opt.value"
                :label="opt.label"
                :value="opt.value"
              />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>

      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item :label="t('detailViews.invoice.dueDate')">
            <el-date-picker
              v-model="form.dueDate"
              type="date"
              :placeholder="t('common.selectField', { field: t('detailViews.invoice.dueDate') })"
              value-format="YYYY-MM-DD"
              style="width: 100%"
            />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item :label="t('dialogs.invoiceForm.relatedType')">
            <el-select
              v-model="form.relatedType"
              :placeholder="t('dialogs.invoiceForm.relatedType')"
              clearable
              style="width: 100%"
            >
              <el-option
                v-for="opt in businessTypeOptions"
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

      <el-divider content-position="left">{{ t('dialogs.invoiceForm.items') }}</el-divider>

      <div class="item-table">
        <el-table :data="form.items" border size="small">
          <el-table-column label="#" width="50" align="center">
            <template #default="{ $index }">{{ $index + 1 }}</template>
          </el-table-column>
          <el-table-column :label="t('detailViews.invoice.description')" min-width="200">
            <template #default="{ row }">
              <el-input
                v-model="row.description"
                :placeholder="t('dialogs.invoiceForm.itemDescription')"
                maxlength="500"
              />
            </template>
          </el-table-column>
          <el-table-column :label="t('dialogs.invoiceForm.quantity')" width="100" align="center">
            <template #default="{ row, $index }">
              <el-input-number
                v-model="row.quantity"
                :min="1"
                :controls="false"
                size="small"
                style="width: 80px"
                @change="recalcItem($index)"
              />
            </template>
          </el-table-column>
          <el-table-column :label="t('dialogs.invoiceForm.unitPrice')" width="140" align="right">
            <template #default="{ row, $index }">
              <el-input-number
                v-model="row.unitPrice"
                :min="0"
                :precision="0"
                :controls="false"
                size="small"
                style="width: 120px"
                @change="recalcItem($index)"
              />
            </template>
          </el-table-column>
          <el-table-column :label="t('dialogs.invoiceForm.amount')" width="120" align="right">
            <template #default="{ row }">
              <span class="item-amount">{{ formatAmount(row.amount) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="" width="60" align="center">
            <template #default="{ $index }">
              <el-button
                type="danger"
                :icon="Delete"
                link
                size="small"
                :disabled="form.items.length <= 1"
                @click="removeItem($index)"
              />
            </template>
          </el-table-column>
        </el-table>

        <div class="item-footer">
          <el-button :icon="Plus" size="small" @click="addItem">
            {{ t('dialogs.invoiceForm.addItem') }}
          </el-button>
          <div class="item-total">
            {{ t('dialogs.invoiceForm.total') }}：<strong>¥ {{ formatAmount(totalAmount) }}</strong>
          </div>
        </div>
      </div>
    </el-form>

    <template #footer>
      <el-button @click="handleClose">{{ t('common.cancel') }}</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSubmit">
        {{ isEdit ? t('common.update') : t('common.create') }}
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">
.item-table {
  margin-bottom: 16px;
}

.item-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 12px;
  padding: 0 8px;
}

.item-total {
  font-size: 16px;
  color: #303133;

  strong {
    color: #409eff;
    font-size: 18px;
  }
}

.item-amount {
  font-weight: 600;
  color: #303133;
}
</style>
