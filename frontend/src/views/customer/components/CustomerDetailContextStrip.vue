<script setup lang="ts">
import { ArrowDown } from '@element-plus/icons-vue'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import {
  type CustomerStatus,
  type CustomerType,
} from '@/constants/enums'
import { P } from '@/constants/permissions'
import { useUserStore } from '@/stores/user'
import type {
  CustomerListPrimaryVisaCaseSummary,
  ListPrimaryVisaCaseSource,
} from '@/types/customer'
import {
  computeContextStripDatePriority,
  formatContextStripMaterialsProgressBar,
  materialsProgressLabel as stripMaterialsFractionLabel,
  primaryCaseStatusLabel as stripPrimaryCaseStatusLabel,
} from '@/utils/customer-detail-context-strip-helpers'
import { pickCustomerDetailDeepLinkPreserve } from '@/utils/customer-detail-return-navigation'
import { useLocaleFormatter } from '@/utils/locale-format'
import { materialChecklistApplicableTotal } from '@/utils/material-checklist-progress'
import { formatVisaCaseTypeDisplay } from '@/utils/visa-case-type-display'

import CustomerDetailStitchHero from './CustomerDetailStitchHero.vue'

const props = withDefaults(
  defineProps<{
    /** 当前客户 UUID，与路由参数一致 */
    customerId: string
    /** 客户姓名（Stitch 顶区标题） */
    customerName: string
    /** 客户编号 customer_code */
    customerCode: string
    /** 客户类型标签 */
    customerType: CustomerType
    /** 客户状态标签 */
    customerStatus: CustomerStatus
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

const primaryActionKind = computed((): 'openCase' | 'writeLog' | null => {
  if (canOpenCaseContext.value) {
    return 'openCase'
  }
  if (canWriteCaseLog.value) {
    return 'writeLog'
  }
  return null
})

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

const primaryCustomerDetailRoute = computed(() => {
  const pid = (props.primaryCustomerIdForListFallback ?? '').trim()
  return {
    path: `/customers/${pid}`,
    query: pickCustomerDetailDeepLinkPreserve(route.query),
  }
})

function preserveBase(): Record<string, string> {
  return pickCustomerDetailDeepLinkPreserve(route.query)
}

/**
 * 跳转当前客户签证域并打开主展示案件编辑上下文（`openVisaCaseId`）。
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
 * 跳转签证域材料子块并锁定主展示案件（`materialsVisaCaseId`）。
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
 * 跳转签证域并打开建案向导（`openVisaCaseWizard=1`）。
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
 * 跳转签证域「案件」子块以查看本客户全部签证案件。
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

type MoreMenuCommand = 'viewAll' | 'materials' | 'writeLog'

/**
 * 响应「更多操作」下拉项，与独立按钮深链行为一致。
 *
 * @param command - 下拉命令：`viewAll` / `materials` / `writeLog`
 */
function onMoreCommand(command: MoreMenuCommand): void {
  if (command === 'viewAll') {
    openAllVisaCases()
    return
  }
  if (command === 'materials') {
    openMaterials()
    return
  }
  if (command === 'writeLog') {
    openWriteLog()
  }
}

function primaryCaseTypeLabel(pc: CustomerListPrimaryVisaCaseSummary): string {
  return formatVisaCaseTypeDisplay(pc.caseType)
}

function primaryCaseStatusLabel(pc: CustomerListPrimaryVisaCaseSummary): string {
  return stripPrimaryCaseStatusLabel(pc)
}

function materialsProgressLabel(pc: CustomerListPrimaryVisaCaseSummary): string {
  return stripMaterialsFractionLabel(pc)
}

function materialsProgressBarFormat(percentage: number): string {
  return formatContextStripMaterialsProgressBar(props.listPrimaryVisaCase, percentage)
}

const stripDatePriority = computed(() => computeContextStripDatePriority(props.listPrimaryVisaCase))

const materialsApplicableTotal = computed((): number => {
  const pc = props.listPrimaryVisaCase
  if (!pc) {
    return 0
  }
  return materialChecklistApplicableTotal(pc)
})

const materialsProgressPercent = computed((): number => {
  const pc = props.listPrimaryVisaCase
  const total = materialsApplicableTotal.value
  if (!pc || total <= 0) {
    return 0
  }
  const collected = pc.materialChecklistCollected ?? 0
  return Math.min(100, Math.round((collected / total) * 100))
})

const assigneeDisplayLabel = computed((): string => {
  const raw = props.listPrimaryVisaCase?.assignedToDisplayName
  const trimmed = typeof raw === 'string' ? raw.trim() : ''
  return trimmed || t('detailViews.customer.contextStrip.unassigned')
})
</script>

<template>
  <div
    class="customer-detail-context-strip"
    role="region"
    :aria-label="t('detailViews.customer.contextStrip.title')"
  >
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

    <CustomerDetailStitchHero
      :customer-name="customerName"
      :customer-code="customerCode"
      :customer-type="customerType"
      :customer-status="customerStatus"
      :list-primary-visa-case="listPrimaryVisaCase"
    />

    <div v-if="listPrimaryVisaCase" class="customer-detail-context-strip__hero">
      <div class="customer-detail-context-strip__hero-main">
        <div class="customer-detail-context-strip__primary-line">
          <div class="customer-detail-context-strip__primary-line-start">
            <span class="customer-detail-context-strip__case-type">
              {{ primaryCaseTypeLabel(listPrimaryVisaCase) }}
            </span>
            <el-tag size="small" type="info">
              {{ primaryCaseStatusLabel(listPrimaryVisaCase) }}
            </el-tag>
          </div>
          <span class="customer-detail-context-strip__assignee">
            <span class="customer-detail-context-strip__assignee-k">{{ t('detailViews.customer.contextStrip.assignee') }}</span>
            <span class="customer-detail-context-strip__assignee-v">{{ assigneeDisplayLabel }}</span>
          </span>
        </div>
        <div class="customer-detail-context-strip__secondary-meta">
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
        </div>
      </div>

      <div class="customer-detail-context-strip__progress-col">
        <div class="customer-detail-context-strip__progress-head">
          <span class="customer-detail-context-strip__progress-label-text">
            {{ t('detailViews.customer.contextStrip.materialsProgress') }}
          </span>
        </div>
        <div v-if="materialsApplicableTotal > 0" class="customer-detail-context-strip__progress-wrap">
          <el-progress
            :percentage="materialsProgressPercent"
            :stroke-width="10"
            :format="materialsProgressBarFormat"
          />
        </div>
        <div v-else class="customer-detail-context-strip__progress-zero">
          <el-tooltip
            :content="t('detailViews.customer.contextStrip.materialsProgressNoApplicableTooltip')"
            placement="top"
          >
            <span class="customer-detail-context-strip__materials-zero" tabindex="0">
              <span class="customer-detail-context-strip__materials-zero-fraction">
                {{ materialsProgressLabel(listPrimaryVisaCase!) }}
              </span>
              <span class="customer-detail-context-strip__materials-zero-note">
                {{ t('detailViews.customer.contextStrip.materialsProgressNoApplicable') }}
              </span>
            </span>
          </el-tooltip>
        </div>
      </div>

      <div class="customer-detail-context-strip__action-col">
        <div class="customer-detail-context-strip__action-buttons">
          <el-button
            v-if="primaryActionKind === 'openCase'"
            type="primary"
            @click="openPrimaryCase"
          >
            {{ t('detailViews.customer.contextStrip.openCase') }}
          </el-button>
          <el-button
            v-else-if="primaryActionKind === 'writeLog'"
            type="primary"
            @click="openWriteLog"
          >
            {{ t('detailViews.customer.contextStrip.writeLog') }}
          </el-button>
          <el-dropdown trigger="click" @command="onMoreCommand">
            <el-button class="customer-detail-context-strip__more-trigger">
              {{ t('detailViews.customer.contextStrip.moreActions') }}
              <el-icon class="customer-detail-context-strip__more-icon">
                <ArrowDown />
              </el-icon>
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="viewAll">
                  {{ t('detailViews.customer.contextStrip.viewAllVisaCases') }}
                </el-dropdown-item>
                <el-dropdown-item v-if="canOpenCaseContext" command="materials">
                  {{ t('detailViews.customer.contextStrip.materials') }}
                </el-dropdown-item>
                <el-dropdown-item
                  v-if="primaryActionKind === 'openCase' && canWriteCaseLog"
                  command="writeLog"
                >
                  {{ t('detailViews.customer.contextStrip.writeLog') }}
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
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
        type="primary"
        @click="goVisaWizard"
      >
        {{ t('detailViews.customer.contextStrip.goCreateCase') }}
      </el-button>
    </div>
  </div>
</template>

<style scoped lang="scss" src="./CustomerDetailContextStrip.scoped.scss"></style>
