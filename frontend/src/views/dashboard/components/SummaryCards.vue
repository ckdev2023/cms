<script setup lang="ts">
import { computed, type Component } from 'vue'
import { User, Document, Money, Tickets } from '@element-plus/icons-vue'
import type { DashboardSummary } from '@/types/dashboard'
import { useI18n } from 'vue-i18n'

defineProps<{
  data: DashboardSummary
  loading: boolean
}>()

interface SummaryCard {
  key: keyof DashboardSummary
  labelKey: string
  icon: Component
  color: string
}

const { t } = useI18n({ useScope: 'global' })

const cards = computed<SummaryCard[]>(() => [
  { key: 'activeCustomers', labelKey: 'dashboard.summary.activeCustomers', icon: User, color: '#409eff' },
  { key: 'activeCases', labelKey: 'dashboard.summary.activeCases', icon: Document, color: '#67c23a' },
  { key: 'pendingInvoices', labelKey: 'dashboard.summary.pendingInvoices', icon: Money, color: '#e6a23c' },
  { key: 'activeContracts', labelKey: 'dashboard.summary.activeContracts', icon: Tickets, color: '#909399' },
])
</script>

<template>
  <el-row :gutter="16">
    <el-col v-for="card in cards" :key="card.key" :xs="12" :sm="12" :md="6">
      <el-card shadow="hover" class="summary-card" :body-style="{ padding: '20px' }">
        <el-skeleton :loading="loading" animated :rows="1">
          <template #default>
            <div class="summary-card__body">
              <div class="summary-card__info">
                <div class="summary-card__label">{{ t(card.labelKey) }}</div>
                <div class="summary-card__value" :style="{ color: card.color }">
                  {{ data[card.key] }}
                </div>
              </div>
              <div class="summary-card__icon" :style="{ backgroundColor: card.color + '18' }">
                <el-icon :size="28" :style="{ color: card.color }">
                  <component :is="card.icon" />
                </el-icon>
              </div>
            </div>
          </template>
        </el-skeleton>
      </el-card>
    </el-col>
  </el-row>
</template>

<style scoped lang="scss">
.summary-card {
  margin-bottom: 16px;

  &__body {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  &__label {
    font-size: 14px;
    color: #909399;
    margin-bottom: 8px;
  }

  &__value {
    font-size: 28px;
    font-weight: 600;
    line-height: 1.2;
  }

  &__icon {
    width: 56px;
    height: 56px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
}
</style>
