<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { Warning } from '@element-plus/icons-vue'
import type { ExpiringItem } from '@/types/dashboard'
import { AdminCaseStatusLabel, MonthlyStatusLabel } from '@/constants/enum-labels'
import type { AdminCaseStatus, MonthlyStatus } from '@/constants/enums'
import { useI18n } from 'vue-i18n'

defineProps<{
  items: ExpiringItem[]
  loading: boolean
}>()

const router = useRouter()
const { t } = useI18n({ useScope: 'global' })

const urgencyTag = computed(() => (daysLeft: number) => {
  if (daysLeft < 0) return { type: 'danger' as const, text: t('dashboard.expiring.overdue') }
  return {
    type: daysLeft <= 3 ? ('danger' as const) : daysLeft <= 7 ? ('warning' as const) : ('info' as const),
    text: t('dashboard.expiring.remainingDays', { days: daysLeft }),
  }
})

function statusLabel(item: ExpiringItem): string {
  if (item.type === 'admin_case') {
    return AdminCaseStatusLabel[item.status as AdminCaseStatus] ?? item.status
  }
  return MonthlyStatusLabel[item.status as MonthlyStatus] ?? item.status
}

function typeLabel(type: string): string {
  return type === 'admin_case'
    ? t('dashboard.expiring.typeAdminCase')
    : t('dashboard.expiring.typeTaxFiling')
}

function handleRowClick(item: ExpiringItem) {
  if (item.type === 'admin_case') {
    router.push(`/admin-cases/${item.id}`)
  } else {
    router.push(`/customers/${item.customerId}`)
  }
}
</script>

<template>
  <el-card shadow="never" class="expiring-card">
    <template #header>
      <div class="card-header">
        <span class="card-header__title">
          <el-icon color="#e6a23c"><Warning /></el-icon>
          {{ t('dashboard.expiring.title') }}
        </span>
        <el-tag v-if="items.length" size="small" type="warning">
          {{ t('dashboard.expiring.countUnit', { count: items.length }) }}
        </el-tag>
      </div>
    </template>

    <el-skeleton :loading="loading" animated :rows="4">
      <template #default>
        <div v-if="items.length === 0" class="empty-state">
          <el-empty :description="t('dashboard.expiring.empty')" :image-size="80" />
        </div>
        <el-scrollbar v-else max-height="360">
          <div
            v-for="item in items"
            :key="`${item.type}-${item.id}`"
            class="expiring-item"
            @click="handleRowClick(item)"
          >
            <div class="expiring-item__left">
              <el-tag
                size="small"
                :type="item.type === 'admin_case' ? 'primary' : 'success'"
                effect="plain"
                class="expiring-item__type"
              >
                {{ typeLabel(item.type) }}
              </el-tag>
              <div class="expiring-item__info">
                <div class="expiring-item__title">{{ item.title }}</div>
                <div class="expiring-item__meta">
                  {{ item.customerName }} · {{ statusLabel(item) }} · {{ item.deadline }}
                </div>
              </div>
            </div>
            <el-tag
              size="small"
              :type="urgencyTag(item.daysLeft).type"
              effect="dark"
              round
            >
              {{ urgencyTag(item.daysLeft).text }}
            </el-tag>
          </div>
        </el-scrollbar>
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

.empty-state {
  padding: 20px 0;
}

.expiring-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.2s;

  &:hover {
    background-color: #f5f7fa;
  }

  & + & {
    border-top: 1px solid #f0f0f0;
  }

  &__left {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
    flex: 1;
  }

  &__type {
    flex-shrink: 0;
  }

  &__info {
    min-width: 0;
  }

  &__title {
    font-size: 14px;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__meta {
    font-size: 12px;
    color: #909399;
    margin-top: 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}
</style>
