<script setup lang="ts">
import { Plus, Refresh, Search } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { computed, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import { deleteInvoice, getInvoices } from '@/api/invoice'
import PageList from '@/components/PageList.vue'
import ProTable from '@/components/ProTable.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useProTable } from '@/composables/useProTable'
import { InvoiceStatusLabel, InvoiceTypeLabel } from '@/constants/enum-labels'
import { InvoiceStatus, InvoiceType } from '@/constants/enums'
import type { ProTableColumn } from '@/types/components'
import type { InvoiceListItem, InvoiceQueryParams } from '@/types/invoice'
import { useLocaleFormatter } from '@/utils/locale-format'

import InvoiceFormDialog from './components/InvoiceFormDialog.vue'

defineOptions({ name: 'InvoiceListView' })

const router = useRouter()
const { confirmDelete } = useConfirm()
const { t } = useI18n({ useScope: 'global' })
const { formatCurrency, formatDate } = useLocaleFormatter()

type InvoiceSearchParams = Pick<InvoiceQueryParams, 'keyword' | 'status' | 'invoiceType'>
type InvoiceSortChange = {
  prop: string
  order: string
}

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

/**
 * 删除草稿发票后刷新当前列表，避免页面保留已失效的数据。
 *
 * @param row - 当前用户准备删除的发票行数据
 */
async function handleDelete(row: InvoiceListItem) {
  const ok = await confirmDelete(row.invoiceNo)
  if (!ok) return

  try {
    await deleteInvoice(row.id)
    ElMessage.success(t('pages.invoices.deleteSuccess'))
    await fetchData()
  } catch {
    // handled by interceptor
  }
}

function handleSaved() {
  void fetchData()
}

/**
 * 提取当前查询表单中有效的筛选条件，避免把空值写入列表请求。
 *
 * @returns 仅包含已填写字段的发票筛选参数
 */
function buildSearchParams(): Partial<InvoiceSearchParams> {
  const params: Partial<InvoiceSearchParams> = {}
  if (searchForm.keyword) params.keyword = searchForm.keyword
  if (searchForm.status) params.status = searchForm.status
  if (searchForm.invoiceType) params.invoiceType = searchForm.invoiceType
  return params
}

function doSearch() {
  handleSearch(buildSearchParams())
}

/**
 * 清空发票列表筛选表单并恢复表格默认查询状态。
 */
function doReset() {
  searchForm.keyword = ''
  searchForm.status = undefined
  searchForm.invoiceType = undefined
  handleReset()
}

/**
 * 将表格排序事件转换为后端可识别的排序参数。
 *
 * @param sort - Element Plus 表格返回的当前排序字段与方向
 * @returns 发票列表接口需要的排序字段；无排序时返回空对象
 */
function buildSortParams(sort: InvoiceSortChange): Partial<Pick<InvoiceQueryParams, 'sortBy' | 'sortOrder'>> {
  const params: Partial<Pick<InvoiceQueryParams, 'sortBy' | 'sortOrder'>> = {}
  if (sort.prop && (sort.order === 'ascending' || sort.order === 'descending')) {
    params.sortBy = sort.prop
    params.sortOrder = sort.order === 'ascending' ? 'ASC' : 'DESC'
  }
  return params
}

function handleSortChange(sort: InvoiceSortChange) {
  const params = buildSortParams(sort)
  handleSearch({ ...searchForm, ...params })
}

function handleRowClick(row: InvoiceListItem) {
  router.push(`/finance/invoices/${row.id}`)
}

/**
 * 判断发票截止日期是否进入 7 天内的临近提醒窗口。
 *
 * @param dateStr - 发票到期日
 * @returns 需要展示临近到期提醒时返回 true
 */
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

function isClosedStatus(status: InvoiceStatus): boolean {
  return status === InvoiceStatus.PAID || status === InvoiceStatus.VOID
}

/**
 * 计算到期日单元格的提醒样式，仅对未完成的发票显示临近与逾期状态。
 *
 * @param row - 当前列表行中的发票数据
 * @returns 对应的样式类名；无需提醒时返回 undefined
 */
function dueDateClass(row: InvoiceListItem): string | undefined {
  if (!row.dueDate || isClosedStatus(row.status)) return undefined
  if (isDueSoon(row.dueDate)) return 'due-warning'
  if (isOverdue(row.dueDate)) return 'due-danger'
  return undefined
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
        <span class="amount-cell">{{ formatCurrency(row.totalAmount) }}</span>
      </template>

      <template #status="{ row }">
        <el-tag size="small" :type="statusTagType[row.status] ?? 'info'">
          {{ InvoiceStatusLabel[row.status as InvoiceStatus] ?? row.status }}
        </el-tag>
      </template>

      <template #dueDate="{ row }">
        <span v-if="row.dueDate" :class="dueDateClass(row)">
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

