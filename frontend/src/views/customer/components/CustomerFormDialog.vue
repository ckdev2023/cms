<script setup lang="ts">
import { ref, reactive, computed, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import type { FormInstance, FormRules } from 'element-plus'
import { ElMessage } from 'element-plus'
import { CustomerType, ServiceType } from '@/constants/enums'
import { ServiceTypeLabel } from '@/constants/enum-labels'
import { createCustomer, updateCustomer } from '@/api/customer'
import type { CustomerItem, CreateCustomerParams } from '@/types/customer'

defineOptions({ name: 'CustomerFormDialog' })
const { t } = useI18n()

const props = defineProps<{
  modelValue: boolean
  editData: CustomerItem | null
}>()

const emit = defineEmits<{
  'update:modelValue': [val: boolean]
  saved: []
}>()

const formRef = ref<FormInstance>()
const submitting = ref(false)

const isEdit = computed(() => !!props.editData)
const dialogTitle = computed(() =>
  isEdit.value ? t('dialogs.customerForm.editTitle') : t('dialogs.customerForm.createTitle'),
)

interface FormModel {
  customerType: CustomerType
  customerName: string
  phone: string
  email: string
  address: string
  serviceType: ServiceType
  ownerUserId: string
  corporationNumber: string
  fiscalMonth: number | undefined
  representativeName: string
  nationality: string
  residenceStatus: string
  residenceExpireDate: string
}

const form = reactive<FormModel>({
  customerType: CustomerType.PERSONAL,
  customerName: '',
  phone: '',
  email: '',
  address: '',
  serviceType: ServiceType.BOTH,
  ownerUserId: '',
  corporationNumber: '',
  fiscalMonth: undefined,
  representativeName: '',
  nationality: '',
  residenceStatus: '',
  residenceExpireDate: '',
})

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
          hasCompanyExtension() ||
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
}))

/** 编辑时仅允许改与当前客户类型一致的一栏；新建时两栏可同时填写并一并提交 */
const personalColumnDisabled = computed(() => isEdit.value && form.customerType === CustomerType.COMPANY)
const companyColumnDisabled = computed(() => isEdit.value && form.customerType === CustomerType.PERSONAL)

function hasCompanyExtension(): boolean {
  return !!(
    form.corporationNumber?.trim() ||
    form.representativeName?.trim() ||
    form.fiscalMonth != null
  )
}

function hasPersonExtension(): boolean {
  return !!(
    form.nationality?.trim() ||
    form.residenceStatus?.trim() ||
    (form.residenceExpireDate != null && String(form.residenceExpireDate).trim() !== '')
  )
}

/** 新建：有法人扩展字段时用法人客户编码（C 前缀）；否则个人（P 前缀）。两栏同时有内容时仍为法人编码。 */
function resolveCreateCustomerType(): CustomerType {
  return hasCompanyExtension() ? CustomerType.COMPANY : CustomerType.PERSONAL
}

const serviceTypeOptions = Object.entries(ServiceTypeLabel).map(([value, label]) => ({
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
  ],
  () => {
    if (!props.modelValue) return
    nextTick(() => {
      formRef.value?.clearValidate(['fiscalMonth', 'corporationNumber', 'representativeName', 'nationality', 'residenceStatus', 'residenceExpireDate'])
    })
  },
  { deep: true },
)

function populateForm(data: CustomerItem) {
  form.customerType = data.customerType
  form.customerName = data.customerName
  form.phone = data.phone ?? ''
  form.email = data.email ?? ''
  form.address = data.address ?? ''
  form.serviceType = data.serviceType
  form.ownerUserId = data.ownerUserId ?? ''
  form.corporationNumber = data.companyInfo?.corporationNumber ?? ''
  form.fiscalMonth = data.companyInfo?.fiscalMonth ?? undefined
  form.representativeName = data.companyInfo?.representativeName ?? ''
  form.nationality = data.personInfo?.nationality ?? ''
  form.residenceStatus = data.personInfo?.residenceStatus ?? ''
  form.residenceExpireDate = data.personInfo?.residenceExpireDate ?? ''
}

function resetForm() {
  form.customerType = CustomerType.PERSONAL
  form.customerName = ''
  form.phone = ''
  form.email = ''
  form.address = ''
  form.serviceType = ServiceType.BOTH
  form.ownerUserId = ''
  form.corporationNumber = ''
  form.fiscalMonth = undefined
  form.representativeName = ''
  form.nationality = ''
  form.residenceStatus = ''
  form.residenceExpireDate = ''
  nextTick(() => formRef.value?.clearValidate())
}

function buildPayload(): CreateCustomerParams {
  const payload: CreateCustomerParams = {
    customerType: isEdit.value ? form.customerType : resolveCreateCustomerType(),
    customerName: form.customerName,
    serviceType: form.serviceType,
  }

  if (form.phone) payload.phone = form.phone
  if (form.email) payload.email = form.email
  if (form.address) payload.address = form.address
  if (form.ownerUserId) payload.ownerUserId = form.ownerUserId

  if (hasCompanyExtension()) {
    payload.companyInfo = {}
    if (form.corporationNumber) payload.companyInfo.corporationNumber = form.corporationNumber
    if (form.fiscalMonth != null) payload.companyInfo.fiscalMonth = form.fiscalMonth
    if (form.representativeName) payload.companyInfo.representativeName = form.representativeName
  }

  if (hasPersonExtension()) {
    payload.personInfo = {}
    if (form.nationality) payload.personInfo.nationality = form.nationality
    if (form.residenceStatus) payload.personInfo.residenceStatus = form.residenceStatus
    if (form.residenceExpireDate) payload.personInfo.residenceExpireDate = form.residenceExpireDate
  }

  return payload
}

async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  submitting.value = true
  try {
    const payload = buildPayload()
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
        <el-select v-model="form.serviceType" :placeholder="t('common.selectField', { field: t('dialogs.customerForm.serviceType') })">
          <el-option
            v-for="opt in serviceTypeOptions"
            :key="opt.value"
            :label="opt.label"
            :value="opt.value"
          />
        </el-select>
      </el-form-item>

      <el-row :gutter="20" class="customer-form-dialog__extension">
        <el-col :xs="24" :md="12">
          <div
            class="customer-form-dialog__extension-title"
            :class="{ 'is-inactive': personalColumnDisabled }"
          >
            {{ t('dialogs.customerForm.personalInfo') }}
          </div>
          <el-form-item
            :label="t('dialogs.customerForm.nationality')"
            prop="nationality"
            label-width="108px"
          >
            <el-input
              v-model="form.nationality"
              :disabled="personalColumnDisabled"
              :placeholder="t('dialogs.customerForm.nationality')"
              maxlength="80"
            />
          </el-form-item>
          <el-form-item
            :label="t('dialogs.customerForm.residenceStatus')"
            prop="residenceStatus"
            label-width="108px"
          >
            <el-input
              v-model="form.residenceStatus"
              :disabled="personalColumnDisabled"
              :placeholder="t('dialogs.customerForm.residenceStatus')"
              maxlength="100"
            />
          </el-form-item>
          <el-form-item
            :label="t('dialogs.customerForm.residenceExpireDate')"
            prop="residenceExpireDate"
            label-width="108px"
          >
            <el-date-picker
              v-model="form.residenceExpireDate"
              type="date"
              :disabled="personalColumnDisabled"
              :placeholder="t('common.selectField', { field: t('dialogs.customerForm.residenceExpireDate') })"
              value-format="YYYY-MM-DD"
              style="width: 100%"
            />
          </el-form-item>
        </el-col>
        <el-col :xs="24" :md="12">
          <div
            class="customer-form-dialog__extension-title"
            :class="{ 'is-inactive': companyColumnDisabled }"
          >
            {{ t('dialogs.customerForm.companyInfo') }}
          </div>
          <el-form-item
            :label="t('dialogs.customerForm.corporationNumber')"
            prop="corporationNumber"
            label-width="108px"
          >
            <el-input
              v-model="form.corporationNumber"
              :disabled="companyColumnDisabled"
              :placeholder="t('dialogs.customerForm.corporationNumber')"
              maxlength="50"
            />
          </el-form-item>
          <el-form-item
            :label="t('dialogs.customerForm.fiscalMonth')"
            prop="fiscalMonth"
            label-width="108px"
          >
            <el-input-number
              v-model="form.fiscalMonth"
              :disabled="companyColumnDisabled"
              :min="1"
              :max="12"
              :placeholder="t('dialogs.customerForm.month')"
              controls-position="right"
              style="width: 100%"
            />
          </el-form-item>
          <el-form-item
            :label="t('dialogs.customerForm.representativeName')"
            prop="representativeName"
            label-width="108px"
          >
            <el-input
              v-model="form.representativeName"
              :disabled="companyColumnDisabled"
              :placeholder="t('dialogs.customerForm.representativeName')"
              maxlength="120"
            />
          </el-form-item>
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

.customer-form-dialog__extension-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin: 0 0 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.customer-form-dialog__extension-title.is-inactive {
  color: var(--el-text-color-secondary);
  font-weight: 500;
}
</style>
