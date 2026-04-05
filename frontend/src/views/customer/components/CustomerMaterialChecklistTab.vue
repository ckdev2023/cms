<script setup lang="ts">
/* eslint-disable max-lines -- 材料 checklist 与摘要写回同页承载，超过默认行数上限；后续可拆区块型子组件时再收紧 */
import { InfoFilled } from '@element-plus/icons-vue'
import axios from 'axios'
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import {
  createVisaCaseMaterialItem,
  deleteVisaCaseMaterialItem,
  getFamilyMembers,
  getVisaCaseMaterials,
  getVisaCaseMaterialSummary,
  getVisaCases,
  initializeVisaCaseMaterials,
  syncVisaCaseMaterialStatus,
  updateVisaCaseMaterialItem,
} from '@/api/visa-case'
import { MaterialItemStatusLabel, MaterialStatusLabel } from '@/constants/enum-labels'
import { MaterialItemStatus, MaterialStatus, VisaCaseLogType } from '@/constants/enums'
import { P } from '@/constants/permissions'
import { useUserStore } from '@/stores/user'
import type {
  CreateVisaCaseMaterialItemParams,
  MaterialSummary,
  VisaCaseFamilyMemberItem,
  VisaCaseItem,
  VisaCaseLogPreFillData,
  VisaCaseMaterialItemDetail,
} from '@/types/visa-case'
import { pickApiErrorMessage } from '@/utils/api-error-message'
import { useLocaleFormatter } from '@/utils/locale-format'
import { formatVisaCaseTypeDisplay } from '@/utils/visa-case-type-display'

const props = defineProps<{
  customerId: string
  /** 客户详情 query `materialsVisaCaseId`：案件列表就绪后优先选中该案（消费后从 URL 剥离） */
  preferredMaterialsVisaCaseId?: string
}>()

const emit = defineEmits<{
  (e: 'material-status-synced', visaCaseId: string, newStatus: string): void
  (e: 'write-log', data: VisaCaseLogPreFillData): void
}>()

defineOptions({ name: 'CustomerMaterialChecklistTab' })

const route = useRoute()
const router = useRouter()
const { t } = useI18n({ useScope: 'global' })
const { formatDate } = useLocaleFormatter()
const userStore = useUserStore()
const T = (key: string, params?: Record<string, unknown>) =>
  t(`detailViews.customer.materialChecklistTab.${key}`, params ?? {})

const canEdit = computed(() => userStore.hasPermission(P.VISA_CASE_EDIT))
/** 将材料快照写入案件日志需「案件日志新建」权限，与材料编辑权解耦 */
const canWriteCaseLog = computed(() => userStore.hasPermission(P.VISA_CASE_LOG_CREATE))

const casesLoading = ref(false)
const visaCases = ref<VisaCaseItem[]>([])
const selectedCaseId = ref('')

const materialsLoading = ref(false)
const materials = ref<VisaCaseMaterialItemDetail[]>([])
const summary = ref<MaterialSummary | null>(null)
const initializing = ref(false)
const syncing = ref(false)

/** 材料项写回失败时在摘要区展示的就地错误文案 */
const materialMutationError = ref('')

const updatingItems = reactive(new Set<string>())

const familyMembers = ref<VisaCaseFamilyMemberItem[]>([])

const addDialogVisible = ref(false)
const addItemLoading = ref(false)
const addForm = reactive<CreateVisaCaseMaterialItemParams>({
  groupName: '',
  itemName: '',
  remark: '',
  visaCaseFamilyMemberId: undefined,
})

const remarkDialogVisible = ref(false)
const remarkEditItemId = ref('')
const remarkEditValue = ref('')
const remarkSaving = ref(false)

interface MaterialGroup {
  groupName: string
  items: VisaCaseMaterialItemDetail[]
}

interface MemberSection {
  memberId: string | null
  memberName: string
  groups: MaterialGroup[]
}

const caseOptions = computed(() =>
  visaCases.value.map((c) => ({
    value: c.id,
    label: c.caseType
      ? `${formatVisaCaseTypeDisplay(c.caseType)} (${c.caseStatus})`
      : `#${c.id.slice(0, 8)} (${c.caseStatus})`,
  })),
)

/**
 * 将扁平材料列表按案件级/成员级分组，再按 groupName 子分组排列。
 *
 * @returns 按展示顺序排列的成员分区列表
 */
const sections = computed<MemberSection[]>(() => {
  if (materials.value.length === 0) {return []}

  const caseItems = materials.value.filter((m) => !m.visaCaseFamilyMemberId)
  const memberMap = new Map<string, VisaCaseMaterialItemDetail[]>()

  for (const m of materials.value) {
    if (m.visaCaseFamilyMemberId) {
      const key = m.visaCaseFamilyMemberId
      if (!memberMap.has(key)) {memberMap.set(key, [])}
      memberMap.get(key)!.push(m)
    }
  }

  const result: MemberSection[] = []

  if (caseItems.length > 0) {
    result.push({
      memberId: null,
      memberName: T('caseLevelGroup'),
      groups: buildGroups(caseItems),
    })
  }

  for (const [memberId, items] of memberMap) {
    const firstName = items[0]?.familyMemberName
    const name = firstName
      ? T('memberGroup', { name: firstName })
      : T('memberGroup', { name: memberId.slice(0, 8) })
    result.push({
      memberId,
      memberName: name,
      groups: buildGroups(items),
    })
  }

  return result
})

const hasMaterials = computed(() => materials.value.length > 0)

const summaryProgressPercent = computed(() => {
  if (!summary.value || summary.value.total === 0) {return 0}
  const applicable = summary.value.total - summary.value.notApplicable
  if (applicable === 0) {return 100}
  return Math.round((summary.value.collected / applicable) * 100)
})

const suggestedStatusLabel = computed(() => {
  if (!summary.value) {return ''}
  return MaterialStatusLabel[summary.value.suggestedStatus as MaterialStatus]
    ?? summary.value.suggestedStatus
})

const currentStatusLabel = computed(() => {
  if (!summary.value?.currentStatus) {return ''}
  return MaterialStatusLabel[summary.value.currentStatus as MaterialStatus]
    ?? summary.value.currentStatus
})

const isStatusMismatch = computed(() => {
  if (!summary.value) {return false}
  return summary.value.currentStatus !== summary.value.suggestedStatus
})

/**
 * 为案件当前持久化状态选择 Tag 类型，与建议状态不一致时标红警示。
 *
 * @returns Element Plus Tag 的 type 属性值
 */
const currentStatusTagType = computed<'success' | 'warning' | 'danger' | 'info'>(() => {
  if (!summary.value?.currentStatus) {return 'info'}
  if (isStatusMismatch.value) {return 'danger'}
  switch (summary.value.currentStatus) {
    case MaterialStatus.COMPLETE: return 'success'
    case MaterialStatus.PARTIAL: return 'warning'
    default: return 'info'
  }
})

/**
 * 提取已有材料项的分组名去重列表，用于新增材料项对话框的自动补全。
 *
 * @returns 去重后的分组名数组
 */
const existingGroupNames = computed(() => {
  const names = new Set<string>()
  for (const m of materials.value) {
    names.add(m.groupName)
  }
  return [...names]
})

watch(
  () => props.customerId,
  () => {
    if (props.customerId) {fetchVisaCases()}
  },
  { immediate: true },
)

watch(selectedCaseId, () => {
  materialMutationError.value = ''
  if (selectedCaseId.value) {
    void fetchMaterials()
    void fetchFamilyMembers()
  } else {
    materials.value = []
    summary.value = null
    familyMembers.value = []
  }
})

/**
 * 材料清单深链已应用选中案件后，从路由 query 移除 `materialsVisaCaseId`，避免刷新或返回时重复解析。
 */
function stripMaterialsVisaCaseIdFromUrl(): void {
  const q = { ...route.query } as Record<string, string | string[] | undefined>
  if (q.materialsVisaCaseId === undefined) {return}
  delete q.materialsVisaCaseId
  void router.replace({ path: route.path, query: q })
}

watch(canEdit, (ok) => {
  if (!ok) {
    addDialogVisible.value = false
    remarkDialogVisible.value = false
  }
})

/**
 * 加载当前客户名下的签证案件供选择器使用，默认选中首条。
 *
 * @throws {Error} 签证案件列表接口请求失败时由请求层继续抛出
 */
async function fetchVisaCases(): Promise<void> {
  casesLoading.value = true
  selectedCaseId.value = ''
  try {
    const res = await getVisaCases(props.customerId, { page: 1, pageSize: 100 })
    const items = res.data.items
    visaCases.value = items
    const pref = props.preferredMaterialsVisaCaseId?.trim()
    if (pref) {
      if (items.some((c) => c.id === pref)) {
        selectedCaseId.value = pref
      }
      stripMaterialsVisaCaseIdFromUrl()
    }
    if (!selectedCaseId.value && items.length > 0) {
      selectedCaseId.value = items[0].id
    }
  } finally {
    casesLoading.value = false
  }
}

/**
 * 并行加载选中案件的材料列表与统计摘要。
 *
 * @throws {Error} 材料接口请求失败时由请求层继续抛出
 */
async function fetchMaterials(): Promise<void> {
  if (!selectedCaseId.value) {return}
  materialsLoading.value = true
  try {
    const [matRes, sumRes] = await Promise.all([
      getVisaCaseMaterials(selectedCaseId.value),
      getVisaCaseMaterialSummary(selectedCaseId.value),
    ])
    materials.value = matRes.data
    summary.value = sumRes.data
  } finally {
    materialsLoading.value = false
  }
}

/**
 * 加载选中案件的家属成员列表，供新增材料项对话框中选择归属。
 */
async function fetchFamilyMembers(): Promise<void> {
  if (!selectedCaseId.value) {return}
  try {
    const res = await getFamilyMembers(selectedCaseId.value)
    familyMembers.value = res.data
  } catch {
    familyMembers.value = []
  }
}

/**
 * 从模板初始化当前案件的材料清单，成功后刷新列表。
 *
 * @throws {Error} 初始化接口请求失败时由请求层统一提示并继续抛出
 */
async function handleInitialize(): Promise<void> {
  if (!canEdit.value || !selectedCaseId.value) {return}
  initializing.value = true
  try {
    await initializeVisaCaseMaterials(selectedCaseId.value)
    ElMessage.success(T('initializeSuccess'))
    await fetchMaterials()
  } catch {
    // request interceptor handles the error
  } finally {
    initializing.value = false
  }
}

function handleCaseChange(): void {
  materials.value = []
  summary.value = null
  familyMembers.value = []
}

/**
 * 切换材料项收集状态：NOT_COLLECTED ↔ COLLECTED，乐观更新后回写 API。
 *
 * @param item - 目标材料项
 */
async function handleToggleCollected(item: VisaCaseMaterialItemDetail): Promise<void> {
  if (!canEdit.value || updatingItems.has(item.id)) {return}
  const newStatus = item.itemStatus === MaterialItemStatus.COLLECTED
    ? MaterialItemStatus.NOT_COLLECTED
    : MaterialItemStatus.COLLECTED
  await handleUpdateStatus(item, newStatus)
}

/**
 * 将材料项标记为指定状态，更新 API 并刷新摘要。
 *
 * @param item - 目标材料项
 * @param newStatus - 目标状态
 */
async function handleUpdateStatus(
  item: VisaCaseMaterialItemDetail,
  newStatus: MaterialItemStatus,
): Promise<void> {
  if (!canEdit.value || updatingItems.has(item.id)) {return}
  const oldStatus = item.itemStatus
  const oldCollectedAt = item.collectedAt

  item.itemStatus = newStatus
  if (newStatus === MaterialItemStatus.COLLECTED) {
    item.collectedAt = new Date().toISOString()
  } else {
    item.collectedAt = null
  }

  updatingItems.add(item.id)
  try {
    const res = await updateVisaCaseMaterialItem(selectedCaseId.value, item.id, {
      itemStatus: newStatus,
    })
    Object.assign(item, res.data)
    materialMutationError.value = ''
    await refreshSummary()
  } catch (e: unknown) {
    item.itemStatus = oldStatus
    item.collectedAt = oldCollectedAt
    const msg = pickApiErrorMessage(e)
    materialMutationError.value =
      msg || T('itemUpdateFailedGeneric', { name: item.itemName })
    if (axios.isAxiosError(e) && e.response?.status === 403) {
      materialMutationError.value = T('itemUpdateFailedForbidden')
    }
  } finally {
    updatingItems.delete(item.id)
  }
}

/**
 * 打开备注编辑对话框并预填当前值。
 *
 * @param item - 目标材料项
 */
function openRemarkDialog(item: VisaCaseMaterialItemDetail): void {
  if (!canEdit.value) {return}
  remarkEditItemId.value = item.id
  remarkEditValue.value = item.remark ?? ''
  remarkDialogVisible.value = true
}

/**
 * 提交备注修改并更新列表中对应项。
 */
async function handleSaveRemark(): Promise<void> {
  if (!canEdit.value || !remarkEditItemId.value) {return}
  remarkSaving.value = true
  try {
    const res = await updateVisaCaseMaterialItem(
      selectedCaseId.value,
      remarkEditItemId.value,
      { remark: remarkEditValue.value },
    )
    const idx = materials.value.findIndex((m) => m.id === remarkEditItemId.value)
    if (idx >= 0) {Object.assign(materials.value[idx], res.data)}
    ElMessage.success(T('updateSuccess'))
    remarkDialogVisible.value = false
  } catch {
    // request interceptor handles the error
  } finally {
    remarkSaving.value = false
  }
}

/**
 * 打开新增材料项对话框并重置表单。
 */
function openAddDialog(): void {
  if (!canEdit.value) {return}
  addForm.groupName = existingGroupNames.value[0] ?? ''
  addForm.itemName = ''
  addForm.remark = ''
  addForm.visaCaseFamilyMemberId = undefined
  addDialogVisible.value = true
}

/**
 * 提交新增材料项并刷新列表与摘要。
 */
async function handleAddItem(): Promise<void> {
  if (!canEdit.value || !addForm.groupName || !addForm.itemName) {return}
  addItemLoading.value = true
  try {
    await createVisaCaseMaterialItem(selectedCaseId.value, {
      groupName: addForm.groupName,
      itemName: addForm.itemName,
      remark: addForm.remark || undefined,
      visaCaseFamilyMemberId: addForm.visaCaseFamilyMemberId || undefined,
    })
    ElMessage.success(T('createSuccess'))
    addDialogVisible.value = false
    await fetchMaterials()
  } catch {
    // request interceptor handles the error
  } finally {
    addItemLoading.value = false
  }
}

/**
 * 确认后删除手动新增的材料项（模板来源项不可删除）。
 *
 * @param item - 目标材料项
 */
async function handleDeleteItem(item: VisaCaseMaterialItemDetail): Promise<void> {
  if (!canEdit.value) {return}
  try {
    await ElMessageBox.confirm(T('deleteConfirm'), {
      confirmButtonText: t('common.confirm'),
      cancelButtonText: t('common.cancel'),
      type: 'warning',
    })
  } catch {
    return
  }

  updatingItems.add(item.id)
  try {
    await deleteVisaCaseMaterialItem(selectedCaseId.value, item.id)
    ElMessage.success(T('deleteSuccess'))
    await fetchMaterials()
  } catch {
    // request interceptor handles the error
  } finally {
    updatingItems.delete(item.id)
  }
}

/**
 * 将 checklist 建议的 material_status 同步写入案件表，并通知父组件刷新。
 */
async function handleSyncStatus(): Promise<void> {
  if (!canEdit.value || !selectedCaseId.value || syncing.value) {return}
  syncing.value = true
  try {
    const res = await syncVisaCaseMaterialStatus(selectedCaseId.value)
    summary.value = res.data
    ElMessage.success(T('syncStatusSuccess'))
    emit('material-status-synced', selectedCaseId.value, res.data.suggestedStatus)
  } catch {
    // request interceptor handles the error
  } finally {
    syncing.value = false
  }
}

/**
 * 从当前材料清单生成已提交/缺失快照文本，通知父组件跳转到日志表单预填。
 */
function handleWriteLog(): void {
  if (!canWriteCaseLog.value || !selectedCaseId.value || materials.value.length === 0) {return}

  const collected = materials.value
    .filter((m) => m.itemStatus === MaterialItemStatus.COLLECTED)
    .map((m) => m.itemName)
  const notCollected = materials.value
    .filter((m) => m.itemStatus === MaterialItemStatus.NOT_COLLECTED)
    .map((m) => m.itemName)

  const applicable = materials.value.filter(
    (m) => m.itemStatus !== MaterialItemStatus.NOT_APPLICABLE,
  ).length
  const contentLine = `${T('summaryCount', { collected: collected.length, total: applicable })}`

  const logType = notCollected.length > 0
    ? VisaCaseLogType.SUPPLEMENT
    : VisaCaseLogType.SUBMISSION

  emit('write-log', {
    visaCaseId: selectedCaseId.value,
    logType,
    content: contentLine,
    submittedItems: collected.join('\n'),
    missingItems: notCollected.join('\n'),
  })
}

/**
 * 将单条未收集材料项写入案件日志预填：补件类型、正文说明与缺失字段仅含该项名称。
 *
 * @param item - 当前为 NOT_COLLECTED 的材料项
 */
function emitLogForSingleMissingItem(item: VisaCaseMaterialItemDetail): void {
  if (!canWriteCaseLog.value || !canEdit.value || !selectedCaseId.value) {return}
  emit('write-log', {
    visaCaseId: selectedCaseId.value,
    logType: VisaCaseLogType.SUPPLEMENT,
    content: T('singleMissingLogContent', { name: item.itemName }),
    submittedItems: '',
    missingItems: item.itemName,
  })
}

/**
 * 仅刷新摘要统计（状态变更后轻量更新，无需重载全列表）。
 */
async function refreshSummary(): Promise<void> {
  if (!selectedCaseId.value) {return}
  try {
    const res = await getVisaCaseMaterialSummary(selectedCaseId.value)
    summary.value = res.data
  } catch {
    // silent
  }
}

/**
 * 将材料项按 groupName 聚合并按 sortOrder 排序，返回分组列表。
 *
 * @param items - 待分组的材料项列表
 * @returns 按分组名称聚合后的材料分组数组
 */
function buildGroups(items: VisaCaseMaterialItemDetail[]): MaterialGroup[] {
  const map = new Map<string, VisaCaseMaterialItemDetail[]>()
  for (const item of items) {
    const key = item.groupName
    if (!map.has(key)) {map.set(key, [])}
    map.get(key)!.push(item)
  }
  const groups: MaterialGroup[] = []
  for (const [groupName, groupItems] of map) {
    groups.push({
      groupName,
      items: groupItems.sort((a, b) => a.sortOrder - b.sortOrder),
    })
  }
  return groups
}

/**
 * 根据材料项收集状态返回对应的 Element Plus Tag 类型。
 *
 * @param status - 材料项状态枚举值
 * @returns Tag 组件的 type 属性值
 */
function statusTagType(status: string): 'success' | 'warning' | 'info' {
  switch (status) {
    case 'COLLECTED': return 'success'
    case 'NOT_COLLECTED': return 'warning'
    case 'NOT_APPLICABLE': return 'info'
    default: return 'info'
  }
}

function statusLabel(status: string): string {
  return MaterialItemStatusLabel[status as MaterialItemStatus] ?? status
}

function progressColor(percent: number): string {
  if (percent >= 100) {return 'var(--el-color-success)'}
  if (percent >= 50) {return 'var(--el-color-primary)'}
  return 'var(--el-color-warning)'
}
</script>

<template>
  <div class="material-checklist-tab">
    <el-collapse class="material-checklist-tab__manager-help">
      <el-collapse-item name="manager-help">
        <template #title>
          <span class="material-checklist-tab__manager-help-title">
            <el-icon
              class="material-checklist-tab__manager-help-icon"
              aria-hidden="true"
            >
              <InfoFilled />
            </el-icon>
            {{ T('managerHelpTitle') }}
          </span>
        </template>
        <ul class="material-checklist-tab__manager-help-list">
          <li>{{ T('managerHelpP1') }}</li>
          <li>{{ T('managerHelpP2') }}</li>
          <li>{{ T('managerHelpP3') }}</li>
          <li>{{ T('managerHelpP4') }}</li>
        </ul>
      </el-collapse-item>
    </el-collapse>

    <div class="material-checklist-tab__toolbar">
      <el-select
        v-model="selectedCaseId"
        :placeholder="T('selectCase')"
        :loading="casesLoading"
        style="width: 320px"
        @change="handleCaseChange"
      >
        <el-option
          v-for="opt in caseOptions"
          :key="opt.value"
          :label="opt.label"
          :value="opt.value"
        />
      </el-select>

      <div
        v-if="selectedCaseId && hasMaterials && (canEdit || canWriteCaseLog)"
        class="material-checklist-tab__actions"
      >
        <el-button v-if="canEdit" size="small" @click="openAddDialog">
          <el-icon class="el-icon--left"><i class="el-icon-plus" /></el-icon>
          {{ T('addItem') }}
        </el-button>
        <el-tooltip v-if="canWriteCaseLog" :content="T('writeLogTooltip')" placement="top">
          <el-button size="small" @click="handleWriteLog">
            {{ T('writeLog') }}
          </el-button>
        </el-tooltip>
        <el-button
          v-if="canEdit"
          size="small"
          type="primary"
          :loading="syncing"
          @click="handleSyncStatus"
        >
          {{ syncing ? T('syncing') : T('syncStatus') }}
        </el-button>
      </div>
    </div>

    <el-empty
      v-if="!casesLoading && visaCases.length === 0"
      :description="t('detailViews.customer.visaCasesTab.empty')"
    />

    <template v-if="selectedCaseId">
      <div v-loading="materialsLoading" class="material-checklist-tab__content">
        <!-- Summary bar -->
        <div v-if="summary && hasMaterials" class="material-checklist-tab__summary">
          <div class="material-checklist-tab__summary-stats">
            <span class="material-checklist-tab__summary-label">{{ T('summaryLabel') }}</span>
            <span class="material-checklist-tab__summary-count">
              {{ T('summaryCount', { collected: summary.collected, total: summary.total - summary.notApplicable }) }}
            </span>
            <el-tag v-if="summary.notApplicable > 0" size="small" type="info">
              {{ T('notApplicableCount', { count: summary.notApplicable }) }}
            </el-tag>
          </div>
          <div class="material-checklist-tab__summary-right">
            <el-progress
              :percentage="summaryProgressPercent"
              :stroke-width="8"
              :color="progressColor(summaryProgressPercent)"
              class="material-checklist-tab__progress"
            />
            <div class="material-checklist-tab__status-bridge">
              <div class="material-checklist-tab__status-row">
                <span class="material-checklist-tab__status-label">{{ T('currentStatus') }}:</span>
                <el-tag v-if="currentStatusLabel" size="small" :type="currentStatusTagType">
                  {{ currentStatusLabel }}
                </el-tag>
                <span v-else class="material-checklist-tab__status-empty">-</span>
              </div>
              <div class="material-checklist-tab__status-row">
                <span class="material-checklist-tab__status-label">{{ T('suggestedStatus') }}:</span>
                <el-tag size="small">{{ suggestedStatusLabel }}</el-tag>
              </div>
              <el-tooltip
                v-if="isStatusMismatch"
                :content="T('statusMismatch')"
                placement="top"
              >
                <el-tag
                  size="small"
                  type="warning"
                  effect="light"
                  class="material-checklist-tab__mismatch-badge"
                >
                  ⚠
                </el-tag>
              </el-tooltip>
            </div>
          </div>
          <el-alert
            v-if="materialMutationError"
            class="material-checklist-tab__mutation-alert"
            type="error"
            closable
            show-icon
            :title="materialMutationError"
            @close="materialMutationError = ''"
          />
        </div>

        <!-- Empty state with initialize option -->
        <div v-if="!materialsLoading && !hasMaterials" class="material-checklist-tab__empty">
          <el-empty :description="T('empty')">
            <template v-if="canEdit" #default>
              <p class="material-checklist-tab__init-hint">{{ T('initializeHint') }}</p>
              <div class="material-checklist-tab__init-actions">
                <el-button
                  type="primary"
                  :loading="initializing"
                  @click="handleInitialize"
                >
                  {{ initializing ? T('initializing') : T('initialize') }}
                </el-button>
                <el-button @click="openAddDialog">
                  {{ T('addItem') }}
                </el-button>
              </div>
            </template>
          </el-empty>
        </div>

        <!-- Grouped checklist -->
        <div v-if="hasMaterials" class="material-checklist-tab__sections">
          <div
            v-for="section in sections"
            :key="section.memberId ?? '__case__'"
            class="material-checklist-tab__section"
          >
            <div class="material-checklist-tab__section-header">
              <h4 class="material-checklist-tab__section-title">{{ section.memberName }}</h4>
            </div>

            <div
              v-for="group in section.groups"
              :key="group.groupName"
              class="material-checklist-tab__group"
            >
              <div class="material-checklist-tab__group-header">
                {{ group.groupName }}
              </div>
              <div class="material-checklist-tab__items">
                <div
                  v-for="item in group.items"
                  :key="item.id"
                  class="material-checklist-tab__item"
                  :class="{
                    'material-checklist-tab__item--collected': item.itemStatus === 'COLLECTED',
                    'material-checklist-tab__item--na': item.itemStatus === 'NOT_APPLICABLE',
                  }"
                >
                  <div class="material-checklist-tab__item-main">
                    <div class="material-checklist-tab__item-left">
                      <el-checkbox
                        v-if="canEdit"
                        :model-value="item.itemStatus === 'COLLECTED'"
                        :disabled="item.itemStatus === 'NOT_APPLICABLE' || updatingItems.has(item.id)"
                        :loading="updatingItems.has(item.id)"
                        class="material-checklist-tab__checkbox"
                        @change="handleToggleCollected(item)"
                      />
                      <span class="material-checklist-tab__item-name">{{ item.itemName }}</span>
                      <el-tag
                        v-if="!item.templateItemId"
                        size="small"
                        type="info"
                        class="material-checklist-tab__manual-tag"
                      >
                        {{ T('manualItem') }}
                      </el-tag>
                    </div>
                    <div class="material-checklist-tab__item-right">
                      <el-tag size="small" :type="statusTagType(item.itemStatus)">
                        {{ statusLabel(item.itemStatus) }}
                      </el-tag>
                      <template v-if="canEdit">
                        <el-dropdown
                          trigger="click"
                          :disabled="updatingItems.has(item.id)"
                          @command="(cmd: string) => handleUpdateStatus(item, cmd as MaterialItemStatus)"
                        >
                          <el-button
                            text
                            size="small"
                            :loading="updatingItems.has(item.id)"
                            class="material-checklist-tab__more-btn"
                          >
                            <el-icon><i class="el-icon-more" /></el-icon>
                          </el-button>
                          <template #dropdown>
                            <el-dropdown-menu>
                              <el-dropdown-item
                                v-if="item.itemStatus !== 'COLLECTED'"
                                command="COLLECTED"
                              >
                                {{ T('markCollected') }}
                              </el-dropdown-item>
                              <el-dropdown-item
                                v-if="item.itemStatus !== 'NOT_COLLECTED'"
                                command="NOT_COLLECTED"
                              >
                                {{ T('markNotCollected') }}
                              </el-dropdown-item>
                              <el-dropdown-item
                                v-if="item.itemStatus !== 'NOT_APPLICABLE'"
                                command="NOT_APPLICABLE"
                              >
                                {{ T('markNotApplicable') }}
                              </el-dropdown-item>
                              <el-dropdown-item
                                v-if="item.itemStatus === 'NOT_COLLECTED' && canWriteCaseLog"
                                divided
                                @click.stop="emitLogForSingleMissingItem(item)"
                              >
                                {{ T('recordSingleMissingToLog') }}
                              </el-dropdown-item>
                              <el-dropdown-item divided @click.stop="openRemarkDialog(item)">
                                {{ T('editRemark') }}
                              </el-dropdown-item>
                              <el-dropdown-item
                                v-if="!item.templateItemId"
                                divided
                                @click.stop="handleDeleteItem(item)"
                              >
                                <span class="material-checklist-tab__delete-text">
                                  {{ T('deleteItem') }}
                                </span>
                              </el-dropdown-item>
                            </el-dropdown-menu>
                          </template>
                        </el-dropdown>
                      </template>
                    </div>
                  </div>
                  <div
                    v-if="item.remark || item.collectedAt"
                    class="material-checklist-tab__item-meta"
                  >
                    <span v-if="item.collectedAt" class="material-checklist-tab__meta-item">
                      {{ T('collectedAtLabel') }}: {{ formatDate(item.collectedAt) }}
                    </span>
                    <span v-if="item.remark" class="material-checklist-tab__meta-item">
                      {{ T('remarkLabel') }}: {{ item.remark }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- Add item dialog -->
    <el-dialog
      v-model="addDialogVisible"
      :title="T('addItemDialog.title')"
      width="480px"
      destroy-on-close
    >
      <el-form label-position="top">
        <el-form-item :label="T('addItemDialog.groupName')" required>
          <el-autocomplete
            v-model="addForm.groupName"
            :fetch-suggestions="(_q: string, cb: (suggestions: { value: string }[]) => void) => cb(existingGroupNames.map(n => ({ value: n })))"
            :placeholder="T('addItemDialog.groupNamePlaceholder')"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item :label="T('addItemDialog.itemName')" required>
          <el-input
            v-model="addForm.itemName"
            :placeholder="T('addItemDialog.itemNamePlaceholder')"
          />
        </el-form-item>
        <el-form-item
          v-if="familyMembers.length > 0"
          :label="T('addItemDialog.familyMember')"
        >
          <el-select
            v-model="addForm.visaCaseFamilyMemberId"
            :placeholder="T('addItemDialog.familyMemberPlaceholder')"
            clearable
            style="width: 100%"
          >
            <el-option
              v-for="fm in familyMembers"
              :key="fm.id"
              :label="fm.displayNameSnapshot"
              :value="fm.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item :label="T('addItemDialog.remark')">
          <el-input
            v-model="addForm.remark"
            type="textarea"
            :rows="2"
            :placeholder="T('addItemDialog.remarkPlaceholder')"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="addDialogVisible = false">
          {{ t('common.cancel') }}
        </el-button>
        <el-button
          type="primary"
          :loading="addItemLoading"
          :disabled="!addForm.groupName || !addForm.itemName"
          @click="handleAddItem"
        >
          {{ t('common.confirm') }}
        </el-button>
      </template>
    </el-dialog>

    <!-- Remark edit dialog -->
    <el-dialog
      v-model="remarkDialogVisible"
      :title="T('remarkDialog.title')"
      width="440px"
      destroy-on-close
    >
      <el-input
        v-model="remarkEditValue"
        type="textarea"
        :rows="3"
        :placeholder="T('remarkDialog.placeholder')"
      />
      <template #footer>
        <el-button @click="remarkDialogVisible = false">
          {{ t('common.cancel') }}
        </el-button>
        <el-button
          type="primary"
          :loading="remarkSaving"
          @click="handleSaveRemark"
        >
          {{ t('common.confirm') }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.material-checklist-tab {
  &__manager-help {
    margin-bottom: 12px;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 6px;
    overflow: hidden;

    :deep(.el-collapse-item__header) {
      font-size: var(--el-font-size-base);
      font-weight: 600;
      color: var(--el-text-color-primary);
      padding: 0 12px;
    }

    :deep(.el-collapse-item__content) {
      padding-bottom: 12px;
    }
  }

  &__manager-help-title {
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }

  &__manager-help-icon {
    flex-shrink: 0;
    font-size: 16px;
    color: var(--el-color-info);
  }

  &__manager-help-list {
    margin: 0;
    padding: 0 4px 0 22px;
    font-size: var(--app-font-size-sm);
    color: var(--app-text-secondary);
    line-height: 1.6;

    li {
      margin-bottom: 8px;
      padding-left: 2px;

      &:last-child {
        margin-bottom: 0;
      }
    }
  }

  &__toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 16px;
    flex-wrap: wrap;
  }

  &__actions {
    display: flex;
    gap: 8px;
  }

  &__content {
    min-height: 120px;
  }

  &__summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 12px 16px;
    margin-bottom: 16px;
    background: var(--el-fill-color-lighter);
    border-radius: 6px;
    flex-wrap: wrap;
  }

  &__summary-stats {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  &__summary-label {
    font-size: var(--app-font-size-sm);
    color: var(--app-text-secondary);
    font-weight: 500;
  }

  &__summary-count {
    font-size: 15px;
    font-weight: 600;
    color: var(--app-text-primary);
  }

  &__summary-right {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  &__progress {
    width: 120px;
  }

  &__status-bridge {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  &__status-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  &__status-label {
    font-size: var(--app-font-size-xs);
    color: var(--app-text-secondary);
    white-space: nowrap;
  }

  &__status-empty {
    font-size: var(--app-font-size-xs);
    color: var(--el-text-color-placeholder);
  }

  &__mismatch-badge {
    cursor: help;
  }

  &__mutation-alert {
    flex: 1 1 100%;
    margin-top: 4px;
  }

  &__empty {
    padding: 24px 0;
  }

  &__init-hint {
    font-size: var(--app-font-size-sm);
    color: var(--app-text-secondary);
    margin-bottom: 12px;
  }

  &__init-actions {
    display: flex;
    gap: 8px;
  }

  &__sections {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  &__section {
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 6px;
    overflow: hidden;
  }

  &__section-header {
    padding: 10px 16px;
    background: var(--el-fill-color-light);
    border-bottom: 1px solid var(--el-border-color-lighter);
  }

  &__section-title {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--app-text-primary);
  }

  &__group {
    &:not(:last-child) {
      border-bottom: 1px solid var(--el-border-color-extra-light);
    }
  }

  &__group-header {
    padding: 8px 16px;
    font-size: var(--app-font-size-sm);
    font-weight: 500;
    color: var(--el-color-primary);
    background: var(--el-fill-color-extra-light);
  }

  &__items {
    padding: 0;
  }

  &__item {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 8px 16px;
    transition: background-color 0.15s;

    &:not(:last-child) {
      border-bottom: 1px dashed var(--el-border-color-extra-light);
    }

    &:hover {
      background: var(--el-fill-color-extra-light);
    }

    &--collected {
      .material-checklist-tab__item-name {
        color: var(--el-color-success);
        text-decoration: line-through;
        text-decoration-color: var(--el-color-success-light-5);
      }
    }

    &--na {
      opacity: 0.55;
    }
  }

  &__item-main {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    min-height: 28px;
  }

  &__item-left {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    min-width: 0;
  }

  &__checkbox {
    flex-shrink: 0;
  }

  &__item-name {
    font-size: var(--app-font-size-base);
    color: var(--app-text-primary);
    flex: 1;
    min-width: 0;
  }

  &__manual-tag {
    flex-shrink: 0;
  }

  &__item-right {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }

  &__more-btn {
    padding: 4px;
  }

  &__delete-text {
    color: var(--el-color-danger);
  }

  &__item-meta {
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
    padding-left: 30px;
  }

  &__meta-item {
    font-size: var(--app-font-size-xs);
    color: var(--app-text-secondary);
  }
}
</style>
