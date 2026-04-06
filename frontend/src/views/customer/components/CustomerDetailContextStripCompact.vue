<script setup lang="ts">
import { ArrowDown } from '@element-plus/icons-vue'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import {
  CustomerStatusLabel,
  CustomerTypeLabel,
} from '@/constants/enum-labels'
import {
  type CustomerStatus,
  type CustomerType,
  FamilyLinkMode,
} from '@/constants/enums'
import { P } from '@/constants/permissions'
import { useUserStore } from '@/stores/user'
import type {
  CustomerListPrimaryVisaCaseSummary,
  ListPrimaryVisaCaseSource,
} from '@/types/customer'
import {
  computeContextStripDatePriority,
  materialsProgressLabel as stripMaterialsFractionLabel,
  primaryCaseStatusLabel as stripPrimaryCaseStatusLabel,
} from '@/utils/customer-detail-context-strip-helpers'
import { pickCustomerDetailDeepLinkPreserve } from '@/utils/customer-detail-return-navigation'
import { useLocaleFormatter } from '@/utils/locale-format'
import { formatVisaCaseTypeDisplay } from '@/utils/visa-case-type-display'

const props = withDefaults(
  defineProps<{
    /**
     * `stack`：多行叠放（默认）；`hub-single-row`：客户详情签证页眉主轴单行，中段可横向滚动。
     */
    layout?: 'stack' | 'hub-single-row'
    /** 当前客户 UUID，与路由参数一致 */
    customerId: string
    /** 客户姓名 */
    customerName: string
    /** 客户编号 customer_code */
    customerCode: string
    /** 客户类型标签 */
    customerType: CustomerType
    /** 客户状态标签 */
    customerStatus: CustomerStatus
    /** 与 `GET /customers/:id` 的 `listPrimaryVisaCase` 同源 */
    listPrimaryVisaCase: CustomerListPrimaryVisaCaseSummary | null
    /** 主展示摘要来源 */
    listPrimaryVisaCaseSource?: ListPrimaryVisaCaseSource | null
    /** 回退场景下的主客户 UUID */
    primaryCustomerIdForListFallback?: string | null
  }>(),
  {
    layout: 'stack',
    listPrimaryVisaCaseSource: null,
    primaryCustomerIdForListFallback: null,
  },
)

defineOptions({ name: 'CustomerDetailContextStripCompact' })

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

const stripDatePriority = computed(() => computeContextStripDatePriority(props.listPrimaryVisaCase))

const assigneeDisplayLabel = computed((): string => {
  const raw = props.listPrimaryVisaCase?.assignedToDisplayName
  const trimmed = typeof raw === 'string' ? raw.trim() : ''
  return trimmed || t('detailViews.customer.contextStrip.unassigned')
})

</script>

<template>
  <div
    class="customer-detail-context-strip customer-detail-context-strip--compact"
    :class="{
      'customer-detail-context-strip--hub-single-row': layout === 'hub-single-row',
    }"
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

    <div class="customer-detail-context-strip__compact">
      <div class="customer-detail-context-strip__compact-id">
        <span class="customer-detail-context-strip__compact-name">{{ customerName }}</span>
        <div class="customer-detail-context-strip__compact-chips">
          <el-tag size="small">
            {{ CustomerTypeLabel[customerType] }}
          </el-tag>
          <el-tag
            size="small"
            :type="customerStatus === 'ACTIVE' ? 'success' : 'danger'"
          >
            {{ CustomerStatusLabel[customerStatus] }}
          </el-tag>
          <el-tag size="small" type="info">
            {{ customerCode }}
          </el-tag>
          <template v-if="listPrimaryVisaCase?.isFamilyCase">
            <el-tag size="small" type="info">
              {{ t('pages.customers.familyCaseShortTag') }}
            </el-tag>
            <el-tag
              v-if="listPrimaryVisaCase.familyLinkMode === FamilyLinkMode.INTERNAL"
              size="small"
              type="success"
            >
              {{ t('detailViews.customer.visaCaseWizard.previewLinkInternal') }}
            </el-tag>
            <el-tag
              v-else-if="listPrimaryVisaCase.familyLinkMode === FamilyLinkMode.EXTERNAL"
              size="small"
              type="warning"
            >
              {{ t('detailViews.customer.visaCaseWizard.previewLinkExternal') }}
            </el-tag>
            <el-tag v-else size="small" type="info">
              {{ t('detailViews.customer.visaCaseWizard.previewFamilyModePending') }}
            </el-tag>
            <span class="customer-detail-context-strip__compact-family-meta">
              {{
                t('detailViews.customer.visaCasesTab.familyMembersCount', {
                  count: listPrimaryVisaCase.familyDependentsCount ?? 0,
                })
              }}
            </span>
          </template>
        </div>
      </div>

      <template v-if="listPrimaryVisaCase">
        <div class="customer-detail-context-strip__compact-case">
          <div class="customer-detail-context-strip__compact-case-main">
            <span class="customer-detail-context-strip__case-type">
              {{ primaryCaseTypeLabel(listPrimaryVisaCase) }}
            </span>
            <el-tag size="small" type="info">
              {{ primaryCaseStatusLabel(listPrimaryVisaCase) }}
            </el-tag>
            <span class="customer-detail-context-strip__compact-inline-meta">
              <span class="customer-detail-context-strip__compact-dot-sep">
                <span class="customer-detail-context-strip__k">{{ t('detailViews.customer.contextStrip.assignee') }}</span>
                <span class="customer-detail-context-strip__v">{{ assigneeDisplayLabel }}</span>
              </span>
              <span class="customer-detail-context-strip__compact-dot-sep">
                <span class="customer-detail-context-strip__k">{{ t('detailViews.customer.contextStrip.nextFollowUp') }}</span>
                <span
                  class="customer-detail-context-strip__v"
                  :class="{ 'customer-detail-context-strip__v--date-priority': stripDatePriority.nextFollowUp }"
                >{{ formatDate(listPrimaryVisaCase.nextFollowUpAt) }}</span>
              </span>
              <span class="customer-detail-context-strip__compact-dot-sep">
                <span class="customer-detail-context-strip__k">{{ t('detailViews.customer.contextStrip.expireDate') }}</span>
                <span
                  class="customer-detail-context-strip__v"
                  :class="{ 'customer-detail-context-strip__v--date-priority': stripDatePriority.expireDate }"
                >{{ formatDate(listPrimaryVisaCase.expireDate) }}</span>
              </span>
              <span class="customer-detail-context-strip__compact-dot-sep">
                <span class="customer-detail-context-strip__k">{{ t('detailViews.customer.contextStrip.materialsProgress') }}</span>
                <span class="customer-detail-context-strip__v">{{ materialsProgressLabel(listPrimaryVisaCase) }}</span>
              </span>
            </span>
          </div>
          <div class="customer-detail-context-strip__compact-actions">
            <el-button
              v-if="primaryActionKind === 'openCase'"
              type="primary"
              size="small"
              @click="openPrimaryCase"
            >
              {{ t('detailViews.customer.contextStrip.openCase') }}
            </el-button>
            <el-button
              v-else-if="primaryActionKind === 'writeLog'"
              type="primary"
              size="small"
              @click="openWriteLog"
            >
              {{ t('detailViews.customer.contextStrip.writeLog') }}
            </el-button>
            <el-dropdown trigger="click" @command="onMoreCommand">
              <el-button size="small" class="customer-detail-context-strip__more-trigger">
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
      </template>
      <div v-else class="customer-detail-context-strip__compact-empty">
        <span class="customer-detail-context-strip__empty-text">
          {{ t('detailViews.customer.contextStrip.noPrimaryCase') }}
        </span>
        <el-button link type="primary" size="small" @click="openAllVisaCases">
          {{ t('detailViews.customer.contextStrip.viewAllVisaCases') }}
        </el-button>
        <el-button
          v-if="canOpenVisaWizard"
          type="primary"
          size="small"
          @click="goVisaWizard"
        >
          {{ t('detailViews.customer.contextStrip.goCreateCase') }}
        </el-button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss" src="./CustomerDetailContextStrip.scoped.scss"></style>
