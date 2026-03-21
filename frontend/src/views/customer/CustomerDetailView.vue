<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import PageDetail from '@/components/PageDetail.vue'
import CustomerBasicInfoTab from './components/CustomerBasicInfoTab.vue'
import CustomerNotesTab from './components/CustomerNotesTab.vue'
import CustomerAdminCasesTab from './components/CustomerAdminCasesTab.vue'
import CustomerTaxContractsTab from './components/CustomerTaxContractsTab.vue'
import CustomerFilesTab from './components/CustomerFilesTab.vue'
import CustomerFormDialog from './components/CustomerFormDialog.vue'
import { getCustomer } from '@/api/customer'
import { CustomerTypeLabel, CustomerStatusLabel } from '@/constants/enum-labels'
import type { CustomerType, CustomerStatus } from '@/constants/enums'
import type { CustomerDetail } from '@/types/customer'

defineOptions({ name: 'CustomerDetailView' })

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const loading = ref(false)
const customer = ref<CustomerDetail | null>(null)
const activeTab = ref('basic')
const showEditDialog = ref(false)

const customerId = computed(() => route.params.id as string)

const pageTitle = computed(() => {
  if (!customer.value) return ''
  return customer.value.customerName
})

onMounted(() => {
  fetchCustomer()
})

async function fetchCustomer() {
  loading.value = true
  try {
    const res = await getCustomer(customerId.value)
    customer.value = res.data
  } finally {
    loading.value = false
  }
}

function goBack() {
  router.push('/customers')
}

function handleEdit() {
  showEditDialog.value = true
}

function handleSaved() {
  fetchCustomer()
}
</script>

<template>
  <PageDetail :loading="loading" @back="goBack">
    <template v-if="customer" #actions>
      <div class="detail-header-info">
        <h3 class="detail-header-info__name">{{ pageTitle }}</h3>
        <el-tag size="small">
          {{ CustomerTypeLabel[customer.customerType as CustomerType] }}
        </el-tag>
        <el-tag
          size="small"
          :type="customer.status === 'ACTIVE' ? 'success' : 'danger'"
        >
          {{ CustomerStatusLabel[customer.status as CustomerStatus] }}
        </el-tag>
        <el-tag size="small" type="info">
          {{ customer.customerCode }}
        </el-tag>
      </div>
    </template>

    <el-card v-if="customer" shadow="never">
      <el-tabs v-model="activeTab">
        <el-tab-pane :label="t('detailViews.customer.basicInfo')" name="basic">
          <CustomerBasicInfoTab :customer="customer" @edit="handleEdit" />
        </el-tab-pane>

        <el-tab-pane :label="t('detailViews.customer.notes')" name="notes">
          <CustomerNotesTab :customer-id="customerId" />
        </el-tab-pane>

        <el-tab-pane :label="t('detailViews.customer.adminCases')" name="admin-cases">
          <CustomerAdminCasesTab :customer-id="customerId" />
        </el-tab-pane>

        <el-tab-pane :label="t('detailViews.customer.tax')" name="tax">
          <CustomerTaxContractsTab :customer-id="customerId" />
        </el-tab-pane>

        <el-tab-pane :label="t('detailViews.customer.finance')" name="finance">
          <el-empty :description="t('detailViews.customer.financePending')" />
        </el-tab-pane>

        <el-tab-pane :label="t('detailViews.customer.files')" name="files">
          <CustomerFilesTab :customer-id="customerId" />
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <CustomerFormDialog
      v-model="showEditDialog"
      :edit-data="customer"
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
</style>
