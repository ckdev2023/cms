<script setup lang="ts">
import { Plus } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import { deleteAdminCase, getAdminCases } from '@/api/admin-case'
import ProTable from '@/components/ProTable.vue'
import { useConfirm } from '@/composables/useConfirm'
import { AdminCaseStatusLabel } from '@/constants/enum-labels'
import { AdminCaseStatus } from '@/constants/enums'
import type { AdminCaseItem } from '@/types/admin-case'
import type { ProTableColumn } from '@/types/components'
import { useLocaleFormatter } from '@/utils/locale-format'
import AdminCaseFormDialog from '@/views/admin-case/components/AdminCaseFormDialog.vue'

const props = defineProps<{
  customerId: string
}>()

defineOptions({ name: 'CustomerAdminCasesTab' })

const router = useRouter()
const { confirmDelete } = useConfirm()
const { t } = useI18n({ useScope: 'global' })
const { formatDate } = useLocaleFormatter()

const loading = ref(false)
const data = ref<AdminCaseItem[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)
const dialogVisible = ref(false)
const editingCase = ref<AdminCaseItem | null>(null)

const columns = computed<ProTableColumn[]>(() => [
  { prop: 'caseName', label: t('detailViews.adminCase.caseName'), minWidth: 180 },
  { prop: 'applicantName', label: t('detailViews.adminCase.applicantName'), width: 120 },
  { prop: 'status', label: t('common.status'), width: 110, slot: 'status', align: 'center' },
  { prop: 'expireDate', label: t('detailViews.adminCase.expireDate'), width: 110, slot: 'expireDate' },
  { prop: 'ownerName', label: t('common.owner'), width: 110 },
])

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

watch(
  () => props.customerId,
  () => {
    if (props.customerId) {
      page.value = 1
      fetchData()
    }
  },
  { immediate: true },
)

/**
 * 按当前客户和分页条件加载行政案件列表。
 *
 * @throws {Error} 行政案件列表接口请求失败时由请求层继续抛出
 */
async function fetchData() {
  loading.value = true
  try {
    const res = await getAdminCases({
      customerId: props.customerId,
      page: page.value,
      pageSize: pageSize.value,
      sortOrder: 'DESC',
    })
    data.value = res.data.items
    total.value = res.data.total
  } finally {
    loading.value = false
  }
}

function handlePageChange(newPage: number) {
  page.value = newPage
  fetchData()
}

function handleSizeChange(newSize: number) {
  pageSize.value = newSize
  page.value = 1
  fetchData()
}

function handleAdd() {
  editingCase.value = null
  dialogVisible.value = true
}

function handleRowClick(row: AdminCaseItem) {
  router.push(`/admin-cases/${row.id}`)
}

/**
 * 删除指定行政案件，并在成功后刷新当前客户下的案件列表。
 *
 * @param row - 当前准备删除的行政案件记录
 * @throws {Error} 删除行政案件请求失败时由请求层统一提示并继续抛出
 */
async function handleDelete(row: AdminCaseItem) {
  const ok = await confirmDelete(row.caseName)
  if (!ok) return

  try {
    await deleteAdminCase(row.id)
    ElMessage.success(t('detailViews.customer.adminCaseDeleted'))
    fetchData()
  } catch {
    // handled by interceptor
  }
}

function handleSaved() {
  fetchData()
}

function isExpired(dateStr: string | null): boolean {
  if (!dateStr) return false
  return new Date(dateStr).getTime() < Date.now()
}

/**
 * 判断行政案件是否进入到期前 30 天内的提醒窗口。
 *
 * @param dateStr - 行政案件的到期日期字符串，为空时视为无需提醒
 * @returns 命中临近到期区间时返回 true
 */
function isExpiringSoon(dateStr: string | null): boolean {
  if (!dateStr) return false
  const diff = new Date(dateStr).getTime() - Date.now()
  const days = diff / (1000 * 60 * 60 * 24)
  return days >= 0 && days <= 30
}
</script>

<template>
  <div class="admin-cases-tab">
    <div class="admin-cases-tab__toolbar">
      <span class="admin-cases-tab__count">{{ t('detailViews.customer.caseCount', { count: total }) }}</span>
      <el-button type="primary" :icon="Plus" size="small" @click="handleAdd">
        {{ t('detailViews.customer.addCase') }}
      </el-button>
    </div>

    <ProTable
      :columns="columns"
      :data="data"
      :loading="loading"
      :total="total"
      :page="page"
      :page-size="pageSize"
      :actions-width="140"
      :page-sizes="[5, 10, 20]"
      @page-change="handlePageChange"
      @size-change="handleSizeChange"
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

      <template #actions="{ row }">
        <el-button type="primary" link size="small" @click.stop="handleRowClick(row)">
          {{ t('common.detail') }}
        </el-button>
        <el-button type="danger" link size="small" @click.stop="handleDelete(row)">
          {{ t('common.delete') }}
        </el-button>
      </template>
    </ProTable>

    <AdminCaseFormDialog
      v-model="dialogVisible"
      :edit-data="editingCase"
      :default-customer-id="customerId"
      @saved="handleSaved"
    />
  </div>
</template>

<style scoped lang="scss">
.admin-cases-tab {
  &__toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  }

  &__count {
    font-size: var(--app-font-size-sm);
    color: var(--app-text-secondary);
  }
}
</style>
