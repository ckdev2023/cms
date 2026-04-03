<script setup lang="ts">
import type { FormInstance, FormRules } from 'element-plus'
import { ElMessage } from 'element-plus'
import { computed, nextTick, provide, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { createCustomer, getCustomers, updateCustomer } from '@/api/customer'
import { FamilyRelationLabel, ServiceTypeLabel } from '@/constants/enum-labels'
import { CustomerType } from '@/constants/enums'
import type { CustomerItem } from '@/types/customer'
import CustomerFormDialogCompanyColumn from '@/views/customer/components/CustomerFormDialogCompanyColumn.vue'
import CustomerFormDialogPersonalColumn from '@/views/customer/components/CustomerFormDialogPersonalColumn.vue'
import { customerFormModelKey } from '@/views/customer/customerFormDialogInjection'
import {
  buildBaseFormValues,
  buildCompanyFormValues,
  buildCustomerFormPayload,
  buildPersonFormValues,
  createDefaultFormModel,
  type FormModel,
  hasCompanyExtension,
} from '@/views/customer/customerFormDialogModel'

const props = defineProps<{
  modelValue: boolean
  editData: CustomerItem | null
}>()
const emit = defineEmits<{
  'update:modelValue': [val: boolean]
  saved: []
}>()
defineOptions({ name: 'CustomerFormDialog' })
const { t } = useI18n()

const formRef = ref<FormInstance>()
const submitting = ref(false)

const isEdit = computed(() => !!props.editData)
const dialogTitle = computed(() =>
  isEdit.value ? t('dialogs.customerForm.editTitle') : t('dialogs.customerForm.createTitle'),
)

const form = reactive<FormModel>(createDefaultFormModel())
provide(customerFormModelKey, form)

const rules = computed<FormRules>(() => ({
  customerName: [
    { required: true, message: t('common.enterField', { field: t('dialogs.customerForm.customerName') }), trigger: 'blur' },
    { max: 200, message: t('validation.maxChars', { max: 200 }), trigger: 'blur' },
  ],
  serviceType: [{ required: true, message: t('common.selectField', { field: t('dialogs.customerForm.serviceType') }), trigger: 'change' }],
  email: [{ type: 'email', message: t('validation.invalidEmail'), trigger: 'blur' }],
  fiscalMonth: [
    {
      validator: (_rule, value, callback) => {
        const companySideActive =
          hasCompanyExtension(form) ||
          (isEdit.value && form.customerType === CustomerType.COMPANY)
        if (!companySideActive) {
          callback()
          return
        }
        if (value === undefined || value === null || value === '') {
          callback()
          return
        }
        const n = Number(value)
        if (Number.isNaN(n) || n < 1 || n > 12) {
          callback(new Error(t('validation.numberRange', { min: 1, max: 12 })))
          return
        }
        callback()
      },
      trigger: 'blur',
    },
  ],
  familyRelation: [
    {
      validator: (_rule, value, callback) => {
        if (form.isFamilyMember && !value) {
          callback(new Error(t('common.selectField', { field: t('dialogs.customerForm.familyRelation') })))
          return
        }
        callback()
      },
      trigger: 'change',
    },
  ],
  remindDaysBefore: [
    {
      validator: (_rule, value, callback) => {
        if (value === undefined || value === null || value === '') {
          callback()
          return
        }
        const n = Number(value)
        if (Number.isNaN(n) || n < 1 || n > 365) {
          callback(new Error(t('validation.numberRange', { min: 1, max: 365 })))
          return
        }
        callback()
      },
      trigger: 'blur',
    },
  ],
}))

/** 编辑时仅允许改与当前客户类型一致的一栏；新建时两栏可同时填写并一并提交 */
const personalColumnDisabled = computed(() => isEdit.value && form.customerType === CustomerType.COMPANY)
const companyColumnDisabled = computed(() => isEdit.value && form.customerType === CustomerType.PERSONAL)

const serviceTypeOptions = Object.entries(ServiceTypeLabel).map(([value, label]) => ({
  value,
  label,
}))

const familyRelationOptions = Object.entries(FamilyRelationLabel).map(([value, label]) => ({
  value,
  label,
}))

const primaryCustomerOptions = ref<{ value: string; label: string }[]>([])
const primaryCustomerLoading = ref(false)

/**
 * 远程搜索可用的主客户列表。
 *
 * @param query - 搜索关键字
 */
async function searchPrimaryCustomers(query: string): Promise<void> {
  if (!query) {
    primaryCustomerOptions.value = []
    return
  }
  primaryCustomerLoading.value = true
  try {
    const res = await getCustomers({ keyword: query, pageSize: 20 })
    const editId = props.editData?.id
    primaryCustomerOptions.value = res.data.items
      .filter((c) => c.id !== editId)
      .map((c) => ({ value: c.id, label: `${c.customerName}（${c.customerCode}）` }))
  } finally {
    primaryCustomerLoading.value = false
  }
}

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
      })
    }
  },
)

watch(
  () => [
    form.corporationNumber,
    form.representativeName,
    form.fiscalMonth,
    form.nationality,
    form.residenceStatus,
    form.residenceExpireDate,
    form.customerType,
    form.isFamilyMember,
    form.familyRelation,
    form.remindDaysBefore,
  ],
  () => {
    if (!props.modelValue) return
    nextTick(() => {
      formRef.value?.clearValidate([
        'fiscalMonth',
        'corporationNumber',
        'representativeName',
        'nationality',
        'residenceStatus',
        'residenceExpireDate',
        'familyRelation',
        'remindDaysBefore',
      ])
    })
  },
  { deep: true },
)

/**
 * 将待编辑客户数据展开到表单模型，兼容公司客户和个人客户字段。
 *
 * @param data - 当前正在编辑的客户记录
 */
function populateForm(data: CustomerItem) {
  Object.assign(
    form,
    buildBaseFormValues(data),
    buildCompanyFormValues(data),
    buildPersonFormValues(data),
  )
}

/**
 * 将客户表单恢复为默认初始值，并清空上一次校验结果。
 */
function resetForm() {
  Object.assign(form, createDefaultFormModel())
  primaryCustomerOptions.value = []
  nextTick(() => formRef.value?.clearValidate())
}

/**
 * 校验客户表单并提交创建或更新请求。
 *
 * 成功后会关闭弹窗，并通知父组件刷新客户列表或详情页数据。
 *
 * @throws {Error} 客户保存请求失败时由请求层统一提示并继续抛出
 */
async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  submitting.value = true
  try {
    const payload = buildCustomerFormPayload(form, isEdit.value)
    if (isEdit.value && props.editData) {
      await updateCustomer(props.editData.id, payload)
      ElMessage.success(t('dialogs.customerForm.updated'))
    } else {
      await createCustomer(payload)
      ElMessage.success(t('dialogs.customerForm.created'))
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
    width="960px"
    class="customer-form-dialog"
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
      <el-form-item :label="t('dialogs.customerForm.customerName')" prop="customerName">
        <el-input
          v-model="form.customerName"
          :placeholder="t('common.enterField', { field: t('dialogs.customerForm.customerName') })"
          maxlength="200"
        />
      </el-form-item>

      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item :label="t('common.phone')" prop="phone">
            <el-input v-model="form.phone" placeholder="03-1234-5678" maxlength="50" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item :label="t('common.email')" prop="email">
            <el-input v-model="form.email" placeholder="example@mail.com" maxlength="120" />
          </el-form-item>
        </el-col>
      </el-row>

      <el-form-item :label="t('dialogs.customerForm.address')" prop="address">
        <el-input
          v-model="form.address"
          :placeholder="t('common.enterField', { field: t('dialogs.customerForm.address') })"
          maxlength="500"
        />
      </el-form-item>

      <el-form-item :label="t('dialogs.customerForm.serviceType')" prop="serviceType">
        <el-select
          v-model="form.serviceType"
          class="customer-form-dialog__field-fill"
          :placeholder="t('common.selectField', { field: t('dialogs.customerForm.serviceType') })"
        >
          <el-option
            v-for="opt in serviceTypeOptions"
            :key="opt.value"
            :label="opt.label"
            :value="opt.value"
          />
        </el-select>
      </el-form-item>

      <el-row :gutter="20" class="customer-form-dialog__extension" align="top">
        <CustomerFormDialogPersonalColumn
          :personal-column-disabled="personalColumnDisabled"
          :family-relation-options="familyRelationOptions"
          :primary-customer-options="primaryCustomerOptions"
          :primary-customer-loading="primaryCustomerLoading"
          @search-primary-customers="searchPrimaryCustomers"
        />
        <CustomerFormDialogCompanyColumn
          :company-column-disabled="companyColumnDisabled"
        />
      </el-row>

      <el-row :gutter="20" class="customer-form-dialog__visa-row">
        <el-col :span="24">
          <div
            class="customer-form-dialog__extension-title customer-form-dialog__extension-title--visa"
            :class="{ 'is-inactive': personalColumnDisabled }"
          >
            {{ t('dialogs.customerForm.visaInfoTitle') }}
          </div>
          <div
            class="customer-form-dialog__visa-panel"
            :class="{ 'is-inactive': personalColumnDisabled }"
          >
            <el-row :gutter="16" class="customer-form-dialog__visa-inner-row">
              <el-col :span="12">
                <el-form-item
                  :label="t('dialogs.customerForm.residenceExpireDate')"
                  prop="residenceExpireDate"
                >
                  <el-date-picker
                    v-model="form.residenceExpireDate"
                    type="date"
                    :disabled="personalColumnDisabled"
                    :placeholder="t('common.selectField', { field: t('dialogs.customerForm.residenceExpireDate') })"
                    value-format="YYYY-MM-DD"
                    class="customer-form-dialog__field-fill"
                  />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item
                  :label="t('dialogs.customerForm.remindDaysBefore')"
                  prop="remindDaysBefore"
                >
                  <el-input-number
                    v-model="form.remindDaysBefore"
                    :disabled="personalColumnDisabled"
                    :min="1"
                    :max="365"
                    :value-on-clear="null"
                    controls-position="right"
                    class="customer-form-dialog__remind-days"
                  />
                </el-form-item>
              </el-col>
            </el-row>
            <el-text size="small" type="info" class="customer-form-dialog__visa-panel-hint">
              {{ t('dialogs.customerForm.remindDaysOptional') }}
            </el-text>
          </div>
        </el-col>
      </el-row>
    </el-form>

    <template #footer>
      <el-button @click="handleClose">{{ t('common.cancel') }}</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSubmit">
        {{ isEdit ? t('common.update') : t('common.create') }}
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.customer-form-dialog__extension {
  margin-top: 4px;
}

.customer-form-dialog__extension :deep(.el-form-item) {
  margin-bottom: 14px;
}

.customer-form-dialog__extension :deep(.el-form-item__content),
.customer-form-dialog__visa-row :deep(.el-form-item__content) {
  flex: 1;
  min-width: 0;
}

.customer-form-dialog__field-fill {
  width: 100%;
}

.customer-form-dialog__visa-row {
  margin-top: 2px;
}

.customer-form-dialog__visa-inner-row {
  width: 100%;
}

.customer-form-dialog__extension-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin: 0 0 8px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.customer-form-dialog__extension-title--visa {
  margin-top: 12px;
}

.customer-form-dialog__extension-title.is-inactive {
  color: var(--el-text-color-secondary);
  font-weight: 500;
}

.customer-form-dialog__visa-panel {
  padding: 10px 12px 8px;
  border-radius: 8px;
  background-color: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color-lighter);
}

.customer-form-dialog__visa-panel.is-inactive {
  opacity: 0.85;
}

.customer-form-dialog__visa-panel-hint {
  display: block;
  text-align: center;
  line-height: 1.45;
  margin: 2px 0 0;
  padding: 0 4px 4px;
}

.customer-form-dialog__remind-days {
  width: 100%;
}

.customer-form-dialog__visa-row :deep(.el-form-item) {
  margin-bottom: 12px;
}
</style>
