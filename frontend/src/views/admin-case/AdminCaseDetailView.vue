<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import { getAdminCase } from '@/api/admin-case'
import PageDetail from '@/components/PageDetail.vue'
import { AdminCaseStatusLabel } from '@/constants/enum-labels'
import { AdminCaseStatus } from '@/constants/enums'
import type { AdminCaseDetail } from '@/types/admin-case'
import { useLocaleFormatter } from '@/utils/locale-format'

import AdminCaseFilesTab from './components/AdminCaseFilesTab.vue'
import AdminCaseFormDialog from './components/AdminCaseFormDialog.vue'
import AdminCaseStatusFlow from './components/AdminCaseStatusFlow.vue'
import InterviewTab from './components/InterviewTab.vue'

defineOptions({ name: 'AdminCaseDetailView' })

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const { formatDate, formatDateTime } = useLocaleFormatter()
const loading = ref(false)
const adminCase = ref<AdminCaseDetail | null>(null)
const activeTab = ref('status')
const showEditDialog = ref(false)

const caseId = computed(() => route.params.id as string)

watch(caseId, () => fetchCase(), { immediate: true })

/**
 * 按路由中的案件 ID 拉取详情数据，并同步页面加载状态。
 *
 * @returns 请求完成后更新当前详情页展示的案件记录
 */
async function fetchCase() {
  loading.value = true
  try {
    const res = await getAdminCase(caseId.value)
    adminCase.value = res.data
  } finally {
    loading.value = false
  }
}

function goBack() {
  router.push('/admin-cases')
}

function handleEdit() {
  showEditDialog.value = true
}

function refreshCaseDetail() {
  fetchCase()
}

function goToCustomer() {
  if (adminCase.value?.customerId) {
    router.push(`/customers/${adminCase.value.customerId}`)
  }
}

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

function isExpiringSoon(dateStr: string): boolean {
  const diff = new Date(dateStr).getTime() - Date.now()
  const days = diff / (1000 * 60 * 60 * 24)
  return days >= 0 && days <= 30
}

function isExpired(dateStr: string): boolean {
  return new Date(dateStr).getTime() < Date.now()
}
</script>

<template>
  <PageDetail :loading="loading" @back="goBack">
    <template v-if="adminCase" #actions>
      <div class="detail-header-info">
        <h3 class="detail-header-info__name">{{ adminCase.caseName }}</h3>
        <el-tag
          size="small"
          :type="statusTagType[adminCase.status] ?? 'info'"
        >
          {{ AdminCaseStatusLabel[adminCase.status as AdminCaseStatus] }}
        </el-tag>
        <el-button type="primary" size="small" @click="handleEdit">
          {{ t('common.edit') }}
        </el-button>
      </div>
    </template>

    <template v-if="adminCase">
      <el-card shadow="never" class="detail-section">
        <el-descriptions :column="3" border>
          <el-descriptions-item :label="t('detailViews.adminCase.caseName')">
            {{ adminCase.caseName }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('common.customer')">
            <el-link type="primary" @click="goToCustomer">
              {{ adminCase.customerName ?? '-' }}
            </el-link>
          </el-descriptions-item>
          <el-descriptions-item :label="t('detailViews.adminCase.applicantName')">
            {{ adminCase.applicantName ?? '-' }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('detailViews.adminCase.residenceStatus')">
            {{ adminCase.residenceStatus ?? '-' }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('detailViews.adminCase.expireDate')">
            <span
              :class="{
                'expire-warning': adminCase.expireDate && isExpiringSoon(adminCase.expireDate),
                'expire-danger': adminCase.expireDate && isExpired(adminCase.expireDate),
              }"
            >
              {{ formatDate(adminCase.expireDate) }}
            </span>
          </el-descriptions-item>
          <el-descriptions-item :label="t('common.owner')">
            {{ adminCase.ownerName ?? '-' }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('common.createdAt')">
            {{ formatDateTime(adminCase.createdAt) }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('common.updatedAt')">
            {{ formatDateTime(adminCase.updatedAt) }}
          </el-descriptions-item>
        </el-descriptions>
      </el-card>

      <el-card shadow="never">
        <el-tabs v-model="activeTab">
          <el-tab-pane :label="t('detailViews.adminCase.statusProgress')" name="status">
            <AdminCaseStatusFlow
              :case-id="caseId"
              :current-status="adminCase.status"
              @updated="refreshCaseDetail"
            />
          </el-tab-pane>

          <el-tab-pane :label="t('detailViews.adminCase.interviews')" name="interviews">
            <InterviewTab :case-id="caseId" />
          </el-tab-pane>

          <el-tab-pane :label="t('detailViews.adminCase.relatedFiles')" name="files">
            <AdminCaseFilesTab
              :case-id="caseId"
              :customer-id="adminCase.customerId"
            />
          </el-tab-pane>
        </el-tabs>
      </el-card>
    </template>

    <AdminCaseFormDialog
      v-model="showEditDialog"
      :edit-data="adminCase"
      @saved="refreshCaseDetail"
    />
  </PageDetail>
</template>

