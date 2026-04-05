<script setup lang="ts">
/* eslint-disable max-lines -- 客户列表 ProTable 多插槽与检索/材料 checklist 列集中在一处；后续可拆子组件时再收紧 */
import { ArrowDown, Plus } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import { deleteCustomer, getCustomers } from '@/api/customer'
import PageList from '@/components/PageList.vue'
import ProTable from '@/components/ProTable.vue'
import VisaDataScopeSegmented from '@/components/VisaDataScopeSegmented.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useCustomerListColumnPreset } from '@/composables/useCustomerListColumnPreset'
import { useCustomerListViewColumns } from '@/composables/useCustomerListViewColumns'
import { useProTable } from '@/composables/useProTable'
import { useViewportTableMaxHeightPx } from '@/composables/useViewportTableMaxHeightPx'
import { useVisaDataScopeRoute } from '@/composables/useVisaDataScopeRoute'
import { pickCustomerListTableColumns } from '@/constants/customer-list-column-presets'
import {
  CustomerStatusLabel,
  CustomerTypeLabel,
  MaterialStatusLabel,
  ServiceTypeLabel,
  VisaAlertLevelLabel,
  VisaCaseStatusLabel,
  VisaReminderTypeLabel,
} from '@/constants/enum-labels'
import {
  CustomerStatus,
  CustomerType,
  FamilyLinkMode,
  MaterialStatus,
  ServiceType,
  VisaAlertLevel,
} from '@/constants/enums'
import { P } from '@/constants/permissions'
import { useAppStore } from '@/stores/app'
import { useUserStore } from '@/stores/user'
import type {
  CustomerItem,
  CustomerListPrimaryVisaCaseSummary,
  CustomerQueryParams,
} from '@/types/customer'
import { mergeCustomerDetailReturnQuery } from '@/utils/customer-detail-return-navigation'
import {
  customerListCustomerTypeTagType,
  customerListPrimaryCaseStatusTagType,
  customerListServiceTagType,
  customerListStatusTagType,
  formatPersonResidenceDaysLeftLine,
  listPrimaryCaseStatusCell,
  personResidenceAlertCell,
  personResidenceAlertElTagType,
  visaDerivedRiskShowPrimaryFallbackEmptyHint,
  visaDerivedRiskVisual,
} from '@/utils/customer-list-view-cells'
import { materialChecklistApplicableTotal } from '@/utils/material-checklist-progress'
import { formatVisaCaseTypeDisplay } from '@/utils/visa-case-type-display'
import { VISA_REMINDER_TYPE_EL_TAG_TYPE } from '@/utils/visa-reminder-type-ui'

import CustomerFormDialog from './components/CustomerFormDialog.vue'
import CustomerListPrimaryCaseFallbackBadge from './components/CustomerListPrimaryCaseFallbackBadge.vue'
import CustomerListSearchPanel from './components/CustomerListSearchPanel.vue'

defineOptions({ name: 'CustomerListView' })

const router = useRouter()
const route = useRoute()
const { confirmDelete } = useConfirm()
const appStore = useAppStore()
const userStore = useUserStore()
const { t } = useI18n({ useScope: 'global' })

const {
  dataScopeForApi,
  showScopeSwitch,
  setDataScope,
  selectableScopes,
} = useVisaDataScopeRoute()

/**
 * 根据当前路由恢复客户列表在留筛选默认值（专用路由默认 90 日，客户中心总览不预设）。
 *
 * @returns 应写入查询表单的 `residenceExpireWithinDays`，总览页为 `undefined`
 */
function residenceDefaultForRoute(): number | undefined {
  if (route.name === 'ResidenceReminderList') {
    const d = route.meta.defaultResidenceExpireWithinDays
    return typeof d === 'number' ? d : 90
  }
  return undefined
}

const pageTitle = computed(() =>
  route.name === 'ResidenceReminderList'
    ? t('pages.customers.residenceReminderTitle')
    : t('pages.customers.title'),
)

const allColumns = useCustomerListViewColumns()
const { preset: columnPreset, presetSelectOptions } = useCustomerListColumnPreset()
const columns = computed(() =>
  pickCustomerListTableColumns(allColumns.value, columnPreset.value),
)

/** 客户列表筛选区以顶栏为主、进阶条件在抽屉内，预留约 320px 给顶栏、页眉、筛选与分页，余量供表体滚动并固定表头。 */
const customerListTableMaxHeightPx = useViewportTableMaxHeightPx(320)

const residenceFilterActive = computed((): boolean => {
  const d = searchForm.residenceExpireWithinDays
  return d !== undefined && d !== null && Number.isFinite(d)
})

const showResidenceScopeHint = computed(
  (): boolean => route.name === 'ResidenceReminderList' || residenceFilterActive.value,
)

const searchForm = reactive<CustomerQueryParams>({
  keyword: '',
  customerType: undefined,
  serviceType: undefined,
  visaCaseTypeKeyword: undefined,
  listPrimaryVisaCaseStatus: undefined,
  listPrimaryFamilyCaseFilter: undefined as 'yes' | 'no' | undefined,
  listPrimaryFamilyLinkMode: undefined as FamilyLinkMode | undefined,
  status: undefined,
  visaReminderBucket: undefined,
  residenceExpireWithinDays: undefined,
})

const {
  loading,
  data,
  total,
  page,
  pageSize,
  fetchData,
  handlePageChange,
  handleSizeChange,
  handleSearch,
} = useProTable<CustomerItem, CustomerQueryParams>(
  (params) => getCustomers({ ...params, dataScope: dataScopeForApi.value }),
  { immediate: false },
)

/**
 * 根据当前客户筛选表单构造列表查询参数。
 *
 * 仅保留已填写的筛选项，避免把空字符串或未选择值传入列表接口。
 *
 * @returns 可直接传给 `handleSearch` 的客户列表查询参数
 */
function buildSearchParams(): Record<string, unknown> {
  const params: Record<string, unknown> = {}
  if (searchForm.keyword) {params.keyword = searchForm.keyword}
  if (searchForm.customerType) {params.customerType = searchForm.customerType}
  if (searchForm.serviceType) {params.serviceType = searchForm.serviceType}
  const visaCaseTypeKw =
    typeof searchForm.visaCaseTypeKeyword === 'string'
      ? searchForm.visaCaseTypeKeyword.trim()
      : ''
  if (visaCaseTypeKw) {params.visaCaseTypeKeyword = visaCaseTypeKw}
  if (searchForm.listPrimaryVisaCaseStatus) {
    params.listPrimaryVisaCaseStatus = searchForm.listPrimaryVisaCaseStatus
  }
  if (searchForm.listPrimaryFamilyCaseFilter === 'yes') {
    params.listPrimaryIsFamilyCase = true
  }
  if (searchForm.listPrimaryFamilyCaseFilter === 'no') {
    params.listPrimaryIsFamilyCase = false
  }
  if (searchForm.listPrimaryFamilyLinkMode) {
    params.listPrimaryFamilyLinkMode = searchForm.listPrimaryFamilyLinkMode
  }
  if (searchForm.status) {params.status = searchForm.status}
  if (searchForm.visaReminderBucket) {params.visaReminderBucket = searchForm.visaReminderBucket}
  if (
    searchForm.residenceExpireWithinDays !== undefined &&
    searchForm.residenceExpireWithinDays !== null &&
    Number.isFinite(searchForm.residenceExpireWithinDays)
  ) {
    params.residenceExpireWithinDays = searchForm.residenceExpireWithinDays
  }

  return params
}

watch(
  () => route.fullPath,
  () => {
    searchForm.residenceExpireWithinDays = residenceDefaultForRoute()
    handleSearch(buildSearchParams())
  },
  { immediate: true },
)

watch(
  dataScopeForApi,
  () => {
    handleSearch(buildSearchParams())
  },
  { immediate: true },
)

const dialogVisible = ref(false)
const editingCustomer = ref<CustomerItem | null>(null)

function handleAdd() {
  editingCustomer.value = null
  dialogVisible.value = true
}

function handleEdit(row: CustomerItem) {
  editingCustomer.value = row
  dialogVisible.value = true
}

/**
 * 确认后删除客户记录，并在成功后刷新列表。
 *
 * @param row - 当前选中的客户行数据
 */
async function handleDelete(row: CustomerItem) {
  const ok = await confirmDelete(row.customerName)
  if (!ok) {return}

  try {
    await deleteCustomer(row.id)
    ElMessage.success(t('pages.customers.deleteSuccess'))
    fetchData()
  } catch {
    // handled by interceptor
  }
}

/**
 * 是否具备从列表快捷跳转客户详情「签证域 → 资料路径」的权限（与原嵌套 `v-permission` 一致）。
 *
 * @returns 同时具备客户详情与资料路径列表权限时为 true
 */
function customerListCanQuickOpenPaths(): boolean {
  return (
    userStore.hasPermission(P.CUSTOMER_DETAIL) &&
    userStore.hasPermission(P.CUSTOMER_FILE_PATH_LIST)
  )
}

/**
 * 是否具备从列表快捷跳转客户详情「签证域 → 材料清单」的权限。
 *
 * @returns 具备客户详情且具备案件列表或详情权限之一时为 true
 */
function customerListCanQuickOpenMaterials(): boolean {
  return (
    userStore.hasPermission(P.CUSTOMER_DETAIL) &&
    (userStore.hasPermission(P.VISA_CASE_LIST) ||
      userStore.hasPermission(P.VISA_CASE_DETAIL))
  )
}

/**
 * 当前行是否应展示「写主案件日志」项（存在主展示案件且具备详情与日志新建权限）。
 *
 * @param row - 客户列表行
 * @returns 满足业务与权限条件时为 true
 */
function customerListCanWritePrimaryCaseLog(row: CustomerItem): boolean {
  return (
    Boolean(row.listPrimaryVisaCase) &&
    userStore.hasPermission(P.CUSTOMER_DETAIL) &&
    userStore.hasPermission(P.VISA_CASE_LOG_CREATE)
  )
}

/**
 * 按下拉菜单 `command` 分发客户列表行内操作，避免操作列横向堆叠多个链接按钮。
 *
 * @param command - 与 `el-dropdown-item` 的 `command` 一致
 * @param row - 当前行客户数据
 */
function handleCustomerListRowAction(command: string, row: CustomerItem): void {
  switch (command) {
    case 'detail': {
      handleRowClick(row)
      return
    }
    case 'edit': {
      handleEdit(row)
      return
    }
    case 'paths': {
      handleOpenVisaDomainQuickBlock(row, 'paths')
      return
    }
    case 'materials': {
      handleOpenVisaDomainQuickBlock(row, 'materials')
      return
    }
    case 'writeLog': {
      handleWritePrimaryCaseLog(row)
      return
    }
    case 'delete': {
      void handleDelete(row)
      return
    }
    default: {
      return
    }
  }
}

function handleSaved() {
  fetchData()
}

function doSearch() {
  handleSearch(buildSearchParams())
}

/**
 * 清空当前客户筛选条件并恢复默认列表。
 */
function doReset() {
  searchForm.keyword = ''
  searchForm.customerType = undefined
  searchForm.serviceType = undefined
  searchForm.visaCaseTypeKeyword = undefined
  searchForm.listPrimaryVisaCaseStatus = undefined
  searchForm.listPrimaryFamilyCaseFilter = undefined
  searchForm.listPrimaryFamilyLinkMode = undefined
  searchForm.status = undefined
  searchForm.visaReminderBucket = undefined
  searchForm.residenceExpireWithinDays = residenceDefaultForRoute()
  handleSearch(buildSearchParams())
}

/**
 * 同步表格排序状态到客户列表查询参数。
 *
 * @param sort - 表格组件返回的排序字段与方向
 * @param sort.prop - 当前生效的排序字段
 * @param sort.order - 当前生效的排序方向
 */
function handleSortChange(sort: { prop: string; order: string }) {
  const params = buildSearchParams()
  if (sort.prop && sort.order) {
    params.sortBy = sort.prop
    params.sortOrder = sort.order === 'ascending' ? 'ASC' : 'DESC'
  }
  handleSearch(params)
}

function formatDate(dateStr: string) {
  if (!dateStr) {return '-'}
  return new Date(dateStr).toLocaleDateString(appStore.locale === 'zh-CN' ? 'zh-CN' : 'ja-JP')
}

/**
 * 列表「材料」列：在存在 checklist 项时展示已收/适用总数，供与持久化状态对照。
 *
 * @param pc - 主展示案件摘要
 * @returns 例如「2/5」；无适用项时为「0/0」
 */
function primaryCaseChecklistProgressLabel(
  pc: CustomerListPrimaryVisaCaseSummary,
): string {
  const applicable = materialChecklistApplicableTotal(pc)
  const collected = pc.materialChecklistCollected ?? 0
  return `${collected}/${applicable}`
}

/**
 * 构造列表「主档在留」列副行的剩余/逾期短文案。
 *
 * @param row - 客户列表行
 * @returns 无有效 `daysLeft` 时为空字符串
 */
function residenceDaysLeftCaption(row: CustomerItem): string {
  return formatPersonResidenceDaysLeftLine(row.personInfo?.daysLeft, t)
}

/**
 * 点击行进入客户详情，并写入 `ccFrom` 以便详情顶栏返回列表/工作台等来源页。
 *
 * @param row - 当前列表行
 */
function handleRowClick(row: CustomerItem) {
  const query: Record<string, string> = {}
  mergeCustomerDetailReturnQuery(query, route)
  if (Object.keys(query).length > 0) {
    void router.push({ path: `/customers/${row.id}`, query })
    return
  }
  void router.push(`/customers/${row.id}`)
}

/**
 * 将列表页当前的签证数据范围 query 并入客户详情深链（与工作台、写日志深链一致）。
 *
 * @param query - 待补充 `dataScope` 的 query 对象（就地修改）
 */
function mergeListDataScopeIntoDetailQuery(query: Record<string, string>): void {
  const ds = route.query.dataScope
  if (typeof ds === 'string' && ds !== '') {
    query.dataScope = ds
  }
}

/**
 * 跳转客户详情签证域指定子区块（资料路径台账 / 材料清单），与详情页 Tab 文案一致。
 *
 * @param row - 客户列表行
 * @param visaDomainBlock - `paths` 或 `materials`，对应 `CustomerVisaDomainTab` 子 Tab
 */
function handleOpenVisaDomainQuickBlock(
  row: CustomerItem,
  visaDomainBlock: 'paths' | 'materials',
): void {
  const query: Record<string, string> = {
    tab: 'visa-domain',
    visaDomainBlock,
  }
  mergeCustomerDetailReturnQuery(query, route)
  mergeListDataScopeIntoDetailQuery(query)
  if (visaDomainBlock === 'materials' && row.listPrimaryVisaCase) {
    query.materialsVisaCaseId = row.listPrimaryVisaCase.visaCaseId
  }
  void router.push({ path: `/customers/${row.id}`, query })
}

/**
 * 跳转当前行主展示未结案签证案件的日志新建表单（与 `listPrimaryVisaCase` / docs/21 主展示案件一致）。
 *
 * @param row - 客户列表行
 */
function handleWritePrimaryCaseLog(row: CustomerItem): void {
  const pc = row.listPrimaryVisaCase
  if (!pc) {
    return
  }
  const query: Record<string, string> = {
    tab: 'visa-domain',
    visaDomainBlock: 'logs',
    logVisaCaseId: pc.visaCaseId,
    openVisaCaseLogForm: '1',
  }
  mergeCustomerDetailReturnQuery(query, route)
  mergeListDataScopeIntoDetailQuery(query)
  if (pc.nextFollowUpAt) {
    query.suggestedNextFollowUpAt = pc.nextFollowUpAt
  }
  void router.push({ path: `/customers/${row.id}`, query })
}

</script>

<template>
  <PageList :title="pageTitle">
    <template #headerExtra>
      <div class="customer-list-header-actions">
        <el-tooltip
          :content="t('pages.customers.columnPresetHint')"
          placement="bottom"
        >
          <el-select
            v-model="columnPreset"
            class="customer-list-column-preset-select"
            :aria-label="t('pages.customers.columnPresetAriaLabel')"
          >
            <el-option
              v-for="opt in presetSelectOptions"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </el-tooltip>
        <VisaDataScopeSegmented
          v-if="showScopeSwitch"
          class="customer-list-scope"
          :model-value="dataScopeForApi"
          :options="selectableScopes"
          @update:model-value="setDataScope"
        />
        <el-button type="primary" :icon="Plus" @click="handleAdd">
          {{ t('common.create') }}
        </el-button>
      </div>
    </template>

    <template #search>
      <CustomerListSearchPanel
        v-model:search-form="searchForm"
        :show-residence-hint="showResidenceScopeHint"
        :loading="loading"
        @search="doSearch"
        @reset="doReset"
      />
    </template>

    <ProTable
      :columns="columns"
      :data="data"
      :loading="loading"
      :total="total"
      :page="page"
      :page-size="pageSize"
      :max-height="customerListTableMaxHeightPx"
      :actions-width="104"
      @page-change="handlePageChange"
      @size-change="handleSizeChange"
      @sort-change="handleSortChange"
    >
      <template #residenceExpireDateCol="{ row }">
        <div v-if="row.personInfo?.residenceExpireDate" class="customer-list__residence-date-cell">
          <span>{{ formatDate(row.personInfo.residenceExpireDate) }}</span>
          <template v-for="cap in [residenceDaysLeftCaption(row)]" :key="`${row.id}-rdl-${cap}`">
            <span v-if="cap" class="customer-list__residence-days-left">{{ cap }}</span>
          </template>
        </div>
        <span v-else class="customer-list__no-risk">—</span>
      </template>

      <template #personResidenceAlertCol="{ row }">
        <template v-for="cell in [personResidenceAlertCell(row)]" :key="`${row.id}-res-${cell.kind}`">
          <el-tag
            v-if="cell.kind === 'tag' && cell.level === VisaAlertLevel.NORMAL"
            size="small"
            class="customer-list__residence-alert-tag customer-list__residence-alert-tag--normal"
          >
            {{ VisaAlertLevelLabel[cell.level] }}
          </el-tag>
          <el-tag
            v-else-if="cell.kind === 'tag'"
            size="small"
            :type="personResidenceAlertElTagType[cell.level] ?? 'info'"
          >
            {{ VisaAlertLevelLabel[cell.level] }}
          </el-tag>
          <span v-else-if="cell.kind === 'raw'" class="customer-list__no-risk">{{ cell.text }}</span>
          <span v-else class="customer-list__no-risk">—</span>
        </template>
      </template>

      <template #customerType="{ row }">
        <el-tag size="small" :type="customerListCustomerTypeTagType[row.customerType] ?? 'info'">
          {{ CustomerTypeLabel[row.customerType as CustomerType] ?? row.customerType }}
        </el-tag>
      </template>

      <template #serviceType="{ row }">
        <el-tag size="small" :type="customerListServiceTagType[row.serviceType] ?? 'info'">
          {{ ServiceTypeLabel[row.serviceType as ServiceType] ?? row.serviceType }}
        </el-tag>
      </template>

      <template #status="{ row }">
        <el-tag size="small" :type="customerListStatusTagType[row.status] ?? 'info'">
          {{ CustomerStatusLabel[row.status as CustomerStatus] ?? row.status }}
        </el-tag>
      </template>

      <template #visaDerivedRisk="{ row }">
        <template v-for="vis in [visaDerivedRiskVisual(row)]" :key="`${row.id}-${vis.state}`">
          <el-tag
            v-if="vis.state === 'tag'"
            size="small"
            :type="VISA_REMINDER_TYPE_EL_TAG_TYPE[vis.bucket]"
          >
            {{ VisaReminderTypeLabel[vis.bucket] }}
          </el-tag>
          <span v-else-if="vis.state === 'unknown'" class="customer-list__no-risk">{{ vis.raw }}</span>
          <el-tooltip
            v-else-if="visaDerivedRiskShowPrimaryFallbackEmptyHint(row)"
            :content="t('pages.customers.visaDerivedRiskPrimaryFallbackEmptyTooltip')"
            placement="top"
          >
            <span class="customer-list__derived-fallback-hint">{{
              t('pages.customers.visaDerivedRiskPrimaryFallbackEmptyShort')
            }}</span>
          </el-tooltip>
          <span v-else class="customer-list__no-risk">—</span>
        </template>
      </template>

      <template #listPrimaryCaseType="{ row }">
        <div class="customer-list__primary-case-cell-row customer-list__primary-case-cell-row--start">
          <CustomerListPrimaryCaseFallbackBadge :row="row" anchor="caseType" />
          <span
            v-if="row.listPrimaryVisaCase?.caseType"
            class="customer-list__primary-case-text"
          >{{ formatVisaCaseTypeDisplay(row.listPrimaryVisaCase.caseType) }}</span>
          <span v-else class="customer-list__no-risk">—</span>
        </div>
      </template>

      <template #listPrimaryCaseStatus="{ row }">
        <div class="customer-list__primary-case-cell-row customer-list__primary-case-cell-row--center">
          <CustomerListPrimaryCaseFallbackBadge :row="row" anchor="status" />
          <template v-for="cell in [listPrimaryCaseStatusCell(row)]" :key="`${row.id}-${cell.kind}`">
            <el-tag
              v-if="cell.kind === 'tag'"
              size="small"
              :type="customerListPrimaryCaseStatusTagType[cell.status] ?? 'info'"
            >
              {{ VisaCaseStatusLabel[cell.status] }}
            </el-tag>
            <span v-else-if="cell.kind === 'raw'" class="customer-list__primary-case-text">{{ cell.text }}</span>
            <span v-else class="customer-list__no-risk">—</span>
          </template>
        </div>
      </template>

      <template #listPrimaryCaseExpire="{ row }">
        <div class="customer-list__primary-case-cell-row customer-list__primary-case-cell-row--center">
          <CustomerListPrimaryCaseFallbackBadge :row="row" anchor="expire" />
          <span v-if="row.listPrimaryVisaCase?.expireDate">{{ formatDate(row.listPrimaryVisaCase.expireDate) }}</span>
          <span v-else class="customer-list__no-risk">—</span>
        </div>
      </template>

      <template #listPrimaryCaseNextFollowUp="{ row }">
        <div class="customer-list__primary-case-cell-row customer-list__primary-case-cell-row--center">
          <CustomerListPrimaryCaseFallbackBadge :row="row" anchor="nextFollowUp" />
          <span v-if="row.listPrimaryVisaCase?.nextFollowUpAt">{{ formatDate(row.listPrimaryVisaCase.nextFollowUpAt) }}</span>
          <span v-else class="customer-list__no-risk">—</span>
        </div>
      </template>

      <template #listPrimaryCaseAssignee="{ row }">
        <div class="customer-list__primary-case-cell-row customer-list__primary-case-cell-row--center">
          <CustomerListPrimaryCaseFallbackBadge :row="row" anchor="assignee" />
          <span
            v-if="row.listPrimaryVisaCase?.assignedToDisplayName"
            class="customer-list__primary-case-text"
          >{{ row.listPrimaryVisaCase.assignedToDisplayName }}</span>
          <span v-else class="customer-list__no-risk">—</span>
        </div>
      </template>

      <template #listPrimaryCaseFamily="{ row }">
        <div v-if="!row.listPrimaryVisaCase" class="customer-list__no-risk">—</div>
        <div v-else class="customer-list__family-cell">
          <CustomerListPrimaryCaseFallbackBadge :row="row" anchor="family" />
          <template v-if="row.listPrimaryVisaCase.isFamilyCase">
            <el-tag size="small" type="info">{{ t('pages.customers.familyCaseShortTag') }}</el-tag>
            <el-tag
              v-if="row.listPrimaryVisaCase.familyLinkMode === FamilyLinkMode.INTERNAL"
              size="small"
              type="success"
            >
              {{ t('detailViews.customer.visaCaseWizard.previewLinkInternal') }}
            </el-tag>
            <el-tag
              v-else-if="row.listPrimaryVisaCase.familyLinkMode === FamilyLinkMode.EXTERNAL"
              size="small"
              type="warning"
            >
              {{ t('detailViews.customer.visaCaseWizard.previewLinkExternal') }}
            </el-tag>
            <el-tag v-else size="small" type="info">
              {{ t('detailViews.customer.visaCaseWizard.previewFamilyModePending') }}
            </el-tag>
            <span class="customer-list__primary-case-text customer-list__family-mode">
              {{
                t('detailViews.customer.visaCasesTab.familyMembersCount', {
                  count: row.listPrimaryVisaCase.familyDependentsCount ?? 0,
                })
              }}
            </span>
          </template>
          <span v-else class="customer-list__no-risk">—</span>
        </div>
      </template>

      <template #listPrimaryCaseMaterial="{ row }">
        <div
          v-if="row.listPrimaryVisaCase && row.listPrimaryVisaCase.materialChecklistTotal > 0"
          class="customer-list__material-cell"
        >
          <CustomerListPrimaryCaseFallbackBadge :row="row" anchor="material" />
          <el-tooltip
            :content="
              row.listPrimaryVisaCase.materialChecklistOutOfSync
                ? t('pages.customers.listPrimaryMaterialChecklistOutOfSyncTooltip')
                : t('pages.customers.listPrimaryMaterialChecklistTooltip', {
                    collected: row.listPrimaryVisaCase.materialChecklistCollected,
                    applicable: materialChecklistApplicableTotal(row.listPrimaryVisaCase),
                    persisted:
                      (row.listPrimaryVisaCase.materialStatus &&
                        MaterialStatusLabel[row.listPrimaryVisaCase.materialStatus as MaterialStatus]) ||
                      t('pages.customers.listPrimaryMaterialPersistedUnset'),
                    suggested:
                      MaterialStatusLabel[
                        row.listPrimaryVisaCase.materialChecklistSuggestedStatus as MaterialStatus
                      ],
                  })
            "
            placement="top"
          >
            <span class="customer-list__primary-case-text">{{
              primaryCaseChecklistProgressLabel(row.listPrimaryVisaCase)
            }}</span>
          </el-tooltip>
          <el-tag
            v-if="row.listPrimaryVisaCase.materialStatus"
            size="small"
            type="info"
            class="customer-list__material-persisted-tag"
          >
            {{
              MaterialStatusLabel[row.listPrimaryVisaCase.materialStatus as MaterialStatus] ??
              row.listPrimaryVisaCase.materialStatus
            }}
          </el-tag>
          <el-tag
            v-if="row.listPrimaryVisaCase.materialChecklistOutOfSync"
            size="small"
            type="warning"
          >
            {{ t('pages.customers.listPrimaryMaterialSyncHint') }}
          </el-tag>
        </div>
        <span
          v-else-if="row.listPrimaryVisaCase?.materialStatus"
          class="customer-list__primary-case-cell-row customer-list__primary-case-cell-row--center customer-list__material-cell--fallback-only"
        >
          <CustomerListPrimaryCaseFallbackBadge :row="row" anchor="material" />
          <span class="customer-list__primary-case-text">{{
            MaterialStatusLabel[row.listPrimaryVisaCase.materialStatus as MaterialStatus] ??
            row.listPrimaryVisaCase.materialStatus
          }}</span>
        </span>
        <span v-else class="customer-list__no-risk">—</span>
      </template>

      <template #createdAt="{ row }">
        {{ formatDate(row.createdAt) }}
      </template>

      <template #actions="{ row }">
        <el-dropdown
          trigger="click"
          class="customer-list__row-actions-dropdown"
          @command="(cmd) => handleCustomerListRowAction(cmd, row)"
        >
          <el-button
            type="primary"
            link
            size="small"
            class="customer-list__actions-trigger"
            @click.stop
          >
            {{ t('common.actions') }}
            <el-icon class="customer-list__actions-trigger-icon">
              <ArrowDown />
            </el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="detail">
                {{ t('common.detail') }}
              </el-dropdown-item>
              <el-dropdown-item command="edit">
                {{ t('common.edit') }}
              </el-dropdown-item>
              <el-dropdown-item v-if="customerListCanQuickOpenPaths()" command="paths">
                {{ t('detailViews.customer.visaDomainTab.pathsBlock') }}
              </el-dropdown-item>
              <el-dropdown-item v-if="customerListCanQuickOpenMaterials()" command="materials">
                {{ t('detailViews.customer.visaDomainTab.materialsBlock') }}
              </el-dropdown-item>
              <el-dropdown-item
                v-if="customerListCanWritePrimaryCaseLog(row)"
                command="writeLog"
              >
                {{ t('pages.workbenchVisa.actionWriteCaseLog') }}
              </el-dropdown-item>
              <el-dropdown-item command="delete" divided class="customer-list__action-item--danger">
                {{ t('common.delete') }}
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </template>
    </ProTable>

    <CustomerFormDialog
      v-model="dialogVisible"
      :edit-data="editingCustomer"
      @saved="handleSaved"
    />
  </PageList>
</template>

<style scoped lang="scss">
.customer-list-column-preset-select {
  width: 152px;
}

.customer-list__row-actions-dropdown {
  display: inline-flex;
  vertical-align: middle;
}

.customer-list__actions-trigger {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.customer-list__actions-trigger-icon {
  font-size: 12px;
}

.customer-list__row-actions-dropdown :deep(.customer-list__action-item--danger) {
  color: var(--el-color-danger);
}

.customer-list-header-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: var(--app-spacing-sm) var(--app-spacing-md);
}

.customer-list-header-actions > :deep(.el-button) {
  flex-shrink: 0;
}

.customer-list-scope {
  flex: 0 1 auto;
  min-width: 0;
}

.customer-list__no-risk {
  color: var(--el-text-color-placeholder);
}

.customer-list__primary-case-text {
  word-break: break-word;
}

.customer-list__primary-case-cell-row {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.customer-list__primary-case-cell-row--start {
  justify-content: flex-start;
}

.customer-list__primary-case-cell-row--center {
  justify-content: center;
}

.customer-list__material-cell--fallback-only {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.customer-list__derived-fallback-hint {
  display: inline-block;
  max-width: 100%;
  font-size: 12px;
  line-height: 1.35;
  color: var(--el-text-color-secondary);
  cursor: help;
  word-break: break-word;
}

.customer-list__family-cell {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  justify-content: center;
}

.customer-list__family-mode {
  font-size: 12px;
}

.customer-list__residence-date-cell {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  line-height: 1.3;
}

.customer-list__residence-days-left {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.customer-list__residence-alert-tag--normal {
  --el-tag-bg-color: #fef9c3;
  --el-tag-border-color: #fde047;
  --el-tag-text-color: #854d0e;
}

.customer-list__material-cell {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.customer-list__material-persisted-tag {
  max-width: 72px;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
