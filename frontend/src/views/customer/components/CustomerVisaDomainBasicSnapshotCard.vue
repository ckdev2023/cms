<script setup lang="ts">
import { Document, Message, Phone } from '@element-plus/icons-vue'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { getFilePreviewUrl } from '@/api/file'
import { VisaAlertLevelLabel } from '@/constants/enum-labels'
import { VisaAlertLevel } from '@/constants/enums'
import type { CustomerDetail } from '@/types/customer'
import { formatPersonResidenceDaysLeftLine } from '@/utils/customer-list-view-cells'
import { useLocaleFormatter } from '@/utils/locale-format'

/**
 * 签证域工作台内「基本信息」只读摘要：仅含联系与在留要点，完整字段与编辑仍在 `CustomerBasicInfoTab`（`tab=basic`）。
 */
const props = defineProps<{
  customer: CustomerDetail
}>()

const emit = defineEmits<{
  /** 请求父级切换到客户详情「基础信息」Tab 并写入 `?tab=basic`。 */
  'open-full-basic': []
}>()

defineOptions({ name: 'CustomerVisaDomainBasicSnapshotCard' })

const { t } = useI18n({ useScope: 'global' })
const { formatDate } = useLocaleFormatter()

const T = (key: string) => t(`detailViews.customer.visaDomainTab.${key}`)

/** 与签证域堆叠首卡、`stitchLayout.stackBlocks.basicSnapshot` 对齐的标题文案。 */
const basicSnapshotHeading = computed((): string =>
  t('detailViews.customer.stitchLayout.stackBlocks.basicSnapshot'),
)

const person = computed(() => props.customer.personInfo)

const passportDisplay = computed((): string => {
  const raw = person.value?.passportNumber?.trim()
  return raw || '—'
})

const showResidenceBlock = computed((): boolean => {
  const pi = person.value
  if (!pi) {
    return false
  }
  return !!(
    pi.nationality?.trim() ||
    pi.residenceStatus?.trim() ||
    pi.residenceExpireDate?.trim() ||
    (pi.alertLevel && pi.alertLevel !== VisaAlertLevel.NORMAL) ||
    (pi.daysLeft !== null && pi.daysLeft !== undefined && Number.isFinite(pi.daysLeft))
  )
})

const residenceDaysLine = computed(() =>
  formatPersonResidenceDaysLeftLine(person.value?.daysLeft, t),
)

const residenceAlertTagType = computed((): 'danger' | 'warning' | 'info' => {
  const lv = person.value?.alertLevel
  if (!lv || lv === VisaAlertLevel.NORMAL) {
    return 'info'
  }
  if (lv === VisaAlertLevel.HIGH) {
    return 'warning'
  }
  return 'danger'
})

const showResidenceAlertTag = computed((): boolean => {
  const lv = person.value?.alertLevel
  return !!lv && lv !== VisaAlertLevel.NORMAL
})

/** 客户头像预览地址；无头像时由 `el-avatar` 展示首字 */
const customerPhotoPreviewUrl = computed((): string => {
  const id = props.customer.photoFileId?.trim()
  return id ? getFilePreviewUrl(id) : ''
})

/**
 * 将主档在留到期格式化为本地日期展示；无值时返回统一占位。
 *
 * @returns 已格式化的日期或「—」占位
 */
function formatResidenceExpireDisplay(): string {
  const raw = person.value?.residenceExpireDate?.trim()
  if (!raw) {
    return '—'
  }
  return formatDate(raw)
}
</script>

<template>
  <el-card shadow="never" class="visa-domain-basic-snapshot">
    <template #header>
      <div class="visa-domain-basic-snapshot__head">
        <span class="visa-domain-basic-snapshot__title">{{ basicSnapshotHeading }}</span>
        <el-button
          data-testid="visa-domain-basic-snapshot-open"
          text
          type="primary"
          size="small"
          @click="emit('open-full-basic')"
        >
          {{ T('basicSnapshotOpenFull') }}
        </el-button>
      </div>
    </template>

    <header class="visa-domain-basic-snapshot__hero">
      <el-avatar
        v-if="customerPhotoPreviewUrl"
        class="visa-domain-basic-snapshot__hero-avatar"
        :size="96"
        :src="customerPhotoPreviewUrl"
      />
      <el-avatar v-else class="visa-domain-basic-snapshot__hero-avatar" :size="96">
        {{ customer.customerName?.trim().charAt(0) || '?' }}
      </el-avatar>
      <div class="visa-domain-basic-snapshot__hero-text">
        <p class="visa-domain-basic-snapshot__hero-name">{{ customer.customerName }}</p>
        <p class="visa-domain-basic-snapshot__hero-code">
          {{ t('detailViews.customer.basicFields.customerCode') }} · {{ customer.customerCode || '—' }}
        </p>
      </div>
    </header>

    <section
      class="visa-domain-basic-snapshot__subsection"
      :aria-label="T('basicSnapshotGroupContact')"
    >
      <h5 class="visa-domain-basic-snapshot__subsection-title">
        {{ T('basicSnapshotGroupContact') }}
      </h5>
      <div class="visa-domain-basic-snapshot__contact-grid">
        <div class="visa-domain-basic-snapshot__kv-item">
          <el-icon class="visa-domain-basic-snapshot__kv-icon" aria-hidden>
            <Phone />
          </el-icon>
          <div class="visa-domain-basic-snapshot__kv-copy">
            <span class="visa-domain-basic-snapshot__kv-label">{{
              t('detailViews.customer.basicFields.phone')
            }}</span>
            <span class="visa-domain-basic-snapshot__kv-value">{{
              customer.phone?.trim() ? customer.phone : '—'
            }}</span>
          </div>
        </div>
        <div class="visa-domain-basic-snapshot__kv-item">
          <el-icon class="visa-domain-basic-snapshot__kv-icon" aria-hidden>
            <Message />
          </el-icon>
          <div class="visa-domain-basic-snapshot__kv-copy">
            <span class="visa-domain-basic-snapshot__kv-label">{{
              t('detailViews.customer.basicFields.email')
            }}</span>
            <span class="visa-domain-basic-snapshot__kv-value">{{
              customer.email?.trim() ? customer.email : '—'
            }}</span>
          </div>
        </div>
      </div>
    </section>

    <section
      class="visa-domain-basic-snapshot__subsection"
      :aria-label="T('basicSnapshotGroupIdDocs')"
    >
      <h5 class="visa-domain-basic-snapshot__subsection-title">
        {{ T('basicSnapshotGroupIdDocs') }}
      </h5>
      <div class="visa-domain-basic-snapshot__kv-item">
        <el-icon class="visa-domain-basic-snapshot__kv-icon" aria-hidden>
          <Document />
        </el-icon>
        <div class="visa-domain-basic-snapshot__kv-copy">
          <span class="visa-domain-basic-snapshot__kv-label">{{
            t('detailViews.customer.basicFields.passportNumber')
          }}</span>
          <span class="visa-domain-basic-snapshot__kv-value">{{ passportDisplay }}</span>
        </div>
      </div>
    </section>

    <section
      v-if="person && showResidenceBlock"
      class="visa-domain-basic-snapshot__subsection"
      :aria-label="T('basicSnapshotGroupResidence')"
    >
      <h5 class="visa-domain-basic-snapshot__subsection-title">
        {{ T('basicSnapshotGroupResidence') }}
      </h5>
      <div class="visa-domain-basic-snapshot__residence-stack">
        <div v-if="person.nationality?.trim()" class="visa-domain-basic-snapshot__residence-row">
          <span class="visa-domain-basic-snapshot__residence-dt">
            {{ t('detailViews.customer.basicFields.nationality') }}
          </span>
          <span class="visa-domain-basic-snapshot__residence-dd">{{ person.nationality }}</span>
        </div>
        <div v-if="person.residenceStatus?.trim()" class="visa-domain-basic-snapshot__residence-row">
          <span class="visa-domain-basic-snapshot__residence-dt">
            {{ t('detailViews.customer.basicFields.residenceStatus') }}
          </span>
          <span class="visa-domain-basic-snapshot__residence-dd">{{ person.residenceStatus }}</span>
        </div>
        <div class="visa-domain-basic-snapshot__residence-row">
          <span class="visa-domain-basic-snapshot__residence-dt">
            {{ t('detailViews.customer.basicFields.residenceExpireDate') }}
          </span>
          <span class="visa-domain-basic-snapshot__residence-dd">{{ formatResidenceExpireDisplay() }}</span>
        </div>
        <div
          v-if="showResidenceAlertTag || residenceDaysLine"
          class="visa-domain-basic-snapshot__residence-row"
        >
          <span class="visa-domain-basic-snapshot__residence-dt">
            {{ t('detailViews.customer.basicFields.daysLeft') }}
          </span>
          <span class="visa-domain-basic-snapshot__residence-dd visa-domain-basic-snapshot__attention-dd">
            <el-tag
              v-if="showResidenceAlertTag && person.alertLevel"
              size="small"
              :type="residenceAlertTagType"
            >
              {{ VisaAlertLevelLabel[person.alertLevel as VisaAlertLevel] }}
            </el-tag>
            <span v-if="residenceDaysLine" class="visa-domain-basic-snapshot__days-line">
              {{ residenceDaysLine }}
            </span>
            <span v-if="!residenceDaysLine && !showResidenceAlertTag">—</span>
          </span>
        </div>
      </div>
    </section>

    <p class="visa-domain-basic-snapshot__scope-hint">
      {{ T('basicSnapshotScopeHint') }}
    </p>
  </el-card>
</template>

<style scoped lang="scss" src="./CustomerVisaDomainBasicSnapshotCard.scoped.scss"></style>
