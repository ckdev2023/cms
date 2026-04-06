<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  CustomerStatusLabel,
  CustomerTypeLabel,
} from '@/constants/enum-labels'
import {
  type CustomerStatus,
  type CustomerType,
  FamilyLinkMode,
} from '@/constants/enums'
import type { CustomerListPrimaryVisaCaseSummary } from '@/types/customer'

const props = defineProps<{
  /** 客户姓名，与详情主档一致 */
  customerName: string
  /** 客户编号（customer_code） */
  customerCode: string
  /** 客户类型，用于与 PageDetail 原顶栏一致的小型标签 */
  customerType: CustomerType
  /** 客户状态标签 */
  customerStatus: CustomerStatus
  /** 主展示签证案件摘要；无案件时不展示案件 ID 与家庭签徽标 */
  listPrimaryVisaCase: CustomerListPrimaryVisaCaseSummary | null
}>()

defineOptions({ name: 'CustomerDetailStitchHero' })

const { t } = useI18n({ useScope: 'global' })

const primaryCaseId = computed((): string => (props.listPrimaryVisaCase?.visaCaseId ?? '').trim())

const showFamilyCaseRow = computed((): boolean => !!props.listPrimaryVisaCase?.isFamilyCase)
</script>

<template>
  <header
    class="customer-detail-stitch-hero"
    :aria-label="t('detailViews.customer.stitchLayout.heroRegionAria')"
  >
    <h2 class="customer-detail-stitch-hero__name">{{ customerName }}</h2>
    <div class="customer-detail-stitch-hero__chips">
      <el-tag size="small">
        {{ CustomerTypeLabel[customerType] }}
      </el-tag>
      <el-tag
        size="small"
        :type="customerStatus === 'ACTIVE' ? 'success' : 'danger'"
      >
        {{ CustomerStatusLabel[customerStatus] }}
      </el-tag>
      <el-tag size="small" type="info">
        {{ customerCode }}
      </el-tag>
      <template v-if="primaryCaseId">
        <span class="customer-detail-stitch-hero__case-ref">
          <span class="customer-detail-stitch-hero__case-ref-k">
            {{ t('detailViews.customer.stitchLayout.primaryCaseIdLabel') }}
          </span>
          <code class="customer-detail-stitch-hero__case-id" :title="primaryCaseId">{{
            primaryCaseId
          }}</code>
        </span>
      </template>
      <template v-if="showFamilyCaseRow && listPrimaryVisaCase">
        <el-tag size="small" type="info">
          {{ t('pages.customers.familyCaseShortTag') }}
        </el-tag>
        <el-tag
          v-if="listPrimaryVisaCase.familyLinkMode === FamilyLinkMode.INTERNAL"
          size="small"
          type="success"
        >
          {{ t('detailViews.customer.visaCaseWizard.previewLinkInternal') }}
        </el-tag>
        <el-tag
          v-else-if="listPrimaryVisaCase.familyLinkMode === FamilyLinkMode.EXTERNAL"
          size="small"
          type="warning"
        >
          {{ t('detailViews.customer.visaCaseWizard.previewLinkExternal') }}
        </el-tag>
        <el-tag v-else size="small" type="info">
          {{ t('detailViews.customer.visaCaseWizard.previewFamilyModePending') }}
        </el-tag>
        <span class="customer-detail-stitch-hero__family-meta">
          {{
            t('detailViews.customer.visaCasesTab.familyMembersCount', {
              count: listPrimaryVisaCase.familyDependentsCount ?? 0,
            })
          }}
        </span>
      </template>
    </div>
    <p class="customer-detail-stitch-hero__subtitle">
      {{ t('detailViews.customer.contextStrip.title') }}
    </p>
  </header>
</template>

<style scoped lang="scss">
.customer-detail-stitch-hero {
  margin-bottom: var(--app-spacing-md);
  padding-bottom: var(--app-spacing-md);
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.customer-detail-stitch-hero__name {
  margin: 0 0 var(--app-spacing-sm);
  font-size: clamp(1.125rem, 2.2vw, 1.5rem);
  font-weight: 700;
  line-height: 1.25;
  letter-spacing: -0.02em;
  color: var(--el-text-color-primary);
}

.customer-detail-stitch-hero__chips {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--app-spacing-xs);
}

.customer-detail-stitch-hero__case-ref {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  font-size: var(--el-font-size-small);
}

.customer-detail-stitch-hero__case-ref-k {
  flex-shrink: 0;
  color: var(--el-text-color-secondary);
}

.customer-detail-stitch-hero__case-id {
  margin: 0;
  padding: 2px 6px;
  max-width: min(100%, 220px);
  overflow: hidden;
  font-family: var(--el-font-family);
  font-size: var(--el-font-size-extra-small);
  text-overflow: ellipsis;
  white-space: nowrap;
  background: var(--el-fill-color-light);
  border-radius: var(--el-border-radius-small);
}

.customer-detail-stitch-hero__family-meta {
  font-size: var(--el-font-size-small);
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}

.customer-detail-stitch-hero__subtitle {
  margin: var(--app-spacing-sm) 0 0;
  font-size: var(--el-font-size-small);
  font-weight: 600;
  color: var(--el-text-color-secondary);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
</style>
