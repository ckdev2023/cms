<script setup lang="ts">
import { ref, computed } from 'vue'
import type { FormInstance, FormRules } from 'element-plus'
import type { ProFormField } from '@/types/components'
import { useI18n } from 'vue-i18n'

defineOptions({ name: 'ProForm' })

interface Props {
  fields: ProFormField[]
  model: Record<string, any>
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
  showActions: true,
  submitText: undefined,
  cancelText: undefined,
  loading: false,
})
const { t } = useI18n({ useScope: 'global' })
const resolvedSubmitText = computed(() => props.submitText || t('common.save'))
const resolvedCancelText = computed(() => props.cancelText || t('common.cancel'))

function inputPlaceholder(label: string) {
  return t('common.enterField', { field: label })
}

function selectPlaceholder(label: string) {
  return t('common.selectField', { field: label })
}

const emit = defineEmits<{
  submit: [model: Record<string, any>]
  cancel: []
}>()

const formRef = ref<FormInstance>()
const colSpan = computed(() => Math.floor(24 / props.columns))

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
          v-model="model[field.prop]"
          :placeholder="field.placeholder || inputPlaceholder(field.label)"
          :disabled="field.disabled"
          clearable
          v-bind="field.props"
        />

        <el-select
          v-else-if="field.type === 'select'"
          v-model="model[field.prop]"
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
          v-model="model[field.prop]"
          type="date"
          :placeholder="field.placeholder || selectPlaceholder(field.label)"
          :disabled="field.disabled"
          v-bind="field.props"
        />

        <el-date-picker
          v-else-if="field.type === 'daterange'"
          v-model="model[field.prop]"
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
              v-model="model[field.prop]"
              :placeholder="field.placeholder || inputPlaceholder(field.label)"
              :disabled="field.disabled"
              clearable
              v-bind="field.props"
            />

            <el-input
              v-else-if="field.type === 'textarea'"
              v-model="model[field.prop]"
              type="textarea"
              :placeholder="field.placeholder || inputPlaceholder(field.label)"
              :disabled="field.disabled"
              :rows="3"
              v-bind="field.props"
            />

            <el-input-number
              v-else-if="field.type === 'number'"
              v-model="model[field.prop]"
              :placeholder="field.placeholder"
              :disabled="field.disabled"
              v-bind="field.props"
              style="width: 100%"
            />

            <el-select
              v-else-if="field.type === 'select'"
              v-model="model[field.prop]"
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
              v-model="model[field.prop]"
              type="date"
              :placeholder="field.placeholder || selectPlaceholder(field.label)"
              :disabled="field.disabled"
              v-bind="field.props"
              style="width: 100%"
            />

            <el-date-picker
              v-else-if="field.type === 'daterange'"
              v-model="model[field.prop]"
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
              v-model="model[field.prop]"
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
              v-model="model[field.prop]"
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
              v-model="model[field.prop]"
              :disabled="field.disabled"
              v-bind="field.props"
            />
          </el-form-item>
        </el-col>
      </el-row>

      <el-form-item v-if="showActions">
        <slot name="actions">
          <el-button type="primary" :loading="loading" @click="handleSubmit">
            {{ resolvedSubmitText }}
          </el-button>
          <el-button @click="handleCancel">{{ resolvedCancelText }}</el-button>
        </slot>
      </el-form-item>
    </template>
  </el-form>
</template>
