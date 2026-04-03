<script setup lang="ts">
import { inject } from 'vue'
import { useI18n } from 'vue-i18n'

import { customerFormModelKey } from '@/views/customer/customerFormDialogInjection'

defineProps<{
  companyColumnDisabled: boolean
}>()

defineOptions({ name: 'CustomerFormDialogCompanyColumn' })

const form = inject(customerFormModelKey)
if (!form) {
  throw new Error('CustomerFormDialogCompanyColumn 必须在 CustomerFormDialog 内使用')
}

const { t } = useI18n()
</script>

<template>
  <el-col :xs="24" :md="12">
    <div
      class="customer-form-dialog__extension-title"
      :class="{ 'is-inactive': companyColumnDisabled }"
    >
      {{ t('dialogs.customerForm.companyInfo') }}
    </div>
    <el-row :gutter="12" class="customer-form-dialog__extension-inner-row">
      <el-col :span="12">
        <el-form-item
          :label="t('dialogs.customerForm.corporationNumber')"
          prop="corporationNumber"
        >
          <el-input
            v-model="form.corporationNumber"
            class="customer-form-dialog__field-fill"
            :disabled="companyColumnDisabled"
            :placeholder="t('dialogs.customerForm.corporationNumber')"
            maxlength="50"
          />
        </el-form-item>
      </el-col>
      <el-col :span="12">
        <el-form-item
          :label="t('dialogs.customerForm.fiscalMonth')"
          prop="fiscalMonth"
        >
          <el-input-number
            v-model="form.fiscalMonth"
            :disabled="companyColumnDisabled"
            :min="1"
            :max="12"
            :placeholder="t('dialogs.customerForm.month')"
            controls-position="right"
            class="customer-form-dialog__fiscal-month"
          />
        </el-form-item>
      </el-col>
    </el-row>
    <el-form-item
      :label="t('dialogs.customerForm.representativeName')"
      prop="representativeName"
    >
      <el-input
        v-model="form.representativeName"
        class="customer-form-dialog__field-fill"
        :disabled="companyColumnDisabled"
        :placeholder="t('dialogs.customerForm.representativeName')"
        maxlength="120"
      />
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

.customer-form-dialog__extension-title.is-inactive {
  color: var(--el-text-color-secondary);
  font-weight: 500;
}

.customer-form-dialog__fiscal-month {
  width: 100%;
}

.customer-form-dialog__field-fill {
  width: 100%;
}
</style>
