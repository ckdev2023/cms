<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import { getInvoice } from '@/api/invoice'
import { getPaymentsByInvoice } from '@/api/payment'
import PageDetail from '@/components/PageDetail.vue'
import {
  InvoiceStatusLabel,
  InvoiceTypeLabel,
  PaymentMethodLabel,
  PaymentStatusLabel,
} from '@/constants/enum-labels'
import {
  InvoiceStatus,
  InvoiceType,
  PaymentMethod,
  PaymentStatus,
} from '@/constants/enums'
import type { CreateInvoiceItemParams, InvoiceDetail } from '@/types/invoice'
import type { InvoicePaymentItem } from '@/types/payment'
import { mergeCustomerDetailReturnQuery } from '@/utils/customer-detail-return-navigation'
import { useLocaleFormatter } from '@/utils/locale-format'

import InvoiceFormDialog from './components/InvoiceFormDialog.vue'
import InvoiceStatusFlow from './components/InvoiceStatusFlow.vue'

defineOptions({ name: 'InvoiceDetailView' })

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const { formatDate, formatDateTime, formatCurrency } = useLocaleFormatter()
const loading = ref(false)
const invoice = ref<InvoiceDetail | null>(null)
const activeTab = ref('status')
const showEditDialog = ref(false)
const invoicePayments = ref<InvoicePaymentItem[]>([])
const paymentsLoading = ref(false)

const invoiceId = computed(() => route.params.id as string)
const canEdit = computed(() => invoice.value?.status === InvoiceStatus.DRAFT)
const hasPayments = computed(() => invoicePayments.value.length > 0)
const remainingAmount = computed(() => Number(invoice.value?.totalAmount ?? 0) - paidTotal.value)
const invoiceEditItems = computed<CreateInvoiceItemParams[]>(() =>
  invoice.value?.items.map((item) => ({
    description: item.description,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
  })) ?? [],
)

watch(
  invoiceId,
  (id) => {
    void fetchInvoice(id)
    void fetchPayments(id)
  },
  { immediate: true },
)

/**
 * 按当前路由中的发票 ID 拉取最新明细，保证详情页与状态页签使用同一份数据源。
 *
 * @param id - 当前详情页对应的发票 ID
 */
async function fetchInvoice(id: string): Promise<void> {
  loading.value = true
  try {
    const res = await getInvoice(id)
    invoice.value = res.data
  } finally {
    loading.value = false
  }
}

/**
 * 查询当前发票已关联的收款记录，用于展示支付列表与剩余待收金额。
 *
 * @param id - 当前详情页对应的发票 ID
 */
async function fetchPayments(id: string): Promise<void> {
  paymentsLoading.value = true
  try {
    const res = await getPaymentsByInvoice(id)
    invoicePayments.value = res.data
  } finally {
    paymentsLoading.value = false
  }
}

const paidTotal = computed(() =>
  invoicePayments.value.reduce((sum, p) => sum + Number(p.allocatedAmount), 0),
)

function goBack() {
  router.push('/finance/invoices')
}

function handleEdit() {
  showEditDialog.value = true
}

function handleSaved() {
  void fetchInvoice(invoiceId.value)
}

function handleStatusUpdated() {
  void fetchInvoice(invoiceId.value)
  void fetchPayments(invoiceId.value)
}

function goToPayment(paymentId: string) {
  router.push(`/finance/payments/${paymentId}`)
}

/**
 *
 */
/**
 * 跳转请求书关联客户主档详情，并写入客户中心返回锚点。
 */
function goToCustomer() {
  if (!invoice.value?.customerId) {
    return
  }
  const query: Record<string, string> = {}
  mergeCustomerDetailReturnQuery(query, route)
  if (Object.keys(query).length > 0) {
    void router.push({ path: `/customers/${invoice.value.customerId}`, query })
    return
  }
  void router.push(`/customers/${invoice.value.customerId}`)
}

const statusTagType: Record<string, 'primary' | 'success' | 'info' | 'warning' | 'danger'> = {
  [InvoiceStatus.DRAFT]: 'info',
  [InvoiceStatus.SENT]: 'primary',
  [InvoiceStatus.PARTIAL]: 'warning',
  [InvoiceStatus.PAID]: 'success',
  [InvoiceStatus.VOID]: 'danger',
}

const paymentStatusTagType: Record<string, 'primary' | 'success' | 'info' | 'warning' | 'danger'> = {
  [PaymentStatus.REGISTERED]: 'primary',
  [PaymentStatus.VERIFIED]: 'success',
  [PaymentStatus.REFUNDED]: 'warning',
  [PaymentStatus.REVERSED]: 'danger',
}
</script>

<template>
  <PageDetail :loading="loading" @back="goBack">
    <template v-if="invoice" #actions>
      <div class="detail-header-info">
        <h3 class="detail-header-info__name">{{ invoice.invoiceNo }}</h3>
        <el-tag
          size="small"
          :type="statusTagType[invoice.status] ?? 'info'"
        >
          {{ InvoiceStatusLabel[invoice.status as InvoiceStatus] }}
        </el-tag>
        <el-button
          v-if="canEdit"
          type="primary"
          size="small"
          @click="handleEdit"
        >
          {{ t('common.edit') }}
        </el-button>
      </div>
    </template>

    <template v-if="invoice">
      <el-card shadow="never" class="detail-section">
        <el-descriptions :column="3" border>
          <el-descriptions-item :label="t('detailViews.invoice.invoiceNo')">
            {{ invoice.invoiceNo }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('common.customer')">
            <el-link type="primary" @click="goToCustomer">
              {{ invoice.customer?.customerName ?? '-' }}
            </el-link>
          </el-descriptions-item>
          <el-descriptions-item :label="t('detailViews.invoice.invoiceType')">
            {{ InvoiceTypeLabel[invoice.invoiceType as InvoiceType] ?? invoice.invoiceType }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('detailViews.invoice.totalAmount')">
            <span class="amount-highlight">{{ formatCurrency(invoice.totalAmount) }}</span>
          </el-descriptions-item>
          <el-descriptions-item :label="t('detailViews.invoice.dueDate')">
            {{ formatDate(invoice.dueDate) }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('detailViews.invoice.issuedAt')">
            {{ formatDate(invoice.issuedAt) }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('common.createdAt')">
            {{ formatDateTime(invoice.createdAt) }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('common.updatedAt')">
            {{ formatDateTime(invoice.updatedAt) }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('common.currency')">
            {{ invoice.currency }}
          </el-descriptions-item>
          <el-descriptions-item v-if="invoice.remark" :label="t('common.remark')" :span="3">
            {{ invoice.remark }}
          </el-descriptions-item>
        </el-descriptions>
      </el-card>

      <el-card v-if="invoice.status === InvoiceStatus.VOID" shadow="never" class="detail-section void-info">
        <el-descriptions :column="3" border :title="t('detailViews.invoice.voidInfo')">
          <el-descriptions-item :label="t('detailViews.invoice.voidReason')" :span="3">
            {{ invoice.voidReason }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('detailViews.invoice.voidedAt')">
            {{ invoice.voidedAt ? formatDateTime(invoice.voidedAt) : '-' }}
          </el-descriptions-item>
        </el-descriptions>
      </el-card>

      <el-card shadow="never" class="detail-section">
        <template #header>
          <div class="card-header">
            <span>{{ t('detailViews.invoice.itemList') }}</span>
            <span class="item-count">{{ invoice.items.length }}</span>
          </div>
        </template>
        <el-table :data="invoice.items" border size="small">
          <el-table-column label="#" width="50" align="center" type="index" />
          <el-table-column
            prop="description"
            :label="t('detailViews.invoice.description')"
            min-width="250"
            show-overflow-tooltip
          />
          <el-table-column prop="quantity" :label="t('detailViews.invoice.quantity')" width="80" align="center" />
          <el-table-column :label="t('detailViews.invoice.unitPrice')" width="140" align="right">
            <template #default="{ row }">
              {{ formatCurrency(row.unitPrice) }}
            </template>
          </el-table-column>
          <el-table-column :label="t('detailViews.invoice.amount')" width="140" align="right">
            <template #default="{ row }">
              <strong>{{ formatCurrency(row.amount) }}</strong>
            </template>
          </el-table-column>
        </el-table>
        <div class="items-total">
          {{ t('common.total') }}：<strong>{{ formatCurrency(invoice.totalAmount) }}</strong>
        </div>
      </el-card>

      <el-card shadow="never">
        <el-tabs v-model="activeTab">
          <el-tab-pane :label="t('detailViews.invoice.statusProgress')" name="status">
            <InvoiceStatusFlow
              :invoice-id="invoiceId"
              :current-status="(invoice.status as InvoiceStatus)"
              @updated="handleStatusUpdated"
            />
          </el-tab-pane>

          <el-tab-pane :label="t('detailViews.invoice.paymentInfo')" name="payments">
            <div v-loading="paymentsLoading">
              <el-table
                v-if="hasPayments"
                :data="invoicePayments"
                border
                size="small"
              >
                <el-table-column label="#" width="50" align="center" type="index" />
                <el-table-column :label="t('detailViews.invoice.paymentNo')" min-width="180">
                  <template #default="{ row }">
                    <el-link type="primary" @click="goToPayment(row.paymentId)">
                      {{ row.paymentNo ?? '-' }}
                    </el-link>
                  </template>
                </el-table-column>
                <el-table-column :label="t('detailViews.invoice.paymentAmount')" width="140" align="right">
                  <template #default="{ row }">
                    <strong>{{ formatCurrency(row.allocatedAmount) }}</strong>
                  </template>
                </el-table-column>
                <el-table-column :label="t('detailViews.invoice.paymentMethod')" width="110" align="center">
                  <template #default="{ row }">
                    {{ row.paymentMethod ? PaymentMethodLabel[row.paymentMethod as PaymentMethod] : '-' }}
                  </template>
                </el-table-column>
                <el-table-column :label="t('detailViews.invoice.paymentStatus')" width="120" align="center">
                  <template #default="{ row }">
                    <el-tag
                      v-if="row.paymentStatus"
                      size="small"
                      :type="paymentStatusTagType[row.paymentStatus] ?? 'info'"
                    >
                      {{ PaymentStatusLabel[row.paymentStatus as PaymentStatus] ?? row.paymentStatus }}
                    </el-tag>
                    <span v-else>-</span>
                  </template>
                </el-table-column>
                <el-table-column :label="t('detailViews.invoice.paymentDate')" width="120">
                  <template #default="{ row }">
                    {{ formatDate(row.paymentDate) }}
                  </template>
                </el-table-column>
              </el-table>
              <div v-if="hasPayments" class="payment-summary">
                {{ t('detailViews.invoice.paymentTotal') }}：<strong>{{ formatCurrency(paidTotal) }}</strong>
                <span class="payment-remaining">
                  （{{ t('detailViews.invoice.remainingAmount') }}：{{ formatCurrency(remainingAmount) }}）
                </span>
              </div>
              <el-empty
                v-if="!hasPayments && !paymentsLoading"
                :description="t('detailViews.invoice.noPayments')"
              />
            </div>
          </el-tab-pane>
        </el-tabs>
      </el-card>
    </template>

    <InvoiceFormDialog
      v-if="invoice"
      v-model="showEditDialog"
      :edit-data="invoice"
      :edit-items="invoiceEditItems"
      @saved="handleSaved"
    />
  </PageDetail>
</template>

