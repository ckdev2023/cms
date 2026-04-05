<script setup lang="ts">
import CustomerVisaCaseWizardPreview from './visa-case-wizard/CustomerVisaCaseWizardPreview.vue'
import CustomerVisaCaseWizardStepCase from './visa-case-wizard/CustomerVisaCaseWizardStepCase.vue'
import CustomerVisaCaseWizardStepMembers from './visa-case-wizard/CustomerVisaCaseWizardStepMembers.vue'
import { useVisaCaseWizard } from './visa-case-wizard/useVisaCaseWizard'

const props = defineProps<{
  visible: boolean
  customerId: string
  /** 本页客户姓名，用于侧栏「申请人」展示 */
  contextCustomerName?: string
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  created: []
}>()

const wizard = useVisaCaseWizard(props, emit)

const {
  T,
  t,
  form,
  currentStep,
  totalSteps,
  submitting,
  canProceedStep1,
  handlePrev,
  handleNext,
  handleSubmit,
  closeDialog,
} = wizard
</script>

<template>
  <el-dialog
    :model-value="visible"
    :title="T('title')"
    width="920px"
    destroy-on-close
    :close-on-click-modal="false"
    class="visa-case-wizard-dialog"
    @update:model-value="emit('update:visible', $event)"
  >
    <div class="wizard-body">
      <div class="wizard-body__main">
        <el-steps
          v-if="totalSteps > 1"
          :active="currentStep"
          finish-status="success"
          align-center
          class="wizard-steps"
        >
          <el-step :title="T('stepCase')" />
          <el-step :title="T('stepMembers')" />
        </el-steps>

        <CustomerVisaCaseWizardStepCase v-show="currentStep === 0" />
        <CustomerVisaCaseWizardStepMembers v-show="currentStep === 1" />
      </div>
      <aside class="wizard-body__preview" aria-label="visa-case-wizard-preview">
        <CustomerVisaCaseWizardPreview />
      </aside>
    </div>

    <template #footer>
      <div class="wizard-footer">
        <el-button v-if="currentStep > 0" @click="handlePrev">
          {{ T('prev') }}
        </el-button>
        <el-button @click="closeDialog">
          {{ t('common.cancel') }}
        </el-button>
        <el-button
          v-if="form.isFamilyCase && currentStep < totalSteps - 1"
          type="primary"
          :disabled="!canProceedStep1"
          @click="handleNext"
        >
          {{ T('next') }}
        </el-button>
        <el-button
          v-if="!form.isFamilyCase || currentStep === totalSteps - 1"
          type="primary"
          :loading="submitting"
          :disabled="!canProceedStep1"
          @click="handleSubmit"
        >
          {{ T('create') }}
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">
.wizard-body {
  display: flex;
  gap: 20px;
  align-items: flex-start;
}

.wizard-body__main {
  flex: 1;
  min-width: 0;
}

.wizard-body__preview {
  flex: 0 0 248px;
  max-width: 248px;
}

.wizard-steps {
  margin-bottom: 24px;
}

.wizard-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>

<style lang="scss">
/* el-dialog 默认 body padding 较窄，侧栏与主区并排时需略收紧避免横向滚动 */
.visa-case-wizard-dialog.el-dialog .el-dialog__body {
  padding-top: 12px;
}
</style>
