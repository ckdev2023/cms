<script setup lang="ts">
import { Refresh } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'

import ExpiringList from './components/ExpiringList.vue'
import FinanceSummaryCard from './components/FinanceSummaryCard.vue'
import RecentActivityList from './components/RecentActivityList.vue'
import SummaryCards from './components/SummaryCards.vue'
import { useDashboard } from './composables/useDashboard'

const {
  loadingStates,
  summary,
  expiringItems,
  financeSummary,
  recentActivity,
  fetchAll,
} = useDashboard()
const { t } = useI18n({ useScope: 'global' })
</script>

<template>
  <div class="dashboard">
    <header class="dashboard__header">
      <h1 class="dashboard__title">{{ t('dashboard.title') }}</h1>
      <el-button :icon="Refresh" circle size="small" @click="fetchAll" />
    </header>

    <!-- Tier 1: KPI hero strip — at-a-glance metrics -->
    <section class="dashboard__kpi">
      <SummaryCards :data="summary" :loading="loadingStates.summary" />
    </section>

    <!-- Tier 2: Primary workspace — action-oriented modules -->
    <section class="dashboard__primary">
      <div class="dashboard__primary-grid">
        <ExpiringList :items="expiringItems" :loading="loadingStates.expiring" />
        <FinanceSummaryCard :data="financeSummary" :loading="loadingStates.finance" />
      </div>
    </section>

    <!-- Tier 3: Secondary — informational feed -->
    <section class="dashboard__secondary">
      <RecentActivityList :items="recentActivity" :loading="loadingStates.activity" />
    </section>
  </div>
</template>

<style lang="scss">
@use './components/card-system';
</style>

<style scoped lang="scss">
.dashboard {
  display: flex;
  flex-direction: column;
  gap: var(--app-spacing-xl);

  &__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  &__title {
    font-size: var(--app-font-size-2xl);
    font-weight: var(--app-font-weight-semibold);
    color: var(--app-text-primary);
    margin: 0;
    line-height: 1.3;
  }

  &__primary-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--app-spacing-base);
  }
}

@media (max-width: 992px) {
  .dashboard__primary-grid {
    grid-template-columns: 1fr;
  }
}
</style>
