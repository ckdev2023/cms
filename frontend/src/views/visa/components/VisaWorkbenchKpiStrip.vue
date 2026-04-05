<script setup lang="ts">
import { Calendar, Document, Files, User, WarningFilled } from '@element-plus/icons-vue'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { VisaReminderTypeLabel } from '@/constants/enum-labels'
import { VisaReminderType } from '@/constants/enums'
import type { VisaDomainStats, VisaWorkbenchAggregate } from '@/types/visa-case'
import { VISA_REMINDER_BUCKET_DISPLAY_ORDER } from '@/utils/visa-reminder-type-ui'
import { sumVisaOpenCaseCountFromStatusCounts } from '@/utils/visa-workbench-open-case-count'

const props = defineProps<{
  sectionTitle: string
  aggregate: VisaWorkbenchAggregate
  activeReminderFilter: VisaReminderType | ''
}>()

const emit = defineEmits<{
  /** 切换提醒桶筛选；空串表示清除桶条件（与提醒列表、路由 `reminderType` 同步） */
  filterReminderType: [next: VisaReminderType | '']
  /** 未指派：列表/API 未接好时的 MVP，由父级弹说明（不写 query） */
  openUnassignedMvp: []
  /** 四分桶以外：列表无对应 reminderType 时的 MVP，由父级弹说明（不写 query） */
  openNoBucketMvp: []
}>()

defineOptions({ name: 'VisaWorkbenchKpiStrip' })

const { t } = useI18n({ useScope: 'global' })

const stats = computed((): VisaDomainStats => props.aggregate.stats)

const openCaseTotal = computed((): number =>
  sumVisaOpenCaseCountFromStatusCounts(stats.value.caseStatusCounts),
)

const isSupplementUrgent = computed((): boolean => stats.value.supplementRelatedCount > 0)

const bucketOrder = VISA_REMINDER_BUCKET_DISPLAY_ORDER

/**
 * 读取域统计中某一提醒桶对应的计数字段。
 *
 * @param payload - 工作台聚合中的 `stats`
 * @param rt - 提醒类型
 * @returns 该桶件数
 */
function reminderBucketCount(payload: VisaDomainStats, rt: VisaReminderType): number {
  if (rt === VisaReminderType.SUPPLEMENT) {
    return payload.reminderBuckets.supplement
  }
  if (rt === VisaReminderType.TODAY_FOLLOW_UP) {
    return payload.reminderBuckets.todayFollowUp
  }
  if (rt === VisaReminderType.EXPIRING_7_DAYS) {
    return payload.reminderBuckets.expiring7Days
  }
  return payload.reminderBuckets.expiring2Months
}

/**
 * 通知父级更新路由 `reminderType`；再次点击已选桶则清除为「全部」。
 *
 * @param next - 目标提醒类型
 */
function selectReminderType(next: VisaReminderType): void {
  emit('filterReminderType', props.activeReminderFilter === next ? '' : next)
}

/**
 * 未指派 KPI：无列表筛选项时的 MVP，交由父级提示。
 */
function onUnassignedMvpClick(): void {
  emit('openUnassignedMvp')
}

/**
 * 四分桶以外 KPI：无列表筛选项时的 MVP，交由父级提示。
 */
function onNoBucketMvpClick(): void {
  emit('openNoBucketMvp')
}
</script>

<template>
  <section class="visa-workbench-kpi-strip">
    <h2 class="visa-workbench-kpi-strip__title">{{ props.sectionTitle }}</h2>
    <p class="visa-workbench-kpi-strip__hint">{{ t('pages.workbenchVisa.kpiStripHint') }}</p>
    <div
      class="visa-workbench-kpi-strip__toolbar"
      role="toolbar"
      :aria-label="t('pages.workbenchVisa.kpiStripToolbarAria')"
    >
      <el-tooltip placement="top" :show-after="200">
        <template #content>
          {{ t('pages.workbenchVisa.kpiOpenCasesFilterPending') }}
        </template>
        <div
          class="visa-workbench-kpi-strip__chip-host visa-workbench-kpi-strip__chip-host--stat"
          tabindex="0"
          role="group"
          aria-disabled="true"
          :aria-label="
            t('pages.workbenchVisa.kpiStatNonFilterableAria', {
              label: t('pages.workbenchVisa.kpiOpenCasesTotal'),
              count: openCaseTotal,
              hint: t('pages.workbenchVisa.kpiOpenCasesFilterPending'),
            })
          "
        >
          <div class="visa-workbench-kpi-strip__chip visa-workbench-kpi-strip__chip--readonly">
            <span class="visa-workbench-kpi-strip__chip-label">{{ t('pages.workbenchVisa.kpiOpenCasesTotal') }}</span>
            <span class="visa-workbench-kpi-strip__chip-value" aria-hidden="true">{{ openCaseTotal }}</span>
          </div>
        </div>
      </el-tooltip>

      <button
        type="button"
        class="visa-workbench-kpi-strip__chip visa-workbench-kpi-strip__chip--interactive visa-workbench-kpi-strip__chip--filter-all"
        :class="{ 'visa-workbench-kpi-strip__chip--active': props.activeReminderFilter === '' }"
        :aria-pressed="props.activeReminderFilter === ''"
        :aria-label="t('pages.workbenchVisa.kpiFilterAllAria')"
        @click="emit('filterReminderType', '')"
      >
        <span class="visa-workbench-kpi-strip__chip-main">
          <span class="visa-workbench-kpi-strip__chip-label">{{ t('pages.workbenchVisa.kpiChipFilterAll') }}</span>
        </span>
      </button>

      <button
        v-for="rt in bucketOrder"
        :key="rt"
        type="button"
        class="visa-workbench-kpi-strip__chip visa-workbench-kpi-strip__chip--interactive"
        :class="{
          'visa-workbench-kpi-strip__chip--supplement-urgent':
            rt === VisaReminderType.SUPPLEMENT && isSupplementUrgent,
          'visa-workbench-kpi-strip__chip--active': props.activeReminderFilter === rt,
        }"
        :aria-pressed="props.activeReminderFilter === rt"
        :aria-label="
          t('pages.workbenchVisa.kpiFilterAria', {
            label: VisaReminderTypeLabel[rt],
            count: reminderBucketCount(stats, rt),
          })
        "
        @click="selectReminderType(rt)"
      >
        <span class="visa-workbench-kpi-strip__chip-main">
          <span class="visa-workbench-kpi-strip__chip-label">{{ VisaReminderTypeLabel[rt] }}</span>
          <span
            v-if="rt === VisaReminderType.SUPPLEMENT && isSupplementUrgent"
            class="visa-workbench-kpi-strip__chip-icon-wrap visa-workbench-kpi-strip__chip-icon-wrap--danger"
            aria-hidden="true"
          >
            <el-icon class="visa-workbench-kpi-strip__chip-icon"><WarningFilled /></el-icon>
          </span>
          <el-icon
            v-else-if="rt === VisaReminderType.SUPPLEMENT"
            class="visa-workbench-kpi-strip__chip-icon visa-workbench-kpi-strip__chip-icon--muted"
            aria-hidden="true"
          >
            <Document />
          </el-icon>
          <el-icon
            v-else
            class="visa-workbench-kpi-strip__chip-icon"
            :class="{
              'visa-workbench-kpi-strip__chip-icon--today': rt === VisaReminderType.TODAY_FOLLOW_UP,
              'visa-workbench-kpi-strip__chip-icon--expiring': rt === VisaReminderType.EXPIRING_7_DAYS,
              'visa-workbench-kpi-strip__chip-icon--two-mo': rt === VisaReminderType.EXPIRING_2_MONTHS,
            }"
            aria-hidden="true"
          >
            <Calendar />
          </el-icon>
        </span>
        <span class="visa-workbench-kpi-strip__chip-value">{{ reminderBucketCount(stats, rt) }}</span>
      </button>

      <el-tooltip placement="top" :show-after="200">
        <template #content>
          {{ t('pages.workbenchVisa.kpiUnassignedFilterPending') }}
        </template>
        <button
          type="button"
          class="visa-workbench-kpi-strip__chip-host visa-workbench-kpi-strip__chip-host--mvp visa-workbench-kpi-strip__chip-host--mvp-button visa-workbench-kpi-strip__chip--interactive"
          :aria-label="
            t('pages.workbenchVisa.kpiUnassignedChipAria', { count: stats.unassignedCount })
          "
          @click="onUnassignedMvpClick"
        >
          <span class="visa-workbench-kpi-strip__chip visa-workbench-kpi-strip__chip--mvp-notice">
            <span class="visa-workbench-kpi-strip__chip-main">
              <span class="visa-workbench-kpi-strip__chip-label">{{ t('pages.workbenchVisa.unassigned') }}</span>
              <el-icon class="visa-workbench-kpi-strip__chip-icon visa-workbench-kpi-strip__chip-icon--user" aria-hidden="true">
                <User />
              </el-icon>
            </span>
            <span class="visa-workbench-kpi-strip__chip-value">{{ stats.unassignedCount }}</span>
          </span>
        </button>
      </el-tooltip>

      <el-tooltip placement="top" :show-after="200">
        <template #content>
          {{ t('pages.workbenchVisa.kpiNoBucketFilterPending') }}
        </template>
        <button
          type="button"
          class="visa-workbench-kpi-strip__chip-host visa-workbench-kpi-strip__chip-host--mvp visa-workbench-kpi-strip__chip-host--mvp-button visa-workbench-kpi-strip__chip--interactive"
          :aria-label="
            t('pages.workbenchVisa.kpiNoBucketChipAria', { count: stats.reminderBuckets.noBucket })
          "
          @click="onNoBucketMvpClick"
        >
          <span class="visa-workbench-kpi-strip__chip visa-workbench-kpi-strip__chip--mvp-notice">
            <span class="visa-workbench-kpi-strip__chip-main">
              <span class="visa-workbench-kpi-strip__chip-label">
                {{ t('pages.workbenchVisa.kpiNoBucketLabel') }}
              </span>
              <el-icon class="visa-workbench-kpi-strip__chip-icon visa-workbench-kpi-strip__chip-icon--muted" aria-hidden="true">
                <Files />
              </el-icon>
            </span>
            <span class="visa-workbench-kpi-strip__chip-value">
              {{ stats.reminderBuckets.noBucket }}
            </span>
          </span>
        </button>
      </el-tooltip>
    </div>
  </section>
</template>

<style scoped lang="scss">
.visa-workbench-kpi-strip {
  display: flex;
  flex-direction: column;
  gap: var(--app-spacing-sm);
}

.visa-workbench-kpi-strip__title {
  margin: 0;
  font-size: var(--app-font-size-lg);
  font-weight: var(--app-font-weight-semibold);
  color: var(--app-text-primary);
}

.visa-workbench-kpi-strip__hint {
  margin: 0;
  font-size: var(--app-font-size-xs);
  line-height: 1.45;
  color: var(--app-text-secondary);
}

.visa-workbench-kpi-strip__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: stretch;
  gap: 12px;

  > :deep(.el-tooltip__trigger) {
    display: flex;
    flex-direction: column;
    min-height: 0;
    min-width: 0;
  }
}

.visa-workbench-kpi-strip__chip-host {
  flex: 0 1 auto;
  display: flex;
  min-width: 0;
  border-radius: 10px;
  outline: none;

  &:focus-visible {
    outline: 2px solid var(--el-color-info);
    outline-offset: 2px;
  }
}

.visa-workbench-kpi-strip__chip-host--stat {
  cursor: help;
}

.visa-workbench-kpi-strip__chip-host--mvp-button {
  appearance: none;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  font: inherit;
  color: inherit;
  text-align: inherit;
  cursor: pointer;
}

.visa-workbench-kpi-strip__chip--mvp-notice {
  flex: 1 1 auto;
  width: 100%;
}

.visa-workbench-kpi-strip__chip {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 6px;
  min-height: 52px;
  min-width: 108px;
  padding: 10px 14px;
  border-radius: 10px;
  border: 1px solid var(--el-border-color-lighter);
  background: linear-gradient(
    165deg,
    var(--el-fill-color-blank) 0%,
    var(--el-fill-color-extra-light) 100%
  );
  text-align: left;
  box-shadow:
    0 1px 2px rgb(15 23 42 / 5%),
    inset 0 1px 0 rgb(255 255 255 / 55%);
  transition:
    box-shadow 0.18s ease,
    border-color 0.18s ease,
    background 0.18s ease,
    transform 0.18s ease;
}

.visa-workbench-kpi-strip__chip--readonly {
  flex: 1 1 auto;
  width: 100%;
  cursor: inherit;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-spacing-sm);
}

.visa-workbench-kpi-strip__chip-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-spacing-xs);
  width: 100%;
  min-width: 0;
}

.visa-workbench-kpi-strip__chip-label {
  margin: 0;
  font-size: 12px;
  font-weight: var(--app-font-weight-semibold);
  letter-spacing: 0.02em;
  color: var(--el-text-color-regular);
  line-height: 1.35;
  flex: 1 1 auto;
  min-width: 0;
}

.visa-workbench-kpi-strip__chip-value {
  margin: 0;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 2.25rem;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 18px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
  color: var(--el-text-color-primary);
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color-extra-light);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 65%);
}

.visa-workbench-kpi-strip__chip-icon {
  flex-shrink: 0;
  font-size: 18px;
}

.visa-workbench-kpi-strip__chip-icon--muted {
  color: var(--el-text-color-regular);
}

.visa-workbench-kpi-strip__chip-icon--today {
  color: var(--el-color-primary);
}

.visa-workbench-kpi-strip__chip-icon--expiring {
  color: var(--el-color-warning);
}

.visa-workbench-kpi-strip__chip-icon--two-mo {
  color: var(--el-color-info);
}

.visa-workbench-kpi-strip__chip-icon--user {
  color: var(--el-text-color-secondary);
}

.visa-workbench-kpi-strip__chip-icon-wrap {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;

  .visa-workbench-kpi-strip__chip-icon {
    font-size: 16px;
    margin: 0;
    color: #fff;
  }
}

.visa-workbench-kpi-strip__chip-icon-wrap--danger {
  background: var(--el-color-danger);
}

.visa-workbench-kpi-strip__chip--supplement-urgent {
  border-left: 4px solid var(--el-color-danger);
  background: linear-gradient(
    165deg,
    var(--el-color-danger-light-9) 0%,
    var(--el-fill-color-blank) 100%
  );
  border-color: var(--el-color-danger-light-5);

  .visa-workbench-kpi-strip__chip-label {
    color: var(--el-color-danger);
  }

  .visa-workbench-kpi-strip__chip-value {
    color: var(--el-color-danger-dark-2);
    background: rgb(255 255 255 / 72%);
    border-color: var(--el-color-danger-light-5);
  }
}

button.visa-workbench-kpi-strip__chip--interactive,
button.visa-workbench-kpi-strip__chip-host.visa-workbench-kpi-strip__chip--interactive {
  cursor: pointer;
  font: inherit;
  color: inherit;
}

/** 可筛桶与 MVP：标签区与数字横排，数字为右侧胶囊 */
.visa-workbench-kpi-strip__chip.visa-workbench-kpi-strip__chip--interactive:not(
    .visa-workbench-kpi-strip__chip--filter-all
  ),
.visa-workbench-kpi-strip__chip.visa-workbench-kpi-strip__chip--mvp-notice {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 10px;

  .visa-workbench-kpi-strip__chip-main {
    flex: 1 1 auto;
    width: auto;
  }
}

.visa-workbench-kpi-strip__chip.visa-workbench-kpi-strip__chip--interactive:hover {
  border-color: var(--el-border-color);
  box-shadow:
    0 6px 16px rgb(15 23 42 / 9%),
    inset 0 1px 0 rgb(255 255 255 / 55%);
  transform: translateY(-1px);
  background: linear-gradient(
    165deg,
    var(--el-fill-color-light) 0%,
    var(--el-fill-color-blank) 100%
  );
}

.visa-workbench-kpi-strip__chip.visa-workbench-kpi-strip__chip--interactive:focus-visible {
  outline: 2px solid var(--el-color-primary);
  outline-offset: 2px;
}

button.visa-workbench-kpi-strip__chip-host.visa-workbench-kpi-strip__chip--interactive:hover
  .visa-workbench-kpi-strip__chip {
  border-color: var(--el-border-color);
  box-shadow:
    0 6px 16px rgb(15 23 42 / 9%),
    inset 0 1px 0 rgb(255 255 255 / 55%);
  transform: translateY(-1px);
  background: linear-gradient(
    165deg,
    var(--el-fill-color-light) 0%,
    var(--el-fill-color-blank) 100%
  );
}

button.visa-workbench-kpi-strip__chip-host.visa-workbench-kpi-strip__chip--interactive:focus-visible {
  outline: 2px solid var(--el-color-primary);
  outline-offset: 2px;
}

.visa-workbench-kpi-strip__chip--supplement-urgent.visa-workbench-kpi-strip__chip--interactive:hover {
  background: linear-gradient(
    165deg,
    var(--el-color-danger-light-9) 0%,
    var(--el-fill-color-light) 100%
  );
}

.visa-workbench-kpi-strip__chip--active {
  outline: none;
  border-color: var(--el-color-primary-light-5);
  background: linear-gradient(
    165deg,
    var(--el-color-primary-light-9) 0%,
    var(--el-fill-color-blank) 100%
  );
  box-shadow:
    0 0 0 1px var(--el-color-primary-light-7),
    0 4px 14px rgb(64 158 255 / 12%),
    inset 0 1px 0 rgb(255 255 255 / 55%);

  .visa-workbench-kpi-strip__chip-label {
    color: var(--el-color-primary);
  }

  .visa-workbench-kpi-strip__chip-value {
    background: rgb(255 255 255 / 85%);
    border-color: var(--el-color-primary-light-5);
    color: var(--el-color-primary-dark-2);
  }
}

/** 「全部」：无件数行，标签居中 */
.visa-workbench-kpi-strip__chip--filter-all {
  min-width: 84px;
  justify-content: center;

  .visa-workbench-kpi-strip__chip-main {
    justify-content: center;
    width: 100%;
  }

  .visa-workbench-kpi-strip__chip-label {
    text-align: center;
    font-size: var(--app-font-size-sm);
    color: var(--app-text-primary);
  }
}

@media (prefers-reduced-motion: reduce) {
  .visa-workbench-kpi-strip__chip.visa-workbench-kpi-strip__chip--interactive:hover,
  button.visa-workbench-kpi-strip__chip-host.visa-workbench-kpi-strip__chip--interactive:hover
    .visa-workbench-kpi-strip__chip {
    transform: none;
  }
}
</style>
