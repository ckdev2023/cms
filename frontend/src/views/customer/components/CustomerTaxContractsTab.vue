<script setup lang="ts">
import { Plus } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import { deleteTaxContract, getTaxContracts } from '@/api/tax'
import ProTable from '@/components/ProTable.vue'
import { useConfirm } from '@/composables/useConfirm'
import {
  BillingCycleLabel,
  TaxContractStatusLabel,
} from '@/constants/enum-labels'
import { BillingCycle, TaxContractStatus } from '@/constants/enums'
import type { ProTableColumn } from '@/types/components'
import type { TaxContractItem } from '@/types/tax'
import { useLocaleFormatter } from '@/utils/locale-format'
import TaxContractFormDialog from '@/views/tax/components/TaxContractFormDialog.vue'

const props = defineProps<{
  customerId: string
}>()

defineOptions({ name: 'CustomerTaxContractsTab' })

const router = useRouter()
const { confirmDelete } = useConfirm()
const { t } = useI18n({ useScope: 'global' })
const { formatDate, formatCurrency } = useLocaleFormatter()

const loading = ref(false)
const data = ref<TaxContractItem[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)
const dialogVisible = ref(false)
const editingContract = ref<TaxContractItem | null>(null)

const columns = computed<ProTableColumn[]>(() => [
  { prop: 'contractName', label: t('detailViews.taxContract.contractName'), minWidth: 180 },
  {
    prop: 'contractStatus',
    label: t('common.status'),
    width: 110,
    slot: 'contractStatus',
    align: 'center',
  },
  {
    prop: 'billingCycle',
    label: t('detailViews.taxContract.billingCycle'),
    width: 100,
    slot: 'billingCycle',
    align: 'center',
  },
  {
    prop: 'monthlyFee',
    label: t('detailViews.taxContract.monthlyFee'),
    width: 110,
    slot: 'monthlyFee',
    align: 'right',
  },
  {
    prop: 'startDate',
    label: t('common.startDate'),
    width: 110,
    slot: 'startDate',
  },
  {
    prop: 'endDate',
    label: t('common.endDate'),
    width: 110,
    slot: 'endDate',
  },
  { prop: 'ownerName', label: t('common.owner'), width: 110 },
])

const statusTagType: Record<
  string,
  'success' | 'info' | 'warning' | 'danger'
> = {
  [TaxContractStatus.ACTIVE]: 'success',
  [TaxContractStatus.EXPIRED]: 'warning',
  [TaxContractStatus.TERMINATED]: 'danger',
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
 * 按当前客户和分页条件加载税务契约列表。
 *
 * @throws {Error} 税务契约列表接口请求失败时由请求层继续抛出
 */
async function fetchData() {
  loading.value = true
  try {
    const res = await getTaxContracts({
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
  editingContract.value = null
  dialogVisible.value = true
}

function handleRowClick(row: TaxContractItem) {
  router.push(`/tax-contracts/${row.id}`)
}

/**
 * 删除指定税务契约，并在成功后刷新当前客户下的契约列表。
 *
 * @param row - 当前准备删除的税务契约记录
 * @throws {Error} 删除税务契约请求失败时由请求层统一提示并继续抛出
 */
async function handleDelete(row: TaxContractItem) {
  const ok = await confirmDelete(row.contractName)
  if (!ok) {return}

  try {
    await deleteTaxContract(row.id)
    ElMessage.success(t('detailViews.customer.taxContractDeleted'))
    fetchData()
  } catch {
    // handled by interceptor
  }
}

function handleSaved() {
  fetchData()
}

</script>

<template>
  <div class="tax-contracts-tab">
    <div class="tax-contracts-tab__toolbar">
      <span class="tax-contracts-tab__count">{{ t('detailViews.customer.contractCount', { count: total }) }}</span>
      <el-button
        type="primary"
        :icon="Plus"
        size="small"
        @click="handleAdd"
      >
        {{ t('detailViews.customer.addContract') }}
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
      <template #contractStatus="{ row }">
        <el-tag
          size="small"
          :type="statusTagType[row.contractStatus] ?? 'info'"
        >
          {{
            TaxContractStatusLabel[
              row.contractStatus as TaxContractStatus
            ] ?? row.contractStatus
          }}
        </el-tag>
      </template>

      <template #billingCycle="{ row }">
        {{
          BillingCycleLabel[row.billingCycle as BillingCycle] ??
          row.billingCycle
        }}
      </template>

      <template #monthlyFee="{ row }">
        {{ formatCurrency(row.monthlyFee) }}
      </template>

      <template #startDate="{ row }">
        {{ formatDate(row.startDate) }}
      </template>

      <template #endDate="{ row }">
        {{ row.endDate ? formatDate(row.endDate) : '-' }}
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
        <el-button
          type="danger"
          link
          size="small"
          @click.stop="handleDelete(row)"
        >
          {{ t('common.delete') }}
        </el-button>
      </template>
    </ProTable>

    <TaxContractFormDialog
      v-model="dialogVisible"
      :edit-data="editingContract"
      :default-customer-id="customerId"
      @saved="handleSaved"
    />
  </div>
</template>

<style scoped lang="scss">
.tax-contracts-tab {
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
