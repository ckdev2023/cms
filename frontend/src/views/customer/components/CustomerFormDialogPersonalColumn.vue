<script setup lang="ts">
import { inject } from 'vue'
import { useI18n } from 'vue-i18n'

import { customerFormModelKey } from '@/views/customer/customerFormDialogInjection'

defineProps<{
  personalColumnDisabled: boolean
  familyRelationOptions: { value: string; label: string }[]
  primaryCustomerOptions: { value: string; label: string }[]
  primaryCustomerLoading: boolean
}>()

const emit = defineEmits<{
  searchPrimaryCustomers: [query: string]
}>()

defineOptions({ name: 'CustomerFormDialogPersonalColumn' })

const form = inject(customerFormModelKey)
if (!form) {
  throw new Error('CustomerFormDialogPersonalColumn 必须在 CustomerFormDialog 内使用')
}

const { t } = useI18n()

/**
 * 将主客户远程搜索关键字透传给父组件以触发列表加载。
 *
 * @param query - 用户输入的检索关键字
 */
function onRemoteSearch(query: string): void {
  emit('searchPrimaryCustomers', query)
}
</script>

<template>
  <el-col :xs="24" :md="12">
    <div
      class="customer-form-dialog__extension-title"
      :class="{ 'is-inactive': personalColumnDisabled }"
    >
      {{ t('dialogs.customerForm.personalInfo') }}
    </div>
    <el-row :gutter="12" class="customer-form-dialog__extension-inner-row">
      <el-col :span="12">
        <el-form-item
          :label="t('dialogs.customerForm.nationality')"
          prop="nationality"
        >
          <el-input
            v-model="form.nationality"
            class="customer-form-dialog__field-fill"
            :disabled="personalColumnDisabled"
            :placeholder="t('dialogs.customerForm.nationality')"
            maxlength="80"
          />
        </el-form-item>
      </el-col>
      <el-col :span="12">
        <el-form-item
          :label="t('dialogs.customerForm.residenceStatus')"
          prop="residenceStatus"
        >
          <el-input
            v-model="form.residenceStatus"
            class="customer-form-dialog__field-fill"
            :disabled="personalColumnDisabled"
            :placeholder="t('dialogs.customerForm.residenceStatus')"
            maxlength="100"
          />
        </el-form-item>
      </el-col>
    </el-row>

    <div
      class="customer-form-dialog__extension-title customer-form-dialog__extension-title--follow"
      :class="{ 'is-inactive': personalColumnDisabled }"
    >
      {{ t('dialogs.customerForm.familyInfoTitle') }}
    </div>
    <el-form-item
      :label="t('dialogs.customerForm.isFamilyMember')"
      prop="isFamilyMember"
    >
      <el-switch
        v-model="form.isFamilyMember"
        :disabled="personalColumnDisabled"
      />
    </el-form-item>
    <el-form-item
      v-if="form.isFamilyMember"
      :label="t('dialogs.customerForm.familyRelation')"
      prop="familyRelation"
    >
      <el-select
        v-model="form.familyRelation"
        :disabled="personalColumnDisabled"
        :placeholder="t('common.selectField', { field: t('dialogs.customerForm.familyRelation') })"
        style="width: 100%"
      >
        <el-option
          v-for="opt in familyRelationOptions"
          :key="opt.value"
          :label="opt.label"
          :value="opt.value"
        />
      </el-select>
    </el-form-item>
    <el-form-item
      v-if="form.isFamilyMember"
      :label="t('dialogs.customerForm.primaryCustomer')"
      prop="primaryCustomerId"
    >
      <el-select
        v-model="form.primaryCustomerId"
        :disabled="personalColumnDisabled"
        :placeholder="t('common.selectField', { field: t('dialogs.customerForm.primaryCustomer') })"
        filterable
        remote
        :remote-method="onRemoteSearch"
        :loading="primaryCustomerLoading"
        clearable
        style="width: 100%"
      >
        <el-option
          v-for="opt in primaryCustomerOptions"
          :key="opt.value"
          :label="opt.label"
          :value="opt.value"
        />
      </el-select>
    </el-form-item>
  </el-col>
</template>

<style scoped>
.customer-form-dialog__extension-inner-row {
  width: 100%;
}

.customer-form-dialog__extension-title {
  font-size: 13px;
  font-weight: 600;
  line-height: 1.35;
  color: var(--el-text-color-primary);
  margin: 0 0 8px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  min-height: 22px;
}

.customer-form-dialog__extension-title--follow {
  margin-top: 10px;
}

.customer-form-dialog__extension-title.is-inactive {
  color: var(--el-text-color-secondary);
  font-weight: 500;
}

.customer-form-dialog__field-fill {
  width: 100%;
}
</style>
