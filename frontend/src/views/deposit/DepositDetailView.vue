<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import { getAccountTransactions, getDepositAccount } from '@/api/deposit'
import PageDetail from '@/components/PageDetail.vue'
import ProTable from '@/components/ProTable.vue'
import { DepositTransactionTypeLabel } from '@/constants/enum-labels'
import { DepositTransactionType } from '@/constants/enums'
import type { ProTableColumn } from '@/types/components'
import type {
  DepositAccountDetail,
  DepositTransactionListItem,
  DepositTransactionQueryParams,
} from '@/types/deposit'
import { mergeCustomerDetailReturnQuery } from '@/utils/customer-detail-return-navigation'
import { useLocaleFormatter } from '@/utils/locale-format'

import DepositOffsetDialog from './components/DepositOffsetDialog.vue'
import DepositRechargeDialog from './components/DepositRechargeDialog.vue'
import DepositRefundDialog from './components/DepositRefundDialog.vue'

defineOptions({ name: 'DepositDetailView' })

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const { formatDate, formatDateTime, formatCurrency, formatNumber } = useLocaleFormatter()
const loading = ref(false)
const account = ref<DepositAccountDetail | null>(null)

const txnLoading = ref(false)
const txnData = ref<DepositTransactionListItem[]>([])
const txnTotal = ref(0)
const txnPage = ref(1)
const txnPageSize = ref(20)
const txnFilter = ref<DepositTransactionType | undefined>(undefined)

const rechargeVisible = ref(false)
const offsetVisible = ref(false)
const refundVisible = ref(false)

const accountId = computed(() => route.params.id as string)
const canOperate = computed(() => account.value !== null)
const hasBalance = computed(() =>
  account.value !== null && Number(account.value.balance) > 0,
)

const txnColumns = computed<ProTableColumn[]>(() => [
  {
    prop: 'transactionType',
    label: t('detailViews.deposit.type'),
    width: 100,
    slot: 'transactionType',
    align: 'center',
  },
  {
    prop: 'amount',
    label: t('detailViews.deposit.amount'),
    width: 150,
    slot: 'amount',
    align: 'right',
    sortable: 'custom',
  },
  {
    prop: 'balanceAfter',
    label: t('detailViews.deposit.balanceAfter'),
    width: 150,
    slot: 'balanceAfter',
    align: 'right',
  },
  {
    prop: 'relatedInvoiceNo',
    label: t('detailViews.deposit.relatedInvoice'),
    width: 180,
    slot: 'relatedInvoice',
  },
  { prop: 'remark', label: t('common.remark'), minWidth: 200 },
  {
    prop: 'createdAt',
    label: t('detailViews.deposit.transactionTime'),
    width: 160,
    slot: 'createdAt',
    sortable: 'custom',
  },
])

const typeTagType: Record<
  string,
  'primary' | 'success' | 'info' | 'warning' | 'danger'
> = {
  [DepositTransactionType.RECHARGE]: 'success',
  [DepositTransactionType.OFFSET]: 'primary',
  [DepositTransactionType.REFUND]: 'warning',
  [DepositTransactionType.ADJUSTMENT]: 'info',
}

const typeFilterOptions = Object.entries(DepositTransactionTypeLabel).map(
  ([value, label]) => ({ value, label }),
)

onMounted(() => {
  fetchAccount()
  fetchTransactions()
})

/**
 * 根据当前路由中的账户 ID 拉取预存款账户详情。
 */
async function fetchAccount() {
  loading.value = true
  try {
    const res = await getDepositAccount(accountId.value)
    account.value = res.data
  } finally {
    loading.value = false
  }
}

/**
 * 按分页与交易类型筛选条件加载账户流水列表。
 */
async function fetchTransactions() {
  txnLoading.value = true
  try {
    const params: DepositTransactionQueryParams = {
      page: txnPage.value,
      pageSize: txnPageSize.value,
    }
    if (txnFilter.value) {params.transactionType = txnFilter.value}
    const res = await getAccountTransactions(accountId.value, params)
    txnData.value = res.data.items
    txnTotal.value = res.data.total
  } finally {
    txnLoading.value = false
  }
}

function handleTxnPageChange(p: number) {
  txnPage.value = p
  fetchTransactions()
}

function handleTxnSizeChange(s: number) {
  txnPageSize.value = s
  txnPage.value = 1
  fetchTransactions()
}

function handleTxnSortChange() {
  fetchTransactions()
}

function handleFilterChange() {
  txnPage.value = 1
  fetchTransactions()
}

function handleOperationDone() {
  fetchAccount()
  fetchTransactions()
}

function goBack() {
  router.push('/finance/deposits')
}

/**
 *
 */
/**
 * 跳转预存款账户关联客户主档详情，并写入客户中心返回锚点。
 */
function goToCustomer() {
  if (!account.value?.customerId) {
    return
  }
  const query: Record<string, string> = {}
  mergeCustomerDetailReturnQuery(query, route)
  if (Object.keys(query).length > 0) {
    void router.push({ path: `/customers/${account.value.customerId}`, query })
    return
  }
  void router.push(`/customers/${account.value.customerId}`)
}

function goToInvoice(invoiceId: string) {
  router.push(`/finance/invoices/${invoiceId}`)
}

/**
 * 按交易方向格式化流水金额，统一补充正负号展示。
 *
 * @param val - 原始交易金额
 * @param type - 当前流水的业务类型
 * @returns 适合在流水表格中展示的带符号金额文本
 */
function formatSignedAmount(
  val: number | string,
  type: DepositTransactionType,
) {
  if (type === DepositTransactionType.RECHARGE) {
    return `+ ${formatCurrency(val)}`
  }
  if (
    type === DepositTransactionType.OFFSET ||
    type === DepositTransactionType.REFUND
  ) {
    return `- ${formatCurrency(val)}`
  }
  const num = Number(val)
  const prefix = num >= 0 ? '+' : '-'
  return `${prefix} ¥ ${formatNumber(Math.abs(num))}`
}

/**
 * 根据交易类型返回金额单元格的语义样式类名。
 *
 * @param type - 当前流水的业务类型
 * @returns 充值返回加号样式，扣减类交易返回减号样式，其余返回空字符串
 */
function getAmountClass(type: DepositTransactionType) {
  if (type === DepositTransactionType.RECHARGE) {return 'amount--plus'}
  if (
    type === DepositTransactionType.OFFSET ||
    type === DepositTransactionType.REFUND
  ) {
    return 'amount--minus'
  }
  return ''
}
</script>

<template>
  <PageDetail :loading="loading" @back="goBack">
    <template v-if="account" #actions>
      <div class="detail-header-info">
        <h3 class="detail-header-info__name">
          {{ account.customer?.customerName ?? t('detailViews.deposit.defaultTitle') }}
        </h3>
        <span class="detail-header-info__balance">
          {{ t('detailViews.deposit.balance') }}: {{ formatCurrency(account.balance) }}
        </span>
        <div class="detail-header-info__actions">
          <el-button
            v-if="canOperate"
            type="primary"
            size="small"
            @click="rechargeVisible = true"
          >
            {{ t('detailViews.deposit.recharge') }}
          </el-button>
          <el-button
            v-if="hasBalance"
            type="warning"
            size="small"
            @click="offsetVisible = true"
          >
            {{ t('detailViews.deposit.offset') }}
          </el-button>
          <el-button
            v-if="hasBalance"
            size="small"
            @click="refundVisible = true"
          >
            {{ t('detailViews.deposit.refund') }}
          </el-button>
        </div>
      </div>
    </template>

    <template v-if="account">
      <el-card shadow="never" class="detail-section">
        <el-descriptions :column="3" border>
          <el-descriptions-item :label="t('common.customer')">
            <el-link type="primary" @click="goToCustomer">
              {{ account.customer?.customerName ?? '-' }}
            </el-link>
          </el-descriptions-item>
          <el-descriptions-item :label="t('common.customerCode')">
            {{ account.customer?.customerCode ?? '-' }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('detailViews.deposit.balance')">
            <span class="balance-highlight">
              {{ formatCurrency(account.balance) }}
            </span>
          </el-descriptions-item>
          <el-descriptions-item :label="t('detailViews.deposit.createdDate')">
            {{ formatDate(account.createdAt) }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('detailViews.deposit.lastUpdated')">
            {{ formatDateTime(account.updatedAt) }}
          </el-descriptions-item>
        </el-descriptions>
      </el-card>

      <el-card shadow="never" class="detail-section">
        <template #header>
          <div class="card-header">
            <span>{{ t('detailViews.deposit.transactionHistory') }}</span>
            <el-select
              v-model="txnFilter"
              :placeholder="t('detailViews.deposit.allTypes')"
              clearable
              style="width: 130px"
              @change="handleFilterChange"
            >
              <el-option
                v-for="opt in typeFilterOptions"
                :key="opt.value"
                :label="opt.label"
                :value="opt.value"
              />
            </el-select>
          </div>
        </template>

        <ProTable
          :columns="txnColumns"
          :data="txnData"
          :loading="txnLoading"
          :total="txnTotal"
          :page="txnPage"
          :page-size="txnPageSize"
          :actions-width="0"
          @page-change="handleTxnPageChange"
          @size-change="handleTxnSizeChange"
          @sort-change="handleTxnSortChange"
        >
          <template #transactionType="{ row }">
            <el-tag
              size="small"
              :type="typeTagType[row.transactionType] ?? 'info'"
            >
              {{
                DepositTransactionTypeLabel[
                  row.transactionType as DepositTransactionType
                ] ?? row.transactionType
              }}
            </el-tag>
          </template>

          <template #amount="{ row }">
            <span
              class="amount-cell"
              :class="getAmountClass(row.transactionType)"
            >
              {{ formatSignedAmount(row.amount, row.transactionType) }}
            </span>
          </template>

          <template #balanceAfter="{ row }">
            <span class="amount-cell">
              {{ formatCurrency(row.balanceAfter) }}
            </span>
          </template>

          <template #relatedInvoice="{ row }">
            <el-link
              v-if="row.relatedInvoiceId"
              type="primary"
              @click="goToInvoice(row.relatedInvoiceId)"
            >
              {{ row.relatedInvoiceNo ?? row.relatedInvoiceId }}
            </el-link>
            <span v-else>-</span>
          </template>

          <template #createdAt="{ row }">
            {{ formatDateTime(row.createdAt) }}
          </template>
        </ProTable>
      </el-card>
    </template>

    <DepositRechargeDialog
      v-if="account"
      v-model="rechargeVisible"
      :default-customer-id="account.customerId"
      @saved="handleOperationDone"
    />

    <DepositOffsetDialog
      v-if="account"
      v-model="offsetVisible"
      :customer-id="account.customerId"
      :balance="Number(account.balance)"
      @saved="handleOperationDone"
    />

    <DepositRefundDialog
      v-if="account"
      v-model="refundVisible"
      :customer-id="account.customerId"
      :balance="Number(account.balance)"
      @saved="handleOperationDone"
    />
  </PageDetail>
</template>

