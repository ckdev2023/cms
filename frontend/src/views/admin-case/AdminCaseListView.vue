<script setup lang="ts">
import { computed, ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Plus, Search, Refresh } from '@element-plus/icons-vue'
import PageList from '@/components/PageList.vue'
import ProTable from '@/components/ProTable.vue'
import AdminCaseFormDialog from './components/AdminCaseFormDialog.vue'
import { useAppStore } from '@/stores/app'
import { getAdminCases, deleteAdminCase } from '@/api/admin-case'
import { useProTable } from '@/composables/useProTable'
import { useConfirm } from '@/composables/useConfirm'
import { AdminCaseStatus } from '@/constants/enums'
import { AdminCaseStatusLabel } from '@/constants/enum-labels'
import type { ProTableColumn } from '@/types/components'
import type { AdminCaseItem, AdminCaseQueryParams } from '@/types/admin-case'
import { useI18n } from 'vue-i18n'

defineOptions({ name: 'AdminCaseListView' })

const router = useRouter()
const { confirmDelete } = useConfirm()
const appStore = useAppStore()
const { t } = useI18n({ useScope: 'global' })

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

async function handleDelete(row: AdminCaseItem) {
  const ok = await confirmDelete(row.caseName)
  if (!ok) return

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

function doSearch() {
  const params: Record<string, any> = {}
  if (searchForm.keyword) params.keyword = searchForm.keyword
  if (searchForm.status) params.status = searchForm.status
  handleSearch(params)
}

function doReset() {
  searchForm.keyword = ''
  searchForm.status = undefined
  searchForm.ownerUserId = undefined
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

function handleRowClick(row: AdminCaseItem) {
  router.push(`/admin-cases/${row.id}`)
}

function isExpiringSoon(dateStr: string | null): boolean {
  if (!dateStr) return false
  const diff = new Date(dateStr).getTime() - Date.now()
  const days = diff / (1000 * 60 * 60 * 24)
  return days >= 0 && days <= 30
}

function isExpired(dateStr: string | null): boolean {
  if (!dateStr) return false
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

<style scoped lang="scss">
.expire-warning {
  color: #e6a23c;
  font-weight: 600;
}

.expire-danger {
  color: #f56c6c;
  font-weight: 600;
}
</style>
