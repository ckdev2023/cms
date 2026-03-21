<script setup lang="ts">
import { useRouter } from 'vue-router'
import { ChatLineSquare, Document, Clock } from '@element-plus/icons-vue'
import type { RecentActivityItem } from '@/types/dashboard'
import { useAppStore } from '@/stores/app'
import { useI18n } from 'vue-i18n'

defineProps<{
  items: RecentActivityItem[]
  loading: boolean
}>()

const router = useRouter()
const appStore = useAppStore()
const { t } = useI18n({ useScope: 'global' })

const iconMap = { note: ChatLineSquare, file: Document }

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
  return d.toLocaleDateString(appStore.locale === 'zh-CN' ? 'zh-CN' : 'ja-JP')
}

function handleClick(item: RecentActivityItem) {
  if (item.customerId) {
    router.push(`/customers/${item.customerId}`)
  }
}
</script>

<template>
  <el-card shadow="never" class="activity-card">
    <template #header>
      <div class="card-header">
        <span class="card-header__title">
          <el-icon color="#67c23a"><Clock /></el-icon>
          {{ t('dashboard.recentActivity.title') }}
        </span>
        <el-tag v-if="items.length" size="small">
          {{ t('dashboard.recentActivity.countUnit', { count: items.length }) }}
        </el-tag>
      </div>
    </template>

    <el-skeleton :loading="loading" animated :rows="4">
      <template #default>
        <div v-if="items.length === 0" class="empty-state">
          <el-empty :description="t('dashboard.recentActivity.empty')" :image-size="80" />
        </div>
        <el-scrollbar v-else max-height="360">
          <div
            v-for="item in items"
            :key="item.id"
            class="activity-item"
            :class="{ 'activity-item--clickable': !!item.customerId }"
            @click="handleClick(item)"
          >
            <div class="activity-item__icon-wrap">
              <el-icon
                :size="18"
                :color="item.type === 'note' ? '#409eff' : '#67c23a'"
              >
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

.activity-item {
  display: flex;
  gap: 12px;
  padding: 10px 8px;
  border-radius: 6px;
  transition: background-color 0.2s;

  &--clickable {
    cursor: pointer;
  }

  &:hover {
    background-color: #f5f7fa;
  }

  & + & {
    border-top: 1px solid #f0f0f0;
  }

  &__icon-wrap {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    background-color: #f4f4f5;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
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
    font-size: 14px;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__time {
    font-size: 12px;
    color: #c0c4cc;
    flex-shrink: 0;
    margin-left: 8px;
  }

  &__desc {
    font-size: 13px;
    color: #606266;
    margin-top: 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__meta {
    font-size: 12px;
    color: #909399;
    margin-top: 4px;
    display: flex;
    gap: 8px;

    span::before {
      content: '·';
      margin-right: 4px;
    }

    span:first-child::before {
      content: '';
      margin-right: 0;
    }
  }
}
</style>
