<script setup lang="ts">
import { Plus } from '@element-plus/icons-vue'
import type { UploadRequestOptions } from 'element-plus'
import { ElMessage } from 'element-plus'
import { computed, ref } from 'vue'

import { getFilePreviewUrl,uploadFile } from '@/api/file'
import {
  type CustomerFormDialogEmitDecl,
  type CustomerFormDialogProps,
  useCustomerFormDialog,
} from '@/composables/useCustomerFormDialog'
import { BusinessType } from '@/constants/enums'
import { P } from '@/constants/permissions'
import { useUserStore } from '@/stores/user'
import CustomerAccompanyingFamilyBlock from '@/views/customer/components/CustomerAccompanyingFamilyBlock.vue'
import CustomerFormDialogCompanyColumn from '@/views/customer/components/CustomerFormDialogCompanyColumn.vue'
import CustomerFormDialogPersonalColumn from '@/views/customer/components/CustomerFormDialogPersonalColumn.vue'

const props = defineProps<CustomerFormDialogProps>()
const emit = defineEmits<CustomerFormDialogEmitDecl>()
defineOptions({ name: 'CustomerFormDialog' })

const userStore = useUserStore()
const photoUploading = ref(false)

const {
  accompanyingFamilyFeatureActive,
  companyColumnDisabled,
  dialogTitle,
  familyRelationOptions,
  form,
  formRef,
  handleClose,
  handleSubmit,
  isEdit,
  personalColumnDisabled,
  primaryCustomerLoading,
  primaryCustomerOptions,
  rules,
  searchPrimaryCustomers,
  serviceTypeOptions,
  staffLoading,
  staffOptions,
  submitting,
  t,
} = useCustomerFormDialog(props, emit)

const canUploadCustomerPhoto = computed((): boolean => {
  if (!userStore.hasPermission(P.FILE_UPLOAD)) {
    return false
  }
  return isEdit.value
    ? userStore.hasPermission(P.CUSTOMER_EDIT)
    : userStore.hasPermission(P.CUSTOMER_CREATE)
})

const customerFormPhotoPreviewSrc = computed((): string => {
  const id = form.photoFileId?.trim()
  return id ? getFilePreviewUrl(id) : ''
})

/**
 * 使用文件中心上传接口写入 CUSTOMER 业务图片，并在成功后回填表单中的 `photoFileId`。
 *
 * @param options - Element Plus `el-upload` 自定义上传选项（含本地文件与回调）
 * @returns Promise，在上传结束或失败后落定
 */
async function handleCustomerPhotoHttpRequest(options: UploadRequestOptions): Promise<void> {
  const raw = options.file
  const file = raw instanceof File ? raw : null
  if (!file) {
    options.onError?.(
      { name: 'Error', message: 'missing file', status: 0, method: 'POST', url: '' } as Parameters<
        NonNullable<UploadRequestOptions['onError']>
      >[0],
    )
    return
  }
  photoUploading.value = true
  try {
    const res = await uploadFile({
      file,
      businessType: BusinessType.CUSTOMER,
      customerId: props.editData?.id,
    })
    form.photoFileId = res.data.id
    ElMessage.success(t('dialogs.customerForm.customerPhotoUploadSuccess'))
    options.onSuccess?.(res.data)
  } catch {
    options.onError?.(
      { name: 'Error', message: 'upload failed', status: 0, method: 'POST', url: '' } as Parameters<
        NonNullable<UploadRequestOptions['onError']>
      >[0],
    )
  } finally {
    photoUploading.value = false
  }
}

/** 清空表单中的头像文件引用（保存时以 `photoFileId: null` 提交）。 */
function clearCustomerFormPhoto(): void {
  form.photoFileId = ''
}

defineExpose({ formRef })
</script>

<template>
  <el-drawer
    :model-value="modelValue"
    :title="dialogTitle"
    direction="rtl"
    size="960px"
    destroy-on-close
    append-to-body
    class="customer-form-dialog customer-form-drawer"
    @close="handleClose"
  >
    <el-form
      ref="formRef"
      class="customer-form-drawer__form"
      :model="form"
      :rules="rules"
      label-width="120px"
      label-position="right"
    >
      <section
        class="customer-form-drawer__section"
        :aria-label="t('dialogs.customerForm.sectionIdentityTitle')"
      >
        <h3 class="customer-form-drawer__section-title">
          {{ t('dialogs.customerForm.sectionIdentityTitle') }}
        </h3>
        <el-form-item :label="t('dialogs.customerForm.customerName')" prop="customerName">
          <el-input
            v-model="form.customerName"
            :placeholder="t('common.enterField', { field: t('dialogs.customerForm.customerName') })"
            maxlength="200"
          />
        </el-form-item>

        <el-form-item :label="t('dialogs.customerForm.customerPhoto')">
          <div class="customer-form-drawer__photo-block">
            <el-avatar :size="72" :src="customerFormPhotoPreviewSrc || undefined">
              {{ form.customerName?.trim().charAt(0) || '?' }}
            </el-avatar>
            <div class="customer-form-drawer__photo-actions">
              <el-upload
                v-if="canUploadCustomerPhoto"
                :show-file-list="false"
                accept="image/jpeg,image/png,image/gif,image/webp,.jpg,.jpeg,.png,.gif,.webp"
                :disabled="photoUploading"
                :http-request="handleCustomerPhotoHttpRequest"
              >
                <el-button type="primary" plain :loading="photoUploading" :icon="Plus">
                  {{ t('dialogs.customerForm.customerPhotoUpload') }}
                </el-button>
              </el-upload>
              <el-button
                v-if="canUploadCustomerPhoto && form.photoFileId?.trim()"
                type="danger"
                link
                @click="clearCustomerFormPhoto"
              >
                {{ t('dialogs.customerForm.customerPhotoClear') }}
              </el-button>
            </div>
          </div>
          <el-text
            v-if="!canUploadCustomerPhoto"
            size="small"
            type="warning"
            class="customer-form-drawer__photo-perm-hint"
          >
            {{ t('dialogs.customerForm.customerPhotoNoUploadPermission') }}
          </el-text>
          <el-text v-else size="small" type="info" class="customer-form-drawer__photo-hint">
            {{ t('dialogs.customerForm.customerPhotoHint') }}
          </el-text>
        </el-form-item>
      </section>

      <section
        class="customer-form-drawer__section"
        :aria-label="t('dialogs.customerForm.sectionContactTitle')"
      >
        <h3 class="customer-form-drawer__section-title">
          {{ t('dialogs.customerForm.sectionContactTitle') }}
        </h3>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item :label="t('common.phone')" prop="phone">
              <el-input v-model="form.phone" placeholder="03-1234-5678" maxlength="50" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="t('common.email')" prop="email">
              <el-input v-model="form.email" placeholder="example@mail.com" maxlength="120" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="16" class="customer-form-drawer__row-tight-top">
          <el-col :span="12">
            <el-form-item :label="t('dialogs.customerForm.wechatId')" prop="wechatId">
              <el-input
                v-model="form.wechatId"
                :placeholder="t('dialogs.customerForm.wechatIdPlaceholder')"
                maxlength="50"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="t('dialogs.customerForm.lineId')" prop="lineId">
              <el-input
                v-model="form.lineId"
                :placeholder="t('dialogs.customerForm.lineIdPlaceholder')"
                maxlength="50"
              />
            </el-form-item>
          </el-col>
        </el-row>
        <div class="customer-form-drawer__callout" role="note">
          <el-text size="small" type="info" class="customer-form-drawer__callout-text">
            {{ t('dialogs.customerForm.wechatLineContactHint') }}
          </el-text>
        </div>

        <el-form-item :label="t('dialogs.customerForm.address')" prop="address">
          <el-input
            v-model="form.address"
            :placeholder="t('common.enterField', { field: t('dialogs.customerForm.address') })"
            maxlength="500"
          />
        </el-form-item>
      </section>

      <section
        class="customer-form-drawer__section"
        :aria-label="t('dialogs.customerForm.sectionServiceTitle')"
      >
        <h3 class="customer-form-drawer__section-title">
          {{ t('dialogs.customerForm.sectionServiceTitle') }}
        </h3>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item :label="t('dialogs.customerForm.serviceType')" prop="serviceType">
              <el-select
                v-model="form.serviceType"
                class="customer-form-dialog__field-fill"
                :placeholder="t('common.selectField', { field: t('dialogs.customerForm.serviceType') })"
              >
                <el-option
                  v-for="opt in serviceTypeOptions"
                  :key="opt.value"
                  :label="opt.label"
                  :value="opt.value"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="t('dialogs.customerForm.ownerUserId')" prop="ownerUserId">
              <el-select
                v-model="form.ownerUserId"
                filterable
                clearable
                :loading="staffLoading"
                class="customer-form-dialog__field-fill"
                :placeholder="t('dialogs.customerForm.ownerUserIdPlaceholder')"
              >
                <el-option
                  v-for="opt in staffOptions"
                  :key="opt.value"
                  :label="opt.label"
                  :value="opt.value"
                />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <div class="customer-form-drawer__callout" role="note">
          <el-text size="small" type="info" class="customer-form-drawer__callout-text">
            {{ t('dialogs.customerForm.ownerUserIdHint') }}
          </el-text>
          <el-text
            v-if="!staffLoading && staffOptions.length === 0"
            size="small"
            type="warning"
            class="customer-form-drawer__callout-text customer-form-drawer__callout-text--stack"
          >
            {{ t('dialogs.customerForm.ownerUserIdListEmptyHint') }}
          </el-text>
        </div>
      </section>

      <section
        class="customer-form-drawer__section customer-form-drawer__section--panel"
        :aria-label="t('dialogs.customerForm.sectionExtensionTitle')"
      >
        <h3 class="customer-form-drawer__section-title customer-form-drawer__section-title--in-panel">
          {{ t('dialogs.customerForm.sectionExtensionTitle') }}
        </h3>
        <p class="customer-form-drawer__section-lead">
          <el-text size="small" type="info">
            {{ t('dialogs.customerForm.sectionExtensionHint') }}
          </el-text>
        </p>
        <el-row :gutter="20" class="customer-form-dialog__extension" align="top">
          <CustomerFormDialogPersonalColumn
            :personal-column-disabled="personalColumnDisabled"
            :family-relation-options="familyRelationOptions"
            :primary-customer-options="primaryCustomerOptions"
            :primary-customer-loading="primaryCustomerLoading"
            @search-primary-customers="searchPrimaryCustomers"
          />
          <CustomerFormDialogCompanyColumn
            :company-column-disabled="companyColumnDisabled"
          />
        </el-row>
      </section>

      <el-row
        v-if="accompanyingFamilyFeatureActive"
        :gutter="20"
        class="customer-form-dialog__accompanying-row"
      >
        <CustomerAccompanyingFamilyBlock
          :disabled="personalColumnDisabled"
          :family-relation-options="familyRelationOptions"
        />
      </el-row>

      <el-row :gutter="20" class="customer-form-dialog__visa-row">
        <el-col :span="24">
          <h3
            class="customer-form-drawer__section-title customer-form-drawer__section-title--visa"
            :class="{ 'is-inactive': personalColumnDisabled }"
          >
            {{ t('dialogs.customerForm.visaInfoTitle') }}
          </h3>
          <div
            class="customer-form-dialog__visa-panel"
            :class="{ 'is-inactive': personalColumnDisabled }"
          >
            <el-row :gutter="16" class="customer-form-dialog__visa-inner-row">
              <el-col :span="12">
                <el-form-item
                  :label="t('dialogs.customerForm.residenceExpireDate')"
                  prop="residenceExpireDate"
                >
                  <el-date-picker
                    v-model="form.residenceExpireDate"
                    type="date"
                    :disabled="personalColumnDisabled"
                    :placeholder="t('common.selectField', { field: t('dialogs.customerForm.residenceExpireDate') })"
                    value-format="YYYY-MM-DD"
                    class="customer-form-dialog__field-fill"
                  />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item
                  :label="t('dialogs.customerForm.remindDaysBefore')"
                  prop="remindDaysBefore"
                >
                  <el-input-number
                    v-model="form.remindDaysBefore"
                    :disabled="personalColumnDisabled"
                    :min="1"
                    :max="365"
                    :value-on-clear="null"
                    controls-position="right"
                    class="customer-form-dialog__remind-days"
                  />
                </el-form-item>
              </el-col>
            </el-row>
            <el-text size="small" type="info" class="customer-form-dialog__visa-panel-hint">
              {{ t('dialogs.customerForm.remindDaysOptional') }}
            </el-text>
          </div>
        </el-col>
      </el-row>
    </el-form>

    <template #footer>
      <div class="customer-form-drawer__footer-actions">
        <el-button @click="handleClose">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">
          {{ isEdit ? t('common.update') : t('common.create') }}
        </el-button>
      </div>
    </template>
  </el-drawer>
</template>

<style scoped lang="scss" src="./customer-form-dialog.scoped.scss"></style>
<style lang="scss" src="./customer-form-dialog.global.scss"></style>
