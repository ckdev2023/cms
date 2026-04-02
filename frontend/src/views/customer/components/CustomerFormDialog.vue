<script setup lang="ts">
import type { FormInstance, FormRules } from 'element-plus'
import { ElMessage } from 'element-plus'
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { createCustomer, updateCustomer } from '@/api/customer'
import { CustomerTypeLabel, ServiceTypeLabel } from '@/constants/enum-labels'
import { CustomerType, ServiceType } from '@/constants/enums'
import type { CreateCustomerParams, CustomerItem } from '@/types/customer'

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

type BaseFormValues = Pick<
  FormModel,
  | 'customerType'
  | 'customerName'
  | 'phone'
  | 'email'
  | 'address'
  | 'serviceType'
  | 'ownerUserId'
>

type CompanyFormValues = Pick<
  FormModel,
  'corporationNumber' | 'fiscalMonth' | 'representativeName'
>

type PersonFormValues = Pick<
  FormModel,
  'nationality' | 'residenceStatus' | 'residenceExpireDate'
>

/**
 * 创建客户弹窗所需的默认表单模型。
 *
 * @returns 适用于新增客户场景的初始表单值
 */
function createDefaultFormModel(): FormModel {
  return {
    customerType: CustomerType.COMPANY,
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
  }
}

/**
 * 从客户详情中提取所有通用字段，供新增/编辑表单复用。
 *
 * @param data - 当前正在编辑的客户记录
 * @returns 适用于公司和个人客户的基础表单字段
 */
function buildBaseFormValues(data: CustomerItem): BaseFormValues {
  return {
    customerType: data.customerType,
    customerName: data.customerName,
    phone: data.phone ?? '',
    email: data.email ?? '',
    address: data.address ?? '',
    serviceType: data.serviceType,
    ownerUserId: data.ownerUserId ?? '',
  }
}

/**
 * 从客户详情中提取公司客户专属字段。
 *
 * @param data - 当前正在编辑的客户记录
 * @returns 公司客户表单所需的补充字段
 */
function buildCompanyFormValues(data: CustomerItem): CompanyFormValues {
  const companyInfo = data.companyInfo

  return {
    corporationNumber: companyInfo?.corporationNumber ?? '',
    fiscalMonth: companyInfo?.fiscalMonth ?? undefined,
    representativeName: companyInfo?.representativeName ?? '',
  }
}

/**
 * 从客户详情中提取个人客户专属字段。
 *
 * @param data - 当前正在编辑的客户记录
 * @returns 个人客户表单所需的补充字段
 */
function buildPersonFormValues(data: CustomerItem): PersonFormValues {
  const personInfo = data.personInfo

  return {
    nationality: personInfo?.nationality ?? '',
    residenceStatus: personInfo?.residenceStatus ?? '',
    residenceExpireDate: personInfo?.residenceExpireDate ?? '',
  }
}

const form = reactive<FormModel>(createDefaultFormModel())

const rules = computed<FormRules>(() => ({
  customerType: [{ required: true, message: t('common.selectField', { field: t('dialogs.customerForm.customerType') }), trigger: 'change' }],
  customerName: [
    { required: true, message: t('common.enterField', { field: t('dialogs.customerForm.customerName') }), trigger: 'blur' },
    { max: 200, message: t('validation.maxChars', { max: 200 }), trigger: 'blur' },
  ],
  serviceType: [{ required: true, message: t('common.selectField', { field: t('dialogs.customerForm.serviceType') }), trigger: 'change' }],
  email: [{ type: 'email', message: t('validation.invalidEmail'), trigger: 'blur' }],
  fiscalMonth: [
    { type: 'number', min: 1, max: 12, message: t('validation.numberRange', { min: 1, max: 12 }), trigger: 'blur' },
  ],
}))

const isCompany = computed(() => form.customerType === CustomerType.COMPANY)

const customerTypeOptions = Object.entries(CustomerTypeLabel).map(([value, label]) => ({
  value,
  label,
}))

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
  nextTick(() => formRef.value?.clearValidate())
}

/**
 * 根据客户类型整理接口所需的提交载荷。
 *
 * 仅在用户填写了对应字段时写入可选属性，避免把空值结构提交给后端。
 *
 * @returns 创建或更新客户接口需要的请求体
 */
function buildPayload(): CreateCustomerParams {
  const payload: CreateCustomerParams = {
    customerType: form.customerType,
    customerName: form.customerName,
    serviceType: form.serviceType,
  }

  if (form.phone) payload.phone = form.phone
  if (form.email) payload.email = form.email
  if (form.address) payload.address = form.address
  if (form.ownerUserId) payload.ownerUserId = form.ownerUserId

  if (isCompany.value) {
    payload.companyInfo = {}
    if (form.corporationNumber) payload.companyInfo.corporationNumber = form.corporationNumber
    if (form.fiscalMonth) payload.companyInfo.fiscalMonth = form.fiscalMonth
    if (form.representativeName) payload.companyInfo.representativeName = form.representativeName
  } else {
    payload.personInfo = {}
    if (form.nationality) payload.personInfo.nationality = form.nationality
    if (form.residenceStatus) payload.personInfo.residenceStatus = form.residenceStatus
    if (form.residenceExpireDate) payload.personInfo.residenceExpireDate = form.residenceExpireDate
  }

  return payload
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
      <el-form-item :label="t('dialogs.customerForm.customerType')" prop="customerType">
        <el-radio-group v-model="form.customerType" :disabled="isEdit">
          <el-radio-button
            v-for="opt in customerTypeOptions"
            :key="opt.value"
            :value="opt.value"
          >
            {{ opt.label }}
          </el-radio-button>
        </el-radio-group>
      </el-form-item>

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

      <el-divider content-position="left">
        {{ isCompany ? t('dialogs.customerForm.companyInfo') : t('dialogs.customerForm.personalInfo') }}
      </el-divider>

      <template v-if="isCompany">
        <el-form-item :label="t('dialogs.customerForm.corporationNumber')" prop="corporationNumber">
          <el-input v-model="form.corporationNumber" :placeholder="t('dialogs.customerForm.corporationNumber')" maxlength="50" />
        </el-form-item>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item :label="t('dialogs.customerForm.fiscalMonth')" prop="fiscalMonth">
              <el-input-number
                v-model="form.fiscalMonth"
                :min="1"
                :max="12"
                :placeholder="t('dialogs.customerForm.month')"
                controls-position="right"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="t('dialogs.customerForm.representativeName')" prop="representativeName">
              <el-input v-model="form.representativeName" :placeholder="t('dialogs.customerForm.representativeName')" maxlength="120" />
            </el-form-item>
          </el-col>
        </el-row>
      </template>

      <template v-else>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item :label="t('dialogs.customerForm.nationality')" prop="nationality">
              <el-input v-model="form.nationality" :placeholder="t('dialogs.customerForm.nationality')" maxlength="80" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="t('dialogs.customerForm.residenceStatus')" prop="residenceStatus">
              <el-input v-model="form.residenceStatus" :placeholder="t('dialogs.customerForm.residenceStatus')" maxlength="100" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item :label="t('dialogs.customerForm.residenceExpireDate')" prop="residenceExpireDate">
          <el-date-picker
            v-model="form.residenceExpireDate"
            type="date"
            :placeholder="t('common.selectField', { field: t('dialogs.customerForm.residenceExpireDate') })"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
        </el-form-item>
      </template>
    </el-form>

    <template #footer>
      <el-button @click="handleClose">{{ t('common.cancel') }}</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSubmit">
        {{ isEdit ? t('common.update') : t('common.create') }}
      </el-button>
    </template>
  </el-dialog>
</template>
