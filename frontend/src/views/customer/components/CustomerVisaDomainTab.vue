<!-- eslint-disable max-lines -- 签证域摘要条、分区 pill、堆叠六段与 IntersectionObserver 同页承载；后续可拆 composable / 子块时再收紧 -->
<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import { getVisaCases } from '@/api/visa-case'
import { useCustomerVisaDomainLogsPanelCollapse } from '@/composables/useCustomerVisaDomainLogsPanelCollapse'
import { useCustomerVisaDomainStackSectionSync } from '@/composables/useCustomerVisaDomainStackSectionSync'
import { MaterialStatusLabel, VisaCaseStatusLabel } from '@/constants/enum-labels'
import type { MaterialStatus } from '@/constants/enums'
import { VisaCaseStatus } from '@/constants/enums'
import { P } from '@/constants/permissions'
import { useUserStore } from '@/stores/user'
import type { CustomerDetail, CustomerListPrimaryVisaCaseSummary } from '@/types/customer'
import type { VisaCaseItem, VisaCaseLogPreFillData } from '@/types/visa-case'
import { CUSTOMER_DETAIL_VISA_WORK_IN_PROGRESS_STATUSES } from '@/utils/customer-detail-default-tab'
import {
  isVisaDomainBlockQueryValue,
  stripVisaDomainDeepLinkFromLocation,
  VISA_DOMAIN_BLOCK_KEYS,
  type VisaDomainBlockQueryValue,
  visaDomainSectionElementId,
} from '@/utils/customer-detail-visa-domain-deeplink'
import { useLocaleFormatter } from '@/utils/locale-format'
import { materialChecklistApplicableTotal } from '@/utils/material-checklist-progress'
import { formatVisaCaseTypeDisplay } from '@/utils/visa-case-type-display'

import CustomerFamilyMembersBlock from './CustomerFamilyMembersBlock.vue'
import CustomerFilePathsTab from './CustomerFilePathsTab.vue'
import CustomerMaterialChecklistTab from './CustomerMaterialChecklistTab.vue'
import CustomerVisaCaseLogsTab from './CustomerVisaCaseLogsTab.vue'
import CustomerVisaCasesTab from './CustomerVisaCasesTab.vue'
import CustomerVisaDomainBasicSnapshotCard from './CustomerVisaDomainBasicSnapshotCard.vue'

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
  /** 与详情页 `GET /customers/:id` 同源；用于工作台「基本信息摘要」卡片（非完整主档表单）。 */
  customer: CustomerDetail
}>()

const emit = defineEmits<{
  /** 签证域内变更影响客户详情顶栏/主展示案件摘要时，请求详情页重新拉取 GET /customers/:id */
  'visa-domain-customer-refresh': []
  /** 摘要卡片「查看完整资料」：请求父级切换到 `tab=basic`。 */
  'request-basic-tab': []
}>()

defineOptions({ name: 'CustomerVisaDomainTab' })

const VISA_DOMAIN_BLOCK_ORDER = VISA_DOMAIN_BLOCK_KEYS

type VisaDomainBlockKey = VisaDomainBlockQueryValue

/** 需懒加载挂载子 Tab 的分区（首卡 basicSnapshot 始终挂载，不纳入此表）。 */
type VisaLazyMountBlockKey = Exclude<VisaDomainBlockKey, 'basicSnapshot'>

const { t } = useI18n({ useScope: 'global' })
const route = useRoute()
const router = useRouter()
const { formatDate } = useLocaleFormatter()
const userStore = useUserStore()
const T = (key: string, params?: Record<string, unknown>) =>
  t(`detailViews.customer.visaDomainTab.${key}`, params ?? {})

/**
 * 返回 Stitch 堆叠分区标题（与 `stitchLayout.stackBlocks` 及路由 `visaDomainBlock` 对齐）。
 *
 * @param block - 签证域分区键
 * @returns 当前语言下的区块标题文案
 */
function stackBlockTitle(block: VisaDomainBlockKey): string {
  return t(`detailViews.customer.stitchLayout.stackBlocks.${block}`)
}

const activeBlock = ref<VisaDomainBlockKey>('basicSnapshot')
const cases = ref<VisaCaseItem[]>([])
const summaryLoading = ref(false)

const stackRootRef = ref<HTMLElement | null>(null)

const lazyMount = reactive<Record<VisaLazyMountBlockKey, boolean>>({
  family: true,
  materials: false,
  paths: false,
  cases: false,
  logs: false,
})

/** 有主展示摘要时「全部案件」表格默认折叠；深链打开向导/编辑时需展开才能交互 */
const allCasesCollapseNames = ref<string[]>([])

const primaryCaseStatusTagType: Record<
  string,
  'success' | 'info' | 'warning' | 'danger' | 'primary'
> = {
  [VisaCaseStatus.DRAFT]: 'info',
  [VisaCaseStatus.IN_PROGRESS]: 'primary',
  [VisaCaseStatus.SUBMITTED]: 'primary',
  [VisaCaseStatus.SUPPLEMENT]: 'warning',
  [VisaCaseStatus.APPROVED]: 'success',
  [VisaCaseStatus.REJECTED]: 'danger',
  [VisaCaseStatus.COMPLETED]: 'success',
  [VisaCaseStatus.CANCELLED]: 'info',
}

/** 日志 Tab 默认选中：`logVisaCaseId` 优先于 `openVisaCaseId`，避免与案件子 Tab 抢 ID */
const preferredVisaCaseIdForLogs = computed((): string => {
  const logId = props.logVisaCaseId?.trim()
  if (logId) {
    return logId
  }
  return props.openVisaCaseId?.trim() ?? ''
})

/** docs/21：客户上下文案件摘要与 `GET .../visa-cases` 同源，需 `visaCase:list`。 */
const canLoadCaseSummary = computed((): boolean => userStore.hasPermission(P.VISA_CASE_LIST))

/**
 * 将指定分区标记为已挂载，供懒加载子块与深链滚动前渲染内容。
 *
 * @param block - 签证域堆叠分区键
 */
function ensureBlockMounted(block: VisaDomainBlockKey): void {
  if (block === 'basicSnapshot') {
    return
  }
  lazyMount[block as VisaLazyMountBlockKey] = true
}

const {
  logsPanelExpandedNames,
  expandLogsPanel,
  onLogsPanelCollapseChange,
  logsPanelCollapseName,
} = useCustomerVisaDomainLogsPanelCollapse(
  () => props.openVisaCaseLogForm,
  ensureBlockMounted,
)

const OBSERVER_ACTIVE_SYNC_PAUSE_MS = 750

const { pauseSectionObserverActiveSync } = useCustomerVisaDomainStackSectionSync(
  stackRootRef,
  activeBlock,
  ensureBlockMounted,
)

/**
 * 滚动至对应锚点分区并同步活动锚点状态。
 *
 * @param block - 与 `visaDomainBlock` 一致的区块键
 */
function scrollToBlock(block: VisaDomainBlockKey): void {
  if (block === 'logs') {
    expandLogsPanel()
  }
  activeBlock.value = block
  pauseSectionObserverActiveSync(OBSERVER_ACTIVE_SYNC_PAUSE_MS)
  ensureBlockMounted(block)
  void nextTick(() => {
    document.getElementById(visaDomainSectionElementId(block))?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
  })
}

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
    if (!block || !isVisaDomainBlockQueryValue(block)) {
      return
    }
    const key = block
    if (key === 'logs') {
      expandLogsPanel()
    }
    activeBlock.value = key
    pauseSectionObserverActiveSync(OBSERVER_ACTIVE_SYNC_PAUSE_MS)
    ensureBlockMounted(key)
    void nextTick(() => {
      void nextTick(() => {
        document.getElementById(visaDomainSectionElementId(key))?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        })
        stripVisaDomainDeepLinkFromLocation(route, router)
      })
    })
  },
  { immediate: true },
)

watch(
  () =>
    [
      props.listPrimaryVisaCase,
      props.openVisaCaseId ?? '',
      props.openVisaCaseWizard ?? false,
      props.initialSubBlock ?? '',
    ] as const,
  () => {
    if (!props.listPrimaryVisaCase) {
      return
    }
    const id = props.openVisaCaseId?.trim()
    const sub = typeof props.initialSubBlock === 'string' ? props.initialSubBlock.trim() : ''
    if (id || props.openVisaCaseWizard || sub === 'cases') {
      allCasesCollapseNames.value = ['all']
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
  expandLogsPanel()
  activeBlock.value = 'logs'
  pauseSectionObserverActiveSync(OBSERVER_ACTIVE_SYNC_PAUSE_MS)
  void nextTick(() => {
    document.getElementById(visaDomainSectionElementId('logs'))?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
    nextTick(() => {
      logPreFillData.value = data
    })
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

const sectionNavItems = computed(() =>
  VISA_DOMAIN_BLOCK_ORDER.map((key) => ({
    key,
    label: stackBlockTitle(key),
  })),
)
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
          <span class="visa-domain-tab__cell-caption">{{ stackBlockTitle('materials') }}</span>
        </div>
      </div>
    </div>

    <nav
      class="visa-domain-tab__section-nav"
      role="navigation"
      :aria-label="t('detailViews.customer.stitchLayout.stackSectionNavAria')"
    >
      <div class="visa-domain-tab__section-nav-pills" role="tablist">
        <button
          v-for="item in sectionNavItems"
          :key="item.key"
          type="button"
          role="tab"
          class="visa-domain-tab__section-pill"
          :class="{ 'is-active': activeBlock === item.key }"
          :aria-selected="activeBlock === item.key"
          @click="scrollToBlock(item.key)"
        >
          {{ item.label }}
        </button>
      </div>
    </nav>

    <div ref="stackRootRef" class="visa-domain-tab__stack">
      <div
        :id="visaDomainSectionElementId('basicSnapshot')"
        class="visa-domain-tab__section visa-domain-tab__section--stack-left-1"
      >
        <CustomerVisaDomainBasicSnapshotCard
          :customer="customer"
          @open-full-basic="emit('request-basic-tab')"
        />
      </div>

      <div id="visa-domain-family" class="visa-domain-tab__section visa-domain-tab__section--stack-left-2">
        <el-card shadow="never" class="visa-domain-tab__block-card">
          <template #header>
            <span class="visa-domain-tab__block-title">{{ stackBlockTitle('family') }}</span>
          </template>
          <CustomerFamilyMembersBlock v-if="lazyMount.family" :customer-id="customerId" />
        </el-card>
      </div>

      <div id="visa-domain-materials" class="visa-domain-tab__section visa-domain-tab__section--stack-left-3">
        <el-card shadow="never" class="visa-domain-tab__block-card">
          <template #header>
            <span class="visa-domain-tab__block-title">{{ stackBlockTitle('materials') }}</span>
          </template>
          <CustomerMaterialChecklistTab
            v-if="lazyMount.materials"
            :customer-id="customerId"
            :preferred-materials-visa-case-id="materialsPreferredVisaCaseId"
            @material-status-synced="handleMaterialStatusSynced"
            @write-log="handleWriteLog"
          />
        </el-card>
      </div>

      <div id="visa-domain-paths" class="visa-domain-tab__section visa-domain-tab__section--stack-right-1">
        <el-card shadow="never" class="visa-domain-tab__block-card">
          <template #header>
            <span class="visa-domain-tab__block-title">{{ stackBlockTitle('paths') }}</span>
          </template>
          <CustomerFilePathsTab v-if="lazyMount.paths" :customer-id="customerId" />
        </el-card>
      </div>

      <div id="visa-domain-cases" class="visa-domain-tab__section visa-domain-tab__section--stack-right-2">
        <el-card shadow="never" class="visa-domain-tab__block-card">
          <template #header>
            <span class="visa-domain-tab__block-title">{{ stackBlockTitle('cases') }}</span>
          </template>
          <div v-if="listPrimaryVisaCase" class="visa-domain-tab__primary-case">
            <div class="visa-domain-tab__primary-case-head">
              <span class="visa-domain-tab__primary-case-label">{{ T('primaryCaseSummaryLabel') }}</span>
              <el-tag
                size="small"
                :type="primaryCaseStatusTagType[listPrimaryVisaCase.caseStatus] ?? 'info'"
              >
                {{
                  VisaCaseStatusLabel[listPrimaryVisaCase.caseStatus as VisaCaseStatus] ??
                    listPrimaryVisaCase.caseStatus
                }}
              </el-tag>
            </div>
            <dl class="visa-domain-tab__primary-case-dl">
              <div class="visa-domain-tab__primary-case-row">
                <dt>{{ T('primaryCaseFieldType') }}</dt>
                <dd>{{ formatVisaCaseTypeDisplay(listPrimaryVisaCase.caseType) || '—' }}</dd>
              </div>
              <div v-if="listPrimaryVisaCase.assignedToDisplayName" class="visa-domain-tab__primary-case-row">
                <dt>{{ T('primaryCaseFieldAssignee') }}</dt>
                <dd>{{ listPrimaryVisaCase.assignedToDisplayName }}</dd>
              </div>
              <div v-if="listPrimaryVisaCase.expireDate" class="visa-domain-tab__primary-case-row">
                <dt>{{ T('primaryCaseFieldExpire') }}</dt>
                <dd>{{ formatDate(listPrimaryVisaCase.expireDate) }}</dd>
              </div>
              <div v-if="listPrimaryVisaCase.nextFollowUpAt" class="visa-domain-tab__primary-case-row">
                <dt>{{ T('primaryCaseFieldFollowUp') }}</dt>
                <dd>{{ formatDate(listPrimaryVisaCase.nextFollowUpAt) }}</dd>
              </div>
              <div v-if="listPrimaryVisaCase.materialStatus" class="visa-domain-tab__primary-case-row">
                <dt>{{ T('primaryCaseFieldMaterial') }}</dt>
                <dd>
                  {{
                    MaterialStatusLabel[listPrimaryVisaCase.materialStatus as MaterialStatus] ??
                      listPrimaryVisaCase.materialStatus
                  }}
                </dd>
              </div>
            </dl>
            <el-collapse v-model="allCasesCollapseNames" class="visa-domain-tab__all-cases-collapse">
              <el-collapse-item name="all" :title="T('allCasesCollapseTitle')">
                <CustomerVisaCasesTab
                  :key="casesRefreshKey"
                  :customer-id="customerId"
                  :context-customer-name="contextCustomerName"
                  :open-visa-case-id="openVisaCaseId"
                  :open-visa-case-wizard="openVisaCaseWizard"
                  @visa-domain-customer-refresh="() => emit('visa-domain-customer-refresh')"
                />
              </el-collapse-item>
            </el-collapse>
          </div>
          <CustomerVisaCasesTab
            v-else
            :key="casesRefreshKey"
            :customer-id="customerId"
            :context-customer-name="contextCustomerName"
            :open-visa-case-id="openVisaCaseId"
            :open-visa-case-wizard="openVisaCaseWizard"
            @visa-domain-customer-refresh="() => emit('visa-domain-customer-refresh')"
          />
        </el-card>
      </div>

      <div id="visa-domain-logs" class="visa-domain-tab__section visa-domain-tab__section--stack-right-3">
        <el-collapse
          v-model="logsPanelExpandedNames"
          class="visa-domain-tab__logs-collapse"
          @change="onLogsPanelCollapseChange"
        >
          <el-collapse-item
            :name="logsPanelCollapseName"
            :title="stackBlockTitle('logs')"
          >
            <div class="visa-domain-tab__logs-collapse-body">
              <CustomerVisaCaseLogsTab
                v-if="lazyMount.logs"
                :customer-id="customerId"
                :preferred-visa-case-id="preferredVisaCaseIdForLogs"
                :auto-open-create-form="openVisaCaseLogForm"
                :suggested-next-follow-up-at="suggestedNextFollowUpAt"
                :pre-fill-data="logPreFillData"
                @prefill-settled="clearLogPreFill"
              />
            </div>
          </el-collapse-item>
        </el-collapse>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss" src="./CustomerVisaDomainTab.scoped.scss"></style>
