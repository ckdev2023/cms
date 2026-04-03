<script setup lang="ts">
import type { FormInstance, FormRules } from 'element-plus'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import type { ProFormField } from '@/types/components'

type FormModel = Record<string, unknown>

interface Props {
  fields: ProFormField[]
  model: FormModel
  rules?: FormRules
  labelWidth?: string
  labelPosition?: 'left' | 'right' | 'top'
  columns?: number
  inline?: boolean
  disabled?: boolean
  showActions?: boolean
  submitText?: string
  cancelText?: string
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  labelWidth: '100px',
  labelPosition: 'right',
  columns: 1,
  inline: false,
  disabled: false,
  rules: undefined,
  showActions: true,
  submitText: undefined,
  cancelText: undefined,
  loading: false,
})

const emit = defineEmits<{
  submit: [model: FormModel]
  cancel: []
}>()

defineOptions({ name: 'ProForm' })

const { t } = useI18n({ useScope: 'global' })
const resolvedSubmitText = computed(() => props.submitText || t('common.save'))
const resolvedCancelText = computed(() => props.cancelText || t('common.cancel'))
// Element Plus 各表单控件的 modelValue 类型不一致，统一代理时需要保留宽类型。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const formModel = computed(() => props.model as Record<string, any>)

function inputPlaceholder(label: string) {
  return t('common.enterField', { field: label })
}

function selectPlaceholder(label: string) {
  return t('common.selectField', { field: label })
}

const formRef = ref<FormInstance>()
const colSpan = computed(() => Math.floor(24 / props.columns))

/**
 * 校验当前动态表单并在通过后抛出提交事件。
 */
async function handleSubmit() {
  if (!formRef.value) return
  const valid = await formRef.value.validate().catch(() => false)
  if (valid) {
    emit('submit', props.model)
  }
}

function handleCancel() {
  emit('cancel')
}

async function validate() {
  return formRef.value?.validate()
}

function resetFields() {
  formRef.value?.resetFields()
}

defineExpose({ validate, resetFields, formRef })
</script>

<template>
  <el-form
    ref="formRef"
    :model="model"
    :rules="rules"
    :label-width="inline ? undefined : labelWidth"
    :label-position="labelPosition"
    :inline="inline"
    :disabled="disabled"
  >
    <template v-if="inline">
      <el-form-item
        v-for="field in fields"
        :key="field.prop"
        :label="field.label"
        :prop="field.prop"
        :rules="field.rules"
      >
        <template v-if="field.slot">
          <slot :name="field.slot" :field="field" :model="model" />
        </template>

        <el-input
          v-else-if="field.type === 'input'"
          v-model="formModel[field.prop]"
          :placeholder="field.placeholder || inputPlaceholder(field.label)"
          :disabled="field.disabled"
          clearable
          v-bind="field.props"
        />

        <el-select
          v-else-if="field.type === 'select'"
          v-model="formModel[field.prop]"
          :placeholder="field.placeholder || selectPlaceholder(field.label)"
          :disabled="field.disabled"
          clearable
          v-bind="field.props"
        >
          <el-option
            v-for="opt in field.options"
            :key="opt.value"
            :label="opt.label"
            :value="opt.value"
            :disabled="opt.disabled"
          />
        </el-select>

        <el-date-picker
          v-else-if="field.type === 'date'"
          v-model="formModel[field.prop]"
          type="date"
          :placeholder="field.placeholder || selectPlaceholder(field.label)"
          :disabled="field.disabled"
          v-bind="field.props"
        />

        <el-date-picker
          v-else-if="field.type === 'daterange'"
          v-model="formModel[field.prop]"
          type="daterange"
          range-separator="〜"
          :start-placeholder="t('common.startDate')"
          :end-placeholder="t('common.endDate')"
          :disabled="field.disabled"
          v-bind="field.props"
        />
      </el-form-item>

      <el-form-item v-if="showActions">
        <slot name="actions">
          <el-button type="primary" :loading="loading" @click="handleSubmit">
            {{ resolvedSubmitText }}
          </el-button>
          <el-button @click="handleCancel">{{ resolvedCancelText }}</el-button>
        </slot>
      </el-form-item>
    </template>

    <template v-else>
      <el-row :gutter="16">
        <el-col
          v-for="field in fields"
          :key="field.prop"
          :span="field.span || colSpan"
        >
          <el-form-item
            :label="field.label"
            :prop="field.prop"
            :rules="field.rules"
          >
            <template v-if="field.slot">
              <slot :name="field.slot" :field="field" :model="model" />
            </template>

            <el-input
              v-else-if="field.type === 'input'"
              v-model="formModel[field.prop]"
              :placeholder="field.placeholder || inputPlaceholder(field.label)"
              :disabled="field.disabled"
              clearable
              v-bind="field.props"
            />

            <el-input
              v-else-if="field.type === 'textarea'"
              v-model="formModel[field.prop]"
              type="textarea"
              :placeholder="field.placeholder || inputPlaceholder(field.label)"
              :disabled="field.disabled"
              :rows="3"
              v-bind="field.props"
            />

            <el-input-number
              v-else-if="field.type === 'number'"
              v-model="formModel[field.prop]"
              :placeholder="field.placeholder"
              :disabled="field.disabled"
              v-bind="field.props"
              style="width: 100%"
            />

            <el-select
              v-else-if="field.type === 'select'"
              v-model="formModel[field.prop]"
              :placeholder="field.placeholder || selectPlaceholder(field.label)"
              :disabled="field.disabled"
              clearable
              v-bind="field.props"
              style="width: 100%"
            >
              <el-option
                v-for="opt in field.options"
                :key="opt.value"
                :label="opt.label"
                :value="opt.value"
                :disabled="opt.disabled"
              />
            </el-select>

            <el-date-picker
              v-else-if="field.type === 'date'"
              v-model="formModel[field.prop]"
              type="date"
              :placeholder="field.placeholder || selectPlaceholder(field.label)"
              :disabled="field.disabled"
              v-bind="field.props"
              style="width: 100%"
            />

            <el-date-picker
              v-else-if="field.type === 'daterange'"
              v-model="formModel[field.prop]"
              type="daterange"
              range-separator="〜"
              :start-placeholder="t('common.startDate')"
              :end-placeholder="t('common.endDate')"
              :disabled="field.disabled"
              v-bind="field.props"
              style="width: 100%"
            />

            <el-radio-group
              v-else-if="field.type === 'radio'"
              v-model="formModel[field.prop]"
              :disabled="field.disabled"
              v-bind="field.props"
            >
              <el-radio
                v-for="opt in field.options"
                :key="opt.value"
                :value="opt.value"
                :disabled="opt.disabled"
              >
                {{ opt.label }}
              </el-radio>
            </el-radio-group>

            <el-checkbox-group
              v-else-if="field.type === 'checkbox'"
              v-model="formModel[field.prop]"
              :disabled="field.disabled"
              v-bind="field.props"
            >
              <el-checkbox
                v-for="opt in field.options"
                :key="opt.value"
                :value="opt.value"
                :disabled="opt.disabled"
              >
                {{ opt.label }}
              </el-checkbox>
            </el-checkbox-group>

            <el-switch
              v-else-if="field.type === 'switch'"
              v-model="formModel[field.prop]"
              :disabled="field.disabled"
              v-bind="field.props"
            />
          </el-form-item>
        </el-col>
      </el-row>

      <div v-if="showActions" class="pro-form__actions">
        <el-form-item>
          <slot name="actions">
            <el-button type="primary" :loading="loading" @click="handleSubmit">
              {{ resolvedSubmitText }}
            </el-button>
            <el-button @click="handleCancel">{{ resolvedCancelText }}</el-button>
          </slot>
        </el-form-item>
      </div>
    </template>
  </el-form>
</template>

<style scoped lang="scss">
.pro-form__actions {
  padding-top: var(--app-spacing-md);
  border-top: 1px solid var(--app-border-color-light);
  margin-top: var(--app-spacing-sm);

  :deep(.el-form-item) {
    margin-bottom: 0;
  }

  :deep(.el-button + .el-button) {
    margin-left: var(--app-spacing-sm);
  }
}
</style>
