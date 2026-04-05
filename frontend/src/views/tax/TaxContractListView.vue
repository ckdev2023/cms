<script setup lang="ts">
import { Plus, Refresh,Search } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { computed, reactive,ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import { deleteTaxContract,getTaxContracts } from '@/api/tax'
import PageList from '@/components/PageList.vue'
import ProTable from '@/components/ProTable.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useProTable } from '@/composables/useProTable'
import {
  BillingCycleLabel,
  TaxContractStatusLabel,
} from '@/constants/enum-labels'
import { BillingCycle,TaxContractStatus } from '@/constants/enums'
import { useAppStore } from '@/stores/app'
import type { ProTableColumn } from '@/types/components'
import type {
  TaxContractItem,
  TaxContractQueryParams,
} from '@/types/tax'

import TaxContractFormDialog from './components/TaxContractFormDialog.vue'

defineOptions({ name: 'TaxContractListView' })

const router = useRouter()
const { confirmDelete } = useConfirm()
const appStore = useAppStore()
const { t } = useI18n({ useScope: 'global' })

const columns = computed<ProTableColumn[]>(() => [
  {
    prop: 'contractName',
    label: t('pages.taxContracts.contractName'),
    minWidth: 200,
    sortable: 'custom',
  },
  { prop: 'customerName', label: t('pages.taxContracts.customerName'), minWidth: 150 },
  {
    prop: 'contractStatus',
    label: t('common.status'),
    width: 110,
    slot: 'contractStatus',
    align: 'center',
  },
  {
    prop: 'billingCycle',
    label: t('pages.taxContracts.billingCycle'),
    width: 120,
    slot: 'billingCycle',
    align: 'center',
  },
  {
    prop: 'monthlyFee',
    label: t('pages.taxContracts.monthlyFee'),
    width: 120,
    slot: 'monthlyFee',
    align: 'right',
  },
  {
    prop: 'startDate',
    label: t('pages.taxContracts.startDate'),
    width: 110,
    slot: 'startDate',
    sortable: 'custom',
  },
  {
    prop: 'endDate',
    label: t('pages.taxContracts.endDate'),
    width: 110,
    slot: 'endDate',
    sortable: 'custom',
  },
  { prop: 'ownerName', label: t('common.owner'), width: 120 },
  {
    prop: 'createdAt',
    label: t('common.createdAt'),
    width: 110,
    slot: 'createdAt',
    sortable: 'custom',
  },
])

const searchForm = reactive<TaxContractQueryParams>({
  keyword: '',
  contractStatus: undefined,
  billingCycle: undefined,
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
  handleReset,
} = useProTable<TaxContractItem>(getTaxContracts)

const dialogVisible = ref(false)
const editingContract = ref<TaxContractItem | null>(null)
type SearchFilters = Pick<
  TaxContractQueryParams,
  'billingCycle' | 'contractStatus' | 'keyword'
>
type SortFilters = Pick<TaxContractQueryParams, 'sortBy' | 'sortOrder'>

function handleAdd() {
  editingContract.value = null
  dialogVisible.value = true
}

function handleEdit(row: TaxContractItem) {
  editingContract.value = row
  dialogVisible.value = true
}

/**
 * 删除指定税务合约，并在成功后刷新列表数据。
 *
 * @param row 当前选中的税务合约行数据
 * @returns 用户取消时提前结束；成功删除后重新拉取列表
 */
async function handleDelete(row: TaxContractItem) {
  const ok = await confirmDelete(row.contractName)
  if (!ok) {return}

  try {
    await deleteTaxContract(row.id)
    ElMessage.success(t('pages.taxContracts.deleteSuccess'))
    fetchData()
  } catch {
    // handled by interceptor
  }
}

function handleSaved() {
  fetchData()
}

/**
 * 根据筛选表单构造查询参数并触发表格检索。
 */
function doSearch() {
  const params: Partial<SearchFilters> = {}
  if (searchForm.keyword) {params.keyword = searchForm.keyword}
  if (searchForm.contractStatus)
    {params.contractStatus = searchForm.contractStatus}
  if (searchForm.billingCycle)
    {params.billingCycle = searchForm.billingCycle}
  handleSearch(params)
}

/**
 * 重置筛选表单并恢复默认列表查询条件。
 */
function doReset() {
  searchForm.keyword = ''
  searchForm.contractStatus = undefined
  searchForm.billingCycle = undefined
  handleReset()
}

/**
 * 将表格排序事件转换为后端查询参数并重新发起检索。
 *
 * @param sort ProTable 抛出的当前排序信息
 * @param sort.prop 当前参与排序的列字段
 * @param sort.order 当前列的升降序方向
 */
function handleSortChange(sort: { prop: string; order: string }) {
  const params: Partial<SortFilters> = {}
  if (sort.prop && sort.order) {
    params.sortBy = sort.prop
    params.sortOrder = sort.order === 'ascending' ? 'ASC' : 'DESC'
  }
  handleSearch({ ...searchForm, ...params })
}

function formatDate(dateStr: string) {
  if (!dateStr) {return '-'}
  return new Date(dateStr).toLocaleDateString(appStore.locale === 'zh-CN' ? 'zh-CN' : 'ja-JP')
}

function formatCurrency(value: number) {
  if (value === null || value === undefined) {return '-'}
  return `¥${Number(value).toLocaleString(appStore.locale === 'zh-CN' ? 'zh-CN' : 'ja-JP')}`
}

function handleRowClick(row: TaxContractItem) {
  router.push(`/tax-contracts/${row.id}`)
}

const statusTagType: Record<
  string,
  'success' | 'info' | 'warning' | 'danger'
> = {
  [TaxContractStatus.ACTIVE]: 'success',
  [TaxContractStatus.EXPIRED]: 'warning',
  [TaxContractStatus.TERMINATED]: 'danger',
}

const statusOptions = computed(() =>
  Object.entries(TaxContractStatusLabel).map(
    ([value, label]) => ({ value, label }),
  ),
)

const billingCycleOptions = computed(() =>
  Object.entries(BillingCycleLabel).map(
    ([value, label]) => ({ value, label }),
  ),
)

/**
 * 判断合约是否进入 30 天内的临期提醒窗口。
 *
 * @param dateStr 合约结束日期
 * @returns `true` 表示需要展示临期提醒样式
 */
function isContractExpiringSoon(dateStr: string | null): boolean {
  if (!dateStr) {return false}
  const diff = new Date(dateStr).getTime() - Date.now()
  const days = diff / (1000 * 60 * 60 * 24)
  return days >= 0 && days <= 30
}

function isContractExpired(dateStr: string | null): boolean {
  if (!dateStr) {return false}
  return new Date(dateStr).getTime() < Date.now()
}
</script>

<template>
  <PageList :title="t('pages.taxContracts.title')">
    <template #headerExtra>
      <el-button type="primary" :icon="Plus" @click="handleAdd">
        {{ t('common.create') }}
      </el-button>
    </template>

    <template #search>
      <el-form :model="searchForm" inline>
        <el-form-item :label="t('common.keyword')">
          <el-input
            v-model="searchForm.keyword"
            :placeholder="t('pages.taxContracts.keywordPlaceholder')"
            clearable
            style="width: 240px"
            @keyup.enter="doSearch"
          />
        </el-form-item>
        <el-form-item :label="t('common.status')">
          <el-select
            v-model="searchForm.contractStatus"
            :placeholder="t('common.all')"
            clearable
            style="width: 140px"
          >
            <el-option
              v-for="opt in statusOptions"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('pages.taxContracts.billingCycle')">
          <el-select
            v-model="searchForm.billingCycle"
            :placeholder="t('common.all')"
            clearable
            style="width: 140px"
          >
            <el-option
              v-for="opt in billingCycleOptions"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search" :loading="loading" @click="doSearch">
            {{ t('common.search') }}
          </el-button>
          <el-button :icon="Refresh" @click="doReset">
            {{ t('common.reset') }}
          </el-button>
        </el-form-item>
      </el-form>
    </template>

    <ProTable
      :columns="columns"
      :data="data"
      :loading="loading"
      :total="total"
      :page="page"
      :page-size="pageSize"
      :actions-width="180"
      @page-change="handlePageChange"
      @size-change="handleSizeChange"
      @sort-change="handleSortChange"
    >
      <template #contractStatus="{ row }">
        <el-tag
          size="small"
          :type="statusTagType[row.contractStatus] ?? 'info'"
        >
          {{
            TaxContractStatusLabel[
              row.contractStatus as TaxContractStatus
            ] ?? row.contractStatus
          }}
        </el-tag>
      </template>

      <template #billingCycle="{ row }">
        {{
          BillingCycleLabel[row.billingCycle as BillingCycle] ??
          row.billingCycle
        }}
      </template>

      <template #monthlyFee="{ row }">
        {{ formatCurrency(row.monthlyFee) }}
      </template>

      <template #startDate="{ row }">
        {{ formatDate(row.startDate) }}
      </template>

      <template #endDate="{ row }">
        <span
          v-if="row.endDate"
          :class="{
            'expire-warning': isContractExpiringSoon(row.endDate),
            'expire-danger': isContractExpired(row.endDate),
          }"
        >
          {{ formatDate(row.endDate) }}
        </span>
        <span v-else>-</span>
      </template>

      <template #createdAt="{ row }">
        {{ formatDate(row.createdAt) }}
      </template>

      <template #actions="{ row }">
        <el-button
          type="primary"
          link
          size="small"
          @click.stop="handleRowClick(row)"
        >
          {{ t('common.detail') }}
        </el-button>
        <el-button
          type="primary"
          link
          size="small"
          @click.stop="handleEdit(row)"
        >
          {{ t('common.edit') }}
        </el-button>
        <el-button
          type="danger"
          link
          size="small"
          @click.stop="handleDelete(row)"
        >
          {{ t('common.delete') }}
        </el-button>
      </template>
    </ProTable>

    <TaxContractFormDialog
      v-model="dialogVisible"
      :edit-data="editingContract"
      @saved="handleSaved"
    />
  </PageList>
</template>

