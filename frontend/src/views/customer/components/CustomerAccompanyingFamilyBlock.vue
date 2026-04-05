<script setup lang="ts">
import { Delete, Plus } from '@element-plus/icons-vue'
import { computed, inject } from 'vue'
import { useI18n } from 'vue-i18n'

import { customerFormModelKey } from '@/views/customer/customerFormDialogInjection'
import {
  createEmptyAccompanyingMemberRow,
  primaryResidenceHasValueForAccompanyingCopy,
} from '@/views/customer/customerFormDialogModel'

defineProps<{
  disabled: boolean
  familyRelationOptions: { value: string; label: string }[]
}>()

defineOptions({ name: 'CustomerAccompanyingFamilyBlock' })

const injectedForm = inject(customerFormModelKey)
if (!injectedForm) {
  throw new Error('CustomerAccompanyingFamilyBlock 必须在 CustomerFormDialog 内使用')
}
const form = injectedForm

const { t } = useI18n()

/**
 * 主档在留资格或期限是否至少一项可写入新建随附家属（与 Checkbox 禁用条件一致）。
 */
const primaryResidenceAvailable = computed((): boolean =>
  primaryResidenceHasValueForAccompanyingCopy(form),
)

/**
 * 在表单末尾追加一行空的随附家属录入行。
 */
function addRow(): void {
  form.accompanyingMembers.push(createEmptyAccompanyingMemberRow())
}

/**
 * 按索引移除一行随附家属录入行。
 *
 * @param index - 待删除行在 `accompanyingMembers` 中的下标
 */
function removeRow(index: number): void {
  form.accompanyingMembers.splice(index, 1)
}
</script>

<template>
  <el-col :span="24">
    <div
      class="customer-form-dialog__extension-title customer-form-dialog__extension-title--accompanying"
      :class="{ 'is-inactive': disabled }"
    >
      {{ t('dialogs.customerForm.accompanyingFamilyTitle') }}
    </div>
    <el-text
      size="small"
      type="info"
      class="customer-accompanying-family__hint"
    >
      {{ t('dialogs.customerForm.accompanyingFamilyHint') }}
    </el-text>

    <div class="customer-accompanying-family__residence-copy">
      <el-tooltip
        :content="t('dialogs.customerForm.copyPrimaryResidenceToAccompanyingDisabledHint')"
        placement="top"
        :disabled="primaryResidenceAvailable"
      >
        <span class="customer-accompanying-family__checkbox-wrap">
          <el-checkbox
            v-model="form.copyPrimaryResidenceToNewAccompanyingMembers"
            :disabled="disabled || !primaryResidenceAvailable"
          >
            {{ t('dialogs.customerForm.copyPrimaryResidenceToAccompanyingLabel') }}
          </el-checkbox>
        </span>
      </el-tooltip>
    </div>

    <div class="customer-accompanying-family__table" :class="{ 'is-disabled': disabled }">
      <div class="customer-accompanying-family__head">
        <span class="customer-accompanying-family__cell customer-accompanying-family__cell--name">
          {{ t('dialogs.customerForm.accompanyingFamilyColName') }}
        </span>
        <span class="customer-accompanying-family__cell customer-accompanying-family__cell--relation">
          {{ t('dialogs.customerForm.familyRelation') }}
        </span>
        <span class="customer-accompanying-family__cell customer-accompanying-family__cell--passport">
          {{ t('dialogs.customerForm.passportNumber') }}
        </span>
        <span class="customer-accompanying-family__cell customer-accompanying-family__cell--phone">
          {{ t('common.phone') }}
        </span>
        <span class="customer-accompanying-family__cell customer-accompanying-family__cell--actions" />
      </div>

      <div
        v-for="(row, index) in form.accompanyingMembers"
        :key="row.clientKey"
        class="customer-accompanying-family__row"
      >
        <div class="customer-accompanying-family__cell customer-accompanying-family__cell--name">
          <el-input
            v-model="row.customerName"
            :disabled="disabled"
            :placeholder="t('common.enterField', { field: t('dialogs.customerForm.accompanyingFamilyColName') })"
            maxlength="200"
          />
        </div>
        <div class="customer-accompanying-family__cell customer-accompanying-family__cell--relation">
          <el-select
            v-model="row.familyRelation"
            :disabled="disabled"
            clearable
            :placeholder="t('common.selectField', { field: t('dialogs.customerForm.familyRelation') })"
            class="customer-accompanying-family__select"
          >
            <el-option
              v-for="opt in familyRelationOptions"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </div>
        <div class="customer-accompanying-family__cell customer-accompanying-family__cell--passport">
          <el-input
            v-model="row.passportNumber"
            :disabled="disabled"
            :placeholder="t('dialogs.customerForm.passportNumberPlaceholder')"
            maxlength="64"
          />
        </div>
        <div class="customer-accompanying-family__cell customer-accompanying-family__cell--phone">
          <el-input
            v-model="row.phone"
            :disabled="disabled"
            placeholder="03-1234-5678"
            maxlength="50"
          />
        </div>
        <div class="customer-accompanying-family__cell customer-accompanying-family__cell--actions">
          <el-button
            type="danger"
            link
            :disabled="disabled"
            :icon="Delete"
            @click="removeRow(index)"
          >
            {{ t('common.delete') }}
          </el-button>
        </div>
      </div>

      <el-button
        class="customer-accompanying-family__add"
        type="primary"
        link
        :disabled="disabled"
        :icon="Plus"
        @click="addRow"
      >
        {{ t('dialogs.customerForm.accompanyingFamilyAddRow') }}
      </el-button>
    </div>
  </el-col>
</template>

<style scoped>
.customer-form-dialog__extension-title--accompanying {
  margin-top: 14px;
}

.customer-accompanying-family__hint {
  display: block;
  margin: 0 0 10px;
  line-height: 1.5;
}

.customer-accompanying-family__residence-copy {
  margin: 0 0 10px;
}

.customer-accompanying-family__checkbox-wrap {
  display: inline-flex;
  vertical-align: middle;
}

.customer-accompanying-family__table {
  padding: 10px 12px 8px;
  border-radius: 8px;
  background-color: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color-lighter);
}

.customer-accompanying-family__table.is-disabled {
  opacity: 0.85;
}

.customer-accompanying-family__head,
.customer-accompanying-family__row {
  display: grid;
  grid-template-columns: minmax(120px, 1.2fr) minmax(100px, 0.9fr) minmax(100px, 1fr) minmax(
      100px,
      1fr
    )
    auto;
  gap: 8px 10px;
  align-items: center;
}

.customer-accompanying-family__head {
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-secondary);
  margin-bottom: 6px;
  padding: 0 2px;
}

.customer-accompanying-family__row {
  margin-bottom: 8px;
}

.customer-accompanying-family__row:last-of-type {
  margin-bottom: 4px;
}

.customer-accompanying-family__select {
  width: 100%;
}

.customer-accompanying-family__add {
  padding-left: 2px;
  margin-top: 2px;
}

@media (max-width: 768px) {
  .customer-accompanying-family__head {
    display: none;
  }

  .customer-accompanying-family__row {
    grid-template-columns: 1fr;
    padding-bottom: 8px;
    border-bottom: 1px dashed var(--el-border-color-lighter);
  }

  .customer-accompanying-family__row:last-of-type {
    border-bottom: none;
  }

  .customer-accompanying-family__cell--actions {
    justify-self: flex-start;
  }
}
</style>
