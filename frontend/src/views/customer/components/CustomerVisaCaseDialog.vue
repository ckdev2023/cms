<script setup lang="ts">
import { Delete, Plus } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { getCustomers } from '@/api/customer'
import { getUsers } from '@/api/system'
import {
  addFamilyMember as addFamilyMemberApi,
  getFamilyMembers,
  getVisaCaseMaterialSummary,
  removeFamilyMember as removeFamilyMemberApi,
  updateFamilyMember as updateFamilyMemberApi,
} from '@/api/visa-case'
import {
  FamilyLinkModeLabel,
  FamilyRelationLabel,
  MaterialStatusLabel,
  VisaCaseFeeStatusLabel,
  VisaCaseMemberRoleLabel,
  VisaCaseStatusLabel,
} from '@/constants/enum-labels'
import {
  FamilyLinkMode,
  FamilyRelation,
  MaterialStatus,
  VisaCaseFeeStatus,
  VisaCaseMemberRole,
  VisaCaseStatus,
} from '@/constants/enums'
import type { CustomerItem } from '@/types/customer'
import type { SystemUser } from '@/types/system'
import type {
  UpdateVisaCaseParams,
  VisaCaseEditSubmitPayload,
  VisaCaseFamilyMemberItem,
  VisaCaseItem,
} from '@/types/visa-case'
import { isVisaCaseTypeChanging } from '@/utils/visa-case-type-change-materials'
import { formatVisaCaseTypeDisplay } from '@/utils/visa-case-type-display'

import type { SelectOption } from './visa-case-wizard/types'
import { loadVisaCaseWizardCaseTypeOptions } from './visa-case-wizard/visaCaseWizardCaseTypes'

type StaffOption = {
  label: string
  value: string
}

type CustomerOption = {
  label: string
  value: string
}

type VisaCaseFormModel = {
  caseType: string
  caseStatus: VisaCaseStatus
  assignedTo: string
  expireDate: string
  nextFollowUpAt: string
  materialStatus: string
  feeStatus: string
  isFamilyCase: boolean
  familyLinkMode: string
  internalPrimaryCustomerId: string
  externalPrimaryName: string
  externalPrimaryCaseType: string
  externalPrimaryExpireDate: string
  externalPrimaryRelationToApplicant: FamilyRelation | ''
  memo: string
}

type NewMemberForm = {
  customerId: string
  memberRole: string
  displayNameSnapshot: string
}

type Props = {
  visible: boolean
  isEditing: boolean
  initialValue: VisaCaseItem | null
  familyMembers: VisaCaseFamilyMemberItem[]
  submitting: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  submit: [payload: VisaCaseEditSubmitPayload]
  membersChanged: []
}>()

const { t } = useI18n({ useScope: 'global' })

/** 拉取材料摘要或确认框展示期间，用于禁用重复点击确定。 */
const preflightSubmitting = ref(false)

const staffOptions = ref<StaffOption[]>([])
const customerOptions = ref<CustomerOption[]>([])
const customerSearchLoading = ref(false)
/** 与建案向导共用字典/枚举回退逻辑的案件类型下拉候选项 */
const caseTypeOptions = ref<SelectOption[]>([])

const localMembers = ref<VisaCaseFamilyMemberItem[]>([])
const memberLoading = ref(false)
const addingMember = ref(false)
const showAddForm = ref(false)
const newMemberCustomerOptions = ref<CustomerOption[]>([])
const newMemberSearchLoading = ref(false)
const newMemberForm = reactive<NewMemberForm>({
  customerId: '',
  memberRole: '',
  displayNameSnapshot: '',
})

const showInternalPrimary = computed(
  () => form.isFamilyCase && form.familyLinkMode === FamilyLinkMode.INTERNAL,
)

const showExternalPrimary = computed(
  () => form.isFamilyCase && form.familyLinkMode === FamilyLinkMode.EXTERNAL,
)

const showFamilyMembersSection = computed(
  () => props.isEditing && props.initialValue?.id && form.isFamilyCase,
)

const canAddMember = computed(
  () => newMemberForm.customerId && newMemberForm.memberRole && newMemberForm.displayNameSnapshot,
)

const memberRoleOptions = computed(() =>
  Object.values(VisaCaseMemberRole).map((value) => ({
    label: VisaCaseMemberRoleLabel[value] ?? value,
    value,
  })),
)

const caseStatusOptions = computed(() =>
  Object.values(VisaCaseStatus).map((value) => ({
    label: VisaCaseStatusLabel[value] ?? value,
    value,
  })),
)

const materialStatusOptions = computed(() =>
  Object.values(MaterialStatus).map((value) => ({
    label: MaterialStatusLabel[value] ?? value,
    value,
  })),
)

const feeStatusOptions = computed(() =>
  Object.values(VisaCaseFeeStatus).map((value) => ({
    label: VisaCaseFeeStatusLabel[value] ?? value,
    value,
  })),
)

const familyLinkModeOptions = computed(() =>
  Object.values(FamilyLinkMode).map((value) => ({
    label: FamilyLinkModeLabel[value] ?? value,
    value,
  })),
)

const familyRelationOptions = computed(() =>
  Object.values(FamilyRelation).map((value) => ({
    label: FamilyRelationLabel[value] ?? value,
    value,
  })),
)

/**
 * 合并字典候选项与当前表单值：存量或自由文本的 `case_type` 若不在字典中，补一行以免下拉空白。
 */
const caseTypeOptionsForSelect = computed((): SelectOption[] => {
  const base = caseTypeOptions.value
  const v = form.caseType?.trim()
  if (!v) {
    return base
  }
  if (base.some((o) => o.value === v)) {
    return base
  }
  return [{ value: v, label: formatVisaCaseTypeDisplay(v) || v }, ...base]
})

const defaultForm = (): VisaCaseFormModel => ({
  caseType: '',
  caseStatus: VisaCaseStatus.DRAFT,
  assignedTo: '',
  expireDate: '',
  nextFollowUpAt: '',
  materialStatus: '',
  feeStatus: '',
  isFamilyCase: false,
  familyLinkMode: '',
  internalPrimaryCustomerId: '',
  externalPrimaryName: '',
  externalPrimaryCaseType: '',
  externalPrimaryExpireDate: '',
  externalPrimaryRelationToApplicant: '',
  memo: '',
})

const form = reactive(defaultForm())

/**
 * 将可空字符串规范为表单绑定用非空字符串。
 *
 * @param value - 案件字段上的可选字符串
 * @returns 缺失时返回空字符串
 */
function coalesceVisaCaseString(value: string | null | undefined): string {
  return value ?? ''
}

/**
 * 将打开编辑时的 `VisaCaseItem` 写入响应式表单模型（不含家属与客户下拉副作用）。
 *
 * @param src - 后端返回的案件详情
 * @param target - 对话框内 `reactive` 表单
 */
function applyVisaCaseItemToForm(src: VisaCaseItem, target: VisaCaseFormModel): void {
  target.caseType = coalesceVisaCaseString(src.caseType)
  target.caseStatus = src.caseStatus
  target.assignedTo = coalesceVisaCaseString(src.assignedTo)
  target.expireDate = coalesceVisaCaseString(src.expireDate)
  target.nextFollowUpAt = src.nextFollowUpAt ? src.nextFollowUpAt.slice(0, 16) : ''
  target.materialStatus = coalesceVisaCaseString(src.materialStatus)
  target.feeStatus = coalesceVisaCaseString(src.feeStatus)
  target.isFamilyCase = src.isFamilyCase
  target.familyLinkMode = src.familyLinkMode ?? ''
  target.internalPrimaryCustomerId = coalesceVisaCaseString(src.internalPrimaryCustomerId)
  target.externalPrimaryName = coalesceVisaCaseString(src.externalPrimaryName)
  target.externalPrimaryCaseType = coalesceVisaCaseString(src.externalPrimaryCaseType)
  target.externalPrimaryExpireDate = coalesceVisaCaseString(src.externalPrimaryExpireDate)
  target.externalPrimaryRelationToApplicant = src.externalPrimaryRelationToApplicant ?? ''
  target.memo = coalesceVisaCaseString(src.memo)
}

/**
 * 若案件为内部关联家属且带主申客户信息，则预填内部主申请人下拉候选项。
 *
 * @param src - 后端返回的案件详情
 */
function syncInternalPrimaryCustomerOptions(src: VisaCaseItem): void {
  if (!src.internalPrimaryCustomerId || !src.internalPrimaryCustomerName) {
    return
  }
  customerOptions.value = [
    {
      label: src.internalPrimaryCustomerName,
      value: src.internalPrimaryCustomerId,
    },
  ]
}

/**
 * 写入与家属模式、内外部主申相关的可编辑字段。
 *
 * @param formModel - 当前表单
 * @param payload - 待补全的更新载荷
 */
function applyFamilyLinkFieldsToPayload(
  formModel: VisaCaseFormModel,
  payload: UpdateVisaCaseParams,
): void {
  if (formModel.isFamilyCase && formModel.familyLinkMode) {
    payload.familyLinkMode = formModel.familyLinkMode as FamilyLinkMode
  }
  if (!formModel.isFamilyCase) {
    return
  }
  if (
    formModel.familyLinkMode === FamilyLinkMode.INTERNAL &&
    formModel.internalPrimaryCustomerId
  ) {
    payload.internalPrimaryCustomerId = formModel.internalPrimaryCustomerId
    return
  }
  if (formModel.familyLinkMode !== FamilyLinkMode.EXTERNAL) {
    return
  }
  if (formModel.externalPrimaryName) {
    payload.externalPrimaryName = formModel.externalPrimaryName
  }
  if (formModel.externalPrimaryCaseType) {
    payload.externalPrimaryCaseType = formModel.externalPrimaryCaseType
  }
  if (formModel.externalPrimaryExpireDate) {
    payload.externalPrimaryExpireDate = formModel.externalPrimaryExpireDate
  }
  if (formModel.externalPrimaryRelationToApplicant) {
    payload.externalPrimaryRelationToApplicant =
      formModel.externalPrimaryRelationToApplicant as FamilyRelation
  }
}

watch(
  () => props.visible,
  (visible) => {
    if (!visible) {
      showAddForm.value = false
      return
    }

    initializeForm()
    void loadStaffOptions()
    void loadVisaCaseWizardCaseTypeOptions(caseTypeOptions)
    if (props.isEditing && props.initialValue?.id && props.initialValue.isFamilyCase) {
      void loadFamilyMembers()
    }
  },
  { immediate: true },
)

/**
 * 加载系统内活跃用户列表供负责人下拉选择器使用。
 */
async function loadStaffOptions(): Promise<void> {
  if (staffOptions.value.length > 0) {
    return
  }

  try {
    const res = await getUsers({ page: 1, pageSize: 200, status: 'ACTIVE' })
    staffOptions.value = res.data.items.map((user: SystemUser) => ({
      label: user.displayName,
      value: user.id,
    }))
  } catch {
    staffOptions.value = []
  }
}

/**
 * 从后端加载当前案件的家属成员列表，用于编辑对话框实时展示。
 */
async function loadFamilyMembers(): Promise<void> {
  if (!props.initialValue?.id) {return}
  memberLoading.value = true
  try {
    const res = await getFamilyMembers(props.initialValue.id)
    localMembers.value = res.data
  } catch {
    localMembers.value = [...props.familyMembers]
  } finally {
    memberLoading.value = false
  }
}

/**
 * 根据打开方式初始化对话框表单，并为内部主申请人模式预载入当前选项。
 */
function initializeForm(): void {
  Object.assign(form, defaultForm())
  customerOptions.value = []
  localMembers.value = [...props.familyMembers]

  const init = props.initialValue
  if (!init) {
    return
  }

  applyVisaCaseItemToForm(init, form)
  syncInternalPrimaryCustomerOptions(init)
}

/**
 * 按关键字远程搜索客户列表供内部主申请人下拉选择器使用。
 *
 * @param keyword - 搜索关键字，少于 1 个字符时清空候选项
 */
async function searchCustomers(keyword: string): Promise<void> {
  if (keyword.length < 1) {
    customerOptions.value = []
    return
  }

  customerSearchLoading.value = true
  try {
    const res = await getCustomers({ page: 1, pageSize: 50, keyword })
    customerOptions.value = res.data.items.map((customer: CustomerItem) => ({
      label: customer.customerName,
      value: customer.id,
    }))
  } catch {
    customerOptions.value = []
  } finally {
    customerSearchLoading.value = false
  }
}

/**
 * 按关键字远程搜索客户列表供添加家属成员下拉选择器使用。
 *
 * @param keyword - 搜索关键字，少于 1 个字符时清空候选项
 */
async function searchNewMemberCustomers(keyword: string): Promise<void> {
  if (keyword.length < 1) {
    newMemberCustomerOptions.value = []
    return
  }

  newMemberSearchLoading.value = true
  try {
    const res = await getCustomers({ page: 1, pageSize: 50, keyword })
    newMemberCustomerOptions.value = res.data.items.map((customer: CustomerItem) => ({
      label: customer.customerName,
      value: customer.id,
    }))
  } catch {
    newMemberCustomerOptions.value = []
  } finally {
    newMemberSearchLoading.value = false
  }
}

/**
 * 当新增家属成员的客户选择变更时，自动填充姓名快照字段。
 *
 * @param customerId - 选中的客户 ID
 */
function handleNewMemberCustomerChange(customerId: string): void {
  const selected = newMemberCustomerOptions.value.find((opt) => opt.value === customerId)
  if (selected) {
    newMemberForm.displayNameSnapshot = selected.label
  }
}

/**
 * 展开添加家属成员表单并重置输入状态。
 */
function handleShowAddForm(): void {
  newMemberForm.customerId = ''
  newMemberForm.memberRole = ''
  newMemberForm.displayNameSnapshot = ''
  newMemberCustomerOptions.value = []
  showAddForm.value = true
}

/**
 * 提交添加家属成员请求并刷新本地成员列表。
 */
async function handleAddMember(): Promise<void> {
  if (!props.initialValue?.id || !canAddMember.value) {return}

  addingMember.value = true
  try {
    await addFamilyMemberApi(props.initialValue.id, {
      customerId: newMemberForm.customerId,
      memberRole: newMemberForm.memberRole,
      displayNameSnapshot: newMemberForm.displayNameSnapshot,
    })
    ElMessage.success(t('detailViews.customer.visaCasesTab.memberAdded'))
    showAddForm.value = false
    await loadFamilyMembers()
    emit('membersChanged')
  } finally {
    addingMember.value = false
  }
}

/**
 * 确认后移除指定家属成员并刷新列表。
 *
 * @param member - 待移除的家属成员
 */
async function handleRemoveMember(member: VisaCaseFamilyMemberItem): Promise<void> {
  if (!props.initialValue?.id) {return}

  try {
    await ElMessageBox.confirm(
      t('detailViews.customer.visaCasesTab.removeMemberConfirm'),
      { type: 'warning' },
    )
  } catch {
    return
  }

  try {
    await removeFamilyMemberApi(props.initialValue.id, member.id)
    ElMessage.success(t('detailViews.customer.visaCasesTab.memberRemoved'))
    await loadFamilyMembers()
    emit('membersChanged')
  } catch {
    // request layer handles error display
  }
}

/**
 * 将指定家属成员设为主申请人并刷新列表。
 *
 * @param member - 待设为主申请人的家属成员
 */
async function handleSetPrimary(member: VisaCaseFamilyMemberItem): Promise<void> {
  if (!props.initialValue?.id || member.isPrimary) {return}

  try {
    await updateFamilyMemberApi(props.initialValue.id, member.id, {
      isPrimary: true,
    })
    ElMessage.success(t('detailViews.customer.visaCasesTab.memberUpdated'))
    await loadFamilyMembers()
    emit('membersChanged')
  } catch {
    // request layer handles error display
  }
}

/**
 * 关闭签证案件编辑对话框并将可见状态同步回父组件。
 */
function closeDialog(): void {
  emit('update:visible', false)
}

/**
 * 组装表单字段为签证案件接口所需的可编辑载荷。
 *
 * @returns 适用于创建和更新接口的公共请求字段
 */
function buildSubmitPayload(): UpdateVisaCaseParams {
  const payload: UpdateVisaCaseParams = {
    caseType: form.caseType || undefined,
    caseStatus: form.caseStatus,
    assignedTo: form.assignedTo || undefined,
    expireDate: form.expireDate || undefined,
    nextFollowUpAt: form.nextFollowUpAt
      ? new Date(form.nextFollowUpAt).toISOString()
      : undefined,
    materialStatus: form.materialStatus || undefined,
    feeStatus: (form.feeStatus as VisaCaseFeeStatus) || undefined,
    isFamilyCase: form.isFamilyCase,
    memo: form.memo || undefined,
  }
  applyFamilyLinkFieldsToPayload(form, payload)
  return payload
}

/**
 * 提交当前对话框内的签证案件表单数据，并交由父组件完成接口调用。
 *
 * 编辑模式下若案件类型将变更且该案已有材料行，先弹出确认说明将按新类型模板重建清单；取消则恢复案件类型下拉为打开对话框时的值。
 */
async function handleSubmit(): Promise<void> {
  const payload = buildSubmitPayload()

  if (!props.isEditing || !props.initialValue?.id) {
    emit('submit', payload)
    return
  }

  if (!isVisaCaseTypeChanging(props.initialValue.caseType, form.caseType)) {
    emit('submit', payload)
    return
  }

  preflightSubmitting.value = true
  try {
    let materialTotal = 0
    try {
      const summaryRes = await getVisaCaseMaterialSummary(props.initialValue.id)
      materialTotal = summaryRes.data?.total ?? 0
    } catch {
      ElMessage.warning(
        t('detailViews.customer.visaCasesTab.caseTypeChangeMaterialsSummaryFailed'),
      )
      return
    }

    if (materialTotal <= 0) {
      emit('submit', payload)
      return
    }

    try {
      await ElMessageBox.confirm(
        t('detailViews.customer.visaCasesTab.caseTypeChangeMaterialsConfirmBody'),
        t('detailViews.customer.visaCasesTab.caseTypeChangeMaterialsConfirmTitle'),
        {
          type: 'warning',
          distinguishCancelAndClose: true,
          confirmButtonText: t('common.confirm'),
          cancelButtonText: t('common.cancel'),
        },
      )
    } catch (e) {
      if (e === 'cancel' || e === 'close') {
        form.caseType = coalesceVisaCaseString(props.initialValue.caseType)
        return
      }
      throw e
    }

    emit('submit', { ...payload, reinitializeMaterialsAfterSave: true })
  } finally {
    preflightSubmitting.value = false
  }
}
</script>

<template>
  <el-dialog
    :model-value="props.visible"
    :title="
      props.isEditing
        ? t('detailViews.customer.visaCasesTab.editTitle')
        : t('detailViews.customer.visaCasesTab.createTitle')
    "
    width="640px"
    destroy-on-close
    @update:model-value="emit('update:visible', $event)"
  >
    <el-form label-width="120px" @submit.prevent="handleSubmit">
      <el-form-item :label="t('detailViews.customer.visaCasesTab.caseType')">
        <el-select
          v-model="form.caseType"
          filterable
          allow-create
          default-first-option
          clearable
          style="width: 100%"
          :placeholder="t('detailViews.customer.visaCasesTab.caseTypePlaceholder')"
        >
          <el-option
            v-for="opt in caseTypeOptionsForSelect"
            :key="opt.value"
            :label="opt.label"
            :value="opt.value"
          />
        </el-select>
      </el-form-item>

      <el-form-item :label="t('detailViews.customer.visaCasesTab.caseStatus')">
        <el-select v-model="form.caseStatus" style="width: 100%">
          <el-option
            v-for="opt in caseStatusOptions"
            :key="opt.value"
            :label="opt.label"
            :value="opt.value"
          />
        </el-select>
      </el-form-item>

      <el-form-item :label="t('detailViews.customer.visaCasesTab.assignee')">
        <el-select
          v-model="form.assignedTo"
          :placeholder="t('detailViews.customer.visaCasesTab.assigneePlaceholder')"
          clearable
          filterable
          style="width: 100%"
        >
          <el-option
            v-for="opt in staffOptions"
            :key="opt.value"
            :label="opt.label"
            :value="opt.value"
          />
        </el-select>
      </el-form-item>

      <el-form-item :label="t('detailViews.customer.visaCasesTab.expireDate')">
        <div class="visa-case-dialog__expire-date-wrap">
          <el-date-picker
            v-model="form.expireDate"
            type="date"
            value-format="YYYY-MM-DD"
            style="width: 100%"
            clearable
          />
          <el-text
            type="info"
            size="small"
            class="visa-case-dialog__expire-date-hint"
          >
            {{ t('detailViews.customer.visaCasesTab.expireDateHint') }}
          </el-text>
        </div>
      </el-form-item>

      <el-form-item
        :label="t('detailViews.customer.visaCasesTab.nextFollowUpAt')"
      >
        <el-date-picker
          v-model="form.nextFollowUpAt"
          type="datetime"
          value-format="YYYY-MM-DDTHH:mm"
          style="width: 100%"
          clearable
        />
      </el-form-item>

      <el-form-item
        :label="t('detailViews.customer.visaCasesTab.materialStatus')"
      >
        <el-select v-model="form.materialStatus" clearable style="width: 100%">
          <el-option
            v-for="opt in materialStatusOptions"
            :key="opt.value"
            :label="opt.label"
            :value="opt.value"
          />
        </el-select>
      </el-form-item>

      <el-form-item :label="t('detailViews.customer.visaCasesTab.feeStatus')">
        <el-select v-model="form.feeStatus" clearable style="width: 100%">
          <el-option
            v-for="opt in feeStatusOptions"
            :key="opt.value"
            :label="opt.label"
            :value="opt.value"
          />
        </el-select>
      </el-form-item>

      <el-form-item
        :label="t('detailViews.customer.visaCasesTab.isFamilyCase')"
      >
        <el-switch v-model="form.isFamilyCase" />
      </el-form-item>

      <el-form-item
        v-if="form.isFamilyCase"
        :label="t('detailViews.customer.visaCasesTab.familyLinkMode')"
      >
        <el-select v-model="form.familyLinkMode" clearable style="width: 100%">
          <el-option
            v-for="opt in familyLinkModeOptions"
            :key="opt.value"
            :label="opt.label"
            :value="opt.value"
          />
        </el-select>
      </el-form-item>

      <el-form-item
        v-if="showInternalPrimary"
        :label="t('detailViews.customer.visaCasesTab.internalPrimaryCustomer')"
        required
      >
        <el-select
          v-model="form.internalPrimaryCustomerId"
          :placeholder="
            t('detailViews.customer.visaCasesTab.internalPrimaryCustomerPlaceholder')
          "
          filterable
          remote
          :remote-method="searchCustomers"
          :loading="customerSearchLoading"
          clearable
          style="width: 100%"
        >
          <el-option
            v-for="opt in customerOptions"
            :key="opt.value"
            :label="opt.label"
            :value="opt.value"
          />
        </el-select>
      </el-form-item>

      <el-form-item
        v-if="showExternalPrimary"
        :label="t('detailViews.customer.visaCasesTab.externalPrimaryName')"
        required
      >
        <el-input
          v-model="form.externalPrimaryName"
          :placeholder="t('detailViews.customer.visaCasesTab.externalPrimaryNamePlaceholder')"
        />
      </el-form-item>

      <el-form-item
        v-if="showExternalPrimary"
        :label="t('detailViews.customer.visaCasesTab.externalPrimaryCaseType')"
      >
        <el-input
          v-model="form.externalPrimaryCaseType"
          :placeholder="t('detailViews.customer.visaCasesTab.externalPrimaryCaseTypePlaceholder')"
        />
      </el-form-item>

      <el-form-item
        v-if="showExternalPrimary"
        :label="t('detailViews.customer.visaCasesTab.externalPrimaryExpireDate')"
      >
        <el-date-picker
          v-model="form.externalPrimaryExpireDate"
          type="date"
          value-format="YYYY-MM-DD"
          style="width: 100%"
          clearable
        />
      </el-form-item>

      <el-form-item
        v-if="showExternalPrimary"
        :label="t('detailViews.customer.visaCasesTab.externalPrimaryRelationToApplicant')"
      >
        <el-select
          v-model="form.externalPrimaryRelationToApplicant"
          clearable
          style="width: 100%"
          :placeholder="
            t('detailViews.customer.visaCasesTab.externalPrimaryRelationToApplicantPlaceholder')
          "
        >
          <el-option
            v-for="opt in familyRelationOptions"
            :key="opt.value"
            :label="opt.label"
            :value="opt.value"
          />
        </el-select>
        <el-text
          type="info"
          size="small"
          class="visa-case-external-relation-hint"
        >
          {{ t('detailViews.customer.visaCasesTab.externalPrimaryRelationToApplicantHint') }}
        </el-text>
      </el-form-item>

      <!-- Family Members Section -->
      <el-form-item
        v-if="showFamilyMembersSection"
        :label="t('detailViews.customer.visaCasesTab.familyMembers')"
      >
        <div v-loading="memberLoading" class="family-members-section">
          <div v-if="localMembers.length > 0" class="family-members-list">
            <div
              v-for="member in localMembers"
              :key="member.id"
              class="family-member-row"
            >
              <el-tag
                :type="member.isPrimary ? 'warning' : 'info'"
                size="default"
                class="family-member-tag"
              >
                {{ member.displayNameSnapshot }}
                ({{ VisaCaseMemberRoleLabel[member.memberRole as VisaCaseMemberRole] ?? member.memberRole }})
              </el-tag>
              <span v-if="member.isPrimary" class="primary-badge">
                {{ t('detailViews.customer.visaCasesTab.primaryTag') }}
              </span>
              <div class="family-member-actions">
                <el-button
                  v-if="!member.isPrimary"
                  link
                  type="primary"
                  size="small"
                  @click="handleSetPrimary(member)"
                >
                  {{ t('detailViews.customer.visaCasesTab.setPrimary') }}
                </el-button>
                <el-button
                  link
                  type="danger"
                  size="small"
                  :icon="Delete"
                  @click="handleRemoveMember(member)"
                >
                  {{ t('detailViews.customer.visaCasesTab.removeMember') }}
                </el-button>
              </div>
            </div>
          </div>

          <!-- Add Member Form -->
          <div v-if="showAddForm" class="add-member-form">
            <el-select
              v-model="newMemberForm.customerId"
              :placeholder="t('detailViews.customer.visaCasesTab.addMemberCustomerPlaceholder')"
              filterable
              remote
              :remote-method="searchNewMemberCustomers"
              :loading="newMemberSearchLoading"
              clearable
              class="add-member-field"
              @change="handleNewMemberCustomerChange"
            >
              <el-option
                v-for="opt in newMemberCustomerOptions"
                :key="opt.value"
                :label="opt.label"
                :value="opt.value"
              />
            </el-select>
            <el-select
              v-model="newMemberForm.memberRole"
              :placeholder="t('detailViews.customer.visaCasesTab.addMemberRolePlaceholder')"
              class="add-member-role"
            >
              <el-option
                v-for="opt in memberRoleOptions"
                :key="opt.value"
                :label="opt.label"
                :value="opt.value"
              />
            </el-select>
            <el-input
              v-model="newMemberForm.displayNameSnapshot"
              :placeholder="t('detailViews.customer.visaCasesTab.memberNamePlaceholder')"
              class="add-member-name"
            />
            <div class="add-member-btns">
              <el-button
                type="primary"
                size="small"
                :loading="addingMember"
                :disabled="!canAddMember"
                @click="handleAddMember"
              >
                {{ t('common.confirm') }}
              </el-button>
              <el-button size="small" @click="showAddForm = false">
                {{ t('common.cancel') }}
              </el-button>
            </div>
          </div>

          <el-button
            v-if="!showAddForm"
            :icon="Plus"
            size="small"
            class="add-member-trigger"
            @click="handleShowAddForm"
          >
            {{ t('detailViews.customer.visaCasesTab.addMember') }}
          </el-button>
        </div>
      </el-form-item>

      <!-- Hint for unsaved cases -->
      <el-form-item
        v-if="!props.isEditing && form.isFamilyCase"
        :label="t('detailViews.customer.visaCasesTab.familyMembers')"
      >
        <el-text type="info" size="small">
          {{ t('detailViews.customer.visaCasesTab.saveCaseFirst') }}
        </el-text>
      </el-form-item>

      <el-form-item :label="t('detailViews.customer.visaCasesTab.memo')">
        <el-input
          v-model="form.memo"
          type="textarea"
          :rows="3"
          :placeholder="t('detailViews.customer.visaCasesTab.memoPlaceholder')"
        />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="closeDialog">
        {{ t('common.cancel') }}
      </el-button>
      <el-button
        type="primary"
        :loading="props.submitting || preflightSubmitting"
        @click="handleSubmit"
      >
        {{ t('common.confirm') }}
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">
.family-members-section {
  width: 100%;
}

.family-members-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  margin-bottom: 8px;
}

.family-member-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
}

.family-member-tag {
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.primary-badge {
  font-size: 12px;
  color: var(--el-color-warning);
  white-space: nowrap;
}

.family-member-actions {
  display: flex;
  gap: 4px;
  margin-left: auto;
}

.add-member-form {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  padding: 8px;
  margin-bottom: 8px;
  background: var(--el-fill-color-lighter);
  border-radius: 4px;
}

.add-member-field {
  flex: 1;
  min-width: 160px;
}

.add-member-role {
  width: 130px;
}

.add-member-name {
  width: 120px;
}

.add-member-btns {
  display: flex;
  gap: 4px;
}

.add-member-trigger {
  margin-top: 4px;
}

.visa-case-external-relation-hint {
  display: block;
  margin-top: 6px;
  line-height: 1.45;
}

.visa-case-dialog__expire-date-wrap {
  width: 100%;
}

.visa-case-dialog__expire-date-hint {
  display: block;
  margin-top: 6px;
  line-height: 1.45;
}
</style>
