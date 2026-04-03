<script setup lang="ts">
import { Plus, Refresh, Search } from '@element-plus/icons-vue'
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import { getDepositAccounts, getDepositSummary } from '@/api/deposit'
import PageList from '@/components/PageList.vue'
import ProTable from '@/components/ProTable.vue'
import { useProTable } from '@/composables/useProTable'
import type { ProTableColumn } from '@/types/components'
import type {
  DepositAccountListItem,
  DepositAccountQueryParams,
  DepositAccountSummary,
} from '@/types/deposit'
import { useLocaleFormatter } from '@/utils/locale-format'

import DepositRechargeDialog from './components/DepositRechargeDialog.vue'

defineOptions({ name: 'DepositListView' })

const router = useRouter()
const { t } = useI18n()
const { formatDate, formatCurrency } = useLocaleFormatter()

const columns = computed<ProTableColumn[]>(() => [
  { prop: 'customerCode', label: t('common.customerCode'), width: 130 },
  { prop: 'customerName', label: t('pages.payments.customerName'), minWidth: 160 },
  {
    prop: 'balance',
    label: t('pages.deposits.balance'),
    width: 160,
    slot: 'balance',
    align: 'right',
    sortable: 'custom',
  },
  {
    prop: 'transactionCount',
    label: t('pages.deposits.transactionCount'),
    width: 100,
    align: 'center',
  },
  {
    prop: 'updatedAt',
    label: t('common.updatedAt'),
    width: 130,
    slot: 'updatedAt',
    sortable: 'custom',
  },
  {
    prop: 'createdAt',
    label: t('detailViews.deposit.createdDate'),
    width: 130,
    slot: 'createdAt',
    sortable: 'custom',
  },
])

const searchForm = reactive<DepositAccountQueryParams>({
  keyword: '',
  hasBalance: undefined,
})

type DepositListSearchParams = Partial<
  Pick<DepositAccountQueryParams, 'keyword' | 'hasBalance'>
> & {
  sortBy?: string
  sortOrder?: 'ASC' | 'DESC'
}

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
} = useProTable<DepositAccountListItem>(getDepositAccounts)

const summaryData = ref<DepositAccountSummary | null>(null)
const rechargeVisible = ref(false)

onMounted(() => {
  loadSummary()
})

/**
 * 拉取预存款账户总览数据，用于列表页顶部统计卡片展示。
 */
async function loadSummary() {
  try {
    const res = await getDepositSummary()
    summaryData.value = res.data
  } catch {
    /* ignore */
  }
}

function handleAdd() {
  rechargeVisible.value = true
}

function handleSaved() {
  fetchData()
  loadSummary()
}

/**
 * 按当前筛选表单重载预存款账户列表。
 */
function doSearch() {
  const params: DepositListSearchParams = {}
  if (searchForm.keyword) params.keyword = searchForm.keyword
  if (searchForm.hasBalance === true) params.hasBalance = true
  handleSearch(params)
}

function doReset() {
  searchForm.keyword = ''
  searchForm.hasBalance = undefined
  handleReset()
}

/**
 * 根据表格排序状态拼装查询参数并刷新账户列表。
 *
 * @param sort - 表格组件返回的当前排序字段与方向
 * @param sort.prop - 当前参与排序的字段名
 * @param sort.order - 当前排序方向，未排序时为 null
 */
function handleSortChange(sort: {
  prop: string | null
  order: string | null
}) {
  const params: DepositListSearchParams = {}
  if (sort.prop && (sort.order === 'ascending' || sort.order === 'descending')) {
    params.sortBy = sort.prop
    params.sortOrder = sort.order === 'ascending' ? 'ASC' : 'DESC'
  }
  handleSearch({ ...searchForm, ...params })
}

function handleRowClick(row: DepositAccountListItem) {
  router.push(`/finance/deposits/${row.id}`)
}
</script>

<template>
  <PageList :title="t('pages.deposits.title')">
    <template #headerExtra>
      <el-button type="primary" :icon="Plus" @click="handleAdd">
        {{ t('pages.deposits.rechargeAction') }}
      </el-button>
    </template>

    <template #search>
      <div v-if="summaryData" class="summary-cards">
        <div class="summary-card">
          <span class="summary-card__label">{{ t('pages.deposits.totalAccounts') }}</span>
          <span class="summary-card__value">{{ summaryData.totalAccounts }}</span>
        </div>
        <div class="summary-card">
          <span class="summary-card__label">{{ t('pages.deposits.activeAccounts') }}</span>
          <span class="summary-card__value summary-card__value--active">
            {{ summaryData.activeAccounts }}
          </span>
        </div>
        <div class="summary-card">
          <span class="summary-card__label">{{ t('pages.deposits.totalBalance') }}</span>
          <span class="summary-card__value summary-card__value--amount">
            {{ formatCurrency(summaryData.totalBalance) }}
          </span>
        </div>
      </div>

      <el-form :model="searchForm" inline>
        <el-form-item :label="t('common.keyword')">
          <el-input
            v-model="searchForm.keyword"
            :placeholder="t('pages.deposits.keywordPlaceholder')"
            clearable
            style="width: 240px"
            @keyup.enter="doSearch"
          />
        </el-form-item>
        <el-form-item :label="t('pages.deposits.hasBalance')">
          <el-switch v-model="searchForm.hasBalance" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search" @click="doSearch">
            {{ t('common.search') }}
          </el-button>
          <el-button :icon="Refresh" @click="doReset">{{ t('common.reset') }}</el-button>
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
      :actions-width="100"
      @page-change="handlePageChange"
      @size-change="handleSizeChange"
      @sort-change="handleSortChange"
    >
      <template #balance="{ row }">
        <span
          class="amount-cell"
          :class="{ 'amount-cell--zero': Number(row.balance) === 0 }"
        >
          {{ formatCurrency(row.balance) }}
        </span>
      </template>

      <template #updatedAt="{ row }">
        {{ formatDate(row.updatedAt) }}
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
      </template>
    </ProTable>

    <DepositRechargeDialog v-model="rechargeVisible" @saved="handleSaved" />
  </PageList>
</template>

