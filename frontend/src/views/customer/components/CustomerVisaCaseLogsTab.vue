<script setup lang="ts">
import type { FormRules } from 'element-plus'
import { ElMessage } from 'element-plus'
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import {
  createVisaCaseLog,
  deleteVisaCaseLog,
  getVisaCaseLogs,
  getVisaCases,
  updateVisaCaseLog,
} from '@/api/visa-case'
import { useConfirm } from '@/composables/useConfirm'
import { useVisaCaseLogFormAssist } from '@/composables/useVisaCaseLogFormAssist'
import { VisaCaseLogTypeLabel } from '@/constants/enum-labels'
import { VisaCaseLogType } from '@/constants/enums'
import { P } from '@/constants/permissions'
import { useUserStore } from '@/stores/user'
import type {
  VisaCaseItem,
  VisaCaseLogItem,
  VisaCaseLogPreFillData,
  VisaCaseLogQueryParams,
} from '@/types/visa-case'
import { useLocaleFormatter } from '@/utils/locale-format'
import {
  formatIsoToDatetimeLocalPickerValue,
  stripVisaCaseLogDeepLinkQuery,
} from '@/utils/visa-case-log-deep-link'
import { formatVisaCaseTypeDisplay } from '@/utils/visa-case-type-display'
import CustomerVisaCaseLogsFormCard from '@/views/customer/components/CustomerVisaCaseLogsFormCard.vue'
import CustomerVisaCaseLogsTimeline from '@/views/customer/components/CustomerVisaCaseLogsTimeline.vue'

const props = defineProps<{
  customerId: string
  /** 自客户详情 query `openVisaCaseId` / `logVisaCaseId` 透传，在案件下拉中优先选中对应案件 */
  preferredVisaCaseId?: string
  /** 列表/工作台深链：选中首选案件后自动打开新建日志表单（消费后从 URL 剥离相关 query） */
  autoOpenCreateForm?: boolean
  /** 与深链配套：新建表单「下次跟进」建议值（ISO 日期时间串） */
  suggestedNextFollowUpAt?: string
  preFillData?: VisaCaseLogPreFillData | null
}>()

const emit = defineEmits<{
  /** 材料清单预填已处理（展示表单或无权创建时已提示），供父级清空 `preFillData` 避免残留引用 */
  (e: 'prefill-settled'): void
}>()

defineOptions({ name: 'CustomerVisaCaseLogsTab' })

const route = useRoute()
const router = useRouter()
const { confirmDelete } = useConfirm()
const { t, tm } = useI18n({ useScope: 'global' })
const { formatDateTime } = useLocaleFormatter()
const userStore = useUserStore()
const T = (key: string, params?: Record<string, unknown>) =>
  t(`detailViews.customer.visaCaseLogsTab.${key}`, params ?? {})

/**
 * 将当前客户详情路由切换到「备忘与跟进」Tab，与案件日志 / 客户备注分工（docs/21 §1.4）及顶栏提示一致。
 */
function goCustomerNotesTab(): void {
  void router.push({
    path: route.path,
    query: {
      ...route.query,
      tab: "notes",
    },
  })
}

const canCreate = computed(() => userStore.hasPermission(P.VISA_CASE_LOG_CREATE))
const canEdit = computed(() => userStore.hasPermission(P.VISA_CASE_LOG_EDIT))
const canDelete = computed(() => userStore.hasPermission(P.VISA_CASE_LOG_DELETE))

const casesLoading = ref(false)
const visaCases = ref<VisaCaseItem[]>([])
const selectedCaseId = ref('')

const loading = ref(false)
const logs = ref<VisaCaseLogItem[]>([])
const total = ref(0)
const queryParams = reactive<VisaCaseLogQueryParams>({
  page: 1,
  pageSize: 20,
  logType: undefined,
  sortOrder: 'DESC',
})

const formCardRef = ref<InstanceType<typeof CustomerVisaCaseLogsFormCard> | null>(null)
const submitting = ref(false)
const editingLog = ref<VisaCaseLogItem | null>(null)
const showForm = ref(false)

const formModel = reactive({
  logType: VisaCaseLogType.GENERAL as VisaCaseLogType,
  content: '',
  submittedItems: '',
  missingItems: '',
  nextAction: '',
  nextFollowUpAt: '',
})

const formRules = computed<FormRules>(() => ({
  logType: [
    { required: true, message: t('common.selectField', { field: T('logType') }), trigger: 'change' },
  ],
  content: [
    { required: true, message: t('common.enterField', { field: T('content') }), trigger: 'blur' },
    { max: 5000, message: t('validation.maxChars', { max: 5000 }), trigger: 'blur' },
  ],
}))

const isEdit = computed(() => !!editingLog.value)

const logTypeOptions = computed(() =>
  Object.values(VisaCaseLogType).map((value) => ({
    value,
    label: VisaCaseLogTypeLabel[value] ?? value,
  })),
)

const filterLogTypeOptions = computed(() => [
  { value: '', label: t('common.all') },
  ...logTypeOptions.value,
])

const { contentTemplates, logSourceForReuseMissing, insertContentSnippet, applyReuseMissing } =
  useVisaCaseLogFormAssist(tm, logs, editingLog, formModel)

const caseOptions = computed(() =>
  visaCases.value.map((c) => ({
    value: c.id,
    label: c.caseType
      ? `${formatVisaCaseTypeDisplay(c.caseType)} (${c.caseStatus})`
      : `#${c.id.slice(0, 8)} (${c.caseStatus})`,
  })),
)

const prefillPending = ref<VisaCaseLogPreFillData | null>(null)
const showPrefillHint = ref(false)

/** 深链自动打开新建表单仅执行一次，避免 replace query 后重复弹表单 */
const autoOpenCreateConsumed = ref(false)

watch(() => props.customerId, () => {
  autoOpenCreateConsumed.value = false
  if (props.customerId) {
    fetchVisaCases()
  }
}, { immediate: true })

watch(selectedCaseId, () => {
  if (selectedCaseId.value) {
    queryParams.page = 1
    fetchLogs()
    if (prefillPending.value && prefillPending.value.visaCaseId === selectedCaseId.value) {
      applyPreFill(prefillPending.value)
      prefillPending.value = null
    }
  } else {
    logs.value = []
    total.value = 0
  }
})

watch(() => props.preFillData, (data) => {
  if (!data) {return}
  if (visaCases.value.length === 0) {
    prefillPending.value = data
    return
  }
  if (data.visaCaseId && data.visaCaseId !== selectedCaseId.value) {
    prefillPending.value = data
    selectedCaseId.value = data.visaCaseId
    return
  }
  applyPreFill(data)
})

watch(
  () => props.preferredVisaCaseId,
  (id) => {
    const trimmed = id?.trim()
    if (!trimmed || visaCases.value.length === 0) {return}
    if (visaCases.value.some((c) => c.id === trimmed)) {
      selectedCaseId.value = trimmed
    }
  },
)

watch(
  () =>
    [
      selectedCaseId.value,
      casesLoading.value,
      props.autoOpenCreateForm,
      props.preferredVisaCaseId ?? '',
      props.suggestedNextFollowUpAt ?? '',
      canCreate.value,
    ] as const,
  ([caseId, loading, autoOpen, preferred, suggestedIso, canLog]) => {
    if (!autoOpen || loading || !caseId || autoOpenCreateConsumed.value) {
      return
    }
    const pref = preferred.trim()
    if (!pref || caseId !== pref) {
      return
    }
    autoOpenCreateConsumed.value = true
    if (!canLog) {
      stripVisaCaseLogDeepLinkQuery(route, router)
      ElMessage.warning(T('prefillDeniedNoCreate'))
      return
    }
    openCreateForm(suggestedIso.trim() || undefined)
    stripVisaCaseLogDeepLinkQuery(route, router)
  },
)

/**
 * 加载当前客户名下的签证案件供案件选择器使用，默认选中首条。
 *
 * @throws {Error} 签证案件列表接口请求失败时由请求层继续抛出
 */
async function fetchVisaCases(): Promise<void> {
  casesLoading.value = true
  try {
    const res = await getVisaCases(props.customerId, { page: 1, pageSize: 100 })
    visaCases.value = res.data.items
    if (prefillPending.value) {
      const target = res.data.items.find((c) => c.id === prefillPending.value!.visaCaseId)
      if (target) {
        selectedCaseId.value = target.id
        return
      }
    }
    const preferred = props.preferredVisaCaseId?.trim()
    if (preferred) {
      const preferredHit = res.data.items.find((c) => c.id === preferred)
      if (preferredHit) {
        selectedCaseId.value = preferredHit.id
        return
      }
    }
    if (res.data.items.length > 0 && !selectedCaseId.value) {
      selectedCaseId.value = res.data.items[0].id
    }
  } finally {
    casesLoading.value = false
  }
}

/**
 * 按当前选中案件与分页条件加载案件日志时间线。
 *
 * @throws {Error} 案件日志列表接口请求失败时由请求层继续抛出
 */
async function fetchLogs(): Promise<void> {
  if (!selectedCaseId.value) {return}
  loading.value = true
  try {
    const res = await getVisaCaseLogs(selectedCaseId.value, queryParams)
    logs.value = res.data.items
    total.value = res.data.total
  } finally {
    loading.value = false
  }
}

function handleCaseChange(): void {
  queryParams.page = 1
  queryParams.logType = undefined
  showForm.value = false
}

function handleFilterChange(logType: string): void {
  queryParams.logType = logType ? (logType as VisaCaseLogType) : undefined
  queryParams.page = 1
  fetchLogs()
}

function handlePageChange(page: number): void {
  queryParams.page = page
  fetchLogs()
}

/**
 * 打开新增日志表单，重置编辑态与默认日志类型。
 *
 * @param suggestedNextFollowUpIso - 可选，预填「下次跟进」的 ISO 串（多来自深链/案件行上的跟进建议）；仅写入表单，保存后落库在 **note** 的 `nextFollowUpAt`，与 **visa_cases.next_follow_up_at** 无自动同步。
 */
function openCreateForm(suggestedNextFollowUpIso?: string): void {
  if (!canCreate.value) {return}
  editingLog.value = null
  formModel.logType = VisaCaseLogType.GENERAL
  formModel.content = ''
  formModel.submittedItems = ''
  formModel.missingItems = ''
  formModel.nextAction = ''
  formModel.nextFollowUpAt = suggestedNextFollowUpIso
    ? formatIsoToDatetimeLocalPickerValue(suggestedNextFollowUpIso)
    : ''
  showForm.value = true
}

/**
 * 打开日志编辑表单，将当前日志内容回填到表单模型。
 *
 * @param log - 准备编辑的日志记录
 */
function openEditForm(log: VisaCaseLogItem): void {
  if (!canEdit.value) {return}
  editingLog.value = log
  formModel.logType = log.logType
  formModel.content = log.content
  formModel.submittedItems = log.submittedItems ?? ''
  formModel.missingItems = log.missingItems ?? ''
  formModel.nextAction = log.nextAction ?? ''
  formModel.nextFollowUpAt = log.nextFollowUpAt
    ? log.nextFollowUpAt.slice(0, 16)
    : ''
  showForm.value = true
}

/**
 * 从材料清单快照数据预填日志表单，由 preFillData watcher 调用。
 *
 * @param data - 包含日志类型、预填内容、已提交/缺失材料的快照数据
 */
function applyPreFill(data: VisaCaseLogPreFillData): void {
  if (!canCreate.value) {
    ElMessage.warning(T('prefillDeniedNoCreate'))
    emit('prefill-settled')
    return
  }
  editingLog.value = null
  formModel.logType = data.logType
  formModel.content = data.content
  formModel.submittedItems = data.submittedItems
  formModel.missingItems = data.missingItems
  formModel.nextAction = ''
  formModel.nextFollowUpAt = ''
  showPrefillHint.value = true
  showForm.value = true
  emit('prefill-settled')
  nextTick(() => {
    formCardRef.value?.clearValidate()
  })
}

/**
 * 关闭日志表单，重置编辑态与预填提示。
 */
function cancelForm(): void {
  showForm.value = false
  showPrefillHint.value = false
  editingLog.value = null
  formCardRef.value?.resetFields()
}

/**
 * 校验日志表单并提交新增或编辑请求，成功后刷新列表。
 *
 * 后端 `VisaCaseLogService` 仅 CRUD **notes**（含 `nextFollowUpAt`），不更新 **visa_cases**。
 * 客户详情顶栏与 `listPrimaryVisaCase` 使用的跟进日等字段来自 **案件行**（`GET /customers/:id` 同源 DISTINCT ON），
 * 故此处成功**无需**向父级触发 `visa-domain-customer-refresh`；若产品要求「写日志即刷新案件行跟进日」，需后端先落地同步再接线刷新。
 *
 * @throws {Error} 日志保存请求失败时由请求层统一提示并继续抛出
 */
async function handleSubmit(): Promise<void> {
  if (isEdit.value) {
    if (!canEdit.value) {return}
  } else if (!canCreate.value) {
    return
  }
  submitting.value = true
  try {
    const payload = {
      logType: formModel.logType,
      content: formModel.content,
      submittedItems: formModel.submittedItems || undefined,
      missingItems: formModel.missingItems || undefined,
      nextAction: formModel.nextAction || undefined,
      nextFollowUpAt: formModel.nextFollowUpAt
        ? new Date(formModel.nextFollowUpAt).toISOString()
        : undefined,
    }

    if (isEdit.value && editingLog.value) {
      await updateVisaCaseLog(selectedCaseId.value, editingLog.value.id, payload)
      ElMessage.success(T('updatedSuccess'))
    } else {
      await createVisaCaseLog(selectedCaseId.value, payload)
      ElMessage.success(T('createdSuccess'))
    }
    showPrefillHint.value = false
    cancelForm()
    queryParams.page = 1
    fetchLogs()
  } catch {
    // request interceptor handles the error
  } finally {
    submitting.value = false
  }
}

/**
 * 删除指定案件日志，成功后刷新时间线。
 *
 * @param log - 准备删除的日志记录
 * @throws {Error} 日志删除请求失败时由请求层统一提示并继续抛出
 */
async function handleDelete(log: VisaCaseLogItem): Promise<void> {
  if (!canDelete.value) {return}
  const confirmed = await confirmDelete(T('logDeleteName'))
  if (!confirmed) {return}

  try {
    await deleteVisaCaseLog(selectedCaseId.value, log.id)
    ElMessage.success(T('deletedSuccess'))
    fetchLogs()
  } catch {
    // request interceptor handles the error
  }
}
</script>

<template>
  <div class="case-logs-tab">
    <div class="case-logs-tab__case-selector">
      <el-select v-model="selectedCaseId" :placeholder="T('selectCase')" :loading="casesLoading" style="width: 320px" @change="handleCaseChange">
        <el-option v-for="opt in caseOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
      </el-select>
    </div>
    <el-alert
      type="info"
      :closable="false"
      show-icon
      class="case-logs-tab__trace-alert"
    >
      <template #title>{{ T("traceabilityBannerTitle") }}</template>
      <p class="case-logs-tab__trace-alert__body">
        {{ T("traceabilityBannerBody") }}
      </p>
      <el-button type="primary" link @click="goCustomerNotesTab">
        {{ t("detailViews.customer.traceabilityHint.goNotes") }}
      </el-button>
    </el-alert>
    <el-empty v-if="!casesLoading && visaCases.length === 0" :description="t('detailViews.customer.visaCasesTab.empty')" />

    <template v-if="selectedCaseId">
      <div class="case-logs-tab__toolbar">
        <div class="case-logs-tab__filter">
          <el-select :model-value="queryParams.logType ?? ''" :placeholder="T('filterPlaceholder')" size="default" style="width: 160px" @change="handleFilterChange">
            <el-option v-for="opt in filterLogTypeOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
          </el-select>
          <span class="case-logs-tab__count">{{ T('countLabel', { count: total }) }}</span>
        </div>
        <el-button v-if="canCreate" type="primary" @click="openCreateForm()">{{ T('add') }}</el-button>
      </div>

      <CustomerVisaCaseLogsFormCard
        v-if="showForm"
        ref="formCardRef"
        v-model="formModel"
        v-model:show-prefill-hint="showPrefillHint"
        :form-rules="formRules"
        :is-edit="isEdit"
        :content-templates="contentTemplates"
        :log-source-for-reuse-missing="logSourceForReuseMissing"
        :submitting="submitting"
        :insert-content-snippet="insertContentSnippet"
        :apply-reuse-missing="applyReuseMissing"
        @cancel="cancelForm"
        @submit="handleSubmit"
      />

      <CustomerVisaCaseLogsTimeline
        :loading="loading"
        :logs="logs"
        :total="total"
        :page="queryParams.page ?? 1"
        :page-size="queryParams.pageSize ?? 20"
        :format-date-time="formatDateTime"
        :can-edit="canEdit"
        :can-delete="canDelete"
        @edit="openEditForm"
        @delete="handleDelete"
        @page-change="handlePageChange"
      />
    </template>
  </div>
</template>

<style scoped lang="scss" src="./CustomerVisaCaseLogsTab.scoped.scss"></style>
