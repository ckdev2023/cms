<script setup lang="ts">
import {
  ChatDotRound,
  ChatLineRound,
  ChatLineSquare,
  Document,
  InfoFilled,
  Refresh,
  WarningFilled,
} from '@element-plus/icons-vue'
import type { Component } from 'vue'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import { getVisaCaseLogs } from '@/api/visa-case'
import {
  CASE_LOG_RAIL_DISPLAY_LIMIT,
  CASE_LOG_RAIL_FETCH_PAGE_SIZE,
  type CaseLogRailPillCategory,
  isVisaCaseLogInRailPill,
} from '@/constants/customer-detail-case-log-rail-filter'
import { VisaCaseLogTypeLabel } from '@/constants/enum-labels'
import { VisaCaseLogType } from '@/constants/enums'
import { P } from '@/constants/permissions'
import { resolveVisaCaseLogTimelineVisualTone } from '@/constants/visa-case-log-ui'
import { useUserStore } from '@/stores/user'
import type { CustomerListPrimaryVisaCaseSummary } from '@/types/customer'
import type { VisaCaseLogItem } from '@/types/visa-case'
import { pickCustomerDetailDeepLinkPreserve } from '@/utils/customer-detail-return-navigation'
import { useLocaleFormatter } from '@/utils/locale-format'

const props = defineProps<{
  /** 当前客户 UUID，与路由参数一致 */
  customerId: string
  /** 与 `GET /customers/:id` 的 `listPrimaryVisaCase` 同源 */
  listPrimaryVisaCase: CustomerListPrimaryVisaCaseSummary | null
}>()

defineOptions({ name: 'CustomerDetailCaseLogRail' })

const route = useRoute()
const router = useRouter()
const { t } = useI18n({ useScope: 'global' })
const userStore = useUserStore()
const { formatDateTime } = useLocaleFormatter()

const T = (key: string): string => t(`detailViews.customer.caseLogRail.${key}`)

const pillOptions: { value: CaseLogRailPillCategory; i18nKey: string }[] = [
  { value: 'all', i18nKey: 'filterPillAll' },
  { value: 'materials', i18nKey: 'filterPillMaterials' },
  { value: 'communication', i18nKey: 'filterPillCommunication' },
  { value: 'system', i18nKey: 'filterPillSystem' },
]

/**
 * 与后端 `GET /visa-cases/:id/logs` 一致：仅 `visaCase:detail` 时拉取预览，避免 LIST-only 账号无谓 403。
 */
const hasVisaCaseDetailPermission = computed((): boolean =>
  userStore.hasPermission(P.VISA_CASE_DETAIL),
)

const canFetchLogs = computed(
  (): boolean =>
    hasVisaCaseDetailPermission.value &&
    !!(props.listPrimaryVisaCase?.visaCaseId ?? '').trim(),
)

const loading = ref(false)
const logs = ref<VisaCaseLogItem[]>([])
const loadError = ref(false)
const selectedPill = ref<CaseLogRailPillCategory>('all')

let fetchSeq = 0

watch(
  () => props.listPrimaryVisaCase?.visaCaseId ?? '',
  () => {
    selectedPill.value = 'all'
  },
)

watch(
  () =>
    [props.customerId, props.listPrimaryVisaCase?.visaCaseId ?? '', canFetchLogs.value] as const,
  async ([, visaCaseId, canFetch]) => {
    const seq = ++fetchSeq
    if (!canFetch || !visaCaseId) {
      logs.value = []
      loadError.value = false
      loading.value = false
      return
    }
    loading.value = true
    loadError.value = false
    try {
      const res = await getVisaCaseLogs(visaCaseId, {
        page: 1,
        pageSize: CASE_LOG_RAIL_FETCH_PAGE_SIZE,
        sortOrder: 'DESC',
      })
      if (seq !== fetchSeq) {
        return
      }
      logs.value = res.data.items
    } catch {
      if (seq !== fetchSeq) {
        return
      }
      loadError.value = true
      logs.value = []
    } finally {
      if (seq === fetchSeq) {
        loading.value = false
      }
    }
  },
  { immediate: true },
)

const filteredLogs = computed((): VisaCaseLogItem[] => {
  const pill = selectedPill.value
  return logs.value.filter((row) =>
    isVisaCaseLogInRailPill(row.logType as VisaCaseLogType, pill),
  )
})

const displayedLogs = computed((): VisaCaseLogItem[] =>
  filteredLogs.value.slice(0, CASE_LOG_RAIL_DISPLAY_LIMIT),
)

/**
 * 为 Rail 时间轴节点选择 `logType` 对应的 Element Plus 图标组件。
 *
 * @param logType - 案件日志类型枚举值或后端字符串
 * @returns 用于 `<component :is>` 的图标组件
 */
function railTimelineIconForLogType(logType: string): Component {
  switch (logType as VisaCaseLogType) {
    case VisaCaseLogType.SUBMISSION:
      return Document
    case VisaCaseLogType.SUPPLEMENT:
      return WarningFilled
    case VisaCaseLogType.FOLLOW_UP:
      return ChatLineRound
    case VisaCaseLogType.STATUS_CHANGE:
      return Refresh
    case VisaCaseLogType.GENERAL:
      return ChatDotRound
    default:
      return ChatLineSquare
  }
}

/**
 * 提取深链时应保留的 `dataScope` / `assignedTo` / `ccFrom` 片段。
 *
 * @returns 扁平 query 对象
 */
function preserveBase(): Record<string, string> {
  return pickCustomerDetailDeepLinkPreserve(route.query)
}

/**
 * 跳转签证域日志子块并锁定主展示案件（`logVisaCaseId`），与摘要带写日志入口对齐但不自动打开表单。
 */
function goAllLogsForPrimaryCase(): void {
  const pc = props.listPrimaryVisaCase
  if (!pc) {
    return
  }
  void router.push({
    path: `/customers/${props.customerId}`,
    query: {
      ...preserveBase(),
      tab: 'visa-domain',
      visaDomainBlock: 'logs',
      logVisaCaseId: pc.visaCaseId,
    },
  })
}
</script>

<template>
  <div
    class="customer-detail-case-log-rail"
    role="region"
    :aria-label="T('title')"
  >
    <div class="customer-detail-case-log-rail__head-row">
      <h3 class="customer-detail-case-log-rail__title">
        <span class="customer-detail-case-log-rail__title-text">{{ T('title') }}</span>
        <el-tooltip
          :content="T('filterPillsLegend')"
          placement="top-start"
          :show-after="200"
        >
          <button
            type="button"
            class="customer-detail-case-log-rail__legend-trigger"
            :aria-label="T('filterLegendHint')"
          >
            <el-icon><InfoFilled /></el-icon>
          </button>
        </el-tooltip>
      </h3>
      <el-button
        v-if="listPrimaryVisaCase && hasVisaCaseDetailPermission"
        class="customer-detail-case-log-rail__head-cta"
        type="primary"
        link
        @click="goAllLogsForPrimaryCase"
      >
        {{ T('viewAll') }}
      </el-button>
    </div>

    <template v-if="!listPrimaryVisaCase">
      <el-empty :description="T('noPrimaryCase')" />
    </template>

    <template v-else-if="!hasVisaCaseDetailPermission">
      <el-empty :description="T('needDetailPermission')" />
    </template>

    <template v-else>
      <el-radio-group
        v-model="selectedPill"
        size="small"
        class="customer-detail-case-log-rail__pills"
        :aria-label="T('filtersAriaLabel')"
      >
        <el-radio-button
          v-for="opt in pillOptions"
          :key="opt.value"
          :label="opt.value"
        >
          {{ T(opt.i18nKey) }}
        </el-radio-button>
      </el-radio-group>
      <div v-loading="loading" class="customer-detail-case-log-rail__body">
        <el-alert
          v-if="loadError"
          type="error"
          :closable="false"
          show-icon
          class="customer-detail-case-log-rail__alert"
          :title="T('loadError')"
        />
        <template v-else-if="!loading && logs.length === 0">
          <el-empty :description="T('empty')" />
        </template>
        <template v-else-if="!loading && displayedLogs.length === 0">
          <el-empty :description="T('emptyFiltered')" />
        </template>
        <ul v-else class="customer-detail-case-log-rail__timeline">
          <li
            v-for="log in displayedLogs"
            :key="log.id"
            :class="[
              'customer-detail-case-log-rail__timeline-item',
              `visa-case-log-timeline-tone--${resolveVisaCaseLogTimelineVisualTone(log.logType)}`,
            ]"
          >
            <div class="customer-detail-case-log-rail__timeline-axis" aria-hidden="true">
              <span class="customer-detail-case-log-rail__timeline-node">
                <el-icon class="customer-detail-case-log-rail__timeline-icon">
                  <component :is="railTimelineIconForLogType(log.logType)" />
                </el-icon>
              </span>
            </div>
            <div class="customer-detail-case-log-rail__timeline-panel">
              <div class="customer-detail-case-log-rail__item-head">
                <el-tag size="small" :type="resolveVisaCaseLogTimelineVisualTone(log.logType)">
                  {{ VisaCaseLogTypeLabel[log.logType as VisaCaseLogType] ?? log.logType }}
                </el-tag>
                <time class="customer-detail-case-log-rail__time" :datetime="log.createdAt">
                  {{ formatDateTime(log.createdAt) }}
                </time>
              </div>
              <p v-if="log.creatorName" class="customer-detail-case-log-rail__author">
                <el-icon><ChatLineSquare /></el-icon>
                {{ log.creatorName }}
              </p>
              <p class="customer-detail-case-log-rail__content">{{ log.content }}</p>
            </div>
          </li>
        </ul>
      </div>
    </template>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/visa-case-log-timeline-tone.scss';

.customer-detail-case-log-rail {
  padding: 12px 10px 14px;
  border-radius: var(--customer-detail-radius-surface, var(--el-border-radius-base));
  border: none;
  background: #ffffff;
  box-shadow: var(--customer-detail-shadow-surface, var(--el-box-shadow-lighter));
}

.customer-detail-case-log-rail__head-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 12px;
  margin-bottom: var(--app-spacing-xs);
}

.customer-detail-case-log-rail__title {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  font-size: var(--el-font-size-small);
  font-weight: 600;
  letter-spacing: -0.02em;
  color: #1d1d1f;
  flex: 1 1 auto;
  min-width: 0;
}

.customer-detail-case-log-rail__title-text {
  flex: 1 1 auto;
  min-width: 0;
}

.customer-detail-case-log-rail__legend-trigger {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin: 0;
  padding: 2px;
  border: none;
  border-radius: var(--el-border-radius-base);
  background: transparent;
  color: var(--el-text-color-secondary);
  cursor: help;
  line-height: 1;
  transition: color var(--el-transition-duration) ease;

  &:hover {
    color: var(--el-color-primary);
  }

  &:focus-visible {
    outline: 2px solid var(--el-color-primary-light-5);
    outline-offset: 1px;
  }

  .el-icon {
    font-size: 15px;
  }
}

.customer-detail-case-log-rail__head-cta {
  flex-shrink: 0;
  padding: 0 4px;
}

.customer-detail-case-log-rail__pills {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 4px;

  :deep(.el-radio-button__inner) {
    padding: 4px 10px;
    font-size: var(--el-font-size-extra-small);
  }
}

.customer-detail-case-log-rail__body {
  min-height: 80px;
}

.customer-detail-case-log-rail__alert {
  margin-bottom: var(--app-spacing-sm);
}

.customer-detail-case-log-rail__timeline {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: var(--app-spacing-sm);
}

.customer-detail-case-log-rail__timeline-item {
  display: grid;
  grid-template-columns: 30px minmax(0, 1fr);
  gap: 8px;
  align-items: start;
}

.customer-detail-case-log-rail__timeline-axis {
  position: relative;
  display: flex;
  justify-content: center;
  padding-top: 2px;

  &::after {
    content: '';
    position: absolute;
    top: 30px;
    bottom: calc(-1 * var(--app-spacing-sm));
    left: 50%;
    width: 1px;
    margin-left: -0.5px;
    background: rgba(0, 0, 0, 0.08);
  }
}

.customer-detail-case-log-rail__timeline-item:last-child .customer-detail-case-log-rail__timeline-axis::after {
  display: none;
}

.customer-detail-case-log-rail__timeline-node {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  box-sizing: border-box;
  border: 1px solid var(--vcl-node-border, var(--el-border-color-lighter));
  background: var(--vcl-node-bg, var(--el-fill-color-light));
}

.customer-detail-case-log-rail__timeline-icon {
  font-size: 14px;
  color: var(--vcl-node-icon, var(--el-text-color-regular));
}

.customer-detail-case-log-rail__timeline-panel {
  min-width: 0;
  padding: 8px 10px;
  border-radius: var(--customer-detail-radius-card, var(--el-border-radius-base));
  border: none;
  border-left: 3px solid var(--vcl-accent, rgba(0, 0, 0, 0.12));
  box-shadow: var(--customer-detail-shadow-card, var(--el-box-shadow-light));
  background: #fafafc;
}

.customer-detail-case-log-rail__item-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.customer-detail-case-log-rail__time {
  font-size: var(--el-font-size-extra-small);
  color: var(--el-text-color-secondary);
}

.customer-detail-case-log-rail__author {
  display: flex;
  align-items: center;
  gap: 4px;
  margin: 0 0 4px;
  font-size: var(--el-font-size-extra-small);
  color: var(--el-text-color-secondary);
}

.customer-detail-case-log-rail__content {
  margin: 0;
  font-size: var(--el-font-size-extra-small);
  line-height: 1.45;
  color: var(--el-text-color-regular);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
