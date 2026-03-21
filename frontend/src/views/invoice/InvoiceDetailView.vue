<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import PageDetail from '@/components/PageDetail.vue'
import InvoiceStatusFlow from './components/InvoiceStatusFlow.vue'
import InvoiceFormDialog from './components/InvoiceFormDialog.vue'
import { getInvoice } from '@/api/invoice'
import { getPaymentsByInvoice } from '@/api/payment'
import { InvoiceStatus, InvoiceType, PaymentStatus, PaymentMethod } from '@/constants/enums'
import { InvoiceStatusLabel, InvoiceTypeLabel, PaymentStatusLabel, PaymentMethodLabel } from '@/constants/enum-labels'
import { useLocaleFormatter } from '@/utils/locale-format'
import type { InvoiceDetail } from '@/types/invoice'
import type { InvoicePaymentItem } from '@/types/payment'

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

onMounted(() => {
  fetchInvoice()
  fetchPayments()
})

async function fetchInvoice() {
  loading.value = true
  try {
    const res = await getInvoice(invoiceId.value)
    invoice.value = res.data
  } finally {
    loading.value = false
  }
}

async function fetchPayments() {
  paymentsLoading.value = true
  try {
    const res = await getPaymentsByInvoice(invoiceId.value)
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
  fetchInvoice()
}

function handleStatusUpdated() {
  fetchInvoice()
  fetchPayments()
}

function goToPayment(paymentId: string) {
  router.push(`/finance/payments/${paymentId}`)
}

function goToCustomer() {
  if (invoice.value?.customerId) {
    router.push(`/customers/${invoice.value.customerId}`)
  }
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
                v-if="invoicePayments.length > 0"
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
              <div v-if="invoicePayments.length > 0" class="payment-summary">
                {{ t('detailViews.invoice.paymentTotal') }}：<strong>{{ formatCurrency(paidTotal) }}</strong>
                <span class="payment-remaining">
                  （{{ t('detailViews.invoice.remainingAmount') }}：{{ formatCurrency(Number(invoice!.totalAmount) - paidTotal) }}）
                </span>
              </div>
              <el-empty
                v-if="invoicePayments.length === 0 && !paymentsLoading"
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
      :edit-items="invoice.items?.map(it => ({ description: it.description, quantity: it.quantity, unitPrice: it.unitPrice }))"
      @saved="handleSaved"
    />
  </PageDetail>
</template>

<style scoped lang="scss">
.detail-header-info {
  display: flex;
  align-items: center;
  gap: 8px;

  &__name {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: #303133;
  }
}

.detail-section {
  margin-bottom: 16px;
}

.amount-highlight {
  font-size: 16px;
  font-weight: 700;
  color: #409eff;
}

.void-info {
  :deep(.el-descriptions__title) {
    color: #f56c6c;
  }
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;

  .item-count {
    font-size: 13px;
    color: #909399;
  }
}

.items-total {
  text-align: right;
  padding: 12px 8px 0;
  font-size: 16px;

  strong {
    color: #409eff;
    font-size: 18px;
  }
}

.payment-summary {
  text-align: right;
  padding: 12px 8px 0;
  font-size: 16px;

  strong {
    color: #409eff;
    font-size: 18px;
  }
}

.payment-remaining {
  font-size: 14px;
  color: #909399;
}
</style>
