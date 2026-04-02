<script setup lang="ts">
import type { FormInstance, FormRules } from 'element-plus'
import { ElMessage } from 'element-plus'
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { createAdminCase, updateAdminCase } from '@/api/admin-case'
import { getCustomers } from '@/api/customer'
import { AdminCaseStatusLabel } from '@/constants/enum-labels'
import { AdminCaseStatus } from '@/constants/enums'
import type { AdminCaseItem, CreateAdminCaseParams } from '@/types/admin-case'
import type { CustomerItem } from '@/types/customer'

const props = defineProps<{
  modelValue: boolean
  editData: AdminCaseItem | null
  defaultCustomerId?: string
}>()
const emit = defineEmits<{
  'update:modelValue': [val: boolean]
  saved: []
}>()
defineOptions({ name: 'AdminCaseFormDialog' })
const { t } = useI18n()

const formRef = ref<FormInstance>()
const submitting = ref(false)
const customerOptions = ref<CustomerItem[]>([])
const customerLoading = ref(false)

const isEdit = computed(() => !!props.editData)
const dialogTitle = computed(() =>
  isEdit.value ? t('dialogs.adminCaseForm.editTitle') : t('dialogs.adminCaseForm.createTitle'),
)

interface FormModel {
  customerId: string
  caseName: string
  applicantName: string
  residenceStatus: string
  status: AdminCaseStatus
  expireDate: string
  ownerUserId: string
}

const form = reactive<FormModel>({
  customerId: '',
  caseName: '',
  applicantName: '',
  residenceStatus: '',
  status: AdminCaseStatus.DRAFT,
  expireDate: '',
  ownerUserId: '',
})

const rules: FormRules = {
  customerId: [{ required: true, message: t('common.selectField', { field: t('common.customer') }), trigger: 'change' }],
  caseName: [
    { required: true, message: t('common.enterField', { field: t('dialogs.adminCaseForm.caseName') }), trigger: 'blur' },
    { max: 200, message: t('validation.maxChars', { max: 200 }), trigger: 'blur' },
  ],
  applicantName: [
    { max: 120, message: t('validation.maxChars', { max: 120 }), trigger: 'blur' },
  ],
  residenceStatus: [
    { max: 100, message: t('validation.maxChars', { max: 100 }), trigger: 'blur' },
  ],
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
        if (customerOptions.value.length === 0) {
          fetchCustomers('')
        }
      })
    }
  },
)

/**
 * 将既有案件详情写入表单，用于编辑场景回填初始值。
 *
 * @param data - 当前正在编辑的案件记录
 */
function populateForm(data: AdminCaseItem) {
  form.customerId = data.customerId
  form.caseName = data.caseName
  form.applicantName = data.applicantName ?? ''
  form.residenceStatus = data.residenceStatus ?? ''
  form.status = data.status
  form.expireDate = data.expireDate ?? ''
  form.ownerUserId = data.ownerUserId ?? ''
}

/**
 * 重置新建表单的本地状态，并清理上一次校验残留。
 */
function resetForm() {
  form.customerId = props.defaultCustomerId ?? ''
  form.caseName = ''
  form.applicantName = ''
  form.residenceStatus = ''
  form.status = AdminCaseStatus.DRAFT
  form.expireDate = ''
  form.ownerUserId = ''
  nextTick(() => formRef.value?.clearValidate())
}

/**
 * 按关键字远程查询客户列表，供案件表单下拉选择使用。
 *
 * @param query - 用户在客户选择框中输入的检索关键字
 * @returns 请求结束后刷新可选客户列表与加载状态
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
 * 根据表单当前值构造创建或更新案件所需的请求载荷。
 *
 * 空字符串字段会在提交前被裁剪，避免向接口写入无意义的空值。
 *
 * @returns 符合案件保存接口约定的参数对象
 */
function buildPayload(): CreateAdminCaseParams {
  const payload: CreateAdminCaseParams = {
    customerId: form.customerId,
    caseName: form.caseName,
  }

  if (form.applicantName) payload.applicantName = form.applicantName
  if (form.residenceStatus) payload.residenceStatus = form.residenceStatus
  if (form.expireDate) payload.expireDate = form.expireDate
  if (form.ownerUserId) payload.ownerUserId = form.ownerUserId

  return payload
}

/**
 * 校验表单后提交案件新建或编辑请求。
 *
 * @returns 当校验失败、用户关闭弹窗或请求完成时结束提交流程
 */
async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  submitting.value = true
  try {
    const payload = buildPayload()
    if (isEdit.value && props.editData) {
      await updateAdminCase(props.editData.id, payload)
      ElMessage.success(t('dialogs.adminCaseForm.updated'))
    } else {
      await createAdminCase(payload)
      ElMessage.success(t('dialogs.adminCaseForm.created'))
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

      <el-form-item :label="t('dialogs.adminCaseForm.caseName')" prop="caseName">
        <el-input
          v-model="form.caseName"
          :placeholder="t('common.enterField', { field: t('dialogs.adminCaseForm.caseName') })"
          maxlength="200"
        />
      </el-form-item>

      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item :label="t('dialogs.adminCaseForm.applicantName')" prop="applicantName">
            <el-input v-model="form.applicantName" :placeholder="t('dialogs.adminCaseForm.applicantName')" maxlength="120" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item :label="t('dialogs.adminCaseForm.residenceStatus')" prop="residenceStatus">
            <el-input v-model="form.residenceStatus" :placeholder="t('dialogs.adminCaseForm.residenceStatus')" maxlength="100" />
          </el-form-item>
        </el-col>
      </el-row>

      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item :label="t('dialogs.adminCaseForm.expireDate')" prop="expireDate">
            <el-date-picker
              v-model="form.expireDate"
              type="date"
              :placeholder="t('common.selectField', { field: t('dialogs.adminCaseForm.expireDate') })"
              value-format="YYYY-MM-DD"
              style="width: 100%"
            />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item v-if="isEdit" :label="t('dialogs.adminCaseForm.status')">
            <el-tag :type="form.status === AdminCaseStatus.COMPLETED ? 'success' : 'info'">
              {{ AdminCaseStatusLabel[form.status] ?? form.status }}
            </el-tag>
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
