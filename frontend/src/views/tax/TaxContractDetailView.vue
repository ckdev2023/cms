<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import PageDetail from '@/components/PageDetail.vue'
import TaxContractStatusFlow from './components/TaxContractStatusFlow.vue'
import TaxContractFormDialog from './components/TaxContractFormDialog.vue'
import PeriodsTab from './components/PeriodsTab.vue'
import TaxContractFilesTab from './components/TaxContractFilesTab.vue'
import { getTaxContract } from '@/api/tax'
import { TaxContractStatus, BillingCycle } from '@/constants/enums'
import {
  TaxContractStatusLabel,
  BillingCycleLabel,
} from '@/constants/enum-labels'
import { useLocaleFormatter } from '@/utils/locale-format'
import type { TaxContractDetail } from '@/types/tax'

defineOptions({ name: 'TaxContractDetailView' })

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const { formatDate, formatDateTime, formatCurrency } = useLocaleFormatter()
const loading = ref(false)
const contract = ref<TaxContractDetail | null>(null)
const activeTab = ref('status')
const showEditDialog = ref(false)

const contractId = computed(() => route.params.id as string)

onMounted(() => {
  fetchContract()
})

async function fetchContract() {
  loading.value = true
  try {
    const res = await getTaxContract(contractId.value)
    contract.value = res.data
  } finally {
    loading.value = false
  }
}

function goBack() {
  router.push('/tax-contracts')
}

function handleEdit() {
  showEditDialog.value = true
}

function handleSaved() {
  fetchContract()
}

function handleStatusUpdated() {
  fetchContract()
}

function goToCustomer() {
  if (contract.value?.customerId) {
    router.push(`/customers/${contract.value.customerId}`)
  }
}

function formatFee(value: number) {
  if (value == null) return '-'
  return formatCurrency(value, '¥')
}

const statusTagType: Record<
  string,
  'success' | 'info' | 'warning' | 'danger'
> = {
  [TaxContractStatus.ACTIVE]: 'success',
  [TaxContractStatus.EXPIRED]: 'warning',
  [TaxContractStatus.TERMINATED]: 'danger',
}
</script>

<template>
  <PageDetail :loading="loading" @back="goBack">
    <template v-if="contract" #actions>
      <div class="detail-header-info">
        <h3 class="detail-header-info__name">
          {{ contract.contractName }}
        </h3>
        <el-tag
          size="small"
          :type="statusTagType[contract.contractStatus] ?? 'info'"
        >
          {{
            TaxContractStatusLabel[
              contract.contractStatus as TaxContractStatus
            ]
          }}
        </el-tag>
        <el-button type="primary" size="small" @click="handleEdit">
          {{ t('common.edit') }}
        </el-button>
      </div>
    </template>

    <template v-if="contract">
      <el-card shadow="never" class="detail-section">
        <el-descriptions :column="3" border>
          <el-descriptions-item :label="t('detailViews.taxContract.contractName')">
            {{ contract.contractName }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('common.customer')">
            <el-link type="primary" @click="goToCustomer">
              {{ contract.customer?.customerName ?? '-' }}
            </el-link>
          </el-descriptions-item>
          <el-descriptions-item :label="t('detailViews.taxContract.billingCycle')">
            {{
              BillingCycleLabel[contract.billingCycle as BillingCycle] ??
              contract.billingCycle
            }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('detailViews.taxContract.monthlyFee')">
            {{ formatFee(contract.monthlyFee) }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('common.startDate')">
            {{ formatDate(contract.startDate) }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('common.endDate')">
            {{ formatDate(contract.endDate) }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('common.owner')">
            {{ contract.owner?.displayName ?? '-' }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('common.createdAt')">
            {{ formatDateTime(contract.createdAt) }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('common.updatedAt')">
            {{ formatDateTime(contract.updatedAt) }}
          </el-descriptions-item>
        </el-descriptions>
      </el-card>

      <el-card shadow="never">
        <el-tabs v-model="activeTab">
          <el-tab-pane :label="t('detailViews.taxContract.statusManagement')" name="status">
            <TaxContractStatusFlow
              :contract-id="contractId"
              :current-status="contract.contractStatus"
              @updated="handleStatusUpdated"
            />
          </el-tab-pane>

          <el-tab-pane :label="t('detailViews.taxContract.monthlyTasks')" name="periods">
            <PeriodsTab :contract-id="contractId" />
          </el-tab-pane>

          <el-tab-pane :label="t('detailViews.taxContract.relatedFiles')" name="files">
            <TaxContractFilesTab
              :contract-id="contractId"
              :customer-id="contract.customerId"
            />
          </el-tab-pane>
        </el-tabs>
      </el-card>
    </template>

    <TaxContractFormDialog
      v-model="showEditDialog"
      :edit-data="contract"
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
</style>
