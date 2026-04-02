<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import { getCustomer } from '@/api/customer'
import PageDetail from '@/components/PageDetail.vue'
import { CustomerStatusLabel,CustomerTypeLabel } from '@/constants/enum-labels'
import type { CustomerStatus,CustomerType } from '@/constants/enums'
import type { CustomerDetail } from '@/types/customer'

import CustomerAdminCasesTab from './components/CustomerAdminCasesTab.vue'
import CustomerBasicInfoTab from './components/CustomerBasicInfoTab.vue'
import CustomerFilesTab from './components/CustomerFilesTab.vue'
import CustomerFormDialog from './components/CustomerFormDialog.vue'
import CustomerNotesTab from './components/CustomerNotesTab.vue'
import CustomerTaxContractsTab from './components/CustomerTaxContractsTab.vue'

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

watch(customerId, () => {
  if (customerId.value) {
    fetchCustomer()
  }
}, { immediate: true })

/**
 * 拉取当前路由对应的客户详情并同步到页面状态。
 *
 * @throws {Error} 客户详情接口请求失败时由请求层继续抛出
 */
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

