<script setup lang="ts">
import { ArrowDown } from '@element-plus/icons-vue'
import type { FormInstance, FormRules } from 'element-plus'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { VisaCaseLogTypeLabel } from '@/constants/enum-labels'
import { VisaCaseLogType } from '@/constants/enums'
import type { VisaCaseLogFormModelState } from '@/types/visa-case'
import type { VisaCaseLogContentTemplate } from '@/utils/visa-case-log-content-templates'
import type { VisaCaseLogMissingReuseCandidate } from '@/utils/visa-case-log-missing-reuse'

const props = defineProps<{
  formRules: FormRules
  isEdit: boolean
  contentTemplates: VisaCaseLogContentTemplate[]
  logSourceForReuseMissing: VisaCaseLogMissingReuseCandidate | null
  submitting: boolean
  insertContentSnippet: (command: unknown) => void
  applyReuseMissing: () => void
}>()

const emit = defineEmits<{
  cancel: []
  submit: []
}>()

defineOptions({ name: 'CustomerVisaCaseLogsFormCard' })

const formModel = defineModel<VisaCaseLogFormModelState>({ required: true })
const showPrefillHint = defineModel<boolean>('showPrefillHint', { required: true })

const { t } = useI18n({ useScope: 'global' })
const T = (key: string, params?: Record<string, unknown>) => t(`detailViews.customer.visaCaseLogsTab.${key}`, params ?? {})

const formRef = ref<FormInstance>()

const logTypeOptions = Object.values(VisaCaseLogType).map((value) => ({
  value,
  label: VisaCaseLogTypeLabel[value] ?? value,
}))

defineExpose({
  validate: () => formRef.value?.validate().catch(() => false),
  resetFields: () => formRef.value?.resetFields(),
  clearValidate: () => formRef.value?.clearValidate(),
})

/**
 * 校验通过后向父组件触发提交，由父级调用保存接口。
 */
async function requestSubmit(): Promise<void> {
  const ok = await formRef.value?.validate().catch(() => false)
  if (!ok) {
    return
  }
  emit('submit')
}
</script>

<template>
  <el-card shadow="never" class="case-logs-tab__form-card">
    <template #header>
      <span>{{ props.isEdit ? T('editTitle') : T('createTitle') }}</span>
    </template>
    <el-alert
      v-if="showPrefillHint && !props.isEdit"
      :title="T('prefillHint')"
      type="info"
      show-icon
      closable
      class="case-logs-tab__prefill-hint"
      @close="showPrefillHint = false"
    />
    <el-form ref="formRef" :model="formModel" :rules="props.formRules" label-width="120px" label-position="top">
      <el-form-item :label="T('logType')" prop="logType">
        <el-radio-group v-model="formModel.logType">
          <el-radio-button v-for="opt in logTypeOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</el-radio-button>
        </el-radio-group>
      </el-form-item>
      <el-form-item prop="content">
        <template #label>
          <span class="case-logs-tab__form-label-row">
            <span>{{ T('content') }}</span>
            <el-dropdown v-if="props.contentTemplates.length > 0" trigger="click" @command="props.insertContentSnippet">
              <el-button type="primary" link size="small" class="case-logs-tab__snippet-trigger">
                {{ T('snippetMenu') }}
                <el-icon class="case-logs-tab__snippet-caret"><ArrowDown /></el-icon>
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item v-for="(tpl, idx) in props.contentTemplates" :key="idx" :command="tpl.text">
                    {{ tpl.label }}
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </span>
        </template>
        <el-input v-model="formModel.content" type="textarea" :rows="4" :placeholder="T('contentPlaceholder')" maxlength="5000" show-word-limit />
      </el-form-item>
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item :label="T('submittedItems')">
            <el-input v-model="formModel.submittedItems" type="textarea" :rows="2" :placeholder="T('submittedItemsPlaceholder')" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item>
            <template #label>
              <span class="case-logs-tab__form-label-row">
                <span>{{ T('missingItems') }}</span>
                <el-tooltip :content="T('reuseMissingTooltip')" placement="top">
                  <el-button
                    type="primary"
                    link
                    size="small"
                    :disabled="!props.logSourceForReuseMissing"
                    @click="props.applyReuseMissing"
                  >
                    {{ T('reuseMissing') }}
                  </el-button>
                </el-tooltip>
              </span>
            </template>
            <el-input v-model="formModel.missingItems" type="textarea" :rows="2" :placeholder="T('missingItemsPlaceholder')" />
          </el-form-item>
        </el-col>
      </el-row>
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item :label="T('nextAction')">
            <el-input v-model="formModel.nextAction" :placeholder="T('nextActionPlaceholder')" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item :label="T('nextFollowUpAt')">
            <el-date-picker v-model="formModel.nextFollowUpAt" type="datetime" value-format="YYYY-MM-DDTHH:mm" style="width: 100%" clearable />
          </el-form-item>
        </el-col>
      </el-row>
      <div class="case-logs-tab__form-actions">
        <el-button @click="emit('cancel')">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" :loading="props.submitting" @click="requestSubmit">{{ props.isEdit ? t('common.update') : t('common.create') }}</el-button>
      </div>
    </el-form>
  </el-card>
</template>

<style scoped lang="scss" src="./CustomerVisaCaseLogsTab.scoped.scss"></style>
