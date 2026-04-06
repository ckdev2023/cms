<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import { VisaCaseStatusLabel } from '@/constants/enum-labels'
import type { VisaCaseStatus } from '@/constants/enums'
import { P } from '@/constants/permissions'
import { useUserStore } from '@/stores/user'
import type { CustomerListPrimaryVisaCaseSummary } from '@/types/customer'
import { pickCustomerDetailDeepLinkPreserve } from '@/utils/customer-detail-return-navigation'
import { materialChecklistApplicableTotal } from '@/utils/material-checklist-progress'

const props = defineProps<{
  /** 当前客户 UUID，与路由参数一致 */
  customerId: string
  /** 与 `GET /customers/:id` 的 `listPrimaryVisaCase` 同源 */
  listPrimaryVisaCase: CustomerListPrimaryVisaCaseSummary | null
}>()

defineOptions({ name: 'CustomerDetailStickyActions' })

const route = useRoute()
const router = useRouter()
const { t } = useI18n({ useScope: 'global' })
const userStore = useUserStore()

const canOpenCaseContext = computed(
  (): boolean =>
    userStore.hasPermission(P.VISA_CASE_DETAIL) || userStore.hasPermission(P.VISA_CASE_LIST),
)

const canWriteCaseLog = computed((): boolean => userStore.hasPermission(P.VISA_CASE_LOG_CREATE))

/**
 * 与主轴条一致的主操作类型；底栏主按钮使用 `type="primary"`，次按钮为默认样式。
 */
const primaryActionKind = computed((): 'openCase' | 'writeLog' | null => {
  if (canOpenCaseContext.value) {
    return 'openCase'
  }
  if (canWriteCaseLog.value) {
    return 'writeLog'
  }
  return null
})

/**
 * 有主展示案件即展示底栏：左侧状态摘要 + 右侧按权限渲染按钮（无权限时仅展示状态）。
 */
const showBar = computed((): boolean => !!props.listPrimaryVisaCase)

/** 供模板在 `v-if` 内收窄类型，避免将可空的 `listPrimaryVisaCase` 传入摘要函数。 */
const stickyPrimaryCase = computed(
  (): CustomerListPrimaryVisaCaseSummary | null => props.listPrimaryVisaCase,
)

/**
 * 主 CTA 为「打开案件」时，另显「新增记录」跳转写日志，避免与主按钮重复。
 */
const showSecondaryWriteLog = computed(
  (): boolean => primaryActionKind.value === 'openCase' && canWriteCaseLog.value,
)

/**
 * 与 `CustomerDetailContextStrip` 材料入口一致：需能进入案件上下文方可跳转材料子块。
 */
const showUrgeSupplement = computed((): boolean => canOpenCaseContext.value)

const hasAnyStickyAction = computed(
  (): boolean =>
    primaryActionKind.value !== null || showSecondaryWriteLog.value || showUrgeSupplement.value,
)

/**
 * 底栏左侧一句叙事：主展示案件状态 + 材料分数或「无适用项」，与 Stitch 扫读句对齐。
 *
 * @param pc - 主展示案件摘要
 * @returns 已插值的一条展示文案
 */
function stickyCaseMaterialsNarrative(pc: CustomerListPrimaryVisaCaseSummary): string {
  const status = primaryCaseStatusLabel(pc)
  const materials =
    materialChecklistApplicableTotal(pc) > 0
      ? materialsFractionLabel(pc)
      : t('detailViews.customer.contextStrip.materialsProgressNoApplicable')
  return t('detailViews.customer.stickyActions.caseMaterialsNarrative', { status, materials })
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
 * 解析主展示案件状态枚举为界面标签。
 *
 * @param pc - 主展示案件摘要
 * @returns 状态本地化文本
 */
function primaryCaseStatusLabel(pc: CustomerListPrimaryVisaCaseSummary): string {
  return VisaCaseStatusLabel[pc.caseStatus as VisaCaseStatus] ?? String(pc.caseStatus)
}

/**
 * 汇总材料 checklist 已收/适用数为短分数字符串。
 *
 * @param pc - 主展示案件摘要
 * @returns 例如「2/5」
 */
function materialsFractionLabel(pc: CustomerListPrimaryVisaCaseSummary): string {
  const applicable = materialChecklistApplicableTotal(pc)
  const collected = pc.materialChecklistCollected ?? 0
  return `${collected}/${applicable}`
}

/**
 * 跳转签证域并打开主展示案件编辑上下文（与 `CustomerDetailContextStrip` 一致）。
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
 * 跳转签证域材料子块并锁定主展示案件（与 `openMaterials()` 及 docs/36 一致）。
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
 * 跳转签证域日志子块并打开新建案件日志表单（与主轴条一致）。
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
</script>

<template>
  <div
    v-if="showBar"
    class="customer-detail-sticky-actions"
    role="region"
    :aria-label="t('detailViews.customer.stickyActions.regionAriaLabel')"
  >
    <div class="customer-detail-sticky-actions__inner">
      <div
        v-if="stickyPrimaryCase"
        class="customer-detail-sticky-actions__status"
        role="group"
        :aria-label="t('detailViews.customer.stickyActions.statusLineAriaLabel')"
      >
        <span class="customer-detail-sticky-actions__narrative">{{
          stickyCaseMaterialsNarrative(stickyPrimaryCase)
        }}</span>
      </div>

      <div
        v-if="hasAnyStickyAction"
        class="customer-detail-sticky-actions__actions"
      >
        <el-button
          v-if="showSecondaryWriteLog"
          class="customer-detail-sticky-actions__secondary"
          @click="openWriteLog"
        >
          {{ t('detailViews.customer.stickyActions.newRecordCta') }}
        </el-button>
        <el-tooltip
          v-if="showUrgeSupplement"
          :content="t('detailViews.customer.stitchLayout.urgeSupplementTooltip')"
          placement="top"
        >
          <span class="customer-detail-sticky-actions__urge-wrap">
            <el-button class="customer-detail-sticky-actions__secondary" @click="openMaterials">
              {{ t('detailViews.customer.stitchLayout.urgeSupplementCta') }}
            </el-button>
          </span>
        </el-tooltip>
        <el-button
          v-if="primaryActionKind === 'openCase'"
          type="primary"
          class="customer-detail-sticky-actions__primary"
          @click="openPrimaryCase"
        >
          {{ t('detailViews.customer.contextStrip.openCase') }}
        </el-button>
        <el-button
          v-else-if="primaryActionKind === 'writeLog'"
          type="primary"
          class="customer-detail-sticky-actions__primary"
          @click="openWriteLog"
        >
          {{ t('detailViews.customer.contextStrip.writeLog') }}
        </el-button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.customer-detail-sticky-actions {
  position: sticky;
  bottom: 0;
  z-index: 10;
  margin-top: var(--app-spacing-md);
  padding: var(--app-spacing-sm) 0;
  padding-bottom: calc(var(--app-spacing-sm) + env(safe-area-inset-bottom, 0px));
  background: var(--el-fill-color-blank);
  border-top: 1px solid var(--el-border-color-lighter);
}

.customer-detail-sticky-actions__inner {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-spacing-sm);
  max-width: 100%;
}

.customer-detail-sticky-actions__status {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  min-width: min(100%, 14rem);
  font-size: var(--el-font-size-small);
  line-height: var(--el-font-line-height-primary);
  color: var(--el-text-color-regular);
}

.customer-detail-sticky-actions__narrative {
  font-weight: 500;
  color: var(--el-text-color-primary);
  font-variant-numeric: tabular-nums;
}

.customer-detail-sticky-actions__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: var(--app-spacing-xs);
}

.customer-detail-sticky-actions__urge-wrap {
  display: inline-flex;
}

.customer-detail-sticky-actions__primary {
  min-width: 6.5rem;
}
</style>
