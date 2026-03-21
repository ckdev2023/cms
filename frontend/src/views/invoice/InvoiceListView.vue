<script setup lang="ts">
import { computed, ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Plus, Search, Refresh } from '@element-plus/icons-vue'
import PageList from '@/components/PageList.vue'
import ProTable from '@/components/ProTable.vue'
import InvoiceFormDialog from './components/InvoiceFormDialog.vue'
import { useAppStore } from '@/stores/app'
import { getInvoices, deleteInvoice } from '@/api/invoice'
import { useProTable } from '@/composables/useProTable'
import { useConfirm } from '@/composables/useConfirm'
import { InvoiceStatus, InvoiceType } from '@/constants/enums'
import { InvoiceStatusLabel, InvoiceTypeLabel } from '@/constants/enum-labels'
import type { ProTableColumn } from '@/types/components'
import type { InvoiceListItem, InvoiceQueryParams } from '@/types/invoice'
import { useI18n } from 'vue-i18n'

defineOptions({ name: 'InvoiceListView' })

const router = useRouter()
const { confirmDelete } = useConfirm()
const appStore = useAppStore()
const { t } = useI18n({ useScope: 'global' })

const columns = computed<ProTableColumn[]>(() => [
  { prop: 'invoiceNo', label: t('pages.invoices.invoiceNo'), minWidth: 180, sortable: 'custom' },
  { prop: 'customerName', label: t('pages.invoices.customerName'), minWidth: 150 },
  { prop: 'invoiceType', label: t('common.type'), width: 100, slot: 'invoiceType', align: 'center' },
  { prop: 'totalAmount', label: t('pages.invoices.totalAmount'), width: 140, slot: 'totalAmount', align: 'right', sortable: 'custom' },
  { prop: 'status', label: t('common.status'), width: 120, slot: 'status', align: 'center' },
  { prop: 'dueDate', label: t('pages.invoices.dueDate'), width: 120, slot: 'dueDate', sortable: 'custom' },
  { prop: 'issuedAt', label: t('pages.invoices.issuedAt'), width: 120, slot: 'issuedAt' },
  { prop: 'createdAt', label: t('common.createdAt'), width: 110, slot: 'createdAt', sortable: 'custom' },
])

const searchForm = reactive<InvoiceQueryParams>({
  keyword: '',
  status: undefined,
  invoiceType: undefined,
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
} = useProTable<InvoiceListItem>(getInvoices)

const dialogVisible = ref(false)
const editingInvoice = ref<InvoiceListItem | null>(null)

function handleAdd() {
  editingInvoice.value = null
  dialogVisible.value = true
}

function handleEdit(row: InvoiceListItem) {
  editingInvoice.value = row
  dialogVisible.value = true
}

async function handleDelete(row: InvoiceListItem) {
  const ok = await confirmDelete(row.invoiceNo)
  if (!ok) return

  try {
    await deleteInvoice(row.id)
    ElMessage.success(t('pages.invoices.deleteSuccess'))
    fetchData()
  } catch {
    // handled by interceptor
  }
}

function handleSaved() {
  fetchData()
}

function doSearch() {
  const params: Record<string, any> = {}
  if (searchForm.keyword) params.keyword = searchForm.keyword
  if (searchForm.status) params.status = searchForm.status
  if (searchForm.invoiceType) params.invoiceType = searchForm.invoiceType
  handleSearch(params)
}

function doReset() {
  searchForm.keyword = ''
  searchForm.status = undefined
  searchForm.invoiceType = undefined
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

function formatDate(dateStr: string | null) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString(appStore.locale === 'zh-CN' ? 'zh-CN' : 'ja-JP')
}

function formatAmount(val: number) {
  return `¥ ${Number(val).toLocaleString(appStore.locale === 'zh-CN' ? 'zh-CN' : 'ja-JP')}`
}

function handleRowClick(row: InvoiceListItem) {
  router.push(`/finance/invoices/${row.id}`)
}

function isDueSoon(dateStr: string | null): boolean {
  if (!dateStr) return false
  const diff = new Date(dateStr).getTime() - Date.now()
  const days = diff / (1000 * 60 * 60 * 24)
  return days >= 0 && days <= 7
}

function isOverdue(dateStr: string | null): boolean {
  if (!dateStr) return false
  return new Date(dateStr).getTime() < Date.now()
}

const statusTagType: Record<string, 'primary' | 'success' | 'info' | 'warning' | 'danger'> = {
  [InvoiceStatus.DRAFT]: 'info',
  [InvoiceStatus.SENT]: 'primary',
  [InvoiceStatus.PARTIAL]: 'warning',
  [InvoiceStatus.PAID]: 'success',
  [InvoiceStatus.VOID]: 'danger',
}

const statusOptions = computed(() =>
  Object.entries(InvoiceStatusLabel).map(([value, label]) => ({
    value,
    label,
  })),
)

const typeOptions = computed(() =>
  Object.entries(InvoiceTypeLabel).map(([value, label]) => ({
    value,
    label,
  })),
)
</script>

<template>
  <PageList :title="t('pages.invoices.title')">
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
            :placeholder="t('pages.invoices.keywordPlaceholder')"
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
        <el-form-item :label="t('common.type')">
          <el-select
            v-model="searchForm.invoiceType"
            :placeholder="t('common.all')"
            clearable
            style="width: 120px"
          >
            <el-option
              v-for="opt in typeOptions"
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
      :actions-width="200"
      @page-change="handlePageChange"
      @size-change="handleSizeChange"
      @sort-change="handleSortChange"
    >
      <template #invoiceType="{ row }">
        <span>{{ InvoiceTypeLabel[row.invoiceType as InvoiceType] ?? row.invoiceType }}</span>
      </template>

      <template #totalAmount="{ row }">
        <span class="amount-cell">{{ formatAmount(row.totalAmount) }}</span>
      </template>

      <template #status="{ row }">
        <el-tag size="small" :type="statusTagType[row.status] ?? 'info'">
          {{ InvoiceStatusLabel[row.status as InvoiceStatus] ?? row.status }}
        </el-tag>
      </template>

      <template #dueDate="{ row }">
        <span
          v-if="row.dueDate"
          :class="{
            'due-warning': isDueSoon(row.dueDate) && row.status !== InvoiceStatus.PAID && row.status !== InvoiceStatus.VOID,
            'due-danger': isOverdue(row.dueDate) && row.status !== InvoiceStatus.PAID && row.status !== InvoiceStatus.VOID,
          }"
        >
          {{ formatDate(row.dueDate) }}
        </span>
        <span v-else>-</span>
      </template>

      <template #issuedAt="{ row }">
        {{ formatDate(row.issuedAt) }}
      </template>

      <template #createdAt="{ row }">
        {{ formatDate(row.createdAt) }}
      </template>

      <template #actions="{ row }">
        <el-button type="primary" link size="small" @click.stop="handleRowClick(row)">
          {{ t('common.detail') }}
        </el-button>
        <el-button
          v-if="row.status === InvoiceStatus.DRAFT"
          type="primary"
          link
          size="small"
          @click.stop="handleEdit(row)"
        >
          {{ t('common.edit') }}
        </el-button>
        <el-button
          v-if="row.status === InvoiceStatus.DRAFT"
          type="danger"
          link
          size="small"
          @click.stop="handleDelete(row)"
        >
          {{ t('common.delete') }}
        </el-button>
      </template>
    </ProTable>

    <InvoiceFormDialog
      v-model="dialogVisible"
      :edit-data="editingInvoice"
      @saved="handleSaved"
    />
  </PageList>
</template>

<style scoped lang="scss">
.amount-cell {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.due-warning {
  color: #e6a23c;
  font-weight: 600;
}

.due-danger {
  color: #f56c6c;
  font-weight: 600;
}
</style>
