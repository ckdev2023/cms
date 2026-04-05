<script setup lang="ts">
import { inject } from 'vue'

import { FamilyLinkMode } from '@/constants/enums'

import {
  VISA_CASE_WIZARD_KEY,
  type VisaCaseWizardContext,
} from './useVisaCaseWizard'

const wizard = inject(VISA_CASE_WIZARD_KEY) as VisaCaseWizardContext | undefined
if (!wizard) {
  throw new Error(
    'CustomerVisaCaseWizardStepCase must be used inside CustomerVisaCaseWizard',
  )
}

const {
  form,
  T,
  CT,
  staffOptions,
  caseTypeOptions,
  caseStatusOptions,
  materialStatusOptions,
  feeStatusOptions,
  familyLinkModeOptions,
  familyRelationOptions,
  showInternalPrimary,
  showExternalPrimary,
  primaryCustomerOptions,
  primaryCustomerSearchLoading,
  searchPrimaryCustomers,
} = wizard
</script>

<template>
  <el-form
    label-width="120px"
    class="wizard-form"
    @submit.prevent
  >
    <el-form-item :label="CT('caseType')">
      <el-select
        v-model="form.caseType"
        class="wizard-form__case-type"
        filterable
        allow-create
        default-first-option
        clearable
        :placeholder="CT('caseTypePlaceholder')"
      >
        <el-option
          v-for="opt in caseTypeOptions"
          :key="opt.value"
          :label="opt.label"
          :value="opt.value"
        />
      </el-select>
    </el-form-item>

    <el-form-item :label="CT('caseStatus')">
      <el-select v-model="form.caseStatus" style="width: 100%">
        <el-option
          v-for="opt in caseStatusOptions"
          :key="opt.value"
          :label="opt.label"
          :value="opt.value"
        />
      </el-select>
    </el-form-item>

    <el-form-item :label="CT('assignee')">
      <el-select
        v-model="form.assignedTo"
        :placeholder="CT('assigneePlaceholder')"
        clearable
        filterable
        style="width: 100%"
      >
        <el-option
          v-for="opt in staffOptions"
          :key="opt.value"
          :label="opt.label"
          :value="opt.value"
        />
      </el-select>
    </el-form-item>

    <el-form-item :label="CT('expireDate')">
      <div class="wizard-form__expire-date-wrap">
        <el-date-picker
          v-model="form.expireDate"
          type="date"
          value-format="YYYY-MM-DD"
          style="width: 100%"
          clearable
        />
        <el-text
          type="info"
          size="small"
          class="wizard-form__expire-date-hint"
        >
          {{ CT('expireDateHint') }}
        </el-text>
      </div>
    </el-form-item>

    <el-form-item :label="CT('nextFollowUpAt')">
      <el-date-picker
        v-model="form.nextFollowUpAt"
        type="datetime"
        value-format="YYYY-MM-DDTHH:mm"
        style="width: 100%"
        clearable
      />
    </el-form-item>

    <el-form-item :label="CT('materialStatus')">
      <el-select v-model="form.materialStatus" clearable style="width: 100%">
        <el-option
          v-for="opt in materialStatusOptions"
          :key="opt.value"
          :label="opt.label"
          :value="opt.value"
        />
      </el-select>
    </el-form-item>

    <el-form-item :label="CT('feeStatus')">
      <el-select v-model="form.feeStatus" clearable style="width: 100%">
        <el-option
          v-for="opt in feeStatusOptions"
          :key="opt.value"
          :label="opt.label"
          :value="opt.value"
        />
      </el-select>
    </el-form-item>

    <el-divider />

    <el-form-item :label="CT('isFamilyCase')">
      <el-switch v-model="form.isFamilyCase" />
    </el-form-item>

    <el-alert
      v-if="form.isFamilyCase"
      type="info"
      :closable="false"
      show-icon
      class="wizard-smart-hint"
    >
      <template #title>{{ T('familyCaseHintTitle') }}</template>
      <div class="wizard-smart-hint__body">
        {{ T('familyCaseHintBody') }}
      </div>
    </el-alert>

    <el-form-item
      v-if="form.isFamilyCase"
      :label="CT('familyLinkMode')"
      required
    >
      <el-select v-model="form.familyLinkMode" style="width: 100%">
        <el-option
          v-for="opt in familyLinkModeOptions"
          :key="opt.value"
          :label="opt.label"
          :value="opt.value"
        />
      </el-select>
    </el-form-item>

    <div
      v-if="form.isFamilyCase && form.familyLinkMode === FamilyLinkMode.EXTERNAL"
      class="wizard-smart-hint__inline"
    >
      <el-text type="info" size="small">
        {{ T('familyLinkExternalShortHint') }}
      </el-text>
    </div>

    <el-form-item
      v-if="showInternalPrimary"
      :label="CT('internalPrimaryCustomer')"
      required
    >
      <el-select
        v-model="form.internalPrimaryCustomerId"
        :placeholder="CT('internalPrimaryCustomerPlaceholder')"
        filterable
        remote
        :remote-method="searchPrimaryCustomers"
        :loading="primaryCustomerSearchLoading"
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

    <el-form-item
      v-if="showExternalPrimary"
      :label="CT('externalPrimaryName')"
      required
    >
      <el-input
        v-model="form.externalPrimaryName"
        :placeholder="CT('externalPrimaryNamePlaceholder')"
      />
    </el-form-item>

    <el-form-item
      v-if="showExternalPrimary"
      :label="CT('externalPrimaryCaseType')"
    >
      <el-input
        v-model="form.externalPrimaryCaseType"
        :placeholder="CT('externalPrimaryCaseTypePlaceholder')"
      />
    </el-form-item>

    <el-form-item
      v-if="showExternalPrimary"
      :label="CT('externalPrimaryExpireDate')"
    >
      <el-date-picker
        v-model="form.externalPrimaryExpireDate"
        type="date"
        value-format="YYYY-MM-DD"
        style="width: 100%"
        clearable
      />
    </el-form-item>

    <el-form-item
      v-if="showExternalPrimary"
      :label="CT('externalPrimaryRelationToApplicant')"
    >
      <el-select
        v-model="form.externalPrimaryRelationToApplicant"
        clearable
        style="width: 100%"
        :placeholder="CT('externalPrimaryRelationToApplicantPlaceholder')"
      >
        <el-option
          v-for="opt in familyRelationOptions"
          :key="opt.value"
          :label="opt.label"
          :value="opt.value"
        />
      </el-select>
      <el-text
        type="info"
        size="small"
        class="visa-case-external-relation-hint"
      >
        {{ CT('externalPrimaryRelationToApplicantHint') }}
      </el-text>
    </el-form-item>

    <el-divider />

    <el-form-item :label="CT('memo')">
      <el-input
        v-model="form.memo"
        type="textarea"
        :rows="3"
        :placeholder="CT('memoPlaceholder')"
      />
    </el-form-item>
  </el-form>
</template>

<style scoped lang="scss">
.wizard-form {
  max-height: 60vh;
  overflow-y: auto;
  padding-right: 8px;
}

.wizard-form__case-type {
  width: 100%;
}

.wizard-smart-hint {
  margin-bottom: 16px;
}

.wizard-smart-hint__body {
  margin: 0;
  line-height: 1.55;
  white-space: pre-line;
}

.wizard-smart-hint__inline {
  margin: -8px 0 12px;
  line-height: 1.45;
}

.visa-case-external-relation-hint {
  display: block;
  margin-top: 6px;
  line-height: 1.45;
}

.wizard-form__expire-date-wrap {
  width: 100%;
}

.wizard-form__expire-date-hint {
  display: block;
  margin-top: 6px;
  line-height: 1.45;
}
</style>
