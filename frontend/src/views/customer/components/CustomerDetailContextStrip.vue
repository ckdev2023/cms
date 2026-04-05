<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import { VisaCaseStatusLabel } from '@/constants/enum-labels'
import { VisaCaseStatus } from '@/constants/enums'
import { P } from '@/constants/permissions'
import { useUserStore } from '@/stores/user'
import type {
  CustomerListPrimaryVisaCaseSummary,
  ListPrimaryVisaCaseSource,
} from '@/types/customer'
import { pickCustomerDetailDeepLinkPreserve } from '@/utils/customer-detail-return-navigation'
import { useLocaleFormatter } from '@/utils/locale-format'
import { materialChecklistApplicableTotal } from '@/utils/material-checklist-progress'
import { formatVisaCaseTypeDisplay } from '@/utils/visa-case-type-display'

const props = withDefaults(
  defineProps<{
    /** 当前客户 UUID，与路由参数一致 */
    customerId: string
    /** 与 `GET /customers/:id` 的 `listPrimaryVisaCase` 同源，用于摘要带与深链目标案件 */
    listPrimaryVisaCase: CustomerListPrimaryVisaCaseSummary | null
    /** 主展示摘要来源；家属回退至主客户案件时为 `PRIMARY_CUSTOMER_FALLBACK` */
    listPrimaryVisaCaseSource?: ListPrimaryVisaCaseSource
    /** 回退场景下的主客户 UUID，与列表同源 */
    primaryCustomerIdForListFallback?: string | null
  }>(),
  {
    listPrimaryVisaCaseSource: null,
    primaryCustomerIdForListFallback: null,
  },
)

defineOptions({ name: 'CustomerDetailContextStrip' })

const route = useRoute()
const router = useRouter()
const { t } = useI18n({ useScope: 'global' })
const userStore = useUserStore()
const { formatDate } = useLocaleFormatter()

const canOpenCaseContext = computed(
  (): boolean =>
    userStore.hasPermission(P.VISA_CASE_DETAIL) || userStore.hasPermission(P.VISA_CASE_LIST),
)

const canWriteCaseLog = computed((): boolean => userStore.hasPermission(P.VISA_CASE_LOG_CREATE))

const canOpenVisaWizard = computed((): boolean => userStore.hasPermission(P.VISA_CASE_CREATE))

const canOpenPrimaryCustomerDetail = computed((): boolean =>
  userStore.hasPermission(P.CUSTOMER_DETAIL),
)

/**
 * 主展示摘要为主客户回退且主客户 id 有效、与当前页客户不同时展示单行说明（含可选深链）。
 */
const showPrimaryCustomerFallbackBanner = computed((): boolean => {
  if (props.listPrimaryVisaCaseSource !== 'PRIMARY_CUSTOMER_FALLBACK') {
    return false
  }
  const pid = (props.primaryCustomerIdForListFallback ?? '').trim()
  if (!pid || pid === props.customerId) {
    return false
  }
  return true
})

/**
 * 跳转主客户详情时保留与签证域深链一致的 query（`pickCustomerDetailDeepLinkPreserve`）。
 */
const primaryCustomerDetailRoute = computed(() => {
  const pid = (props.primaryCustomerIdForListFallback ?? '').trim()
  return {
    path: `/customers/${pid}`,
    query: pickCustomerDetailDeepLinkPreserve(route.query),
  }
})

/**
 * 提取深链时应保留的 `dataScope` / `assignedTo` / `ccFrom` 片段。
 *
 * @returns 扁平 query 对象
 */
function preserveBase(): Record<string, string> {
  return pickCustomerDetailDeepLinkPreserve(route.query)
}

/**
 * 跳转签证域并打开主展示案件编辑上下文（`openVisaCaseId`，与列表/登记册一致）。
 */
function openPrimaryCase(): void {
  const pc = props.listPrimaryVisaCase
  if (!pc) {
    return
  }
  void router.push({
    path: `/customers/${props.customerId}`,
    query: {
      ...preserveBase(),
      tab: 'visa-domain',
      openVisaCaseId: pc.visaCaseId,
    },
  })
}

/**
 * 跳转签证域材料子块并锁定主展示案件（`visaDomainBlock` + `materialsVisaCaseId`）。
 */
function openMaterials(): void {
  const pc = props.listPrimaryVisaCase
  if (!pc) {
    return
  }
  void router.push({
    path: `/customers/${props.customerId}`,
    query: {
      ...preserveBase(),
      tab: 'visa-domain',
      visaDomainBlock: 'materials',
      materialsVisaCaseId: pc.visaCaseId,
    },
  })
}

/**
 * 跳转签证域日志子块并打开新建案件日志表单（`logVisaCaseId` + `openVisaCaseLogForm`）。
 */
function openWriteLog(): void {
  const pc = props.listPrimaryVisaCase
  if (!pc) {
    return
  }
  const query: Record<string, string> = {
    ...preserveBase(),
    tab: 'visa-domain',
    visaDomainBlock: 'logs',
    logVisaCaseId: pc.visaCaseId,
    openVisaCaseLogForm: '1',
  }
  if (pc.nextFollowUpAt) {
    query.suggestedNextFollowUpAt = pc.nextFollowUpAt
  }
  void router.push({
    path: `/customers/${props.customerId}`,
    query,
  })
}

/**
 * 无开放主展示摘要时引导进入签证域建案向导（`openVisaCaseWizard=1`，与 docs/21 主路径一致）。
 */
function goVisaWizard(): void {
  void router.push({
    path: `/customers/${props.customerId}`,
    query: {
      ...preserveBase(),
      tab: 'visa-domain',
      openVisaCaseWizard: '1',
    },
  })
}

/**
 * 进入签证域「案件」子块，查看本客户全部签证案件（无后端开放件数时的列表入口）。
 */
function openAllVisaCases(): void {
  void router.push({
    path: `/customers/${props.customerId}`,
    query: {
      ...preserveBase(),
      tab: 'visa-domain',
      visaDomainBlock: 'cases',
    },
  })
}

/**
 * 将主展示案件类型码格式化为界面展示文案。
 *
 * @param pc - 主展示案件摘要
 * @returns 本地化案件类型标签
 */
function primaryCaseTypeLabel(pc: CustomerListPrimaryVisaCaseSummary): string {
  return formatVisaCaseTypeDisplay(pc.caseType)
}

/**
 * 汇总材料 checklist 已收/适用数以短文案展示。
 *
 * @param pc - 主展示案件摘要
 * @returns 例如「2/5」
 */
function materialsProgressLabel(pc: CustomerListPrimaryVisaCaseSummary): string {
  const applicable = materialChecklistApplicableTotal(pc)
  const collected = pc.materialChecklistCollected ?? 0
  return `${collected}/${applicable}`
}

/**
 * 将可选日期字符串解析为时间戳；无效或空值返回 `null`。
 *
 * @param dateStr - ISO 或后端日期字符串
 * @returns 毫秒时间戳，不可解析时为 `null`
 */
function parseDateMs(dateStr: string | null | undefined): number | null {
  if (!dateStr) {
    return null
  }
  const t = new Date(dateStr).getTime()
  return Number.isNaN(t) ? null : t
}

/**
 * 在「下次跟进」与「在留期限」之间标出更紧迫的一栏（更早的日历时刻），便于扫读。
 */
const stripDatePriority = computed((): { nextFollowUp: boolean; expireDate: boolean } => {
  const pc = props.listPrimaryVisaCase
  if (!pc) {
    return { nextFollowUp: false, expireDate: false }
  }
  const nextMs = parseDateMs(pc.nextFollowUpAt)
  const expireMs = parseDateMs(pc.expireDate)
  if (nextMs === null && expireMs === null) {
    return { nextFollowUp: false, expireDate: false }
  }
  if (nextMs !== null && expireMs === null) {
    return { nextFollowUp: true, expireDate: false }
  }
  if (nextMs === null && expireMs !== null) {
    return { nextFollowUp: false, expireDate: true }
  }
  return (nextMs as number) <= (expireMs as number)
    ? { nextFollowUp: true, expireDate: false }
    : { nextFollowUp: false, expireDate: true }
})

/**
 * 主展示案件材料 checklist 的适用项总数（与 `materialChecklistApplicableTotal` 一致）。
 *
 * @returns 非负整数；无 `listPrimaryVisaCase` 时为 0
 */
const materialsApplicableTotal = computed((): number => {
  const pc = props.listPrimaryVisaCase
  if (!pc) {
    return 0
  }
  return materialChecklistApplicableTotal(pc)
})

/**
 * 解析主展示案件状态枚举为界面标签。
 *
 * @param pc - 主展示案件摘要
 * @returns 状态本地化文本
 */
function primaryCaseStatusLabel(pc: CustomerListPrimaryVisaCaseSummary): string {
  return VisaCaseStatusLabel[pc.caseStatus as VisaCaseStatus] ?? pc.caseStatus
}

/**
 * 主展示签证案件之案件担当（assigned_to）显示名；空串或缺失时回退为 i18n「未指定」。
 *
 * @returns 案件担当姓名或 `contextStrip.unassigned` 文案
 */
const assigneeDisplayLabel = computed((): string => {
  const raw = props.listPrimaryVisaCase?.assignedToDisplayName
  const trimmed = typeof raw === 'string' ? raw.trim() : ''
  return trimmed || t('detailViews.customer.contextStrip.unassigned')
})
</script>

<template>
  <div class="customer-detail-context-strip" role="region" :aria-label="t('detailViews.customer.contextStrip.title')">
    <div class="customer-detail-context-strip__head">
      <span class="customer-detail-context-strip__title">
        {{ t('detailViews.customer.contextStrip.title') }}
      </span>
    </div>

    <el-alert
      v-if="showPrimaryCustomerFallbackBanner"
      class="customer-detail-context-strip__fallback-alert"
      type="info"
      :closable="false"
      show-icon
    >
      <template #default>
        <span class="customer-detail-context-strip__fallback-line">
          {{ t('detailViews.customer.contextStrip.primaryCustomerFallbackLine') }}
          <router-link
            v-if="canOpenPrimaryCustomerDetail"
            class="customer-detail-context-strip__fallback-link"
            :to="primaryCustomerDetailRoute"
          >
            {{ t('detailViews.customer.contextStrip.primaryCustomerFallbackOpen') }}
          </router-link>
        </span>
      </template>
    </el-alert>

    <div v-if="listPrimaryVisaCase" class="customer-detail-context-strip__body">
      <div class="customer-detail-context-strip__meta">
        <span class="customer-detail-context-strip__kv">
          <span class="customer-detail-context-strip__k">{{ t('detailViews.customer.contextStrip.caseType') }}</span>
          <span class="customer-detail-context-strip__v">{{ primaryCaseTypeLabel(listPrimaryVisaCase) }}</span>
        </span>
        <span class="customer-detail-context-strip__kv">
          <span class="customer-detail-context-strip__k">{{ t('detailViews.customer.contextStrip.status') }}</span>
          <el-tag size="small" type="info">{{ primaryCaseStatusLabel(listPrimaryVisaCase) }}</el-tag>
        </span>
        <span class="customer-detail-context-strip__kv">
          <span class="customer-detail-context-strip__k">{{ t('detailViews.customer.contextStrip.assignee') }}</span>
          <span class="customer-detail-context-strip__v">{{ assigneeDisplayLabel }}</span>
        </span>
        <span class="customer-detail-context-strip__kv">
          <span class="customer-detail-context-strip__k">{{ t('detailViews.customer.contextStrip.nextFollowUp') }}</span>
          <span
            class="customer-detail-context-strip__v"
            :class="{ 'customer-detail-context-strip__v--date-priority': stripDatePriority.nextFollowUp }"
          >{{ formatDate(listPrimaryVisaCase.nextFollowUpAt) }}</span>
        </span>
        <span class="customer-detail-context-strip__kv">
          <span class="customer-detail-context-strip__k">{{ t('detailViews.customer.contextStrip.expireDate') }}</span>
          <span
            class="customer-detail-context-strip__v"
            :class="{ 'customer-detail-context-strip__v--date-priority': stripDatePriority.expireDate }"
          >{{ formatDate(listPrimaryVisaCase.expireDate) }}</span>
        </span>
        <span class="customer-detail-context-strip__kv">
          <span class="customer-detail-context-strip__k">{{ t('detailViews.customer.contextStrip.materialsProgress') }}</span>
          <span class="customer-detail-context-strip__v">
            <template v-if="materialsApplicableTotal > 0">
              {{ materialsProgressLabel(listPrimaryVisaCase) }}
            </template>
            <el-tooltip
              v-else
              :content="t('detailViews.customer.contextStrip.materialsProgressNoApplicableTooltip')"
              placement="top"
            >
              <span class="customer-detail-context-strip__materials-zero" tabindex="0">
                <span class="customer-detail-context-strip__materials-zero-fraction">
                  {{ materialsProgressLabel(listPrimaryVisaCase) }}
                </span>
                <span class="customer-detail-context-strip__materials-zero-note">
                  {{ t('detailViews.customer.contextStrip.materialsProgressNoApplicable') }}
                </span>
              </span>
            </el-tooltip>
          </span>
        </span>
      </div>
      <div class="customer-detail-context-strip__actions">
        <el-button link type="primary" @click="openAllVisaCases">
          {{ t('detailViews.customer.contextStrip.viewAllVisaCases') }}
        </el-button>
        <el-button
          v-if="canOpenCaseContext"
          link
          type="primary"
          @click="openPrimaryCase"
        >
          {{ t('detailViews.customer.contextStrip.openCase') }}
        </el-button>
        <el-button
          v-if="canOpenCaseContext"
          link
          type="primary"
          @click="openMaterials"
        >
          {{ t('detailViews.customer.contextStrip.materials') }}
        </el-button>
        <el-button
          v-if="canWriteCaseLog"
          link
          type="primary"
          @click="openWriteLog"
        >
          {{ t('detailViews.customer.contextStrip.writeLog') }}
        </el-button>
      </div>
    </div>

    <div v-else class="customer-detail-context-strip__empty">
      <span class="customer-detail-context-strip__empty-text">
        {{ t('detailViews.customer.contextStrip.noPrimaryCase') }}
      </span>
      <el-button link type="primary" @click="openAllVisaCases">
        {{ t('detailViews.customer.contextStrip.viewAllVisaCases') }}
      </el-button>
      <el-button
        v-if="canOpenVisaWizard"
        link
        type="primary"
        @click="goVisaWizard"
      >
        {{ t('detailViews.customer.contextStrip.goCreateCase') }}
      </el-button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.customer-detail-context-strip {
  margin-bottom: var(--app-spacing-md);
  padding: var(--app-spacing-md);
  border-radius: var(--el-border-radius-base);
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color-lighter);
}

.customer-detail-context-strip__head {
  margin-bottom: var(--app-spacing-sm);
}

.customer-detail-context-strip__fallback-alert {
  margin-bottom: var(--app-spacing-sm);
  padding: 6px 11px;
}

.customer-detail-context-strip__fallback-alert :deep(.el-alert__content) {
  padding: 0;
}

.customer-detail-context-strip__fallback-line {
  font-size: var(--el-font-size-small);
  line-height: 1.5;
}

.customer-detail-context-strip__fallback-link {
  margin-left: 6px;
  font-weight: 600;
  white-space: nowrap;
  color: var(--el-color-primary);
  text-decoration: none;
}

.customer-detail-context-strip__fallback-link:hover {
  color: var(--el-color-primary-light-3);
  text-decoration: underline;
}

.customer-detail-context-strip__title {
  font-size: var(--el-font-size-small);
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.customer-detail-context-strip__body {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: var(--app-spacing-md);
  justify-content: space-between;
}

.customer-detail-context-strip__meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--app-spacing-md);
  align-items: center;
}

.customer-detail-context-strip__kv {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: var(--el-font-size-small);
}

.customer-detail-context-strip__k {
  color: var(--el-text-color-secondary);
}

.customer-detail-context-strip__v {
  color: var(--el-text-color-regular);
}

.customer-detail-context-strip__v--date-priority {
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.customer-detail-context-strip__materials-zero {
  display: inline-flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 4px;
  max-width: 100%;
  cursor: help;
  border-bottom: 1px dotted var(--el-text-color-secondary);
  outline: none;
}

.customer-detail-context-strip__materials-zero-fraction {
  white-space: nowrap;
}

.customer-detail-context-strip__materials-zero-note {
  font-weight: 400;
  color: var(--el-text-color-secondary);
  font-size: var(--el-font-size-extra-small);
}

.customer-detail-context-strip__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--app-spacing-xs);
  align-items: center;
}

.customer-detail-context-strip__empty {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--app-spacing-sm);
  font-size: var(--el-font-size-small);
  color: var(--el-text-color-secondary);
}

.customer-detail-context-strip__empty-text {
  flex: 1;
  min-width: 200px;
}
</style>
