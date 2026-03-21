<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Plus, Search, Refresh } from '@element-plus/icons-vue'
import PageList from '@/components/PageList.vue'
import ProTable from '@/components/ProTable.vue'
import DepositRechargeDialog from './components/DepositRechargeDialog.vue'
import { getDepositAccounts, getDepositSummary } from '@/api/deposit'
import { useProTable } from '@/composables/useProTable'
import { useLocaleFormatter } from '@/utils/locale-format'
import type { ProTableColumn } from '@/types/components'
import type {
  DepositAccountListItem,
  DepositAccountQueryParams,
  DepositAccountSummary,
} from '@/types/deposit'

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

function doSearch() {
  const params: Record<string, any> = {}
  if (searchForm.keyword) params.keyword = searchForm.keyword
  if (searchForm.hasBalance) params.hasBalance = true
  handleSearch(params)
}

function doReset() {
  searchForm.keyword = ''
  searchForm.hasBalance = undefined
  handleReset()
}

function handleSortChange(sort: { prop: string; order: string }) {
  const params: Record<string, any> = {}
  if (sort.prop && sort.order) {
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

<style scoped lang="scss">
.summary-cards {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
}

.summary-card {
  display: flex;
  flex-direction: column;
  padding: 12px 20px;
  background: #f4f4f5;
  border-radius: 8px;
  min-width: 140px;

  &__label {
    font-size: 12px;
    color: #909399;
    margin-bottom: 4px;
  }

  &__value {
    font-size: 20px;
    font-weight: 700;
    color: #303133;
    font-variant-numeric: tabular-nums;

    &--active {
      color: #67c23a;
    }

    &--amount {
      color: #409eff;
    }
  }
}

.amount-cell {
  font-weight: 600;
  font-variant-numeric: tabular-nums;

  &--zero {
    color: #c0c4cc;
  }
}
</style>
