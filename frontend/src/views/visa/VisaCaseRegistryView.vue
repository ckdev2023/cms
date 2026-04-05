<script setup lang="ts">
import { Refresh } from '@element-plus/icons-vue'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import { getGlobalVisaCases } from '@/api/visa-case'
import PageList from '@/components/PageList.vue'
import ProTable from '@/components/ProTable.vue'
import VisaDataScopeSegmented from '@/components/VisaDataScopeSegmented.vue'
import { useProTable } from '@/composables/useProTable'
import { useVisaDataScopeRoute } from '@/composables/useVisaDataScopeRoute'
import {
  FamilyLinkModeLabel,
  MaterialStatusLabel,
  VisaCaseStatusLabel,
} from '@/constants/enum-labels'
import { FamilyLinkMode, MaterialStatus, VisaCaseStatus } from '@/constants/enums'
import { P } from '@/constants/permissions'
import type { ProTableColumn } from '@/types/components'
import type { GlobalVisaCaseQueryParams, VisaCaseItem } from '@/types/visa-case'
import { mergeCustomerDetailReturnQuery } from '@/utils/customer-detail-return-navigation'
import { useLocaleFormatter } from '@/utils/locale-format'
import { formatVisaCaseTypeDisplay } from '@/utils/visa-case-type-display'

import VisaCaseRegistrySearchForm from './components/VisaCaseRegistrySearchForm.vue'
import VisaCaseRegistryStatsPanel from './components/VisaCaseRegistryStatsPanel.vue'

defineOptions({ name: 'VisaCaseRegistryView' })

const router = useRouter()
const route = useRoute()
const { t } = useI18n({ useScope: 'global' })
const { formatDate } = useLocaleFormatter()

const {
  dataScopeForApi,
  showScopeSwitch,
  setDataScope,
  selectableScopes,
} = useVisaDataScopeRoute()

const statusTagType: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'primary'> = {
  [VisaCaseStatus.DRAFT]: 'info',
  [VisaCaseStatus.IN_PROGRESS]: 'primary',
  [VisaCaseStatus.SUBMITTED]: 'primary',
  [VisaCaseStatus.SUPPLEMENT]: 'warning',
  [VisaCaseStatus.APPROVED]: 'success',
  [VisaCaseStatus.REJECTED]: 'danger',
  [VisaCaseStatus.COMPLETED]: 'success',
  [VisaCaseStatus.CANCELLED]: 'info',
}

const columns = computed<ProTableColumn[]>(() => [
  {
    prop: 'customerName',
    label: t('pages.visaCaseRegistry.customer'),
    minWidth: 160,
    slot: 'customer',
  },
  {
    prop: 'caseType',
    label: t('pages.visaCaseRegistry.caseType'),
    minWidth: 120,
    slot: 'caseType',
    showOverflowTooltip: true,
  },
  {
    prop: 'caseStatus',
    label: t('pages.visaCaseRegistry.caseStatus'),
    width: 120,
    slot: 'caseStatus',
    align: 'center',
  },
  {
    prop: 'internalPrimaryCustomerName',
    label: t('pages.visaCaseRegistry.primaryApplicant'),
    width: 130,
    slot: 'primaryApplicant',
  },
  {
    prop: 'isFamilyCase',
    label: t('pages.visaCaseRegistry.familyCase'),
    width: 100,
    slot: 'familyCase',
    align: 'center',
  },
  {
    prop: 'assigneeName',
    label: t('pages.visaCaseRegistry.assignee'),
    width: 110,
    slot: 'assigneeName',
  },
  {
    prop: 'expireDate',
    label: t('pages.visaCaseRegistry.expireDate'),
    width: 120,
    slot: 'expireDate',
  },
  {
    prop: 'nextFollowUpAt',
    label: t('pages.visaCaseRegistry.nextFollowUpAt'),
    width: 130,
    slot: 'nextFollowUpAt',
  },
  {
    prop: 'materialStatus',
    label: t('pages.visaCaseRegistry.materialStatus'),
    width: 110,
    slot: 'materialStatus',
  },
])

const statsPanelRef = ref<InstanceType<typeof VisaCaseRegistryStatsPanel> | null>(null)

/** 域内统计折叠面板：默认收起以减少首屏纵向占用 */
const registryStatsExpandedNames = ref<string[]>([])

const {
  loading,
  data,
  total,
  page,
  pageSize,
  searchParams,
  fetchData,
  handlePageChange,
  handleSizeChange,
  handleSearch,
  handleReset,
} = useProTable<VisaCaseItem, GlobalVisaCaseQueryParams>(
  (params) => getGlobalVisaCases({ ...params, dataScope: dataScopeForApi.value }),
  { immediate: false },
)

watch(
  dataScopeForApi,
  () => {
    void fetchData()
  },
  { immediate: true },
)

/**
 * 接收子组件提交的筛选条件并刷新表格。
 *
 * @param params - 全局案件列表查询参数
 */
function onSearchFilters(params: GlobalVisaCaseQueryParams): void {
  handleSearch(params)
}

/**
 * 在子组件清空表单后重置表格检索状态。
 */
function onResetFilters(): void {
  handleReset()
}

/**
 * 将表格行断言为签证案件项，供模板槽内安全读取字段。
 *
 * @param row - 表格行对象
 * @returns 带类型的案件记录
 */
function asRow(row: unknown): VisaCaseItem {
  return row as VisaCaseItem
}

/**
 * 跳转至客户详情页的签证域 Tab。
 *
 * @param row - 当前行案件数据
 */
function goCustomer(row: VisaCaseItem): void {
  const query: Record<string, string> = { tab: 'visa-domain' }
  mergeCustomerDetailReturnQuery(query, route)
  void router.push({
    path: `/customers/${row.customerId}`,
    query,
  })
}

/**
 * 跳转至客户签证域并尝试打开指定案件的编辑对话框（需具备详情/编辑权限）。
 *
 * @param row - 当前行案件数据
 */
function goCase(row: VisaCaseItem): void {
  const query: Record<string, string> = { tab: 'visa-domain', openVisaCaseId: row.id }
  mergeCustomerDetailReturnQuery(query, route)
  void router.push({
    path: `/customers/${row.customerId}`,
    query,
  })
}

/**
 * 按当前已保存的检索条件重新拉取登记册。
 */
function reloadList(): void {
  void fetchData()
  statsPanelRef.value?.reload()
}
</script>

<template>
  <PageList>
    <template v-if="showScopeSwitch" #headerExtra>
      <div class="visa-registry__header-actions">
        <VisaDataScopeSegmented
          class="visa-registry__scope"
          :model-value="dataScopeForApi"
          :options="selectableScopes"
          @update:model-value="setDataScope"
        />
      </div>
    </template>

    <template #search>
      <VisaCaseRegistrySearchForm @search="onSearchFilters" @reset="onResetFilters" />
    </template>

    <div class="visa-registry__scope-hint">
      <span class="visa-registry__scope-hint-text">{{ t('pages.visaCaseRegistry.scopeHintShort') }}</span>
      <el-tooltip
        :content="t('pages.visaCaseRegistry.scopeHint')"
        placement="bottom-start"
        :max-width="440"
        :show-after="200"
      >
        <el-button link type="primary" class="visa-registry__scope-hint-link">
          {{ t('pages.visaCaseRegistry.detailHintLink') }}
        </el-button>
      </el-tooltip>
    </div>

    <div class="visa-registry__list-toolbar">
      <el-button :icon="Refresh" :loading="loading" @click="reloadList">
        {{ t('pages.visaCaseRegistry.reload') }}
      </el-button>
    </div>

    <el-collapse v-model="registryStatsExpandedNames" class="visa-registry__stats-collapse">
      <el-collapse-item name="stats" :title="t('pages.visaCaseRegistry.statsCollapseTitle')">
        <VisaCaseRegistryStatsPanel
          ref="statsPanelRef"
          embedded-in-collapse
          :list-query="searchParams"
          :data-scope="dataScopeForApi"
        />
      </el-collapse-item>
    </el-collapse>

    <ProTable
      row-key="id"
      class="visa-registry__table"
      :columns="columns"
      :data="data"
      :loading="loading"
      :total="total"
      :page="page"
      :page-size="pageSize"
      :actions-width="148"
      :empty-text="t('pages.visaCaseRegistry.noData')"
      @page-change="handlePageChange"
      @size-change="handleSizeChange"
    >
      <template #customer="{ row }">
        <div class="visa-registry__customer-cell">
          <span class="visa-registry__customer-name">{{ asRow(row).customerName || '—' }}</span>
          <span v-if="asRow(row).customerCode" class="visa-registry__customer-code">
            {{ asRow(row).customerCode }}
          </span>
        </div>
      </template>

      <template #caseType="{ row }">
        {{ formatVisaCaseTypeDisplay(asRow(row).caseType) || '—' }}
      </template>

      <template #caseStatus="{ row }">
        <el-tag size="small" :type="statusTagType[asRow(row).caseStatus] ?? 'info'">
          {{ VisaCaseStatusLabel[asRow(row).caseStatus] }}
        </el-tag>
      </template>

      <template #primaryApplicant="{ row }">
        <span
          v-if="
            asRow(row).isFamilyCase &&
              asRow(row).familyLinkMode === FamilyLinkMode.INTERNAL &&
              asRow(row).internalPrimaryCustomerName
          "
        >
          {{ asRow(row).internalPrimaryCustomerName }}
        </span>
        <span
          v-else-if="
            asRow(row).isFamilyCase &&
              asRow(row).familyLinkMode === FamilyLinkMode.EXTERNAL &&
              asRow(row).externalPrimaryName
          "
        >
          {{ asRow(row).externalPrimaryName }}
        </span>
        <span v-else class="text-placeholder">—</span>
      </template>

      <template #familyCase="{ row }">
        <template v-if="asRow(row).isFamilyCase">
          <el-tag size="small" type="warning">
            {{ t('common.yes') }}
          </el-tag>
          <div v-if="asRow(row).familyLinkMode" class="visa-registry__family-mode">
            {{ FamilyLinkModeLabel[asRow(row).familyLinkMode as FamilyLinkMode] }}
          </div>
        </template>
        <span v-else class="text-placeholder">—</span>
      </template>

      <template #assigneeName="{ row }">
        {{ asRow(row).assigneeName ?? t('common.unassigned') }}
      </template>

      <template #expireDate="{ row }">
        {{ asRow(row).expireDate ? formatDate(asRow(row).expireDate) : '—' }}
      </template>

      <template #nextFollowUpAt="{ row }">
        {{ asRow(row).nextFollowUpAt ? formatDate(asRow(row).nextFollowUpAt) : '—' }}
      </template>

      <template #materialStatus="{ row }">
        <span v-if="asRow(row).materialStatus">
          {{
            MaterialStatusLabel[asRow(row).materialStatus as MaterialStatus] ??
              asRow(row).materialStatus
          }}
        </span>
        <span v-else class="text-placeholder">—</span>
      </template>

      <template #actions="{ row }">
        <div class="visa-registry__row-actions">
          <span v-permission="P.CUSTOMER_DETAIL">
            <el-button type="primary" link size="small" @click="goCustomer(asRow(row))">
              {{ t('pages.visaCaseRegistry.goCustomer') }}
            </el-button>
          </span>
          <span v-permission="P.VISA_CASE_DETAIL">
            <el-button type="primary" link size="small" @click="goCase(asRow(row))">
              {{ t('pages.visaCaseRegistry.goCase') }}
            </el-button>
          </span>
        </div>
      </template>
    </ProTable>
  </PageList>
</template>

<style scoped lang="scss">
.visa-registry {
  &__header-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: var(--app-spacing-sm);
    max-width: 100%;
  }

  &__scope {
    flex: 0 1 auto;
    min-width: 0;
  }

  &__scope-hint {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 4px var(--app-spacing-sm);
    margin: 0 var(--app-spacing-lg) var(--app-spacing-sm);
    padding: var(--app-spacing-sm) var(--app-spacing-md);
    font-size: 13px;
    line-height: 1.5;
    color: var(--el-text-color-secondary);
    background: var(--el-fill-color-light);
    border-radius: var(--el-border-radius-base);
    border: 1px solid var(--el-border-color-lighter);
  }

  &__scope-hint-text {
    flex: 1 1 220px;
    min-width: 0;
  }

  &__scope-hint-link {
    flex: 0 0 auto;
    padding: 0;
    height: auto;
    vertical-align: baseline;
  }

  &__stats-collapse {
    margin: 0 var(--app-spacing-lg) var(--app-spacing-md);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: var(--el-border-radius-base);
    overflow: hidden;
    background: var(--el-fill-color-blank);

    :deep(.el-collapse-item__header) {
      font-weight: 600;
      padding-left: var(--app-spacing-md);
      padding-right: var(--app-spacing-md);
    }

    :deep(.el-collapse-item__wrap) {
      border-bottom: none;
    }

    :deep(.el-collapse-item__content) {
      padding: 0 var(--app-spacing-md) var(--app-spacing-md);
    }
  }

  &__list-toolbar {
    display: flex;
    justify-content: flex-end;
    padding: 0 var(--app-spacing-lg) var(--app-spacing-sm);
  }

  &__table {
    padding: 0 var(--app-spacing-lg) var(--app-spacing-lg);
  }

  &__row-actions {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 2px;
  }

  &__customer-cell {
    display: flex;
    flex-direction: column;
    gap: 2px;
    line-height: 1.35;
  }

  &__customer-name {
    font-weight: 500;
  }

  &__customer-code {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  &__family-mode {
    font-size: 11px;
    color: var(--el-text-color-secondary);
    margin-top: 2px;
  }
}

.text-placeholder {
  color: var(--el-text-color-placeholder);
}
</style>
