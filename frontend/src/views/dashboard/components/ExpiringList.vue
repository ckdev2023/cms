<script setup lang="ts">
import { Warning } from '@element-plus/icons-vue'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { type NavigationFailure, useRouter } from 'vue-router'

import { AdminCaseStatusLabel, MonthlyStatusLabel } from '@/constants/enum-labels'
import type { AdminCaseStatus, MonthlyStatus } from '@/constants/enums'
import type { ExpiringItem } from '@/types/dashboard'

import DashboardCard from './DashboardCard.vue'

const props = defineProps<{
  items: ExpiringItem[]
  loading: boolean
}>()

interface ExpiringDisplayItem extends ExpiringItem {
  statusText: string
  typeText: string
  urgency: {
    type: 'danger' | 'warning' | 'info'
    text: string
  }
}

const router = useRouter()
const { t } = useI18n({ useScope: 'global' })

/**
 * 根据剩余天数返回到期提醒标签样式与文案。
 *
 * @param daysLeft - 距离截止日期的剩余天数，负数表示已逾期
 * @returns 供标签组件直接消费的状态类型与展示文本
 */
function resolveUrgencyTag(daysLeft: number): ExpiringDisplayItem['urgency'] {
  if (daysLeft < 0) return { type: 'danger' as const, text: t('dashboard.expiring.overdue') }
  return {
    type: daysLeft <= 3 ? ('danger' as const) : daysLeft <= 7 ? ('warning' as const) : ('info' as const),
    text: t('dashboard.expiring.remainingDays', { days: daysLeft }),
  }
}

/**
 * 为到期项目解析业务状态的本地化名称。
 *
 * @param item - 仪表盘展示的到期项目
 * @returns 当前项目对应的状态标签文本
 */
function resolveStatusLabel(item: ExpiringItem): string {
  if (item.type === 'admin_case') {
    return AdminCaseStatusLabel[item.status as AdminCaseStatus] ?? item.status
  }
  return MonthlyStatusLabel[item.status as MonthlyStatus] ?? item.status
}

function resolveTypeLabel(type: ExpiringItem['type']): string {
  return type === 'admin_case'
    ? t('dashboard.expiring.typeAdminCase')
    : t('dashboard.expiring.typeTaxFiling')
}

const displayItems = computed<ExpiringDisplayItem[]>(() => props.items.map((item) => ({
  ...item,
  statusText: resolveStatusLabel(item),
  typeText: resolveTypeLabel(item.type),
  urgency: resolveUrgencyTag(item.daysLeft),
})))

/**
 * 根据到期项目类型跳转到对应的详情页。
 *
 * @param item - 用户点击的到期项目
 * @returns 路由跳转 Promise，供点击事件复用
 */
function handleRowClick(item: ExpiringItem): Promise<void | NavigationFailure> {
  if (item.type === 'admin_case') {
    return router.push(`/admin-cases/${item.id}`)
  }
  return router.push(`/customers/${item.customerId}`)
}
</script>

<template>
  <DashboardCard
    :title="t('dashboard.expiring.title')"
    :icon="Warning"
    icon-color="var(--app-color-warning)"
    :loading="loading"
  >
    <template #header-extra>
      <el-tag v-if="displayItems.length" size="small" type="warning">
        {{ t('dashboard.expiring.countUnit', { count: displayItems.length }) }}
      </el-tag>
    </template>

    <div v-if="displayItems.length === 0" class="dc-empty">
      <el-empty :description="t('dashboard.expiring.empty')" :image-size="80" />
    </div>
    <el-scrollbar v-else max-height="360">
      <div
        v-for="item in displayItems"
        :key="`${item.type}-${item.id}`"
        class="dc-list-item dc-list-item--clickable"
        @click="handleRowClick(item)"
      >
        <div class="expiring-item__left">
          <el-tag
            size="small"
            :type="item.type === 'admin_case' ? 'primary' : 'success'"
            effect="plain"
            class="expiring-item__badge"
          >
            {{ item.typeText }}
          </el-tag>
          <div class="expiring-item__info">
            <div class="expiring-item__title">{{ item.title }}</div>
            <div class="expiring-item__meta">
              {{ item.customerName }} · {{ item.statusText }} · {{ item.deadline }}
            </div>
          </div>
        </div>
        <el-tag
          size="small"
          :type="item.urgency.type"
          effect="dark"
          round
        >
          {{ item.urgency.text }}
        </el-tag>
      </div>
    </el-scrollbar>
  </DashboardCard>
</template>

<style scoped lang="scss">
.expiring-item {
  &__left {
    display: flex;
    align-items: center;
    gap: var(--app-spacing-sm);
    min-width: 0;
    flex: 1;
  }

  &__badge {
    flex-shrink: 0;
  }

  &__info {
    min-width: 0;
  }

  &__title {
    font-size: var(--app-font-size-base);
    font-weight: var(--app-font-weight-medium);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__meta {
    font-size: var(--app-font-size-xs);
    color: var(--app-text-secondary);
    margin-top: 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}
</style>
