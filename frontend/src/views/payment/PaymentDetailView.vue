<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import PageDetail from '@/components/PageDetail.vue'
import PaymentReversalDialog from './components/PaymentReversalDialog.vue'
import { getPayment } from '@/api/payment'
import { PaymentStatus, PaymentMethod, InvoiceStatus } from '@/constants/enums'
import {
  PaymentStatusLabel,
  PaymentMethodLabel,
  InvoiceStatusLabel,
} from '@/constants/enum-labels'
import { useLocaleFormatter } from '@/utils/locale-format'
import type { PaymentDetail } from '@/types/payment'

defineOptions({ name: 'PaymentDetailView' })

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const { formatDate, formatDateTime, formatCurrency } = useLocaleFormatter()
const loading = ref(false)
const payment = ref<PaymentDetail | null>(null)
const showReversalDialog = ref(false)

const paymentId = computed(() => route.params.id as string)
const canReverse = computed(
  () =>
    payment.value != null &&
    payment.value.status !== PaymentStatus.REVERSED,
)

onMounted(() => {
  fetchPayment()
})

async function fetchPayment() {
  loading.value = true
  try {
    const res = await getPayment(paymentId.value)
    payment.value = res.data
  } finally {
    loading.value = false
  }
}

function goBack() {
  router.push('/finance/payments')
}

function handleReversed() {
  fetchPayment()
}

function goToInvoice(invoiceId: string) {
  router.push(`/finance/invoices/${invoiceId}`)
}

function goToCustomer() {
  if (payment.value?.customerId) {
    router.push(`/customers/${payment.value.customerId}`)
  }
}

const statusTagType: Record<string, 'primary' | 'success' | 'info' | 'warning' | 'danger'> = {
  [PaymentStatus.REGISTERED]: 'primary',
  [PaymentStatus.VERIFIED]: 'success',
  [PaymentStatus.REFUNDED]: 'warning',
  [PaymentStatus.REVERSED]: 'danger',
}

const invoiceStatusTagType: Record<string, 'primary' | 'success' | 'info' | 'warning' | 'danger'> = {
  [InvoiceStatus.DRAFT]: 'info',
  [InvoiceStatus.SENT]: 'primary',
  [InvoiceStatus.PARTIAL]: 'warning',
  [InvoiceStatus.PAID]: 'success',
  [InvoiceStatus.VOID]: 'danger',
}
</script>

<template>
  <PageDetail :loading="loading" @back="goBack">
    <template v-if="payment" #actions>
      <div class="detail-header-info">
        <h3 class="detail-header-info__name">{{ payment.paymentNo }}</h3>
        <el-tag
          size="small"
          :type="statusTagType[payment.status] ?? 'info'"
        >
          {{ PaymentStatusLabel[payment.status as PaymentStatus] }}
        </el-tag>
        <el-button
          v-if="canReverse"
          type="danger"
          size="small"
          @click="showReversalDialog = true"
        >
          {{ t('detailViews.payment.reversal') }}
        </el-button>
      </div>
    </template>

    <template v-if="payment">
      <el-card shadow="never" class="detail-section">
        <el-descriptions :column="3" border>
          <el-descriptions-item :label="t('detailViews.payment.paymentNo')">
            {{ payment.paymentNo }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('common.customer')">
            <el-link type="primary" @click="goToCustomer">
              {{ payment.customer?.customerName ?? '-' }}
            </el-link>
          </el-descriptions-item>
          <el-descriptions-item :label="t('detailViews.payment.paymentMethod')">
            {{ PaymentMethodLabel[payment.paymentMethod as PaymentMethod] ?? payment.paymentMethod }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('detailViews.payment.paymentAmount')">
            <span class="amount-highlight">{{ formatCurrency(payment.paymentAmount) }}</span>
          </el-descriptions-item>
          <el-descriptions-item :label="t('detailViews.payment.paymentDate')">
            {{ formatDate(payment.paymentDate) }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('common.createdAt')">
            {{ formatDateTime(payment.createdAt) }}
          </el-descriptions-item>
          <el-descriptions-item v-if="payment.remark" :label="t('common.remark')" :span="3">
            {{ payment.remark }}
          </el-descriptions-item>
        </el-descriptions>
      </el-card>

      <el-card
        v-if="payment.status === PaymentStatus.REVERSED"
        shadow="never"
        class="detail-section reversal-info"
      >
        <el-descriptions :column="3" border :title="t('detailViews.payment.reversalInfo')">
          <el-descriptions-item :label="t('detailViews.payment.reversalReason')" :span="3">
            {{ payment.reversalReason }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('detailViews.payment.reversedAt')">
            {{ formatDateTime(payment.reversedAt) }}
          </el-descriptions-item>
        </el-descriptions>
      </el-card>

      <el-card shadow="never" class="detail-section">
        <template #header>
          <div class="card-header">
            <span>{{ t('detailViews.payment.allocatedInvoices') }}</span>
            <span class="alloc-count">{{ payment.allocations.length }}</span>
          </div>
        </template>
        <el-table :data="payment.allocations" border size="small">
          <el-table-column label="#" width="50" align="center" type="index" />
          <el-table-column :label="t('detailViews.payment.invoiceNo')" min-width="180">
            <template #default="{ row }">
              <el-link type="primary" @click="goToInvoice(row.invoiceId)">
                {{ row.invoice?.invoiceNo ?? row.invoiceId }}
              </el-link>
            </template>
          </el-table-column>
          <el-table-column :label="t('detailViews.payment.invoiceAmount')" width="140" align="right">
            <template #default="{ row }">
              {{ row.invoice ? formatCurrency(row.invoice.totalAmount) : '-' }}
            </template>
          </el-table-column>
          <el-table-column :label="t('detailViews.payment.allocatedAmount')" width="140" align="right">
            <template #default="{ row }">
              <strong>{{ formatCurrency(row.allocatedAmount) }}</strong>
            </template>
          </el-table-column>
          <el-table-column :label="t('detailViews.payment.invoiceStatus')" width="120" align="center">
            <template #default="{ row }">
              <el-tag
                v-if="row.invoice?.status"
                size="small"
                :type="invoiceStatusTagType[row.invoice.status] ?? 'info'"
              >
                {{ InvoiceStatusLabel[row.invoice.status as InvoiceStatus] ?? row.invoice.status }}
              </el-tag>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column :label="t('detailViews.payment.allocatedAt')" width="160">
            <template #default="{ row }">
              {{ formatDateTime(row.createdAt) }}
            </template>
          </el-table-column>
        </el-table>
        <div class="alloc-total">
          {{ t('detailViews.payment.allocationTotal') }}：<strong>{{ formatCurrency(
            payment.allocations.reduce((sum, a) => sum + Number(a.allocatedAmount), 0)
          ) }}</strong>
        </div>
      </el-card>
    </template>

    <PaymentReversalDialog
      v-if="payment"
      v-model="showReversalDialog"
      :payment-id="paymentId"
      :payment-no="payment.paymentNo"
      @reversed="handleReversed"
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

.reversal-info {
  :deep(.el-descriptions__title) {
    color: #f56c6c;
  }
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;

  .alloc-count {
    font-size: 13px;
    color: #909399;
  }
}

.alloc-total {
  text-align: right;
  padding: 12px 8px 0;
  font-size: 16px;

  strong {
    color: #409eff;
    font-size: 18px;
  }
}
</style>
