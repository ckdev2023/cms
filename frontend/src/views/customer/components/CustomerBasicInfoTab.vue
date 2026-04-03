<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

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
  type CustomerType,
  type FamilyRelation,
  type ServiceType,
  type StaffRelationType,
  VisaAlertLevel,
} from '@/constants/enums'
import type { CustomerDetail } from '@/types/customer'

const props = defineProps<{
  customer: CustomerDetail
}>()

const emit = defineEmits<{
  edit: []
}>()

defineOptions({ name: 'CustomerBasicInfoTab' })

const { t } = useI18n({ useScope: 'global' })
const hasCompanyInfo = computed(() => !!props.customer.companyInfo)
const hasPersonInfo = computed(() => !!props.customer.personInfo)
const hasStaffRelations = computed(() => props.customer.staffRelations?.length > 0)

const visaAlertElTagType: Partial<Record<VisaAlertLevel, 'danger' | 'warning'>> = {
  [VisaAlertLevel.EXPIRED]: 'danger',
  [VisaAlertLevel.URGENT]: 'danger',
  [VisaAlertLevel.HIGH]: 'warning',
}
</script>

<template>
  <div class="basic-info-tab">
    <div class="basic-info-tab__section-header">
      <h4>{{ t('detailViews.customer.sharedInfo') }}</h4>
      <el-button type="primary" size="small" @click="emit('edit')">
        {{ t('common.edit') }}
      </el-button>
    </div>

    <el-descriptions :column="2" border>
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
            :to="`/customers/${customer.personInfo!.primaryCustomerId}`"
            class="basic-info-tab__primary-link"
          >
            {{ t('common.detail') }}
          </router-link>
          <template v-else>-</template>
        </el-descriptions-item>
      </el-descriptions>

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
}

.visa-alert-tag--normal {
  --el-tag-bg-color: #fef9c3;
  --el-tag-border-color: #fde047;
  --el-tag-text-color: #854d0e;
}
</style>
