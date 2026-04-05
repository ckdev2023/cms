<script setup lang="ts">
import { inject, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  loadPersonResidenceStatusOptions,
  mergeLegacyPersonResidenceStatusOption,
  type PersonResidenceStatusOption,
} from '@/utils/person-residence-status-options'
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

const formInjected = inject(customerFormModelKey)
if (!formInjected) {
  throw new Error('CustomerFormDialogPersonalColumn 必须在 CustomerFormDialog 内使用')
}
const form = formInjected

const { t } = useI18n()

const residenceStatusOptions = ref<PersonResidenceStatusOption[]>([])

onMounted(() => {
  void (async () => {
    await loadPersonResidenceStatusOptions(residenceStatusOptions)
    mergeLegacyPersonResidenceStatusOption(residenceStatusOptions, form.residenceStatus)
  })()
})

watch(
  () => form.residenceStatus,
  (v) => {
    mergeLegacyPersonResidenceStatusOption(
      residenceStatusOptions,
      typeof v === 'string' ? v : '',
    )
  },
)

/**
 * 将主客户远程搜索关键字透传给父组件以触发列表加载。
 *
 * @param query - 用户输入的检索关键字
 */
function onRemoteSearch(query: string): void {
  emit('searchPrimaryCustomers', query)
}

/**
 * 将下拉选中值写回表单字符串，并截断至 100 字以契合同步后端在留资格 MaxLength。
 *
 * @param v - Element Plus 下拉的选中值，清空时为 null/undefined
 */
function onResidenceStatusSelect(v: string | null | undefined): void {
  const s = (v ?? '').trim()
  form.residenceStatus = s.length > 100 ? s.slice(0, 100) : s
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
    <!-- 半宽栏内不再二次分栏，避免输入区被压到约 1/4 抽屉宽度 -->
    <el-row :gutter="12" class="customer-form-dialog__extension-inner-row">
      <el-col :span="24">
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
      <el-col :span="24">
        <el-form-item
          :label="t('dialogs.customerForm.residenceStatus')"
          prop="residenceStatus"
        >
          <el-select
            :model-value="form.residenceStatus === '' ? undefined : form.residenceStatus"
            class="customer-form-dialog__field-fill"
            filterable
            allow-create
            default-first-option
            clearable
            :disabled="personalColumnDisabled"
            :placeholder="t('common.selectField', { field: t('dialogs.customerForm.residenceStatus') })"
            @update:model-value="onResidenceStatusSelect"
          >
            <el-option
              v-for="opt in residenceStatusOptions"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </el-form-item>
      </el-col>
      <el-col :span="24">
        <el-form-item
          :label="t('dialogs.customerForm.passportNumber')"
          prop="passportNumber"
        >
          <el-input
            v-model="form.passportNumber"
            class="customer-form-dialog__field-fill"
            :disabled="personalColumnDisabled"
            :placeholder="t('dialogs.customerForm.passportNumberPlaceholder')"
            maxlength="64"
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
    <el-text
      size="small"
      type="info"
      class="customer-form-dialog__family-semantics-hint"
    >
      {{ t('dialogs.customerForm.familyMemberSemanticsHint') }}
    </el-text>
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

.customer-form-dialog__family-semantics-hint {
  display: block;
  margin: 0 0 10px;
  line-height: 1.5;
}
</style>
