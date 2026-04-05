<script setup lang="ts">
import { Plus, Refresh, Search } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { computed, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import { deleteAdminCase, getAdminCases } from '@/api/admin-case'
import PageList from '@/components/PageList.vue'
import ProTable from '@/components/ProTable.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useProTable } from '@/composables/useProTable'
import { AdminCaseStatusLabel } from '@/constants/enum-labels'
import { AdminCaseStatus } from '@/constants/enums'
import type { AdminCaseItem, AdminCaseQueryParams } from '@/types/admin-case'
import type { ProTableColumn } from '@/types/components'
import { useLocaleFormatter } from '@/utils/locale-format'

import AdminCaseFormDialog from './components/AdminCaseFormDialog.vue'

defineOptions({ name: 'AdminCaseListView' })

const router = useRouter()
const { confirmDelete } = useConfirm()
const { t } = useI18n({ useScope: 'global' })
const { formatDate } = useLocaleFormatter()

type SortOrder = 'ascending' | 'descending'

interface AdminCaseSortChange {
  prop: string | null
  order: string | null
}

function isSortOrder(order: string | null): order is SortOrder {
  return order === 'ascending' || order === 'descending'
}

const columns = computed<ProTableColumn[]>(() => [
  { prop: 'caseName', label: t('pages.adminCases.caseName'), minWidth: 200, sortable: 'custom' },
  { prop: 'customerName', label: t('pages.adminCases.customerName'), minWidth: 150 },
  { prop: 'applicantName', label: t('pages.adminCases.applicantName'), width: 130 },
  { prop: 'residenceStatus', label: t('pages.adminCases.residenceStatus'), width: 130 },
  { prop: 'status', label: t('common.status'), width: 120, slot: 'status', align: 'center' },
  { prop: 'expireDate', label: t('pages.adminCases.expireDate'), width: 120, slot: 'expireDate', sortable: 'custom' },
  { prop: 'ownerName', label: t('common.owner'), width: 120 },
  { prop: 'createdAt', label: t('common.createdAt'), width: 110, slot: 'createdAt', sortable: 'custom' },
])

const searchForm = reactive<AdminCaseQueryParams>({
  keyword: '',
  status: undefined,
  ownerUserId: undefined,
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
} = useProTable<AdminCaseItem>(getAdminCases)

const dialogVisible = ref(false)
const editingCase = ref<AdminCaseItem | null>(null)

function handleAdd() {
  editingCase.value = null
  dialogVisible.value = true
}

function handleEdit(row: AdminCaseItem) {
  editingCase.value = row
  dialogVisible.value = true
}

/**
 * 删除指定的行政案件并在成功后刷新列表。
 *
 * @param row 当前操作行的案件摘要数据。
 * @returns 删除流程完成后的异步结果。
 */
async function handleDelete(row: AdminCaseItem) {
  const ok = await confirmDelete(row.caseName)
  if (!ok) {return}

  try {
    await deleteAdminCase(row.id)
    ElMessage.success(t('pages.adminCases.deleteSuccess'))
    fetchData()
  } catch {
    // handled by interceptor
  }
}

function handleSaved() {
  fetchData()
}

/**
 * 组装案件列表检索请求中需要提交的有效筛选条件。
 *
 * @returns 仅包含已填写字段的查询参数对象。
 */
function buildSearchParams(): Partial<AdminCaseQueryParams> {
  const params: Partial<AdminCaseQueryParams> = {}
  if (searchForm.keyword) {params.keyword = searchForm.keyword}
  if (searchForm.status) {params.status = searchForm.status}
  return params
}

function doSearch() {
  handleSearch(buildSearchParams())
}

/**
 * 重置案件列表筛选表单并恢复默认分页查询。
 */
function doReset() {
  searchForm.keyword = ''
  searchForm.status = undefined
  searchForm.ownerUserId = undefined
  handleReset()
}

/**
 * 根据表格排序状态重新发起案件列表查询。
 *
 * @param sort 当前表格列的排序字段与方向。
 */
function handleSortChange(sort: AdminCaseSortChange) {
  const params = buildSearchParams()
  if (sort.prop && isSortOrder(sort.order)) {
    params.sortBy = sort.prop
    params.sortOrder = sort.order === 'ascending' ? 'ASC' : 'DESC'
  }
  handleSearch({ ...searchForm, ...params })
}

function handleRowClick(row: AdminCaseItem) {
  router.push(`/customers/admin-cases/${row.id}`)
}

/**
 * 判断案件到期日是否落在未来 30 天内。
 *
 * @param dateStr 案件到期日期字符串。
 * @returns 是否应显示即将到期提醒样式。
 */
function isExpiringSoon(dateStr: string | null): boolean {
  if (!dateStr) {return false}
  const diff = new Date(dateStr).getTime() - Date.now()
  const days = diff / (1000 * 60 * 60 * 24)
  return days >= 0 && days <= 30
}

/**
 * 判断案件到期日是否已经早于当前时间。
 *
 * @param dateStr 案件到期日期字符串。
 * @returns 是否应显示已过期提醒样式。
 */
function isExpired(dateStr: string | null): boolean {
  if (!dateStr) {return false}
  return new Date(dateStr).getTime() < Date.now()
}

const statusTagType: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'primary'> = {
  [AdminCaseStatus.DRAFT]: 'info',
  [AdminCaseStatus.ACCEPTED]: 'primary',
  [AdminCaseStatus.MATERIAL_PENDING]: 'warning',
  [AdminCaseStatus.SUBMITTED]: 'primary',
  [AdminCaseStatus.APPROVED]: 'success',
  [AdminCaseStatus.REJECTED]: 'danger',
  [AdminCaseStatus.COMPLETED]: 'success',
  [AdminCaseStatus.CANCELLED]: 'info',
}

const statusOptions = computed(() =>
  Object.entries(AdminCaseStatusLabel).map(([value, label]) => ({
    value,
    label,
  })),
)
</script>

<template>
  <PageList :title="t('pages.adminCases.title')">
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
            :placeholder="t('pages.adminCases.keywordPlaceholder')"
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
        <el-form-item>
          <el-button type="primary" :icon="Search" :loading="loading" @click="doSearch">{{ t('common.search') }}</el-button>
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
      <template #status="{ row }">
        <el-tag size="small" :type="statusTagType[row.status] ?? 'info'">
          {{ AdminCaseStatusLabel[row.status as AdminCaseStatus] ?? row.status }}
        </el-tag>
      </template>

      <template #expireDate="{ row }">
        <span
          v-if="row.expireDate"
          :class="{
            'expire-warning': isExpiringSoon(row.expireDate),
            'expire-danger': isExpired(row.expireDate),
          }"
        >
          {{ formatDate(row.expireDate) }}
        </span>
        <span v-else>-</span>
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

    <AdminCaseFormDialog
      v-model="dialogVisible"
      :edit-data="editingCase"
      @saved="handleSaved"
    />
  </PageList>
</template>

