<script setup lang="ts">
import { Money } from '@element-plus/icons-vue'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { FinanceSummary } from '@/types/dashboard'
import { useLocaleFormatter } from '@/utils/locale-format'

import DashboardCard from './DashboardCard.vue'

const props = defineProps<{
  data: FinanceSummary
  loading: boolean
}>()

const { formatCurrency } = useLocaleFormatter()
const { t } = useI18n({ useScope: 'global' })

const rows = computed(() => [
  {
    label: t('dashboard.finance.draft'),
    count: props.data.draftCount,
    amount: props.data.draftAmount,
    color: 'var(--app-color-info)',
    tagType: 'info' as const,
  },
  {
    label: t('dashboard.finance.sent'),
    count: props.data.sentCount,
    amount: props.data.sentAmount,
    color: 'var(--app-color-primary)',
    tagType: 'primary' as const,
  },
  {
    label: t('dashboard.finance.partial'),
    count: props.data.partialCount,
    amount: props.data.partialAmount,
    color: 'var(--app-color-warning)',
    tagType: 'warning' as const,
  },
  {
    label: t('dashboard.finance.overdue'),
    count: props.data.overdueCount,
    amount: props.data.overdueAmount,
    color: 'var(--app-color-danger)',
    tagType: 'danger' as const,
  },
])
</script>

<template>
  <DashboardCard
    :title="t('dashboard.finance.title')"
    :icon="Money"
    icon-color="var(--app-color-primary)"
    :loading="loading"
    :skeleton-rows="5"
  >
    <div class="finance-highlight">
      <div class="finance-highlight__item">
        <div class="finance-highlight__label">{{ t('dashboard.finance.monthlyCollected') }}</div>
        <div class="dc-metric dc-metric--lg finance-highlight__value--success">
          {{ formatCurrency(data.monthlyCollected, '¥') }}
        </div>
        <div class="finance-highlight__sub">
          {{ t('dashboard.finance.countUnit', { count: data.monthlyCollectedCount }) }}
        </div>
      </div>
      <el-divider direction="vertical" class="finance-highlight__divider" />
      <div class="finance-highlight__item">
        <div class="finance-highlight__label">{{ t('dashboard.finance.outstandingTotal') }}</div>
        <div class="dc-metric dc-metric--lg finance-highlight__value--warning">
          {{ formatCurrency(data.sentAmount + data.partialAmount, '¥') }}
        </div>
        <div class="finance-highlight__sub">
          {{ t('dashboard.finance.countUnit', { count: data.sentCount + data.partialCount }) }}
        </div>
      </div>
    </div>

    <el-divider class="finance-divider" />

    <div class="finance-rows">
      <div v-for="row in rows" :key="row.label" class="finance-row">
        <div class="finance-row__left">
          <el-tag :type="row.tagType" size="small" effect="light">
            {{ row.count }}
          </el-tag>
          <span class="finance-row__label">{{ row.label }}</span>
        </div>
        <span class="finance-row__amount" :style="{ color: row.color }">
          {{ formatCurrency(row.amount, '¥') }}
        </span>
      </div>
    </div>
  </DashboardCard>
</template>

<style scoped lang="scss">
.finance-highlight {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: var(--app-spacing-xl);
  padding: var(--app-spacing-sm) 0;

  &__divider {
    height: 48px;
  }

  &__item {
    text-align: center;
  }

  &__label {
    font-size: var(--app-font-size-sm);
    color: var(--app-text-secondary);
    margin-bottom: var(--app-spacing-xs);
  }

  &__value--success {
    color: var(--app-color-success);
  }

  &__value--warning {
    color: var(--app-color-warning);
  }

  &__sub {
    font-size: var(--app-font-size-xs);
    color: var(--app-text-placeholder);
    margin-top: 2px;
  }
}

.finance-divider {
  margin: var(--app-spacing-md) 0;
}

.finance-rows {
  display: flex;
  flex-direction: column;
  gap: var(--app-spacing-sm);
}

.finance-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px var(--app-spacing-sm);
  border-radius: var(--app-radius-sm);
  transition: background-color var(--app-transition-base);

  &:hover {
    background-color: var(--app-bg-hover);
  }

  &__left {
    display: flex;
    align-items: center;
    gap: var(--app-spacing-sm);
  }

  &__label {
    font-size: var(--app-font-size-base);
    color: var(--app-text-regular);
  }

  &__amount {
    font-size: var(--app-font-size-base);
    font-weight: var(--app-font-weight-semibold);
    font-variant-numeric: tabular-nums;
  }
}
</style>
