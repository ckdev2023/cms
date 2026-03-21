<script setup lang="ts">
import { computed, ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Plus, Search, Refresh } from '@element-plus/icons-vue'
import PageList from '@/components/PageList.vue'
import ProTable from '@/components/ProTable.vue'
import CustomerFormDialog from './components/CustomerFormDialog.vue'
import { useAppStore } from '@/stores/app'
import { getCustomers, deleteCustomer } from '@/api/customer'
import { useProTable } from '@/composables/useProTable'
import { useConfirm } from '@/composables/useConfirm'
import { CustomerType, ServiceType, CustomerStatus } from '@/constants/enums'
import {
  CustomerTypeLabel,
  ServiceTypeLabel,
  CustomerStatusLabel,
} from '@/constants/enum-labels'
import type { ProTableColumn } from '@/types/components'
import type { CustomerItem, CustomerQueryParams } from '@/types/customer'
import { useI18n } from 'vue-i18n'

defineOptions({ name: 'CustomerListView' })

const router = useRouter()
const { confirmDelete } = useConfirm()
const appStore = useAppStore()
const { t } = useI18n({ useScope: 'global' })

const columns = computed<ProTableColumn[]>(() => [
  { prop: 'customerCode', label: t('pages.customers.customerCode'), width: 120, sortable: 'custom' },
  { prop: 'customerType', label: t('common.type'), width: 90, slot: 'customerType', align: 'center' },
  { prop: 'customerName', label: t('pages.customers.customerName'), minWidth: 180, sortable: 'custom' },
  { prop: 'phone', label: t('common.phone'), width: 140 },
  { prop: 'serviceType', label: t('pages.customers.service'), width: 110, slot: 'serviceType', align: 'center' },
  { prop: 'ownerName', label: t('pages.customers.owner'), width: 120 },
  { prop: 'status', label: t('common.status'), width: 100, slot: 'status', align: 'center' },
  { prop: 'createdAt', label: t('common.createdAt'), width: 110, slot: 'createdAt', sortable: 'custom' },
])

const searchForm = reactive<CustomerQueryParams>({
  keyword: '',
  customerType: undefined,
  serviceType: undefined,
  status: undefined,
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
} = useProTable<CustomerItem>(getCustomers)

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

async function handleDelete(row: CustomerItem) {
  const ok = await confirmDelete(row.customerName)
  if (!ok) return

  try {
    await deleteCustomer(row.id)
    ElMessage.success(t('pages.customers.deleteSuccess'))
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
  if (searchForm.customerType) params.customerType = searchForm.customerType
  if (searchForm.serviceType) params.serviceType = searchForm.serviceType
  if (searchForm.status) params.status = searchForm.status
  handleSearch(params)
}

function doReset() {
  searchForm.keyword = ''
  searchForm.customerType = undefined
  searchForm.serviceType = undefined
  searchForm.status = undefined
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

function formatDate(dateStr: string) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString(appStore.locale === 'zh-CN' ? 'zh-CN' : 'ja-JP')
}

function handleRowClick(row: CustomerItem) {
  router.push(`/customers/${row.id}`)
}

const customerTypeTagType: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'primary'> = {
  [CustomerType.COMPANY]: 'primary',
  [CustomerType.PERSONAL]: 'success',
}

const statusTagType: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'primary'> = {
  [CustomerStatus.ACTIVE]: 'success',
  [CustomerStatus.INACTIVE]: 'info',
}

const serviceTagType: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'primary'> = {
  [ServiceType.ADMIN]: 'primary',
  [ServiceType.TAX]: 'warning',
  [ServiceType.BOTH]: 'success',
}
</script>

<template>
  <PageList :title="t('pages.customers.title')">
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
            :placeholder="t('pages.customers.keywordPlaceholder')"
            clearable
            style="width: 220px"
            @keyup.enter="doSearch"
          />
        </el-form-item>
        <el-form-item :label="t('common.type')">
          <el-select
            v-model="searchForm.customerType"
            :placeholder="t('common.all')"
            clearable
            style="width: 120px"
          >
            <el-option :label="CustomerTypeLabel[CustomerType.COMPANY]" :value="CustomerType.COMPANY" />
            <el-option :label="CustomerTypeLabel[CustomerType.PERSONAL]" :value="CustomerType.PERSONAL" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('pages.customers.service')">
          <el-select
            v-model="searchForm.serviceType"
            :placeholder="t('common.all')"
            clearable
            style="width: 120px"
          >
            <el-option :label="ServiceTypeLabel[ServiceType.ADMIN]" :value="ServiceType.ADMIN" />
            <el-option :label="ServiceTypeLabel[ServiceType.TAX]" :value="ServiceType.TAX" />
            <el-option :label="ServiceTypeLabel[ServiceType.BOTH]" :value="ServiceType.BOTH" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('common.status')">
          <el-select
            v-model="searchForm.status"
            :placeholder="t('common.all')"
            clearable
            style="width: 120px"
          >
            <el-option :label="CustomerStatusLabel[CustomerStatus.ACTIVE]" :value="CustomerStatus.ACTIVE" />
            <el-option :label="CustomerStatusLabel[CustomerStatus.INACTIVE]" :value="CustomerStatus.INACTIVE" />
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
      :actions-width="180"
      @page-change="handlePageChange"
      @size-change="handleSizeChange"
      @sort-change="handleSortChange"
    >
      <template #customerType="{ row }">
        <el-tag size="small" :type="customerTypeTagType[row.customerType] ?? 'info'">
          {{ CustomerTypeLabel[row.customerType as CustomerType] ?? row.customerType }}
        </el-tag>
      </template>

      <template #serviceType="{ row }">
        <el-tag size="small" :type="serviceTagType[row.serviceType] ?? 'info'">
          {{ ServiceTypeLabel[row.serviceType as ServiceType] ?? row.serviceType }}
        </el-tag>
      </template>

      <template #status="{ row }">
        <el-tag size="small" :type="statusTagType[row.status] ?? 'info'">
          {{ CustomerStatusLabel[row.status as CustomerStatus] ?? row.status }}
        </el-tag>
      </template>

      <template #createdAt="{ row }">
        {{ formatDate(row.createdAt) }}
      </template>

      <template #actions="{ row }">
        <el-button type="primary" link size="small" @click.stop="handleRowClick(row)">
          {{ t('common.detail') }}
        </el-button>
        <el-button type="primary" link size="small" @click.stop="handleEdit(row)">
          {{ t('common.edit') }}
        </el-button>
        <el-button type="danger" link size="small" @click.stop="handleDelete(row)">
          {{ t('common.delete') }}
        </el-button>
      </template>
    </ProTable>

    <CustomerFormDialog
      v-model="dialogVisible"
      :edit-data="editingCustomer"
      @saved="handleSaved"
    />
  </PageList>
</template>
