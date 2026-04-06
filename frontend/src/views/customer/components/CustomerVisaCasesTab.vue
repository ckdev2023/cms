<script setup lang="ts">
import { Edit, Plus } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import {
  getVisaCase,
  getVisaCases,
  reinitializeVisaCaseMaterials,
  updateVisaCase,
} from '@/api/visa-case'
import ProTable from '@/components/ProTable.vue'
import {
  MaterialStatusLabel,
  VisaCaseFeeStatusLabel,
  VisaCaseMemberRoleLabel,
  VisaCaseStatusLabel,
} from '@/constants/enum-labels'
import {
  FamilyLinkMode,
  MaterialStatus,
  VisaCaseFeeStatus,
  VisaCaseMemberRole,
  VisaCaseStatus,
} from '@/constants/enums'
import { P } from '@/constants/permissions'
import { useUserStore } from '@/stores/user'
import type { ProTableColumn } from '@/types/components'
import type { VisaCaseEditSubmitPayload, VisaCaseItem } from '@/types/visa-case'
import { useLocaleFormatter } from '@/utils/locale-format'
import { formatVisaCaseTypeDisplay } from '@/utils/visa-case-type-display'

import CustomerVisaCaseDialog from './CustomerVisaCaseDialog.vue'
import CustomerVisaCaseWizard from './CustomerVisaCaseWizard.vue'

const props = defineProps<{
  customerId: string
  /** 本页客户姓名（向导侧栏申请人预览） */
  contextCustomerName?: string
  /** 外部入口（如全局登记册）传入时，在列表就绪后尝试拉取并打开该案件 */
  openVisaCaseId?: string
  /** 为 true 时自动打开新建案件向导（如新建客户成功引导；消费后从 URL 移除 query） */
  openVisaCaseWizard?: boolean
}>()

const emit = defineEmits<{
  /** 案件保存/新建/成员变更后请求父级刷新 GET /customers/:id 主展示摘要 */
  'visa-domain-customer-refresh': []
}>()

defineOptions({ name: 'CustomerVisaCasesTab' })

const route = useRoute()
const router = useRouter()
const { t } = useI18n({ useScope: 'global' })
const { formatDate } = useLocaleFormatter()
const userStore = useUserStore()

const loading = ref(false)
const data = ref<VisaCaseItem[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)
const wizardVisible = ref(false)
const dialogVisible = ref(false)
const submitting = ref(false)
const isEditing = ref(false)
const editingId = ref<string | null>(null)
const editingRow = ref<VisaCaseItem | null>(null)

const canCreate = computed(() => userStore.hasPermission(P.VISA_CASE_CREATE))
const canEdit = computed(() => userStore.hasPermission(P.VISA_CASE_EDIT))
const canViewCaseDetail = computed(() => userStore.hasPermission(P.VISA_CASE_DETAIL))

const consumingOpenCaseId = ref(false)
const consumingOpenWizard = ref(false)

/** 通知签证域父级重新拉取客户详情，与列表页同源主展示案件摘要对齐。 */
function emitVisaDomainCustomerRefresh(): void {
  emit('visa-domain-customer-refresh')
}

const statusTagType: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'primary'> = {
  [VisaCaseStatus.DRAFT]: 'info',
  [VisaCaseStatus.IN_PROGRESS]: 'primary',
  [VisaCaseStatus.SUBMITTED]: 'primary',
  [VisaCaseStatus.SUPPLEMENT]: 'warning',
  [VisaCaseStatus.APPROVED]: 'success',
  [VisaCaseStatus.REJECTED]: 'danger',
  [VisaCaseStatus.COMPLETED]: 'success',
  [VisaCaseStatus.CANCELLED]: 'info',
}

const columns = computed<ProTableColumn[]>(() => [
  {
    prop: 'caseType',
    label: t('detailViews.customer.visaCasesTab.caseType'),
    minWidth: 160,
    slot: 'caseType',
  },
  { prop: 'caseStatus', label: t('detailViews.customer.visaCasesTab.caseStatus'), width: 110, slot: 'caseStatus', align: 'center' },
  { prop: 'internalPrimaryCustomerName', label: t('detailViews.customer.visaCasesTab.primaryApplicant'), width: 120, slot: 'primaryApplicant' },
  { prop: 'familyMembers', label: t('detailViews.customer.visaCasesTab.familyMembers'), width: 180, slot: 'familyMembers' },
  { prop: 'assigneeName', label: t('detailViews.customer.visaCasesTab.assignee'), width: 100 },
  { prop: 'expireDate', label: t('detailViews.customer.visaCasesTab.expireDate'), minWidth: 132, slot: 'expireDate' },
  { prop: 'nextFollowUpAt', label: t('detailViews.customer.visaCasesTab.nextFollowUpAt'), width: 120, slot: 'nextFollowUpAt' },
  { prop: 'materialStatus', label: t('detailViews.customer.visaCasesTab.materialStatus'), width: 110, slot: 'materialStatus' },
  { prop: 'feeStatus', label: t('detailViews.customer.visaCasesTab.feeStatus'), width: 110, slot: 'feeStatus' },
  { prop: 'createdAt', label: t('detailViews.customer.visaCasesTab.createdAt'), width: 110, slot: 'createdAt' },
])

/**
 * 根据路由透传的案件 ID 拉取详情并在权限允许时打开编辑对话框，最后剥离 query 以免重复触发。
 */
async function tryOpenVisaCaseFromQuery(): Promise<void> {
  const id = props.openVisaCaseId?.trim()
  if (!id || !props.customerId || consumingOpenCaseId.value) {return}
  consumingOpenCaseId.value = true
  try {
    if (!canViewCaseDetail.value) {
      ElMessage.warning(t('detailViews.customer.visaCasesTab.openCaseViewOnlyHint'))
      return
    }
    const res = await getVisaCase(id)
    if (res.data.customerId !== props.customerId) {
      ElMessage.warning(t('detailViews.customer.visaCasesTab.openCaseMismatch'))
      return
    }
    if (canEdit.value) {
      handleEdit(res.data)
    } else {
      ElMessage.info(t('detailViews.customer.visaCasesTab.openCaseViewOnlyHint'))
    }
  } catch {
    // 请求错误由拦截器处理
  } finally {
    consumingOpenCaseId.value = false
    const q = { ...route.query }
    if (q.openVisaCaseId !== undefined) {
      delete q.openVisaCaseId
      void router.replace({ path: route.path, query: q })
    }
  }
}

/**
 * 根据 query `openVisaCaseWizard=1` 在具备创建权限时打开建案向导，并剥离 query 以免重复触发。
 */
async function tryOpenVisaCaseWizardFromQuery(): Promise<void> {
  if (!props.openVisaCaseWizard || !props.customerId || consumingOpenWizard.value) {
    return
  }
  consumingOpenWizard.value = true
  try {
    if (!canCreate.value) {
      return
    }
    wizardVisible.value = true
  } finally {
    consumingOpenWizard.value = false
    const q = { ...route.query } as Record<string, string | string[] | undefined>
    if (q.openVisaCaseWizard !== undefined) {
      delete q.openVisaCaseWizard
      void router.replace({ path: route.path, query: q })
    }
  }
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

watch(
  () => [props.customerId, props.openVisaCaseId ?? ''] as const,
  () => {
    void tryOpenVisaCaseFromQuery()
  },
  { immediate: true },
)

watch(
  () => [props.customerId, props.openVisaCaseWizard ?? false] as const,
  () => {
    void tryOpenVisaCaseWizardFromQuery()
  },
  { immediate: true },
)

/**
 * 按当前客户和分页条件加载签证案件列表。
 *
 * @throws {Error} 签证案件列表接口请求失败时由请求层继续抛出
 */
async function fetchData(): Promise<void> {
  loading.value = true
  try {
    const res = await getVisaCases(props.customerId, {
      page: page.value,
      pageSize: pageSize.value,
    })
    data.value = res.data.items
    total.value = res.data.total
  } finally {
    loading.value = false
  }
}

function handlePageChange(newPage: number): void {
  page.value = newPage
  fetchData()
}

function handleSizeChange(newSize: number): void {
  pageSize.value = newSize
  page.value = 1
  fetchData()
}

/**
 * 打开签证案件创建向导，支持案件与家属成员一步到位录入。
 */
function handleAdd(): void {
  if (!canCreate.value) {return}
  wizardVisible.value = true
}

/**
 * 打开编辑对话框并注入当前行数据，供子组件完成表单初始化。
 *
 * @param row - 目标案件行数据
 */
function handleEdit(row: VisaCaseItem): void {
  if (!canEdit.value) {return}
  isEditing.value = true
  editingId.value = row.id
  editingRow.value = row
  dialogVisible.value = true
}

/**
 * 提交签证案件更新请求，并在成功后关闭对话框和刷新列表。
 *
 * @param payload - 子组件组装完成的案件更新字段（可含材料清单再初期化标记）
 * @throws {Error} 签证案件接口请求失败时由请求层统一提示
 */
async function handleDialogSubmit(payload: VisaCaseEditSubmitPayload): Promise<void> {
  if (!canEdit.value || !editingId.value) {return}
  const { reinitializeMaterialsAfterSave, ...updatePayload } = payload
  const caseId = editingId.value
  submitting.value = true
  try {
    await updateVisaCase(caseId, updatePayload)
    if (reinitializeMaterialsAfterSave === true) {
      try {
        await reinitializeVisaCaseMaterials(caseId, {
          confirm: true,
          reason: t('detailViews.customer.visaCasesTab.caseTypeChangeReinitializeReason'),
        })
      } catch {
        ElMessage.warning(
          t('detailViews.customer.visaCasesTab.caseTypeChangeMaterialsReinitFailed'),
        )
        dialogVisible.value = false
        await fetchData()
        emitVisaDomainCustomerRefresh()
        return
      }
    }
    ElMessage.success(t('detailViews.customer.visaCasesTab.updatedSuccess'))
    dialogVisible.value = false
    await fetchData()
    emitVisaDomainCustomerRefresh()
  } finally {
    submitting.value = false
  }
}

/**
 * 建案向导成功后刷新分页列表并请求客户详情主展示摘要同步。
 *
 * @throws {Error} 列表请求失败时由请求层继续抛出
 */
async function onWizardCreated(): Promise<void> {
  await fetchData()
  emitVisaDomainCustomerRefresh()
}

/**
 * 案件成员变更后刷新分页列表并请求客户详情主展示摘要同步。
 *
 * @throws {Error} 列表请求失败时由请求层继续抛出
 */
async function onMembersChanged(): Promise<void> {
  await fetchData()
  emitVisaDomainCustomerRefresh()
}

function isExpired(dateStr: string | null): boolean {
  if (!dateStr) {return false}
  return new Date(dateStr).getTime() < Date.now()
}

/**
 * 判断签证案件到期日是否进入 30 天内的临近提醒窗口。
 *
 * @param dateStr - 案件到期日字符串，为空时视为无需提醒
 * @returns 命中临近到期区间时返回 true
 */
function isExpiringSoon(dateStr: string | null): boolean {
  if (!dateStr) {return false}
  const diff = new Date(dateStr).getTime() - Date.now()
  const days = diff / (1000 * 60 * 60 * 24)
  return days >= 0 && days <= 30
}
</script>

<template>
  <div class="visa-cases-tab">
    <div class="visa-cases-tab__toolbar">
      <span class="visa-cases-tab__count">
        {{ t('detailViews.customer.visaCasesTab.countLabel', { count: total }) }}
      </span>
      <el-button
        v-if="canCreate"
        type="primary"
        :icon="Plus"
        size="small"
        @click="handleAdd"
      >
        {{ t('detailViews.customer.visaCasesTab.add') }}
      </el-button>
    </div>

    <ProTable
      :columns="columns"
      :data="data"
      :loading="loading"
      :total="total"
      :page="page"
      :page-size="pageSize"
      :actions-width="canEdit ? 100 : 0"
      :page-sizes="[5, 10, 20]"
      @page-change="handlePageChange"
      @size-change="handleSizeChange"
    >
      <template #caseType="{ row }">
        {{ formatVisaCaseTypeDisplay(row.caseType) || '—' }}
      </template>

      <template #caseStatus="{ row }">
        <el-tag size="small" :type="statusTagType[row.caseStatus] ?? 'info'">
          {{ VisaCaseStatusLabel[row.caseStatus as VisaCaseStatus] ?? row.caseStatus }}
        </el-tag>
      </template>

      <template #primaryApplicant="{ row }">
        <span v-if="row.isFamilyCase && row.familyLinkMode === FamilyLinkMode.INTERNAL && row.internalPrimaryCustomerName">
          {{ row.internalPrimaryCustomerName }}
        </span>
        <span v-else-if="row.isFamilyCase && row.familyLinkMode === FamilyLinkMode.EXTERNAL && row.externalPrimaryName">
          {{ row.externalPrimaryName }}
          <el-tag size="small" type="info" class="external-tag">{{ t('detailViews.customer.visaCasesTab.externalTag') }}</el-tag>
        </span>
        <span v-else class="text-placeholder">-</span>
      </template>

      <template #familyMembers="{ row }">
        <div v-if="row.familyMembers && row.familyMembers.length > 0" class="family-members-cell">
          <el-tooltip placement="top">
            <template #content>
              <div v-for="fm in row.familyMembers" :key="fm.id" class="family-member-tooltip-row">
                {{ fm.displayNameSnapshot }}
                ({{ VisaCaseMemberRoleLabel[fm.memberRole as VisaCaseMemberRole] ?? fm.memberRole }})
                <span v-if="fm.isPrimary"> ★</span>
              </div>
            </template>
            <span>
              {{ t('detailViews.customer.visaCasesTab.familyMembersCount', { count: row.familyMembers.length }) }}
            </span>
          </el-tooltip>
        </div>
        <span v-else class="text-placeholder">-</span>
      </template>

      <template #expireDate="{ row }">
        <span
          v-if="row.expireDate"
          :class="{
            'expire-warning': isExpiringSoon(row.expireDate),
            'expire-danger': isExpired(row.expireDate),
          }"
        >
          {{ formatDate(row.expireDate) }}
        </span>
        <span v-else class="text-placeholder">-</span>
      </template>

      <template #nextFollowUpAt="{ row }">
        <span v-if="row.nextFollowUpAt">{{ formatDate(row.nextFollowUpAt) }}</span>
        <span v-else class="text-placeholder">-</span>
      </template>

      <template #materialStatus="{ row }">
        <span v-if="row.materialStatus">
          {{ MaterialStatusLabel[row.materialStatus as MaterialStatus] ?? row.materialStatus }}
        </span>
        <span v-else class="text-placeholder">-</span>
      </template>

      <template #feeStatus="{ row }">
        <span v-if="row.feeStatus">
          {{ VisaCaseFeeStatusLabel[row.feeStatus as VisaCaseFeeStatus] ?? row.feeStatus }}
        </span>
        <span v-else class="text-placeholder">-</span>
      </template>

      <template #createdAt="{ row }">
        {{ formatDate(row.createdAt) }}
      </template>

      <template v-if="canEdit" #actions="{ row }">
        <el-button
          link
          type="primary"
          size="small"
          :icon="Edit"
          @click="handleEdit(row)"
        >
          {{ t('detailViews.customer.visaCasesTab.edit') }}
        </el-button>
      </template>

      <template #empty>
        <el-empty :description="t('detailViews.customer.visaCasesTab.empty')" />
      </template>
    </ProTable>

    <CustomerVisaCaseWizard
      v-model:visible="wizardVisible"
      :customer-id="customerId"
      :context-customer-name="contextCustomerName"
      @created="onWizardCreated"
    />

    <CustomerVisaCaseDialog
      v-model:visible="dialogVisible"
      :is-editing="isEditing"
      :initial-value="editingRow"
      :family-members="editingRow?.familyMembers ?? []"
      :submitting="submitting"
      @submit="handleDialogSubmit"
      @members-changed="onMembersChanged"
    />
  </div>
</template>

<style scoped lang="scss">
.visa-cases-tab {
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

.text-placeholder {
  color: var(--el-text-color-placeholder);
}

.external-tag {
  margin-left: 4px;
  vertical-align: middle;
}

.family-members-cell {
  cursor: default;
}

.family-member-tooltip-row {
  line-height: 1.6;
  white-space: nowrap;
}
</style>
