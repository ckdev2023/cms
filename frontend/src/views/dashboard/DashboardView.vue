<script setup lang="ts">
import { Refresh } from '@element-plus/icons-vue'
import { useDashboard } from './composables/useDashboard'
import SummaryCards from './components/SummaryCards.vue'
import ExpiringList from './components/ExpiringList.vue'
import FinanceSummaryCard from './components/FinanceSummaryCard.vue'
import RecentActivityList from './components/RecentActivityList.vue'
import { useI18n } from 'vue-i18n'

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
  <div class="dashboard-page">
    <div class="dashboard-page__header">
      <h2 class="dashboard-page__title">{{ t('dashboard.title') }}</h2>
      <el-button :icon="Refresh" circle @click="fetchAll" />
    </div>

    <SummaryCards :data="summary" :loading="loadingStates.summary" />

    <el-row :gutter="16">
      <el-col :xs="24" :lg="12">
        <ExpiringList :items="expiringItems" :loading="loadingStates.expiring" />
      </el-col>
      <el-col :xs="24" :lg="12">
        <FinanceSummaryCard :data="financeSummary" :loading="loadingStates.finance" />
      </el-col>
    </el-row>

    <RecentActivityList :items="recentActivity" :loading="loadingStates.activity" />
  </div>
</template>

<style scoped lang="scss">
.dashboard-page {
  &__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }

  &__title {
    font-size: 20px;
    font-weight: 600;
    margin: 0;
  }

  .el-col {
    margin-bottom: 16px;
  }
}
</style>
