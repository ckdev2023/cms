<script setup lang="ts">
import { ArrowDown } from '@element-plus/icons-vue'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import type { CustomerStatus, CustomerType } from '@/constants/enums'
import type {
  CustomerListPrimaryVisaCaseSummary,
  ListPrimaryVisaCaseSource,
} from '@/types/customer'

import CustomerDetailContextStripCompact from './CustomerDetailContextStripCompact.vue'
import CustomerDetailTraceabilityHint from './CustomerDetailTraceabilityHint.vue'

defineProps<{
  /** 当前客户 UUID，与路由参数一致 */
  customerId: string
  /** 客户姓名 */
  customerName: string
  /** 客户编号 customer_code */
  customerCode: string
  /** 客户类型标签 */
  customerType: CustomerType
  /** 客户状态标签 */
  customerStatus: CustomerStatus
  /** 与 `GET /customers/:id` 的 `listPrimaryVisaCase` 同源 */
  listPrimaryVisaCase: CustomerListPrimaryVisaCaseSummary | null
  /** 主展示摘要来源；家属回退至主客户案件时为 `PRIMARY_CUSTOMER_FALLBACK` */
  listPrimaryVisaCaseSource?: ListPrimaryVisaCaseSource | null
  /** 回退场景下的主客户 UUID，与列表同源 */
  primaryCustomerIdForListFallback?: string | null
}>()

defineOptions({ name: 'CustomerDetailVisaHeaderHub' })

const { t } = useI18n({ useScope: 'global' })

/** 折叠「详细说明」：摘要、分工说明与快捷深链入口。 */
const detailExpanded = ref(false)
</script>

<template>
  <div class="customer-detail-visa-header-hub">
    <div class="customer-detail-visa-header-hub__toolbar">
      <div class="customer-detail-visa-header-hub__context">
        <CustomerDetailContextStripCompact
          layout="hub-single-row"
          :customer-id="customerId"
          :customer-name="customerName"
          :customer-code="customerCode"
          :customer-type="customerType"
          :customer-status="customerStatus"
          :list-primary-visa-case="listPrimaryVisaCase"
          :list-primary-visa-case-source="listPrimaryVisaCaseSource ?? null"
          :primary-customer-id-for-list-fallback="
            primaryCustomerIdForListFallback ?? null
          "
        />
      </div>
      <el-button
        class="customer-detail-visa-header-hub__detail-toggle"
        type="primary"
        link
        :aria-expanded="detailExpanded"
        :aria-controls="`customer-visa-header-detail-${customerId}`"
        @click="detailExpanded = !detailExpanded"
      >
        {{ t('detailViews.customer.traceabilityHint.rulesPopoverTrigger') }}
        <el-icon
          class="customer-detail-visa-header-hub__chevron"
          :class="{ 'customer-detail-visa-header-hub__chevron--open': detailExpanded }"
        >
          <ArrowDown />
        </el-icon>
      </el-button>
    </div>
    <el-collapse-transition>
      <div
        v-show="detailExpanded"
        :id="`customer-visa-header-detail-${customerId}`"
        class="customer-detail-visa-header-hub__detail"
        role="region"
        :aria-label="t('detailViews.customer.traceabilityHint.rulesPopoverTrigger')"
      >
        <CustomerDetailTraceabilityHint
          variant="expandable-panel"
          density="compact"
        />
      </div>
    </el-collapse-transition>
  </div>
</template>

<style scoped lang="scss">
.customer-detail-visa-header-hub {
  display: flex;
  flex-direction: column;
  gap: var(--app-spacing-xs);
  min-width: 0;
  width: 100%;
}

.customer-detail-visa-header-hub__toolbar {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: var(--app-spacing-sm);
  min-width: 0;
}

.customer-detail-visa-header-hub__context {
  flex: 1 1 0;
  min-width: 0;
}

.customer-detail-visa-header-hub__detail-toggle {
  flex-shrink: 0;
  align-self: center;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}

.customer-detail-visa-header-hub__chevron {
  transition: transform 0.2s ease;
}

.customer-detail-visa-header-hub__chevron--open {
  transform: rotate(180deg);
}

.customer-detail-visa-header-hub__detail {
  margin-top: var(--app-spacing-xs);
  padding: var(--app-spacing-sm) var(--app-spacing-md);
  background: var(--el-fill-color-lighter);
  border-radius: var(--el-border-radius-base);
}
</style>
