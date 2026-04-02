<script setup lang="ts">
import { Calendar, Delete,Plus } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  deleteTaxPeriod,
  getTaxPeriods,
} from '@/api/tax'
import { useConfirm } from '@/composables/useConfirm'
import { MaterialStatusLabel,MonthlyStatusLabel } from '@/constants/enum-labels'
import { MaterialStatus,MonthlyStatus } from '@/constants/enums'
import type { TaxPeriodItem, TaxPeriodQueryParams } from '@/types/tax'
import { useLocaleFormatter } from '@/utils/locale-format'

import PeriodDetailDialog from './PeriodDetailDialog.vue'
import PeriodFormDialog from './PeriodFormDialog.vue'
import PeriodGenerateDialog from './PeriodGenerateDialog.vue'

const props = defineProps<{
  contractId: string
}>()

defineOptions({ name: 'PeriodsTab' })

const { confirmDelete } = useConfirm()
const { t } = useI18n({ useScope: 'global' })
const { formatDate } = useLocaleFormatter()

const loading = ref(false)
const periods = ref<TaxPeriodItem[]>([])
const total = ref(0)
const queryParams = reactive<TaxPeriodQueryParams>({
  page: 1,
  pageSize: 20,
  sortBy: 'periodYm',
  sortOrder: 'ASC',
})

const showCreateDialog = ref(false)
const showGenerateDialog = ref(false)
const showDetailDialog = ref(false)
const editingPeriod = ref<TaxPeriodItem | null>(null)
const selectedPeriodId = ref<string>('')

watch(
  () => props.contractId,
  () => {
    if (props.contractId) {
      queryParams.page = 1
      fetchPeriods()
    }
  },
  { immediate: true },
)

/**
 * 拉取当前税务合约下的期间分页数据。
 *
 * @returns 完成请求后同步表格数据与总数
 */
async function fetchPeriods() {
  loading.value = true
  try {
    const res = await getTaxPeriods(props.contractId, queryParams)
    periods.value = res.data.items
    total.value = res.data.total
  } finally {
    loading.value = false
  }
}

function handlePageChange(page: number) {
  queryParams.page = page
  fetchPeriods()
}

function handleSizeChange(size: number) {
  queryParams.pageSize = size
  queryParams.page = 1
  fetchPeriods()
}

function openCreateDialog() {
  editingPeriod.value = null
  showCreateDialog.value = true
}

function openEditDialog(item: TaxPeriodItem) {
  editingPeriod.value = item
  showCreateDialog.value = true
}

function openDetailDialog(item: TaxPeriodItem) {
  selectedPeriodId.value = item.id
  showDetailDialog.value = true
}

/**
 * 删除指定期间，并在成功后刷新期间列表。
 *
 * @param item 当前选中的期间记录
 * @returns 用户取消时提前结束；删除成功后重新拉取列表
 */
async function handleDelete(item: TaxPeriodItem) {
  const confirmed = await confirmDelete(
    t('detailViews.taxContract.periodsTab.deleteName', { period: item.periodYm }),
  )
  if (!confirmed) return

  try {
    await deleteTaxPeriod(props.contractId, item.id)
    ElMessage.success(t('detailViews.taxContract.periodsTab.deletedSuccess'))
    fetchPeriods()
  } catch {
    // handled by interceptor
  }
}

function handlePeriodSaved() {
  fetchPeriods()
}

function handlePeriodsGenerated() {
  fetchPeriods()
}

function handlePeriodDetailUpdated() {
  fetchPeriods()
}

const filterMonthlyStatus = ref<MonthlyStatus | ''>('')
const filterMaterialStatus = ref<MaterialStatus | ''>('')

/**
 * 将工具栏筛选条件写回查询参数并重新加载期间列表。
 */
function handleFilter() {
  queryParams.monthlyStatus = filterMonthlyStatus.value || undefined
  queryParams.materialStatus = filterMaterialStatus.value || undefined
  queryParams.page = 1
  fetchPeriods()
}

/**
 * 清空期间状态筛选并恢复默认分页查询。
 */
function handleResetFilter() {
  filterMonthlyStatus.value = ''
  filterMaterialStatus.value = ''
  queryParams.monthlyStatus = undefined
  queryParams.materialStatus = undefined
  queryParams.page = 1
  fetchPeriods()
}

/**
 * 将月度主状态映射为标签颜色。
 *
 * @param status 当前期间主状态
 * @returns Element Plus 标签类型
 */
function monthlyStatusTagType(
  status: MonthlyStatus,
): 'info' | 'success' | 'warning' {
  switch (status) {
    case MonthlyStatus.NOT_STARTED:
      return 'info'
    case MonthlyStatus.IN_PROGRESS:
      return 'warning'
    case MonthlyStatus.COMPLETED:
      return 'success'
    default:
      return 'info'
  }
}

/**
 * 将资料收集状态映射为标签颜色。
 *
 * @param status 当前期间资料状态
 * @returns Element Plus 标签类型
 */
function materialStatusTagType(
  status: MaterialStatus,
): 'info' | 'success' | 'warning' {
  switch (status) {
    case MaterialStatus.NOT_RECEIVED:
      return 'info'
    case MaterialStatus.PARTIAL:
      return 'warning'
    case MaterialStatus.COMPLETE:
      return 'success'
    default:
      return 'info'
  }
}

const isDeadlineUrgent = computed(() => {
  return (deadline: string | null): boolean => {
    if (!deadline) return false
    const d = new Date(deadline)
    const now = new Date()
    const diff = d.getTime() - now.getTime()
    const days = diff / (1000 * 60 * 60 * 24)
    return days <= 7 && days >= 0
  }
})

const isDeadlineOverdue = computed(() => {
  return (deadline: string | null): boolean => {
    if (!deadline) return false
    const d = new Date(deadline)
    const now = new Date()
    return d.getTime() < now.getTime()
  }
})

/**
 * 将期间年月字符串格式化为多语言展示文本。
 *
 * @param ym 期间值，格式为 `YYYY-MM`
 * @returns 本地化后的期间标签
 */
function formatPeriodLabel(ym: string) {
  const [year, month] = ym.split('-')
  return t('detailViews.taxContract.periodsTab.periodLabel', {
    year,
    month: parseInt(month, 10),
  })
}
</script>

<template>
  <div class="periods-tab">
    <div class="periods-tab__toolbar">
      <div class="periods-tab__filters">
        <el-select
          v-model="filterMonthlyStatus"
          :placeholder="t('detailViews.taxContract.periodsTab.monthlyStatusPlaceholder')"
          clearable
          size="small"
          style="width: 140px"
          @change="handleFilter"
        >
          <el-option
            v-for="(label, key) in MonthlyStatusLabel"
            :key="key"
            :label="label"
            :value="key"
          />
        </el-select>
        <el-select
          v-model="filterMaterialStatus"
          :placeholder="t('detailViews.taxContract.periodsTab.materialStatusPlaceholder')"
          clearable
          size="small"
          style="width: 140px"
          @change="handleFilter"
        >
          <el-option
            v-for="(label, key) in MaterialStatusLabel"
            :key="key"
            :label="label"
            :value="key"
          />
        </el-select>
        <el-button size="small" @click="handleResetFilter">
          {{ t('common.reset') }}
        </el-button>
      </div>
      <div class="periods-tab__actions">
        <el-button size="small" :icon="Calendar" @click="showGenerateDialog = true">
          {{ t('detailViews.taxContract.periodsTab.generate') }}
        </el-button>
        <el-button type="primary" size="small" :icon="Plus" @click="openCreateDialog">
          {{ t('detailViews.taxContract.periodsTab.add') }}
        </el-button>
      </div>
    </div>

    <el-table
      v-loading="loading"
      :data="periods"
      stripe
      border
      size="small"
      class="periods-tab__table"
      @row-click="openDetailDialog"
    >
      <el-table-column :label="t('detailViews.taxContract.periodsTab.period')" prop="periodYm" width="120">
        <template #default="{ row }">
          <span class="periods-tab__period-label">
            {{ formatPeriodLabel(row.periodYm) }}
          </span>
        </template>
      </el-table-column>

      <el-table-column :label="t('detailViews.taxContract.periodsTab.declarationDeadline')" prop="declarationDeadline" width="130">
        <template #default="{ row }">
          <span
            :class="{
              'deadline-overdue': isDeadlineOverdue(row.declarationDeadline) && row.monthlyStatus !== MonthlyStatus.COMPLETED,
              'deadline-urgent': isDeadlineUrgent(row.declarationDeadline) && row.monthlyStatus !== MonthlyStatus.COMPLETED,
            }"
          >
            {{ formatDate(row.declarationDeadline) }}
          </span>
        </template>
      </el-table-column>

      <el-table-column :label="t('detailViews.taxContract.periodsTab.monthlyStatus')" prop="monthlyStatus" width="130" align="center">
        <template #default="{ row }">
          <el-tag size="small" :type="monthlyStatusTagType(row.monthlyStatus)">
            {{ MonthlyStatusLabel[row.monthlyStatus as MonthlyStatus] }}
          </el-tag>
        </template>
      </el-table-column>

      <el-table-column :label="t('detailViews.taxContract.periodsTab.materialStatus')" prop="materialStatus" width="130" align="center">
        <template #default="{ row }">
          <el-tag size="small" :type="materialStatusTagType(row.materialStatus)">
            {{ MaterialStatusLabel[row.materialStatus as MaterialStatus] }}
          </el-tag>
        </template>
      </el-table-column>

      <el-table-column :label="t('detailViews.taxContract.periodsTab.documentProgress')" width="100" align="center">
        <template #default="{ row }">
          <span v-if="row.documentCount > 0">
            {{ row.documentReceivedCount }}/{{ row.documentCount }}
          </span>
          <span v-else class="text-muted">-</span>
        </template>
      </el-table-column>

      <el-table-column :label="t('detailViews.taxContract.periodsTab.workProgress')" width="100" align="center">
        <template #default="{ row }">
          <span v-if="row.workItemCount > 0">
            {{ row.workItemCompletedCount }}/{{ row.workItemCount }}
          </span>
          <span v-else class="text-muted">-</span>
        </template>
      </el-table-column>

      <el-table-column :label="t('common.actions')" width="140" align="center" fixed="right">
        <template #default="{ row }">
          <el-button type="primary" link size="small" @click.stop="openDetailDialog(row)">
            {{ t('common.detail') }}
          </el-button>
          <el-button type="primary" link size="small" @click.stop="openEditDialog(row)">
            {{ t('common.edit') }}
          </el-button>
          <el-button type="danger" link size="small" :icon="Delete" @click.stop="handleDelete(row)" />
        </template>
      </el-table-column>
    </el-table>

    <div v-if="total > queryParams.pageSize!" class="periods-tab__pagination">
      <el-pagination
        :current-page="queryParams.page"
        :page-size="queryParams.pageSize"
        :total="total"
        :page-sizes="[10, 20, 50]"
        layout="total, sizes, prev, pager, next"
        @current-change="handlePageChange"
        @size-change="handleSizeChange"
      />
    </div>

    <el-empty
      v-if="!loading && periods.length === 0"
      :description="t('detailViews.taxContract.periodsTab.empty')"
    />

    <PeriodFormDialog
      v-model="showCreateDialog"
      :contract-id="contractId"
      :edit-data="editingPeriod"
      @saved="handlePeriodSaved"
    />

    <PeriodGenerateDialog
      v-model="showGenerateDialog"
      :contract-id="contractId"
      @generated="handlePeriodsGenerated"
    />

    <PeriodDetailDialog
      v-model="showDetailDialog"
      :contract-id="contractId"
      :period-id="selectedPeriodId"
      @updated="handlePeriodDetailUpdated"
    />
  </div>
</template>

<style scoped lang="scss">
.periods-tab {
  &__toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
    flex-wrap: wrap;
    gap: 8px;
  }

  &__filters {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  &__table {
    cursor: pointer;
  }

  &__period-label {
    font-weight: 500;
  }

  &__pagination {
    display: flex;
    justify-content: center;
    margin-top: 16px;
  }
}

.deadline-overdue {
  color: var(--app-color-danger);
  font-weight: var(--app-font-weight-semibold);
}

.deadline-urgent {
  color: var(--app-color-warning);
  font-weight: var(--app-font-weight-semibold);
}

.text-muted {
  color: var(--app-text-disabled);
}
</style>
