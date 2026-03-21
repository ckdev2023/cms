<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Plus, Search, Refresh } from '@element-plus/icons-vue'
import PageList from '@/components/PageList.vue'
import ProTable from '@/components/ProTable.vue'
import PaymentFormDialog from './components/PaymentFormDialog.vue'
import { getPayments } from '@/api/payment'
import { useProTable } from '@/composables/useProTable'
import { PaymentStatus, PaymentMethod } from '@/constants/enums'
import { PaymentStatusLabel, PaymentMethodLabel } from '@/constants/enum-labels'
import { useLocaleFormatter } from '@/utils/locale-format'
import type { ProTableColumn } from '@/types/components'
import type { PaymentListItem, PaymentQueryParams } from '@/types/payment'

defineOptions({ name: 'PaymentListView' })

const router = useRouter()
const { t } = useI18n()
const { formatDate, formatCurrency } = useLocaleFormatter()

const columns = computed<ProTableColumn[]>(() => [
  { prop: 'paymentNo', label: t('pages.payments.paymentNo'), minWidth: 180, sortable: 'custom' },
  { prop: 'customerName', label: t('pages.payments.customerName'), minWidth: 150 },
  {
    prop: 'paymentAmount',
    label: t('pages.payments.paymentAmount'),
    width: 140,
    slot: 'paymentAmount',
    align: 'right',
    sortable: 'custom',
  },
  {
    prop: 'paymentMethod',
    label: t('pages.payments.paymentMethod'),
    width: 110,
    slot: 'paymentMethod',
    align: 'center',
  },
  { prop: 'status', label: t('common.status'), width: 120, slot: 'status', align: 'center' },
  {
    prop: 'paymentDate',
    label: t('pages.payments.paymentDate'),
    width: 120,
    slot: 'paymentDate',
    sortable: 'custom',
  },
  { prop: 'allocationCount', label: t('pages.payments.allocationCount'), width: 80, align: 'center' },
  { prop: 'createdAt', label: t('common.createdAt'), width: 110, slot: 'createdAt', sortable: 'custom' },
])

const searchForm = reactive<PaymentQueryParams>({
  keyword: '',
  status: undefined,
  paymentMethod: undefined,
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
} = useProTable<PaymentListItem>(getPayments)

const dialogVisible = ref(false)

function handleAdd() {
  dialogVisible.value = true
}

function handleSaved() {
  fetchData()
}

function doSearch() {
  const params: Record<string, any> = {}
  if (searchForm.keyword) params.keyword = searchForm.keyword
  if (searchForm.status) params.status = searchForm.status
  if (searchForm.paymentMethod) params.paymentMethod = searchForm.paymentMethod
  handleSearch(params)
}

function doReset() {
  searchForm.keyword = ''
  searchForm.status = undefined
  searchForm.paymentMethod = undefined
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

function handleRowClick(row: PaymentListItem) {
  router.push(`/finance/payments/${row.id}`)
}

const statusTagType: Record<string, 'primary' | 'success' | 'info' | 'warning' | 'danger'> = {
  [PaymentStatus.REGISTERED]: 'primary',
  [PaymentStatus.VERIFIED]: 'success',
  [PaymentStatus.REFUNDED]: 'warning',
  [PaymentStatus.REVERSED]: 'danger',
}

const statusOptions = Object.entries(PaymentStatusLabel).map(([value, label]) => ({
  value,
  label,
}))

const methodOptions = Object.entries(PaymentMethodLabel).map(([value, label]) => ({
  value,
  label,
}))
</script>

<template>
  <PageList :title="t('pages.payments.title')">
    <template #headerExtra>
      <el-button type="primary" :icon="Plus" @click="handleAdd">
        {{ t('pages.payments.createAction') }}
      </el-button>
    </template>

    <template #search>
      <el-form :model="searchForm" inline>
        <el-form-item :label="t('common.keyword')">
          <el-input
            v-model="searchForm.keyword"
            :placeholder="t('pages.payments.keywordPlaceholder')"
            clearable
            style="width: 240px"
            @keyup.enter="doSearch"
          />
        </el-form-item>
        <el-form-item :label="t('common.status')">
          <el-select
            v-model="searchForm.status"
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
        <el-form-item :label="t('pages.payments.paymentMethod')">
          <el-select
            v-model="searchForm.paymentMethod"
            :placeholder="t('common.all')"
            clearable
            style="width: 130px"
          >
            <el-option
              v-for="opt in methodOptions"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search" @click="doSearch">{{ t('common.search') }}</el-button>
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
      :actions-width="120"
      @page-change="handlePageChange"
      @size-change="handleSizeChange"
      @sort-change="handleSortChange"
    >
      <template #paymentAmount="{ row }">
        <span class="amount-cell">{{ formatCurrency(row.paymentAmount) }}</span>
      </template>

      <template #paymentMethod="{ row }">
        <span>{{ PaymentMethodLabel[row.paymentMethod as PaymentMethod] ?? row.paymentMethod }}</span>
      </template>

      <template #status="{ row }">
        <el-tag size="small" :type="statusTagType[row.status] ?? 'info'">
          {{ PaymentStatusLabel[row.status as PaymentStatus] ?? row.status }}
        </el-tag>
      </template>

      <template #paymentDate="{ row }">
        {{ formatDate(row.paymentDate) }}
      </template>

      <template #createdAt="{ row }">
        {{ formatDate(row.createdAt) }}
      </template>

      <template #actions="{ row }">
        <el-button type="primary" link size="small" @click.stop="handleRowClick(row)">
          {{ t('common.detail') }}
        </el-button>
      </template>
    </ProTable>

    <PaymentFormDialog
      v-model="dialogVisible"
      @saved="handleSaved"
    />
  </PageList>
</template>

<style scoped lang="scss">
.amount-cell {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
</style>
