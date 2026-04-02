<script setup lang="ts">
import { Document, Money, Tickets, User } from '@element-plus/icons-vue'
import { type Component, computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { DashboardSummary } from '@/types/dashboard'

defineProps<{
  data: DashboardSummary
  loading: boolean
}>()

interface KpiCard {
  key: keyof DashboardSummary
  labelKey: string
  icon: Component
  accent: string
  tint: string
}

const { t } = useI18n({ useScope: 'global' })

const cards = computed<KpiCard[]>(() => [
  {
    key: 'activeCustomers',
    labelKey: 'dashboard.summary.activeCustomers',
    icon: User,
    accent: 'var(--app-color-primary)',
    tint: 'var(--app-color-primary-light)',
  },
  {
    key: 'activeCases',
    labelKey: 'dashboard.summary.activeCases',
    icon: Document,
    accent: 'var(--app-color-success)',
    tint: 'var(--app-color-success-light)',
  },
  {
    key: 'pendingInvoices',
    labelKey: 'dashboard.summary.pendingInvoices',
    icon: Money,
    accent: 'var(--app-color-warning)',
    tint: 'var(--app-color-warning-light)',
  },
  {
    key: 'activeContracts',
    labelKey: 'dashboard.summary.activeContracts',
    icon: Tickets,
    accent: 'var(--app-color-info)',
    tint: 'var(--app-color-info-light)',
  },
])
</script>

<template>
  <div class="kpi-strip">
    <div
      v-for="card in cards"
      :key="card.key"
      class="kpi-card"
      :style="{ '--_accent': card.accent, '--_tint': card.tint }"
    >
      <el-skeleton :loading="loading" animated :rows="1">
        <template #default>
          <div class="dc-icon-badge kpi-card__icon">
            <el-icon :size="18">
              <component :is="card.icon" />
            </el-icon>
          </div>
          <div class="dc-metric dc-metric--xl kpi-card__value">{{ data[card.key] }}</div>
          <div class="kpi-card__label">{{ t(card.labelKey) }}</div>
        </template>
      </el-skeleton>
    </div>
  </div>
</template>

<style scoped lang="scss">
.kpi-strip {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--app-spacing-base);
}

.kpi-card {
  background: var(--app-bg-base);
  border: 1px solid var(--app-border-color-light);
  border-radius: var(--app-radius-lg);
  padding: var(--app-spacing-lg) var(--app-spacing-xl);
  position: relative;
  overflow: hidden;
  transition: box-shadow var(--app-transition-base),
              transform var(--app-transition-base);

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: var(--_accent);
    border-radius: var(--app-radius-lg) var(--app-radius-lg) 0 0;
  }

  &:hover {
    box-shadow: var(--app-shadow-md);
    transform: translateY(-1px);
  }

  &__icon {
    background: var(--_tint);
    color: var(--_accent);
    margin-bottom: var(--app-spacing-md);
  }

  &__value {
    margin-bottom: var(--app-spacing-xs);
  }

  &__label {
    font-size: var(--app-font-size-sm);
    color: var(--app-text-secondary);
    line-height: 1.4;
  }
}

@media (max-width: 992px) {
  .kpi-strip {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 576px) {
  .kpi-strip {
    grid-template-columns: 1fr;
  }
}
</style>
