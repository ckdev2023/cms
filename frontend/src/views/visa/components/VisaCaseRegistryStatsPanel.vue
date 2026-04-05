<script setup lang="ts">
import { Refresh } from '@element-plus/icons-vue'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { getVisaDomainStats } from '@/api/visa-case'
import { VisaCaseStatusLabel, VisaReminderTypeLabel } from '@/constants/enum-labels'
import { VisaDataScope, VisaReminderType } from '@/constants/enums'
import type { GlobalVisaCaseQueryParams, VisaDomainStats } from '@/types/visa-case'
import { VISA_REMINDER_BUCKET_DISPLAY_ORDER } from '@/utils/visa-reminder-type-ui'

const props = defineProps<{
  /** 与表格 `searchParams` 一致的全局列表筛选（不含 dataScope 时由下列字段注入） */
  listQuery: Partial<GlobalVisaCaseQueryParams>
  /** 与列表 `GET /visa-cases` 的 dataScope 一致 */
  dataScope: VisaDataScope
  /**
   * 为 true 时弱化外侧卡片样式，供父级 `el-collapse` 内嵌，避免双边框与过多留白。
   */
  embeddedInCollapse?: boolean
}>()

defineOptions({ name: 'VisaCaseRegistryStatsPanel' })

const { t } = useI18n({ useScope: 'global' })

const loading = ref(false)
const errorMessage = ref('')
const stats = ref<VisaDomainStats | null>(null)

/** 与 `VisaCaseRegistrySearchForm`、客户列表、`/visa-reminders` 同源顺序（`docs/25` §4.2 优先级）。 */
const reminderBucketKeys = VISA_REMINDER_BUCKET_DISPLAY_ORDER

/**
 * 按当前负责人收窄条件请求签证域统计并写入本地状态。
 *
 * @returns Promise，在请求结束后解析
 */
async function loadStats(): Promise<void> {
  loading.value = true
  errorMessage.value = ''
  try {
    const res = await getVisaDomainStats({
      ...props.listQuery,
      dataScope: props.dataScope,
    })
    stats.value = res.data
  } catch {
    errorMessage.value = t('pages.visaCaseRegistry.stats.loadError')
    stats.value = null
  } finally {
    loading.value = false
  }
}

watch(
  () => [props.listQuery, props.dataScope] as const,
  () => {
    void loadStats()
  },
  { deep: true, immediate: true },
)

defineExpose({
  reload: loadStats,
})

const statusRows = computed(() => {
  const payload = stats.value
  if (!payload) {return []}
  return payload.caseStatusCounts
    .filter((row) => row.count > 0)
    .slice()
    .sort((a, b) => b.count - a.count)
})

/**
 * 读取提醒桶对象上某一提醒类型对应的计数字段值。
 *
 * @param payload - 后端返回的域统计体
 * @param key - 提醒类型枚举
 * @returns 该桶内案件件数
 */
function bucketCount(payload: VisaDomainStats, key: (typeof reminderBucketKeys)[number]): number {
  if (key === VisaReminderType.SUPPLEMENT) {return payload.reminderBuckets.supplement}
  if (key === VisaReminderType.TODAY_FOLLOW_UP) {return payload.reminderBuckets.todayFollowUp}
  if (key === VisaReminderType.EXPIRING_7_DAYS) {return payload.reminderBuckets.expiring7Days}
  return payload.reminderBuckets.expiring2Months
}
</script>

<template>
  <section
    class="visa-registry-stats"
    :class="{ 'visa-registry-stats--embedded': props.embeddedInCollapse }"
    aria-label="visa-domain-stats"
  >
    <div
      class="visa-registry-stats__head"
      :class="{ 'visa-registry-stats__head--embedded': props.embeddedInCollapse }"
    >
      <h3 v-if="!props.embeddedInCollapse" class="visa-registry-stats__title">
        {{ t('pages.visaCaseRegistry.stats.title') }}
      </h3>
      <div class="visa-registry-stats__head-actions">
        <el-tooltip
          :content="t('pages.visaCaseRegistry.stats.scopeHint')"
          placement="top-start"
          :max-width="420"
          :show-after="200"
        >
          <el-button link type="primary" class="visa-registry-stats__hint-link">
            {{ t('pages.visaCaseRegistry.stats.scopeHintLink') }}
          </el-button>
        </el-tooltip>
        <el-button
          type="primary"
          link
          :icon="Refresh"
          :loading="loading"
          @click="loadStats"
        >
          {{ t('pages.visaCaseRegistry.stats.reload') }}
        </el-button>
      </div>
    </div>

    <el-alert v-if="errorMessage" type="error" :closable="false" show-icon class="visa-registry-stats__alert">
      {{ errorMessage }}
    </el-alert>

    <el-skeleton v-else-if="loading && !stats" animated :rows="4" class="visa-registry-stats__skeleton" />

    <template v-else-if="stats">
      <h4 class="visa-registry-stats__sub">{{ t('pages.visaCaseRegistry.stats.kpiTitle') }}</h4>
      <el-row :gutter="12" class="visa-registry-stats__row">
        <el-col :xs="12" :sm="12" :md="6">
          <div class="visa-registry-stats__card">
            <div class="visa-registry-stats__card-label">
              {{ t('pages.visaCaseRegistry.stats.expiringWithin7Days') }}
            </div>
            <div class="visa-registry-stats__card-value">{{ stats.expiringWithin7DaysWindow }}</div>
          </div>
        </el-col>
        <el-col :xs="12" :sm="12" :md="6">
          <div class="visa-registry-stats__card">
            <div class="visa-registry-stats__card-label">
              {{ t('pages.visaCaseRegistry.stats.todayFollowUp') }}
            </div>
            <div class="visa-registry-stats__card-value">{{ stats.todayFollowUpCount }}</div>
          </div>
        </el-col>
        <el-col :xs="12" :sm="12" :md="6">
          <div class="visa-registry-stats__card">
            <div class="visa-registry-stats__card-label">
              {{ t('pages.visaCaseRegistry.stats.supplementRelated') }}
            </div>
            <div class="visa-registry-stats__card-value">{{ stats.supplementRelatedCount }}</div>
          </div>
        </el-col>
        <el-col :xs="12" :sm="12" :md="6">
          <div class="visa-registry-stats__card">
            <div class="visa-registry-stats__card-label">
              {{ t('pages.visaCaseRegistry.stats.unassignedCount') }}
            </div>
            <div class="visa-registry-stats__card-value">{{ stats.unassignedCount }}</div>
          </div>
        </el-col>
      </el-row>

      <h4 class="visa-registry-stats__sub">{{ t('pages.visaCaseRegistry.stats.reminderBuckets') }}</h4>
      <el-row :gutter="12" class="visa-registry-stats__row">
        <el-col v-for="bk in reminderBucketKeys" :key="bk" :xs="12" :sm="8" :md="6" :lg="4">
          <div class="visa-registry-stats__card visa-registry-stats__card--compact">
            <div class="visa-registry-stats__card-label">{{ VisaReminderTypeLabel[bk] }}</div>
            <div class="visa-registry-stats__card-value">{{ bucketCount(stats, bk) }}</div>
          </div>
        </el-col>
        <el-col :xs="12" :sm="8" :md="6" :lg="4">
          <div class="visa-registry-stats__card visa-registry-stats__card--compact">
            <div class="visa-registry-stats__card-label">
              {{ t('pages.visaCaseRegistry.stats.bucketNoBucket') }}
            </div>
            <div class="visa-registry-stats__card-value">{{ stats.reminderBuckets.noBucket }}</div>
          </div>
        </el-col>
      </el-row>

      <h4 class="visa-registry-stats__sub">{{ t('pages.visaCaseRegistry.stats.statusDistribution') }}</h4>
      <div v-if="statusRows.length" class="visa-registry-stats__tags">
        <el-tag
          v-for="row in statusRows"
          :key="row.caseStatus"
          size="small"
          class="visa-registry-stats__tag"
        >
          {{ VisaCaseStatusLabel[row.caseStatus] }} · {{ row.count }}
        </el-tag>
      </div>
      <el-empty v-else :description="t('pages.visaCaseRegistry.stats.noStatusData')" :image-size="64" />
    </template>
  </section>
</template>

<style scoped lang="scss">
.visa-registry-stats {
  margin: 0 var(--app-spacing-lg) var(--app-spacing-md);
  padding: var(--app-spacing-md);
  border-radius: var(--el-border-radius-base);
  background: var(--el-fill-color-blank);
  border: 1px solid var(--el-border-color-lighter);

  &--embedded {
    margin: 0;
    padding: 0;
    border: none;
    background: transparent;
  }

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--app-spacing-sm);
    margin-bottom: var(--app-spacing-xs);

    &--embedded {
      justify-content: flex-end;
      margin-bottom: var(--app-spacing-sm);
    }
  }

  &__head-actions {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: var(--app-spacing-xs);
  }

  &__hint-link {
    padding: 0 4px;
  }

  &__title {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  &__sub {
    margin: var(--app-spacing-md) 0 var(--app-spacing-sm);
    font-size: 14px;
    font-weight: 600;
    color: var(--el-text-color-regular);
  }

  &__sub:first-of-type {
    margin-top: 0;
  }

  &__alert {
    margin-bottom: var(--app-spacing-sm);
  }

  &__skeleton {
    padding: var(--app-spacing-sm) 0;
  }

  &__row {
    margin-bottom: var(--app-spacing-xs);
  }

  &__card {
    padding: var(--app-spacing-md);
    border-radius: var(--el-border-radius-base);
    background: var(--el-bg-color);
    border: 1px solid var(--el-border-color-lighter);
    margin-bottom: var(--app-spacing-sm);
    min-height: 88px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 4px;

    &--compact {
      min-height: 72px;
    }
  }

  &__card-label {
    font-size: 12px;
    color: var(--el-text-color-secondary);
    line-height: 1.35;
  }

  &__card-value {
    font-size: 22px;
    font-weight: 600;
    color: var(--el-text-color-primary);
    font-variant-numeric: tabular-nums;
  }

  &__tags {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  &__tag {
    font-variant-numeric: tabular-nums;
  }
}
</style>
