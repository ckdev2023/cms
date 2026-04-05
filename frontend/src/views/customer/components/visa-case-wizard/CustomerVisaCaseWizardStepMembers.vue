<script setup lang="ts">
import { Delete, Plus } from '@element-plus/icons-vue'
import { inject, toRef } from 'vue'

import { VisaCaseMemberRole } from '@/constants/enums'

import {
  VISA_CASE_WIZARD_KEY,
  type VisaCaseWizardContext,
} from './useVisaCaseWizard'

const wizard = inject(VISA_CASE_WIZARD_KEY) as VisaCaseWizardContext | undefined
if (!wizard) {
  throw new Error(
    'CustomerVisaCaseWizardStepMembers must be used inside CustomerVisaCaseWizard',
  )
}

const showAddForm = toRef(wizard, 'showAddForm')
const memberAddMode = toRef(wizard, 'memberAddMode')
const creatingInlineMember = toRef(wizard, 'creatingInlineMember')

const {
  T,
  CT,
  t,
  showInternalPrimary,
  showExternalPrimary,
  selectedPrimaryName,
  pendingMembers,
  newMemberForm,
  inlineMiniForm,
  memberCustomerOptions,
  memberCustomerSearchLoading,
  memberRoleOptions,
  canAddMember,
  isDuplicateMember,
  VisaCaseMemberRoleLabel,
  searchMemberCustomers,
  handleMemberCustomerChange,
  handleShowAddForm,
  handleAddPendingMember,
  handleCreateInlineMemberAndAdd,
  handleRemovePendingMember,
} = wizard

/**
 * 根据当前模式提交「选择已有」或「行内新建」家属行。
 */
function handleConfirmAddMember(): void {
  if (memberAddMode.value === 'inline') {
    void handleCreateInlineMemberAndAdd()
    return
  }
  handleAddPendingMember()
}
</script>

<template>
  <div class="wizard-form">
    <el-alert
      type="info"
      :closable="false"
      show-icon
      class="wizard-smart-hint"
    >
      {{ T('membersPreregisterHint') }}
    </el-alert>

    <div class="wizard-primary-summary">
      <div class="wizard-primary-summary__label">
        {{ CT('primaryApplicant') }}
      </div>
      <div class="wizard-primary-summary__value">
        <el-tag
          :type="showInternalPrimary ? 'warning' : 'info'"
          size="default"
        >
          {{ selectedPrimaryName }}
        </el-tag>
        <el-text v-if="showInternalPrimary" type="info" size="small" class="wizard-hint">
          {{ T('primaryAutoHint') }}
        </el-text>
        <el-text v-if="showExternalPrimary" type="info" size="small" class="wizard-hint">
          {{ T('externalPrimaryHint') }}
        </el-text>
      </div>
    </div>

    <el-divider />

    <div class="wizard-members-header">
      <span class="wizard-members-header__title">
        {{ T('additionalMembers') }}
      </span>
      <el-button
        v-if="!showAddForm"
        :icon="Plus"
        size="small"
        @click="handleShowAddForm"
      >
        {{ CT('addMember') }}
      </el-button>
    </div>

    <div v-if="showAddForm" class="wizard-add-form">
      <el-radio-group
        v-model="memberAddMode"
        size="small"
        class="wizard-add-form__mode"
      >
        <el-radio-button value="existing">
          {{ T('memberAddModeExisting') }}
        </el-radio-button>
        <el-radio-button value="inline">
          {{ T('memberAddModeInline') }}
        </el-radio-button>
      </el-radio-group>

      <template v-if="memberAddMode === 'existing'">
        <el-select
          v-model="newMemberForm.customerId"
          :placeholder="CT('addMemberCustomerPlaceholder')"
          filterable
          remote
          :remote-method="searchMemberCustomers"
          :loading="memberCustomerSearchLoading"
          clearable
          class="wizard-add-form__customer"
          @change="handleMemberCustomerChange"
        >
          <el-option
            v-for="opt in memberCustomerOptions"
            :key="opt.value"
            :label="opt.label"
            :value="opt.value"
          />
        </el-select>
        <el-input
          v-model="newMemberForm.displayNameSnapshot"
          :placeholder="CT('memberNamePlaceholder')"
          class="wizard-add-form__name"
        />
      </template>
      <template v-else>
        <el-input
          v-model="inlineMiniForm.customerName"
          :placeholder="T('inlineCustomerNamePlaceholder')"
          class="wizard-add-form__inline-name"
          clearable
        />
        <el-input
          v-model="inlineMiniForm.phone"
          :placeholder="T('inlinePhonePlaceholder')"
          class="wizard-add-form__inline-phone"
          clearable
        />
      </template>

      <el-select
        v-model="newMemberForm.memberRole"
        :placeholder="CT('addMemberRolePlaceholder')"
        class="wizard-add-form__role"
      >
        <el-option
          v-for="opt in memberRoleOptions"
          :key="opt.value"
          :label="opt.label"
          :value="opt.value"
        />
      </el-select>
      <div class="wizard-add-form__actions">
        <el-button
          type="primary"
          size="small"
          :loading="creatingInlineMember"
          :disabled="
            !canAddMember ||
              creatingInlineMember ||
              (memberAddMode === 'existing' && isDuplicateMember)
          "
          @click="handleConfirmAddMember"
        >
          {{ t('common.confirm') }}
        </el-button>
        <el-button size="small" @click="showAddForm = false">
          {{ t('common.cancel') }}
        </el-button>
      </div>
      <div v-if="memberAddMode === 'existing' && isDuplicateMember" class="wizard-add-form__dup-hint">
        <el-text type="warning" size="small">{{ T('duplicateMember') }}</el-text>
      </div>
    </div>

    <div v-if="pendingMembers.length > 0" class="wizard-members-list">
      <div
        v-for="member in pendingMembers"
        :key="member.tempId"
        class="wizard-member-row"
      >
        <el-tag type="info" size="default" class="wizard-member-row__tag">
          {{ member.displayNameSnapshot }}
          ({{ VisaCaseMemberRoleLabel[member.memberRole as VisaCaseMemberRole] ?? member.memberRole }})
          <span v-if="member.createdViaWizardInline" class="wizard-member-row__inline">
            · {{ T('inlineMemberBadge') }}
          </span>
        </el-tag>
        <el-button
          link
          type="danger"
          size="small"
          :icon="Delete"
          @click="handleRemovePendingMember(member.tempId)"
        >
          {{ CT('removeMember') }}
        </el-button>
      </div>
    </div>

    <el-empty
      v-if="pendingMembers.length === 0 && !showAddForm"
      :description="T('pendingMembersEmpty')"
      :image-size="60"
    />

    <el-text type="info" size="small" class="wizard-hint wizard-hint--bottom">
      {{ T('membersHint') }}
    </el-text>
  </div>
</template>

<style scoped lang="scss">
.wizard-form {
  max-height: 60vh;
  overflow-y: auto;
  padding-right: 8px;
}

.wizard-smart-hint {
  margin-bottom: 14px;
  line-height: 1.5;
}

.wizard-primary-summary {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding: 12px 16px;
  background: var(--el-fill-color-lighter);
  border-radius: 6px;

  &__label {
    min-width: 72px;
    font-size: var(--app-font-size-sm);
    font-weight: 500;
    line-height: 32px;
    color: var(--app-text-secondary);
  }

  &__value {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
}

.wizard-hint {
  display: block;
  margin-top: 2px;

  &--bottom {
    display: block;
    margin-top: 12px;
  }
}

.wizard-members-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;

  &__title {
    font-size: var(--app-font-size-sm);
    font-weight: 500;
    color: var(--app-text-primary);
  }
}

.wizard-add-form {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  padding: 12px;
  margin-bottom: 12px;
  background: var(--el-fill-color-lighter);
  border-radius: 6px;

  &__mode {
    width: 100%;
    margin-bottom: 4px;
  }

  &__customer {
    flex: 1;
    min-width: 160px;
  }

  &__role {
    width: 130px;
  }

  &__name {
    flex: 1;
    min-width: 120px;
  }

  &__inline-name {
    flex: 1;
    min-width: 140px;
  }

  &__inline-phone {
    flex: 1;
    min-width: 120px;
  }

  &__actions {
    display: flex;
    gap: 4px;
  }

  &__dup-hint {
    width: 100%;
  }
}

.wizard-members-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.wizard-member-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: var(--el-fill-color-lighter);
  border-radius: 4px;

  &__tag {
    max-width: 320px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__inline {
    margin-left: 4px;
    font-weight: 500;
    color: var(--el-color-success);
  }

  .el-button {
    margin-left: auto;
  }
}
</style>
