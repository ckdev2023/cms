<script setup lang="ts">
import { ChatLineSquare, Clock, Document } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import type { RecentActivityItem } from '@/types/dashboard'
import { useLocaleFormatter } from '@/utils/locale-format'

import DashboardCard from './DashboardCard.vue'

defineProps<{
  items: RecentActivityItem[]
  loading: boolean
}>()

const router = useRouter()
const { intlLocale } = useLocaleFormatter()
const { t } = useI18n({ useScope: 'global' })

const iconMap = { note: ChatLineSquare, file: Document }

/**
 * 将活动时间格式化为相对时间或本地化日期。
 *
 * @param isoStr - 后端返回的 ISO 时间字符串
 * @returns 适合活动流展示的简短时间文本
 */
function formatTime(isoStr: string): string {
  const d = new Date(isoStr)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return t('dashboard.recentActivity.justNow')
  if (diffMin < 60) return t('dashboard.recentActivity.minutesAgo', { count: diffMin })
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return t('dashboard.recentActivity.hoursAgo', { count: diffH })
  const diffD = Math.floor(diffH / 24)
  if (diffD < 7) return t('dashboard.recentActivity.daysAgo', { count: diffD })
  return d.toLocaleDateString(intlLocale.value)
}

function handleClick(item: RecentActivityItem) {
  if (item.customerId) {
    router.push(`/customers/${item.customerId}`)
  }
}
</script>

<template>
  <DashboardCard
    :title="t('dashboard.recentActivity.title')"
    :icon="Clock"
    icon-color="var(--app-color-success)"
    :loading="loading"
  >
    <template #header-extra>
      <el-tag v-if="items.length" size="small">
        {{ t('dashboard.recentActivity.countUnit', { count: items.length }) }}
      </el-tag>
    </template>

    <div v-if="items.length === 0" class="dc-empty">
      <el-empty :description="t('dashboard.recentActivity.empty')" :image-size="80" />
    </div>
    <el-scrollbar v-else max-height="360">
      <div
        v-for="item in items"
        :key="item.id"
        class="dc-list-item"
        :class="{ 'dc-list-item--clickable': !!item.customerId }"
        @click="handleClick(item)"
      >
        <div
          class="dc-icon-badge activity-item__icon"
          :class="item.type === 'note' ? 'activity-item__icon--note' : 'activity-item__icon--file'"
        >
          <el-icon :size="18">
            <component :is="iconMap[item.type]" />
          </el-icon>
        </div>
        <div class="activity-item__content">
          <div class="activity-item__header">
            <span class="activity-item__title">{{ item.title }}</span>
            <span class="activity-item__time">{{ formatTime(item.createdAt) }}</span>
          </div>
          <div class="activity-item__desc">{{ item.description }}</div>
          <div class="activity-item__meta">
            <span v-if="item.customerName">{{ item.customerName }}</span>
            <span v-if="item.creatorName">{{ item.creatorName }}</span>
          </div>
        </div>
      </div>
    </el-scrollbar>
  </DashboardCard>
</template>

<style scoped lang="scss">
.activity-item {
  &__icon {
    &--note {
      color: var(--app-color-primary);
      background: var(--app-color-primary-light);
    }

    &--file {
      color: var(--app-color-success);
      background: var(--app-color-success-light);
    }
  }

  &__content {
    flex: 1;
    min-width: 0;
  }

  &__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  &__title {
    font-size: var(--app-font-size-base);
    font-weight: var(--app-font-weight-medium);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__time {
    font-size: var(--app-font-size-xs);
    color: var(--app-text-placeholder);
    flex-shrink: 0;
    margin-left: var(--app-spacing-sm);
  }

  &__desc {
    font-size: var(--app-font-size-sm);
    color: var(--app-text-regular);
    margin-top: 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__meta {
    font-size: var(--app-font-size-xs);
    color: var(--app-text-secondary);
    margin-top: var(--app-spacing-xs);
    display: flex;
    gap: var(--app-spacing-sm);

    span::before {
      content: '·';
      margin-right: var(--app-spacing-xs);
    }

    span:first-child::before {
      content: '';
      margin-right: 0;
    }
  }
}
</style>
