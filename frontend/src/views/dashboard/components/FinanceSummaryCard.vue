<script setup lang="ts">
import { computed } from 'vue'
import { Money } from '@element-plus/icons-vue'
import type { FinanceSummary } from '@/types/dashboard'
import { useAppStore } from '@/stores/app'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  data: FinanceSummary
  loading: boolean
}>()

const appStore = useAppStore()
const { t } = useI18n({ useScope: 'global' })

function formatYen(amount: number): string {
  return `¥${Number(amount).toLocaleString(appStore.locale === 'zh-CN' ? 'zh-CN' : 'ja-JP')}`
}

const rows = computed(() => [
  {
    label: t('dashboard.finance.draft'),
    count: props.data.draftCount,
    amount: props.data.draftAmount,
    color: '#909399',
    tagType: 'info' as const,
  },
  {
    label: t('dashboard.finance.sent'),
    count: props.data.sentCount,
    amount: props.data.sentAmount,
    color: '#409eff',
    tagType: 'primary' as const,
  },
  {
    label: t('dashboard.finance.partial'),
    count: props.data.partialCount,
    amount: props.data.partialAmount,
    color: '#e6a23c',
    tagType: 'warning' as const,
  },
  {
    label: t('dashboard.finance.overdue'),
    count: props.data.overdueCount,
    amount: props.data.overdueAmount,
    color: '#f56c6c',
    tagType: 'danger' as const,
  },
])
</script>

<template>
  <el-card shadow="never" class="finance-card">
    <template #header>
      <div class="card-header">
        <span class="card-header__title">
          <el-icon color="#409eff"><Money /></el-icon>
          {{ t('dashboard.finance.title') }}
        </span>
      </div>
    </template>

    <el-skeleton :loading="loading" animated :rows="5">
      <template #default>
        <div class="finance-highlight">
          <div class="finance-highlight__item">
            <div class="finance-highlight__label">{{ t('dashboard.finance.monthlyCollected') }}</div>
            <div class="finance-highlight__value finance-highlight__value--success">
              {{ formatYen(data.monthlyCollected) }}
            </div>
            <div class="finance-highlight__sub">
              {{ t('dashboard.finance.countUnit', { count: data.monthlyCollectedCount }) }}
            </div>
          </div>
          <el-divider direction="vertical" class="finance-highlight__divider" />
          <div class="finance-highlight__item">
            <div class="finance-highlight__label">{{ t('dashboard.finance.outstandingTotal') }}</div>
            <div class="finance-highlight__value finance-highlight__value--warning">
              {{ formatYen(data.sentAmount + data.partialAmount) }}
            </div>
            <div class="finance-highlight__sub">
              {{ t('dashboard.finance.countUnit', { count: data.sentCount + data.partialCount }) }}
            </div>
          </div>
        </div>

        <el-divider style="margin: 12px 0" />

        <div class="finance-rows">
          <div v-for="row in rows" :key="row.label" class="finance-row">
            <div class="finance-row__left">
              <el-tag :type="row.tagType" size="small" effect="light">
                {{ row.count }}
              </el-tag>
              <span class="finance-row__label">{{ row.label }}</span>
            </div>
            <span class="finance-row__amount" :style="{ color: row.color }">
              {{ formatYen(row.amount) }}
            </span>
          </div>
        </div>
      </template>
    </el-skeleton>
  </el-card>
</template>

<style scoped lang="scss">
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;

  &__title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-weight: 600;
    font-size: 15px;
  }
}

.finance-highlight {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 24px;
  padding: 8px 0;

  &__divider {
    height: 48px;
  }

  &__item {
    text-align: center;
  }

  &__label {
    font-size: 13px;
    color: #909399;
    margin-bottom: 4px;
  }

  &__value {
    font-size: 22px;
    font-weight: 600;
    line-height: 1.3;

    &--success {
      color: #67c23a;
    }

    &--warning {
      color: #e6a23c;
    }
  }

  &__sub {
    font-size: 12px;
    color: #c0c4cc;
    margin-top: 2px;
  }
}

.finance-rows {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.finance-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 8px;
  border-radius: 4px;

  &:hover {
    background-color: #fafafa;
  }

  &__left {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  &__label {
    font-size: 14px;
    color: #606266;
  }

  &__amount {
    font-size: 14px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
}
</style>
