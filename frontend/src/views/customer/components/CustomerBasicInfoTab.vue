<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'

import { getFilePreviewUrl } from '@/api/file'
import {
  CustomerStatusLabel,
  CustomerTypeLabel,
  FamilyRelationLabel,
  ServiceTypeLabel,
  StaffRelationTypeLabel,
  VisaAlertLevelLabel,
} from '@/constants/enum-labels'
import {
  type CustomerStatus,
  CustomerType,
  type FamilyRelation,
  type ServiceType,
  type StaffRelationType,
  VisaAlertLevel,
} from '@/constants/enums'
import { P } from '@/constants/permissions'
import { useUserStore } from '@/stores/user'
import type { CustomerDetail } from '@/types/customer'
import { mergeCustomerDetailReturnQuery } from '@/utils/customer-detail-return-navigation'
import { formatPersonResidenceDaysLeftLine } from '@/utils/customer-list-view-cells'
import { visaUiVisaPrimaryEntriesVisible } from '@/utils/visa-ui-feature-flags'

import CustomerAccompanyingDependentsBlock from './CustomerAccompanyingDependentsBlock.vue'

const props = defineProps<{
  customer: CustomerDetail
}>()

const emit = defineEmits<{
  edit: []
}>()

defineOptions({ name: 'CustomerBasicInfoTab' })

const route = useRoute()
const { t } = useI18n({ useScope: 'global' })
const userStore = useUserStore()

/** 链向主客户时写入 `ccFrom` 为当前主档详情路径，便于顶栏返回回到本页。 */
const primaryCustomerDetailLocation = computed(() => {
  const id = props.customer.personInfo?.primaryCustomerId
  if (!id) {
    return ''
  }
  const query: Record<string, string> = {}
  mergeCustomerDetailReturnQuery(query, route, { overrideFullPath: `/customers/${props.customer.id}` })
  return Object.keys(query).length > 0 ? { path: `/customers/${id}`, query } : `/customers/${id}`
})
const canEditCustomer = computed(() => userStore.hasPermission(P.CUSTOMER_EDIT))
/** 含 P2-S3f 主路径开关：关闭时不展示链向 `/customers/visa-reminders` 的引导（深链仍可用）。 */
const canOpenVisaReminders = computed(
  () => visaUiVisaPrimaryEntriesVisible() && userStore.hasPermission(P.VISA_REMINDER_LIST),
)
const hasCompanyInfo = computed(() => !!props.customer.companyInfo)
const hasPersonInfo = computed(() => !!props.customer.personInfo)
const hasStaffRelations = computed(() => props.customer.staffRelations?.length > 0)

/** 个人主档（非「本人挂在他主档下」的家属行）详情页展示随附家属子客户列表。 */
const showAccompanyingDependentsSection = computed((): boolean => {
  if (props.customer.customerType !== CustomerType.PERSONAL) {
    return false
  }
  const pi = props.customer.personInfo
  if (!pi) {
    return false
  }
  return !pi.isFamilyMember
})

const visaAlertElTagType: Partial<Record<VisaAlertLevel, 'danger' | 'warning'>> = {
  [VisaAlertLevel.EXPIRED]: 'danger',
  [VisaAlertLevel.URGENT]: 'danger',
  [VisaAlertLevel.HIGH]: 'warning',
}

/** 主档在留 `alertLevel` 非空时需突出提示（与列表筛选、签证案件到期并行）。 */
const personResidenceAttentionPersonInfo = computed(() => {
  const pi = props.customer.personInfo
  if (!pi?.alertLevel) {
    return null
  }
  return pi
})

/** 主档在留剩余/逾期短句，供详情提示与句号拼接。 */
const personResidenceAttentionDaysLine = computed(() => {
  const pi = personResidenceAttentionPersonInfo.value
  if (!pi) {
    return ''
  }
  return formatPersonResidenceDaysLeftLine(pi.daysLeft, t)
})

const personResidenceAttentionAlertType = computed((): 'info' | 'warning' | 'error' => {
  const pi = personResidenceAttentionPersonInfo.value
  if (!pi) {
    return 'info'
  }
  const lv = pi.alertLevel as VisaAlertLevel
  if (lv === VisaAlertLevel.NORMAL) {
    return 'info'
  }
  if (lv === VisaAlertLevel.HIGH) {
    return 'warning'
  }
  return 'error'
})

/**
 * 主档在留已非「通常」且主展示案件有到期日时，追加并列提示（docs/21 §6.4）。
 */
const residenceParallelCaseExpiryVisible = computed((): boolean => {
  const pi = props.customer.personInfo
  const pc = props.customer.listPrimaryVisaCase
  if (!pi?.alertLevel || pi.alertLevel === VisaAlertLevel.NORMAL) {
    return false
  }
  const exp = pc?.expireDate
  return typeof exp === 'string' && exp.trim() !== ''
})

/** 客户头像预览地址（带预览接口 token）；无头像时为空串 */
const customerPhotoPreviewUrl = computed((): string => {
  const id = props.customer.photoFileId?.trim()
  return id ? getFilePreviewUrl(id) : ''
})
</script>

<template>
  <div class="basic-info-tab">
    <div class="basic-info-tab__section-header">
      <h4>{{ t('detailViews.customer.sharedInfo') }}</h4>
      <el-button v-if="canEditCustomer" type="primary" size="small" @click="emit('edit')">
        {{ t('common.edit') }}
      </el-button>
    </div>

    <el-descriptions :column="2" border>
      <el-descriptions-item :label="t('detailViews.customer.basicFields.customerPhoto')" :span="2">
        <div class="basic-info-tab__photo-wrap">
          <el-avatar v-if="customerPhotoPreviewUrl" :size="96" :src="customerPhotoPreviewUrl" />
          <el-avatar v-else :size="96">
            {{ customer.customerName?.trim().charAt(0) || '?' }}
          </el-avatar>
        </div>
      </el-descriptions-item>
      <el-descriptions-item :label="t('detailViews.customer.basicFields.customerCode')">
        {{ customer.customerCode }}
      </el-descriptions-item>
      <el-descriptions-item :label="t('detailViews.customer.basicFields.customerType')">
        <el-tag size="small">
          {{ CustomerTypeLabel[customer.customerType as CustomerType] }}
        </el-tag>
      </el-descriptions-item>
      <el-descriptions-item :label="t('detailViews.customer.basicFields.customerName')">
        {{ customer.customerName }}
      </el-descriptions-item>
      <el-descriptions-item :label="t('detailViews.customer.basicFields.serviceType')">
        <el-tag size="small" type="info">
          {{ ServiceTypeLabel[customer.serviceType as ServiceType] }}
        </el-tag>
      </el-descriptions-item>
      <el-descriptions-item :label="t('detailViews.customer.basicFields.phone')">
        {{ customer.phone ?? '-' }}
      </el-descriptions-item>
      <el-descriptions-item :label="t('detailViews.customer.basicFields.email')">
        {{ customer.email ?? '-' }}
      </el-descriptions-item>
      <el-descriptions-item :label="t('detailViews.customer.basicFields.wechatId')">
        {{ customer.wechatId ?? '-' }}
      </el-descriptions-item>
      <el-descriptions-item :label="t('detailViews.customer.basicFields.lineId')">
        {{ customer.lineId ?? '-' }}
      </el-descriptions-item>
      <el-descriptions-item :label="t('detailViews.customer.basicFields.address')" :span="2">
        {{ customer.address ?? '-' }}
      </el-descriptions-item>
      <el-descriptions-item :label="t('detailViews.customer.basicFields.owner')">
        {{ customer.ownerName ?? '-' }}
      </el-descriptions-item>
      <el-descriptions-item :label="t('detailViews.customer.basicFields.status')">
        <el-tag
          size="small"
          :type="customer.status === 'ACTIVE' ? 'success' : 'danger'"
        >
          {{ CustomerStatusLabel[customer.status as CustomerStatus] }}
        </el-tag>
      </el-descriptions-item>
      <el-descriptions-item :label="t('detailViews.customer.basicFields.createdAt')">
        {{ customer.createdAt?.slice(0, 10) ?? '-' }}
      </el-descriptions-item>
      <el-descriptions-item :label="t('detailViews.customer.basicFields.updatedAt')">
        {{ customer.updatedAt?.slice(0, 10) ?? '-' }}
      </el-descriptions-item>
    </el-descriptions>

    <template v-if="hasCompanyInfo">
      <h4 class="basic-info-tab__sub-title">{{ t('detailViews.customer.companyInfoTitle') }}</h4>
      <el-descriptions :column="2" border>
        <el-descriptions-item :label="t('detailViews.customer.basicFields.corporationNumber')">
          {{ customer.companyInfo!.corporationNumber ?? '-' }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('detailViews.customer.basicFields.fiscalMonth')">
          {{ customer.companyInfo!.fiscalMonth ? `${customer.companyInfo!.fiscalMonth}${t('dialogs.customerForm.month')}` : '-' }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('detailViews.customer.basicFields.representativeName')">
          {{ customer.companyInfo!.representativeName ?? '-' }}
        </el-descriptions-item>
      </el-descriptions>
    </template>

    <template v-if="hasPersonInfo">
      <h4 class="basic-info-tab__sub-title">{{ t('detailViews.customer.personalInfoTitle') }}</h4>
      <el-descriptions :column="2" border>
        <el-descriptions-item :label="t('detailViews.customer.basicFields.nationality')">
          {{ customer.personInfo!.nationality ?? '-' }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('detailViews.customer.basicFields.residenceStatus')">
          {{ customer.personInfo!.residenceStatus ?? '-' }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('detailViews.customer.basicFields.passportNumber')">
          {{ customer.personInfo!.passportNumber ?? '-' }}
        </el-descriptions-item>
      </el-descriptions>

      <h4 class="basic-info-tab__sub-title">{{ t('dialogs.customerForm.familyInfoTitle') }}</h4>
      <el-descriptions :column="2" border>
        <el-descriptions-item :label="t('detailViews.customer.basicFields.isFamilyMember')">
          {{ customer.personInfo!.isFamilyMember ? t('common.yes') : t('common.no') }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('detailViews.customer.basicFields.familyRelation')">
          <template v-if="customer.personInfo!.isFamilyMember && customer.personInfo!.familyRelation">
            <el-tag size="small" type="info">
              {{ FamilyRelationLabel[customer.personInfo!.familyRelation as FamilyRelation] }}
            </el-tag>
          </template>
          <template v-else>-</template>
        </el-descriptions-item>
        <el-descriptions-item :label="t('detailViews.customer.basicFields.primaryCustomer')" :span="2">
          <router-link
            v-if="customer.personInfo!.primaryCustomerId"
            :to="primaryCustomerDetailLocation"
            class="basic-info-tab__primary-link"
          >
            {{ t('common.detail') }}
          </router-link>
          <template v-else>-</template>
        </el-descriptions-item>
      </el-descriptions>

      <CustomerAccompanyingDependentsBlock
        v-if="showAccompanyingDependentsSection"
        :primary-customer-id="customer.id"
      />

      <h4 class="basic-info-tab__sub-title">{{ t('dialogs.customerForm.visaInfoTitle') }}</h4>
      <el-descriptions :column="2" border>
        <el-descriptions-item :label="t('detailViews.customer.basicFields.residenceExpireDate')">
          {{ customer.personInfo!.residenceExpireDate ?? '-' }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('detailViews.customer.basicFields.remindDaysBefore')">
          {{ customer.personInfo!.remindDaysBefore ?? '-' }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('detailViews.customer.basicFields.daysLeft')">
          {{ customer.personInfo!.daysLeft ?? '-' }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('detailViews.customer.basicFields.alertLevel')">
          <template v-if="customer.personInfo!.alertLevel">
            <el-tag
              v-if="customer.personInfo!.alertLevel === VisaAlertLevel.NORMAL"
              size="small"
              class="visa-alert-tag visa-alert-tag--normal"
            >
              {{ VisaAlertLevelLabel[customer.personInfo!.alertLevel as VisaAlertLevel] }}
            </el-tag>
            <el-tag
              v-else
              size="small"
              :type="visaAlertElTagType[customer.personInfo!.alertLevel as VisaAlertLevel] ?? 'info'"
            >
              {{ VisaAlertLevelLabel[customer.personInfo!.alertLevel as VisaAlertLevel] }}
            </el-tag>
          </template>
          <template v-else>-</template>
        </el-descriptions-item>
      </el-descriptions>

      <el-alert
        v-if="personResidenceAttentionPersonInfo"
        :type="personResidenceAttentionAlertType"
        :closable="false"
        show-icon
        class="basic-info-tab__residence-soon-attention"
      >
        <template #title>{{ t('detailViews.customer.residenceSoonAttentionTitle') }}</template>
        <p class="basic-info-tab__residence-soon-attention-body">
          <template v-if="personResidenceAttentionDaysLine">{{ personResidenceAttentionDaysLine }}。</template>
          {{ t('detailViews.customer.residenceSoonAttentionTail') }}
        </p>
        <p
          v-if="residenceParallelCaseExpiryVisible"
          class="basic-info-tab__residence-soon-attention-body"
        >
          {{ t('detailViews.customer.residenceParallelCaseExpiryHint') }}
        </p>
      </el-alert>

      <el-alert
        type="info"
        :closable="false"
        show-icon
        class="basic-info-tab__legacy-residence-hint"
      >
        {{ t('detailViews.customer.legacyResidenceFieldHint') }}
        <template v-if="canOpenVisaReminders">
          <router-link
            to="/customers/visa-reminders"
            class="basic-info-tab__visa-reminder-link"
          >
            {{ t('pages.visaReminders.openVisaRemindersLink') }}
          </router-link>
        </template>
      </el-alert>
    </template>

    <template v-if="hasStaffRelations">
      <h4 class="basic-info-tab__sub-title">{{ t('detailViews.customer.staffRelationsTitle') }}</h4>
      <el-table :data="customer.staffRelations" border size="small" style="width: 100%">
        <el-table-column prop="user.displayName" :label="t('detailViews.customer.staffName')" min-width="160" />
        <el-table-column :label="t('detailViews.customer.relation')" width="120" align="center">
          <template #default="{ row }">
            <el-tag size="small" type="info">
              {{ StaffRelationTypeLabel[row.relationType as StaffRelationType] ?? row.relationType }}
            </el-tag>
          </template>
        </el-table-column>
      </el-table>
    </template>
  </div>
</template>

<style scoped lang="scss">
.basic-info-tab {
  &__photo-wrap {
    display: flex;
    align-items: center;
    min-height: 96px;
  }

  &__section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;

    h4 {
      margin: 0;
      font-size: var(--app-font-size-md);
      color: var(--app-text-primary);
    }
  }

  &__sub-title {
    margin: var(--app-spacing-lg) 0 var(--app-spacing-md);
    font-size: var(--app-font-size-md);
    color: var(--app-text-primary);
  }

  &__primary-link {
    color: var(--el-color-primary);
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }

  &__residence-soon-attention {
    margin-top: var(--app-spacing-md);
  }

  &__residence-soon-attention-body {
    margin: 0;
    line-height: 1.5;
  }

  &__legacy-residence-hint {
    margin-top: var(--app-spacing-md);
  }

  &__visa-reminder-link {
    display: inline-block;
    margin-top: var(--app-spacing-sm);
    font-weight: var(--app-font-weight-medium);
    color: var(--el-color-primary);
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }
}

.visa-alert-tag--normal {
  --el-tag-bg-color: #fef9c3;
  --el-tag-border-color: #fde047;
  --el-tag-text-color: #854d0e;
}
</style>
