<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { getVisaCases } from '@/api/visa-case'
import { MaterialStatusLabel } from '@/constants/enum-labels'
import type { MaterialStatus } from '@/constants/enums'
import { VisaCaseStatus } from '@/constants/enums'
import { P } from '@/constants/permissions'
import { useUserStore } from '@/stores/user'
import type { CustomerListPrimaryVisaCaseSummary } from '@/types/customer'
import type { VisaCaseItem, VisaCaseLogPreFillData } from '@/types/visa-case'
import { CUSTOMER_DETAIL_VISA_WORK_IN_PROGRESS_STATUSES } from '@/utils/customer-detail-default-tab'
import { useLocaleFormatter } from '@/utils/locale-format'
import { materialChecklistApplicableTotal } from '@/utils/material-checklist-progress'

import CustomerFamilyMembersBlock from './CustomerFamilyMembersBlock.vue'
import CustomerFilePathsTab from './CustomerFilePathsTab.vue'
import CustomerMaterialChecklistTab from './CustomerMaterialChecklistTab.vue'
import CustomerVisaCaseLogsTab from './CustomerVisaCaseLogsTab.vue'
import CustomerVisaCasesTab from './CustomerVisaCasesTab.vue'

const props = defineProps<{
  customerId: string
  /** 本页客户姓名（签证向导侧栏等） */
  contextCustomerName?: string
  /** 自全局登记册等入口透传，用于在签证案件子 Tab 内自动打开指定案件 */
  openVisaCaseId?: string
  /**
   * 列表/工作台写日志深链专用：仅案件日志子 Tab 用于默认选中案件，不触发案件列表「打开编辑」逻辑。
   */
  logVisaCaseId?: string
  /** 新建客户成功引导等：为 true 时在案件子块自动打开建案向导（消费后从 URL 剥离 query） */
  openVisaCaseWizard?: boolean
  /** 与路由 `openVisaCaseLogForm=1` 一致：进入日志子 Tab 后自动展开新建日志表单 */
  openVisaCaseLogForm?: boolean
  /** 路由 `suggestedNextFollowUpAt`：新建日志表单内「下次跟进」建议值（ISO） */
  suggestedNextFollowUpAt?: string
  /**
   * 路由 query `visaDomainBlock` 同步：进入签证域时直接展开对应子区块（如 `logs` 配合写日志深链）。
   */
  initialSubBlock?: string
  /**
   * 路由 query `materialsVisaCaseId`：材料清单子 Tab 默认选中案件（不触发案件子 Tab 的 `openVisaCaseId` 编辑弹窗）。
   */
  materialsPreferredVisaCaseId?: string
  /**
   * 与 `GET /customers/:id` 同源的主展示案件摘要，用于签证域顶栏 checklist 与持久化摘要联动展示。
   */
  listPrimaryVisaCase?: CustomerListPrimaryVisaCaseSummary | null
}>()

const emit = defineEmits<{
  /** 签证域内变更影响客户详情顶栏/主展示案件摘要时，请求详情页重新拉取 GET /customers/:id */
  'visa-domain-customer-refresh': []
}>()

defineOptions({ name: 'CustomerVisaDomainTab' })

const VALID_VISA_DOMAIN_SUB_BLOCKS = new Set([
  'cases',
  'family',
  'paths',
  'logs',
  'materials',
])

const { t } = useI18n({ useScope: 'global' })
const { formatDate } = useLocaleFormatter()
const userStore = useUserStore()
const T = (key: string, params?: Record<string, unknown>) =>
  t(`detailViews.customer.visaDomainTab.${key}`, params ?? {})

const activeBlock = ref('cases')
const cases = ref<VisaCaseItem[]>([])
const summaryLoading = ref(false)

/** 日志 Tab 默认选中：`logVisaCaseId` 优先于 `openVisaCaseId`，避免与案件子 Tab 抢 ID */
const preferredVisaCaseIdForLogs = computed((): string => {
  const logId = props.logVisaCaseId?.trim()
  if (logId) {return logId}
  return props.openVisaCaseId?.trim() ?? ''
})

/** docs/21：客户上下文案件摘要与 `GET .../visa-cases` 同源，需 `visaCase:list`。 */
const canLoadCaseSummary = computed((): boolean => userStore.hasPermission(P.VISA_CASE_LIST))

watch(
  () => [props.customerId, canLoadCaseSummary.value] as const,
  ([id, can]) => {
    if (id && can) {
      void fetchSummary()
      return
    }
    cases.value = []
    summaryLoading.value = false
  },
  { immediate: true },
)

/**
 * 主展示案件摘要随 GET /customers/:id 更新后，重拉签证案件列表以刷新域内汇总条统计。
 */
watch(
  () => props.listPrimaryVisaCase,
  () => {
    if (!props.customerId || !canLoadCaseSummary.value) {
      return
    }
    void fetchSummary()
  },
  { deep: true },
)

watch(
  () => props.initialSubBlock,
  (block) => {
    if (block && VALID_VISA_DOMAIN_SUB_BLOCKS.has(block)) {
      activeBlock.value = block
    }
  },
  { immediate: true },
)

/**
 * 加载签证案件全量列表用于摘要统计展示，不依赖子组件分页请求。
 *
 * @throws {Error} 签证案件列表接口请求失败时由请求层继续抛出
 */
async function fetchSummary(): Promise<void> {
  summaryLoading.value = true
  try {
    const res = await getVisaCases(props.customerId, { page: 1, pageSize: 200 })
    cases.value = res.data.items
  } finally {
    summaryLoading.value = false
  }
}

const casesRefreshKey = ref(0)
const logPreFillData = ref<VisaCaseLogPreFillData | null>(null)

/**
 * 材料 checklist「写入日志」按钮回调：切换到日志 Tab 并透传预填数据。
 *
 * @param data - 包含案件 ID、日志类型、已提交/缺失材料的快照
 */
function handleWriteLog(data: VisaCaseLogPreFillData): void {
  logPreFillData.value = null
  activeBlock.value = 'logs'
  nextTick(() => {
    logPreFillData.value = data
  })
}

/** 案件日志 Tab 处理完材料预填（展示或无权提示）后清空，避免 props 长期持有同一对象引用 */
function clearLogPreFill(): void {
  logPreFillData.value = null
}

/**
 * 材料 checklist 同步后的回调：刷新客户详情主展示与域内案件列表，避免摘要与后端不一致。
 *
 * @param _visaCaseId - 同步的签证案件 ID（保留以兼容事件载荷）
 * @param _newStatus - 同步后的 materialStatus（保留以兼容事件载荷）
 */
function handleMaterialStatusSynced(_visaCaseId: string, _newStatus: string): void {
  emit('visa-domain-customer-refresh')
  casesRefreshKey.value++
}

const totalCount = computed(() => cases.value.length)

/**
 * 汇总条「未结案」件数：与默认签证 Tab 规则同源，集合定义见 `CUSTOMER_DETAIL_VISA_WORK_IN_PROGRESS_STATUSES`。
 *
 * @see docs/17_业务口径冻结确认表.md §1.11
 */
const activeCount = computed(() =>
  cases.value.filter((c) =>
    CUSTOMER_DETAIL_VISA_WORK_IN_PROGRESS_STATUSES.has(c.caseStatus),
  ).length,
)

const supplementCount = computed(() =>
  cases.value.filter((c) => c.caseStatus === VisaCaseStatus.SUPPLEMENT).length,
)

const nearestExpiry = computed(() => {
  const now = Date.now()
  const upcoming = cases.value
    .filter((c) => c.expireDate && new Date(c.expireDate).getTime() > now)
    .sort((a, b) => new Date(a.expireDate!).getTime() - new Date(b.expireDate!).getTime())
  return upcoming.length > 0 ? upcoming[0].expireDate : null
})

const materialBreakdown = computed(() => {
  const counts: Record<string, number> = {}
  for (const c of cases.value) {
    if (c.materialStatus) {
      counts[c.materialStatus] = (counts[c.materialStatus] || 0) + 1
    }
  }
  return Object.entries(counts).map(([status, count]) => ({
    status,
    label: MaterialStatusLabel[status as MaterialStatus] ?? status,
    count,
  }))
})

/** 主展示案件 checklist 进度文案；无清单项时为 null。 */
const primaryCaseChecklistHeadline = computed((): string | null => {
  const pc = props.listPrimaryVisaCase
  if (!pc || (pc.materialChecklistTotal ?? 0) <= 0) {
    return null
  }
  const applicable = materialChecklistApplicableTotal(pc)
  const collected = pc.materialChecklistCollected ?? 0
  return T('primaryCaseChecklistSummary', {
    progress: `${collected}/${applicable}`,
  })
})
</script>

<template>
  <div class="visa-domain-tab">
    <div v-if="totalCount > 0 || summaryLoading" v-loading="summaryLoading" class="visa-domain-tab__summary">
      <div
        class="visa-domain-tab__summary-strip"
        role="group"
        :aria-label="T('summaryStripAria')"
      >
        <div class="visa-domain-tab__cell visa-domain-tab__cell--metric">
          <div class="stat-item">
            <span class="stat-item__value">{{ totalCount }}</span>
            <span class="stat-item__label">{{ T('totalCases') }}</span>
          </div>
        </div>
        <div class="visa-domain-tab__cell visa-domain-tab__cell--metric">
          <div class="stat-item stat-item--primary">
            <span class="stat-item__value">{{ activeCount }}</span>
            <span class="stat-item__label">{{ T('activeCases') }}</span>
          </div>
        </div>
        <div v-if="supplementCount > 0" class="visa-domain-tab__cell visa-domain-tab__cell--metric">
          <div class="stat-item stat-item--warning">
            <span class="stat-item__value">{{ supplementCount }}</span>
            <span class="stat-item__label">{{ T('supplementCases') }}</span>
          </div>
        </div>
        <div v-if="nearestExpiry" class="visa-domain-tab__cell visa-domain-tab__cell--metric">
          <div class="stat-item">
            <span class="stat-item__value stat-item__value--date">{{ formatDate(nearestExpiry) }}</span>
            <span class="stat-item__label">{{ T('nearestExpiry') }}</span>
          </div>
        </div>
        <div v-if="materialBreakdown.length > 0" class="visa-domain-tab__cell visa-domain-tab__cell--fill">
          <div class="visa-domain-tab__cell-main">
            <div class="visa-domain-tab__tag-row">
              <el-tag
                v-for="m in materialBreakdown"
                :key="m.status"
                size="small"
                type="info"
              >
                {{ m.label }}: {{ m.count }}
              </el-tag>
            </div>
          </div>
          <span class="visa-domain-tab__cell-caption">{{ T('materialStatus') }}</span>
        </div>
        <div v-if="primaryCaseChecklistHeadline" class="visa-domain-tab__cell visa-domain-tab__cell--fill">
          <div class="visa-domain-tab__cell-main">
            <div class="visa-domain-tab__tag-row visa-domain-tab__tag-row--checklist">
              <span class="visa-domain-tab__primary-checklist-line">{{ primaryCaseChecklistHeadline }}</span>
              <el-tag
                v-if="listPrimaryVisaCase?.materialChecklistOutOfSync"
                size="small"
                type="warning"
              >
                {{ T('primaryCaseChecklistOutOfSyncBadge') }}
              </el-tag>
            </div>
          </div>
          <span class="visa-domain-tab__cell-caption">{{ T('materialsBlock') }}</span>
        </div>
      </div>
    </div>

    <el-tabs v-model="activeBlock" type="card" class="visa-domain-tab__blocks">
      <el-tab-pane :label="T('casesBlock')" name="cases">
        <CustomerVisaCasesTab
          :key="casesRefreshKey"
          :customer-id="customerId"
          :context-customer-name="contextCustomerName"
          :open-visa-case-id="openVisaCaseId"
          :open-visa-case-wizard="openVisaCaseWizard"
          @visa-domain-customer-refresh="() => emit('visa-domain-customer-refresh')"
        />
      </el-tab-pane>
      <el-tab-pane :label="T('familyBlock')" name="family" lazy>
        <CustomerFamilyMembersBlock :customer-id="customerId" />
      </el-tab-pane>
      <el-tab-pane :label="T('pathsBlock')" name="paths" lazy>
        <CustomerFilePathsTab :customer-id="customerId" />
      </el-tab-pane>
      <el-tab-pane :label="T('logsBlock')" name="logs" lazy>
        <CustomerVisaCaseLogsTab
          :customer-id="customerId"
          :preferred-visa-case-id="preferredVisaCaseIdForLogs"
          :auto-open-create-form="openVisaCaseLogForm"
          :suggested-next-follow-up-at="suggestedNextFollowUpAt"
          :pre-fill-data="logPreFillData"
          @prefill-settled="clearLogPreFill"
        />
      </el-tab-pane>
      <el-tab-pane :label="T('materialsBlock')" name="materials" lazy>
        <CustomerMaterialChecklistTab
          :customer-id="customerId"
          :preferred-materials-visa-case-id="materialsPreferredVisaCaseId"
          @material-status-synced="handleMaterialStatusSynced"
          @write-log="handleWriteLog"
        />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<style scoped lang="scss">
.visa-domain-tab {
  &__summary {
    margin-bottom: 16px;
    padding: 12px 16px;
    background: var(--el-fill-color-lighter);
    border-radius: 6px;
    min-height: 56px;
  }

  /** 单行摘要：各格同一结构（主信息在上、说明在下），说明行底对齐 */
  &__summary-strip {
    display: flex;
    flex-wrap: wrap;
    align-items: stretch;
    gap: 12px 28px;
  }

  &__cell {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: flex-start;
    min-width: 0;

    &--metric {
      flex: 0 0 auto;
    }

    /** 材料类列吃掉剩余宽度，避免窄条挤压 */
    &--fill {
      flex: 1 1 160px;
      min-width: min(100%, 140px);
      max-width: 100%;
    }
  }

  &__cell-main {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    width: 100%;
    flex: 1 1 auto;
    min-height: 0;
  }

  &__cell-caption {
    margin-top: auto;
    padding-top: 4px;
    width: 100%;
    font-size: var(--app-font-size-xs);
    color: var(--app-text-secondary);
    line-height: 1.2;
  }

  &__tag-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 8px;
    width: 100%;
    min-height: 28px;

    &--checklist {
      align-items: flex-start;
    }
  }

  &__primary-checklist-line {
    font-size: var(--el-font-size-small);
    font-weight: 600;
    line-height: 1.35;
    color: var(--app-text-primary);
    flex: 1 1 12rem;
    min-width: 0;
  }

  &__blocks {
    :deep(.el-tabs__content) {
      padding-top: 12px;
    }
  }
}

.visa-domain-tab__cell--metric .stat-item {
  flex: 1 1 auto;
  align-self: stretch;
  min-height: 100%;
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 2px;

  &__value {
    font-size: 20px;
    font-weight: 600;
    line-height: 1.2;
    color: var(--app-text-primary);

    &--date {
      font-size: 16px;
    }
  }

  &__label {
    margin-top: auto;
    padding-top: 4px;
    font-size: var(--app-font-size-xs);
    color: var(--app-text-secondary);
    line-height: 1.2;
  }

  &--primary .stat-item__value {
    color: var(--el-color-primary);
  }

  &--warning .stat-item__value {
    color: var(--el-color-warning);
  }
}
</style>
