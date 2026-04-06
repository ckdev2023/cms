<script setup lang="ts">
import { ChatDotRound, ChatLineRound, Message, Phone } from '@element-plus/icons-vue'
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
    <div class="basic-info-tab__layout">
      <div class="basic-info-tab__col basic-info-tab__col--primary">
        <div class="basic-info-tab__section-header">
          <h4>{{ t('detailViews.customer.sharedInfo') }}</h4>
          <el-button v-if="canEditCustomer" type="primary" size="small" @click="emit('edit')">
            {{ t('common.edit') }}
          </el-button>
        </div>

        <el-card class="basic-info-tab__card basic-info-tab__card--profile" shadow="never">
          <header class="basic-info-tab__hero">
            <div class="basic-info-tab__hero-avatar-wrap">
              <el-avatar
                v-if="customerPhotoPreviewUrl"
                class="basic-info-tab__hero-avatar"
                :size="120"
                :src="customerPhotoPreviewUrl"
              />
              <el-avatar v-else class="basic-info-tab__hero-avatar" :size="120">
                {{ customer.customerName?.trim().charAt(0) || '?' }}
              </el-avatar>
            </div>
            <div class="basic-info-tab__hero-text">
              <p class="basic-info-tab__hero-name">{{ customer.customerName }}</p>
              <p class="basic-info-tab__hero-code">
                {{ t('detailViews.customer.basicFields.customerCode') }} · {{ customer.customerCode }}
              </p>
              <div class="basic-info-tab__hero-tags" role="list">
                <span role="listitem">
                  <el-tag
                    class="basic-info-tab__status-tag"
                    size="default"
                    :type="customer.status === 'ACTIVE' ? 'success' : 'danger'"
                  >
                    {{ CustomerStatusLabel[customer.status as CustomerStatus] }}
                  </el-tag>
                </span>
                <span role="listitem">
                  <el-tag size="small" effect="plain">
                    {{ CustomerTypeLabel[customer.customerType as CustomerType] }}
                  </el-tag>
                </span>
                <span role="listitem">
                  <el-tag size="small" type="info" effect="plain">
                    {{ ServiceTypeLabel[customer.serviceType as ServiceType] }}
                  </el-tag>
                </span>
              </div>
            </div>
          </header>

          <section class="basic-info-tab__subsection" aria-labelledby="basic-info-contact-heading">
            <h5 id="basic-info-contact-heading" class="basic-info-tab__subsection-title">
              {{ t('detailViews.customer.basicInfoLayout.contactHeading') }}
            </h5>
            <div class="basic-info-tab__contact-grid">
              <div class="basic-info-tab__contact-item">
                <el-icon class="basic-info-tab__contact-icon" aria-hidden>
                  <Phone />
                </el-icon>
                <div class="basic-info-tab__contact-copy">
                  <span class="basic-info-tab__contact-label">{{
                    t('detailViews.customer.basicFields.phone')
                  }}</span>
                  <span class="basic-info-tab__contact-value">{{ customer.phone ?? '-' }}</span>
                </div>
              </div>
              <div class="basic-info-tab__contact-item">
                <el-icon class="basic-info-tab__contact-icon" aria-hidden>
                  <Message />
                </el-icon>
                <div class="basic-info-tab__contact-copy">
                  <span class="basic-info-tab__contact-label">{{
                    t('detailViews.customer.basicFields.email')
                  }}</span>
                  <span class="basic-info-tab__contact-value">{{ customer.email ?? '-' }}</span>
                </div>
              </div>
              <div class="basic-info-tab__contact-item">
                <el-icon class="basic-info-tab__contact-icon" aria-hidden>
                  <ChatDotRound />
                </el-icon>
                <div class="basic-info-tab__contact-copy">
                  <span class="basic-info-tab__contact-label">{{
                    t('detailViews.customer.basicFields.wechatId')
                  }}</span>
                  <span class="basic-info-tab__contact-value">{{ customer.wechatId ?? '-' }}</span>
                </div>
              </div>
              <div class="basic-info-tab__contact-item">
                <el-icon class="basic-info-tab__contact-icon" aria-hidden>
                  <ChatLineRound />
                </el-icon>
                <div class="basic-info-tab__contact-copy">
                  <span class="basic-info-tab__contact-label">{{
                    t('detailViews.customer.basicFields.lineId')
                  }}</span>
                  <span class="basic-info-tab__contact-value">{{ customer.lineId ?? '-' }}</span>
                </div>
              </div>
            </div>
          </section>

          <section class="basic-info-tab__subsection" aria-labelledby="basic-info-address-heading">
            <h5 id="basic-info-address-heading" class="basic-info-tab__subsection-title">
              {{ t('detailViews.customer.basicInfoLayout.addressHeading') }}
            </h5>
            <p class="basic-info-tab__address-value">{{ customer.address ?? '-' }}</p>
          </section>

          <footer class="basic-info-tab__record-meta" aria-labelledby="basic-info-record-heading">
            <h5 id="basic-info-record-heading" class="basic-info-tab__subsection-title basic-info-tab__subsection-title--meta">
              {{ t('detailViews.customer.basicInfoLayout.recordHeading') }}
            </h5>
            <div class="basic-info-tab__meta-grid">
              <div class="basic-info-tab__meta-item">
                <span class="basic-info-tab__meta-label">{{
                  t('detailViews.customer.basicFields.owner')
                }}</span>
                <span class="basic-info-tab__meta-value">{{ customer.ownerName ?? '-' }}</span>
              </div>
              <div class="basic-info-tab__meta-item">
                <span class="basic-info-tab__meta-label">{{
                  t('detailViews.customer.basicFields.createdAt')
                }}</span>
                <span class="basic-info-tab__meta-value">{{
                  customer.createdAt?.slice(0, 10) ?? '-'
                }}</span>
              </div>
              <div class="basic-info-tab__meta-item">
                <span class="basic-info-tab__meta-label">{{
                  t('detailViews.customer.basicFields.updatedAt')
                }}</span>
                <span class="basic-info-tab__meta-value">{{
                  customer.updatedAt?.slice(0, 10) ?? '-'
                }}</span>
              </div>
            </div>
          </footer>
        </el-card>
      </div>

      <div class="basic-info-tab__col basic-info-tab__col--secondary">
        <el-card
          v-if="hasCompanyInfo"
          class="basic-info-tab__card"
          shadow="never"
        >
          <template #header>
            <h4 class="basic-info-tab__card-title">{{ t('detailViews.customer.companyInfoTitle') }}</h4>
          </template>
          <div class="basic-info-tab__field-grid">
            <div class="basic-info-tab__field">
              <span class="basic-info-tab__field-label">{{
                t('detailViews.customer.basicFields.corporationNumber')
              }}</span>
              <span class="basic-info-tab__field-value">{{
                customer.companyInfo!.corporationNumber ?? '-'
              }}</span>
            </div>
            <div class="basic-info-tab__field">
              <span class="basic-info-tab__field-label">{{
                t('detailViews.customer.basicFields.fiscalMonth')
              }}</span>
              <span class="basic-info-tab__field-value">{{
                customer.companyInfo!.fiscalMonth
                  ? `${customer.companyInfo!.fiscalMonth}${t('dialogs.customerForm.month')}`
                  : '-'
              }}</span>
            </div>
            <div class="basic-info-tab__field basic-info-tab__field--span">
              <span class="basic-info-tab__field-label">{{
                t('detailViews.customer.basicFields.representativeName')
              }}</span>
              <span class="basic-info-tab__field-value">{{
                customer.companyInfo!.representativeName ?? '-'
              }}</span>
            </div>
          </div>
        </el-card>

        <template v-if="hasPersonInfo">
          <el-card class="basic-info-tab__card" shadow="never">
            <template #header>
              <h4 class="basic-info-tab__card-title">{{ t('detailViews.customer.personalInfoTitle') }}</h4>
            </template>
            <div class="basic-info-tab__field-grid">
              <div class="basic-info-tab__field">
                <span class="basic-info-tab__field-label">{{
                  t('detailViews.customer.basicFields.nationality')
                }}</span>
                <span class="basic-info-tab__field-value">{{
                  customer.personInfo!.nationality ?? '-'
                }}</span>
              </div>
              <div class="basic-info-tab__field">
                <span class="basic-info-tab__field-label">{{
                  t('detailViews.customer.basicFields.residenceStatus')
                }}</span>
                <span class="basic-info-tab__field-value">{{
                  customer.personInfo!.residenceStatus ?? '-'
                }}</span>
              </div>
              <div class="basic-info-tab__field basic-info-tab__field--span">
                <span class="basic-info-tab__field-label">{{
                  t('detailViews.customer.basicFields.passportNumber')
                }}</span>
                <span class="basic-info-tab__field-value">{{
                  customer.personInfo!.passportNumber ?? '-'
                }}</span>
              </div>
            </div>
          </el-card>

          <el-card class="basic-info-tab__card" shadow="never">
            <template #header>
              <h4 class="basic-info-tab__card-title">{{ t('dialogs.customerForm.familyInfoTitle') }}</h4>
            </template>
            <div class="basic-info-tab__field-grid">
              <div class="basic-info-tab__field">
                <span class="basic-info-tab__field-label">{{
                  t('detailViews.customer.basicFields.isFamilyMember')
                }}</span>
                <span class="basic-info-tab__field-value">{{
                  customer.personInfo!.isFamilyMember ? t('common.yes') : t('common.no')
                }}</span>
              </div>
              <div class="basic-info-tab__field">
                <span class="basic-info-tab__field-label">{{
                  t('detailViews.customer.basicFields.familyRelation')
                }}</span>
                <span class="basic-info-tab__field-value">
                  <template
                    v-if="customer.personInfo!.isFamilyMember && customer.personInfo!.familyRelation"
                  >
                    <el-tag size="small" type="info">
                      {{
                        FamilyRelationLabel[customer.personInfo!.familyRelation as FamilyRelation]
                      }}
                    </el-tag>
                  </template>
                  <template v-else>-</template>
                </span>
              </div>
              <div class="basic-info-tab__field basic-info-tab__field--span">
                <span class="basic-info-tab__field-label">{{
                  t('detailViews.customer.basicFields.primaryCustomer')
                }}</span>
                <span class="basic-info-tab__field-value">
                  <router-link
                    v-if="customer.personInfo!.primaryCustomerId"
                    :to="primaryCustomerDetailLocation"
                    class="basic-info-tab__primary-link"
                  >
                    {{ t('common.detail') }}
                  </router-link>
                  <template v-else>-</template>
                </span>
              </div>
            </div>
          </el-card>

          <div
            v-if="showAccompanyingDependentsSection"
            class="basic-info-tab__dependents-slot"
          >
            <CustomerAccompanyingDependentsBlock :primary-customer-id="customer.id" />
          </div>

          <el-card class="basic-info-tab__card" shadow="never">
            <template #header>
              <h4 class="basic-info-tab__card-title">{{ t('dialogs.customerForm.visaInfoTitle') }}</h4>
            </template>
            <div class="basic-info-tab__field-grid">
              <div class="basic-info-tab__field">
                <span class="basic-info-tab__field-label">{{
                  t('detailViews.customer.basicFields.residenceExpireDate')
                }}</span>
                <span class="basic-info-tab__field-value">{{
                  customer.personInfo!.residenceExpireDate ?? '-'
                }}</span>
              </div>
              <div class="basic-info-tab__field">
                <span class="basic-info-tab__field-label">{{
                  t('detailViews.customer.basicFields.remindDaysBefore')
                }}</span>
                <span class="basic-info-tab__field-value">{{
                  customer.personInfo!.remindDaysBefore ?? '-'
                }}</span>
              </div>
              <div class="basic-info-tab__field">
                <span class="basic-info-tab__field-label">{{
                  t('detailViews.customer.basicFields.daysLeft')
                }}</span>
                <span class="basic-info-tab__field-value">{{
                  customer.personInfo!.daysLeft ?? '-'
                }}</span>
              </div>
              <div class="basic-info-tab__field">
                <span class="basic-info-tab__field-label">{{
                  t('detailViews.customer.basicFields.alertLevel')
                }}</span>
                <span class="basic-info-tab__field-value">
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
                      :type="
                        visaAlertElTagType[customer.personInfo!.alertLevel as VisaAlertLevel] ??
                        'info'
                      "
                    >
                      {{ VisaAlertLevelLabel[customer.personInfo!.alertLevel as VisaAlertLevel] }}
                    </el-tag>
                  </template>
                  <template v-else>-</template>
                </span>
              </div>
            </div>
          </el-card>

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

        <el-card
          v-if="hasStaffRelations"
          class="basic-info-tab__card"
          shadow="never"
        >
          <template #header>
            <h4 class="basic-info-tab__card-title">{{ t('detailViews.customer.staffRelationsTitle') }}</h4>
          </template>
          <ul class="basic-info-tab__staff-list" role="list">
            <li
              v-for="rel in customer.staffRelations"
              :key="rel.id"
              class="basic-info-tab__staff-row"
            >
              <span class="basic-info-tab__staff-name">{{ rel.user.displayName }}</span>
              <el-tag size="small" type="info">
                {{
                  StaffRelationTypeLabel[rel.relationType as StaffRelationType] ?? rel.relationType
                }}
              </el-tag>
            </li>
          </ul>
        </el-card>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss" src="./CustomerBasicInfoTab.scoped.scss"></style>
