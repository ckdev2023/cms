<script setup lang="ts">
import { Search } from '@element-plus/icons-vue'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { getUsers } from '@/api/system'
import {
  FamilyLinkModeLabel,
  MaterialStatusLabel,
  VisaCaseFeeStatusLabel,
  VisaCaseStatusLabel,
  VisaReminderTypeLabel,
} from '@/constants/enum-labels'
import {
  FamilyLinkMode,
  MaterialStatus,
  VisaCaseFeeStatus,
  VisaCaseStatus,
  VisaReminderType,
} from '@/constants/enums'
import type { SystemUser } from '@/types/system'
import type { GlobalVisaCaseQueryParams } from '@/types/visa-case'
import { VISA_REMINDER_BUCKET_DISPLAY_ORDER } from '@/utils/visa-reminder-type-ui'

const emit = defineEmits<{
  search: [params: GlobalVisaCaseQueryParams]
  reset: []
}>()

defineOptions({ name: 'VisaCaseRegistrySearchForm' })

const { t } = useI18n({ useScope: 'global' })

type FamilyCaseFilter = '' | 'yes' | 'no'

const filterForm = reactive<{
  customerKeyword: string
  caseStatuses: VisaCaseStatus[]
  assignedToIds: string[]
  unassignedOnly: boolean
  materialStatuses: MaterialStatus[]
  feeStatuses: VisaCaseFeeStatus[]
  expireDateFrom: string
  expireDateTo: string
  nextFollowUpAtFrom: string
  nextFollowUpAtTo: string
  familyCaseFilter: FamilyCaseFilter
  familyLinkMode: FamilyLinkMode | ''
  supplementRelated: boolean
  reminderBucket: VisaReminderType | ''
}>({
  customerKeyword: '',
  caseStatuses: [],
  assignedToIds: [],
  unassignedOnly: false,
  materialStatuses: [],
  feeStatuses: [],
  expireDateFrom: '',
  expireDateTo: '',
  nextFollowUpAtFrom: '',
  nextFollowUpAtTo: '',
  familyCaseFilter: '',
  familyLinkMode: '',
  supplementRelated: false,
  reminderBucket: '',
})

const staffOptions = ref<{ label: string; value: string }[]>([])
const staffLoading = ref(false)

/** 「更多筛选」展开态；默认收起以降低首屏字段密度 */
const moreFiltersExpanded = ref(false)

const allCaseStatuses = Object.values(VisaCaseStatus)
const allMaterialStatuses = Object.values(MaterialStatus)
const allFeeStatuses = Object.values(VisaCaseFeeStatus)
const reminderBucketOptions = VISA_REMINDER_BUCKET_DISPLAY_ORDER

onMounted(() => {
  void loadStaffOptions()
})

const hasMoreFiltersActive = computed((): boolean => {
  return (
    filterForm.materialStatuses.length > 0 ||
    filterForm.feeStatuses.length > 0 ||
    Boolean(filterForm.expireDateFrom) ||
    Boolean(filterForm.expireDateTo) ||
    Boolean(filterForm.nextFollowUpAtFrom) ||
    Boolean(filterForm.nextFollowUpAtTo) ||
    filterForm.familyCaseFilter !== '' ||
    Boolean(filterForm.familyLinkMode) ||
    filterForm.supplementRelated ||
    Boolean(filterForm.reminderBucket)
  )
})

const moreFiltersToggleLabel = computed((): string =>
  moreFiltersExpanded.value
    ? t('pages.visaCaseRegistry.collapseMoreFilters')
    : t('pages.visaCaseRegistry.expandMoreFilters'),
)

watch(hasMoreFiltersActive, (active) => {
  if (active) {
    moreFiltersExpanded.value = true
  }
})

/**
 * 切换「更多筛选」折叠区显隐。
 */
function toggleMoreFilters(): void {
  moreFiltersExpanded.value = !moreFiltersExpanded.value
}

/**
 * 加载在职用户供负责人多选筛选使用。
 */
async function loadStaffOptions(): Promise<void> {
  staffLoading.value = true
  try {
    const res = await getUsers({ page: 1, pageSize: 500, status: 'ACTIVE' })
    staffOptions.value = res.data.items.map((u: SystemUser) => ({
      label: u.displayName || u.username,
      value: u.id,
    }))
  } finally {
    staffLoading.value = false
  }
}

/**
 * 将当前表单映射为全局案件列表查询参数。
 *
 * @returns 剔除空值后的查询对象
 */
// eslint-disable-next-line complexity -- 各筛选项独立条件赋值，集中便于与后端 DTO 对照
function buildSearchParams(): GlobalVisaCaseQueryParams {
  const p: GlobalVisaCaseQueryParams = {}
  const kw = filterForm.customerKeyword.trim()
  if (kw) {p.customerKeyword = kw}
  if (filterForm.caseStatuses.length) {p.caseStatuses = [...filterForm.caseStatuses]}
  if (filterForm.assignedToIds.length) {p.assignedToIds = [...filterForm.assignedToIds]}
  if (filterForm.unassignedOnly) {p.unassignedOnly = true}
  if (filterForm.materialStatuses.length) {
    p.materialStatuses = [...filterForm.materialStatuses]
  }
  if (filterForm.feeStatuses.length) {p.feeStatuses = [...filterForm.feeStatuses]}
  if (filterForm.expireDateFrom) {p.expireDateFrom = filterForm.expireDateFrom}
  if (filterForm.expireDateTo) {p.expireDateTo = filterForm.expireDateTo}
  if (filterForm.nextFollowUpAtFrom) {p.nextFollowUpAtFrom = filterForm.nextFollowUpAtFrom}
  if (filterForm.nextFollowUpAtTo) {p.nextFollowUpAtTo = filterForm.nextFollowUpAtTo}
  if (filterForm.familyCaseFilter === 'yes') {p.isFamilyCase = true}
  if (filterForm.familyCaseFilter === 'no') {p.isFamilyCase = false}
  if (filterForm.familyLinkMode) {p.familyLinkMode = filterForm.familyLinkMode}
  if (filterForm.supplementRelated) {p.supplementRelated = true}
  if (filterForm.reminderBucket) {p.reminderBucket = filterForm.reminderBucket}
  return p
}

/**
 * 提交筛选并通知父级刷新列表。
 */
function doSearch(): void {
  emit('search', buildSearchParams())
}

/**
 * 清空表单并通知父级重置列表条件。
 */
function doReset(): void {
  filterForm.customerKeyword = ''
  filterForm.caseStatuses = []
  filterForm.assignedToIds = []
  filterForm.unassignedOnly = false
  filterForm.materialStatuses = []
  filterForm.feeStatuses = []
  filterForm.expireDateFrom = ''
  filterForm.expireDateTo = ''
  filterForm.nextFollowUpAtFrom = ''
  filterForm.nextFollowUpAtTo = ''
  filterForm.familyCaseFilter = ''
  filterForm.familyLinkMode = ''
  filterForm.supplementRelated = false
  filterForm.reminderBucket = ''
  moreFiltersExpanded.value = false
  emit('reset')
}
</script>

<template>
  <el-form
    class="visa-registry-search"
    label-position="top"
    @submit.prevent="doSearch"
  >
    <div class="visa-registry-search__toolbar">
      <div class="visa-registry-search__toolbar-grid">
        <el-form-item
          class="visa-registry-search__toolbar-field visa-registry-search__toolbar-field--keyword"
          :label="t('pages.visaCaseRegistry.customerKeyword')"
        >
          <el-input
            v-model="filterForm.customerKeyword"
            clearable
            :placeholder="t('pages.visaCaseRegistry.customerKeywordPlaceholder')"
            @keyup.enter="doSearch"
          />
        </el-form-item>

        <el-form-item
          class="visa-registry-search__toolbar-field"
          :label="t('pages.visaCaseRegistry.caseStatus')"
        >
          <el-select
            v-model="filterForm.caseStatuses"
            class="visa-registry-search__select"
            multiple
            clearable
            collapse-tags
            collapse-tags-tooltip
          >
            <el-option
              v-for="s in allCaseStatuses"
              :key="s"
              :label="VisaCaseStatusLabel[s]"
              :value="s"
            />
          </el-select>
        </el-form-item>

        <el-form-item
          class="visa-registry-search__toolbar-field"
          :label="t('pages.visaCaseRegistry.assignee')"
        >
          <el-select
            v-model="filterForm.assignedToIds"
            class="visa-registry-search__select"
            multiple
            filterable
            clearable
            collapse-tags
            collapse-tags-tooltip
            :loading="staffLoading"
          >
            <el-option
              v-for="opt in staffOptions"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </el-form-item>

        <div class="visa-registry-search__toolbar-unassigned">
          <el-checkbox v-model="filterForm.unassignedOnly">
            {{ t('pages.visaCaseRegistry.unassignedOnly') }}
          </el-checkbox>
        </div>

        <div class="visa-registry-search__toolbar-actions">
          <el-button type="primary" :icon="Search" @click="doSearch">
            {{ t('common.search') }}
          </el-button>
          <el-button @click="doReset">
            {{ t('common.reset') }}
          </el-button>
          <el-badge
            :hidden="moreFiltersExpanded || !hasMoreFiltersActive"
            is-dot
            class="visa-registry-search__more-badge"
          >
            <el-button
              link
              type="primary"
              :aria-expanded="moreFiltersExpanded"
              @click="toggleMoreFilters"
            >
              {{ moreFiltersToggleLabel }}
            </el-button>
          </el-badge>
        </div>
      </div>
    </div>

    <div
      v-show="moreFiltersExpanded"
      class="visa-registry-search__more-panel"
      aria-label="visa-registry-more-filters"
    >
      <el-row :gutter="16">
        <el-col :xs="24" :sm="12" :md="8" :lg="6">
          <el-form-item :label="t('pages.visaCaseRegistry.materialStatus')">
            <el-select
              v-model="filterForm.materialStatuses"
              multiple
              clearable
              collapse-tags
              collapse-tags-tooltip
              class="visa-registry-search__select"
            >
              <el-option
                v-for="m in allMaterialStatuses"
                :key="m"
                :label="MaterialStatusLabel[m]"
                :value="m"
              />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :xs="24" :sm="12" :md="8" :lg="6">
          <el-form-item :label="t('pages.visaCaseRegistry.feeStatus')">
            <el-select
              v-model="filterForm.feeStatuses"
              class="visa-registry-search__select"
              multiple
              clearable
              collapse-tags
              collapse-tags-tooltip
            >
              <el-option
                v-for="f in allFeeStatuses"
                :key="f"
                :label="VisaCaseFeeStatusLabel[f]"
                :value="f"
              />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :xs="24" :sm="12" :md="8" :lg="6">
          <el-form-item :label="t('common.startDate')">
            <el-date-picker
              v-model="filterForm.expireDateFrom"
              class="visa-registry-search__control-full"
              type="date"
              value-format="YYYY-MM-DD"
              clearable
            />
          </el-form-item>
        </el-col>
        <el-col :xs="24" :sm="12" :md="8" :lg="6">
          <el-form-item :label="t('common.endDate')">
            <el-date-picker
              v-model="filterForm.expireDateTo"
              class="visa-registry-search__control-full"
              type="date"
              value-format="YYYY-MM-DD"
              clearable
            />
          </el-form-item>
        </el-col>
        <el-col :xs="24" :sm="12" :md="8" :lg="6">
          <el-form-item :label="t('pages.visaCaseRegistry.followUpFrom')">
            <el-date-picker
              v-model="filterForm.nextFollowUpAtFrom"
              class="visa-registry-search__control-full"
              type="datetime"
              value-format="YYYY-MM-DDTHH:mm:ss"
              clearable
            />
          </el-form-item>
        </el-col>
        <el-col :xs="24" :sm="12" :md="8" :lg="6">
          <el-form-item :label="t('pages.visaCaseRegistry.followUpTo')">
            <el-date-picker
              v-model="filterForm.nextFollowUpAtTo"
              class="visa-registry-search__control-full"
              type="datetime"
              value-format="YYYY-MM-DDTHH:mm:ss"
              clearable
            />
          </el-form-item>
        </el-col>
        <el-col :xs="24" :sm="12" :md="8" :lg="6">
          <el-form-item :label="t('pages.visaCaseRegistry.familyCase')">
            <el-select
              v-model="filterForm.familyCaseFilter"
              class="visa-registry-search__select"
              clearable
            >
              <el-option :label="t('common.all')" value="" />
              <el-option :label="t('common.yes')" value="yes" />
              <el-option :label="t('common.no')" value="no" />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :xs="24" :sm="12" :md="8" :lg="6">
          <el-form-item :label="t('pages.visaCaseRegistry.familyLinkMode')">
            <el-select
              v-model="filterForm.familyLinkMode"
              class="visa-registry-search__select"
              clearable
            >
              <el-option
                v-for="mode in [FamilyLinkMode.INTERNAL, FamilyLinkMode.EXTERNAL]"
                :key="mode"
                :label="FamilyLinkModeLabel[mode]"
                :value="mode"
              />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :xs="24" :sm="12" :md="8" :lg="6">
          <el-form-item :label="t('pages.visaCaseRegistry.supplementRelated')">
            <el-checkbox v-model="filterForm.supplementRelated" />
          </el-form-item>
        </el-col>
        <el-col :xs="24" :sm="12" :md="8" :lg="6">
          <el-form-item :label="t('pages.visaCaseRegistry.reminderBucket')">
            <el-select
              v-model="filterForm.reminderBucket"
              class="visa-registry-search__select"
              clearable
            >
              <el-option :label="t('common.all')" value="" />
              <el-option
                v-for="rb in reminderBucketOptions"
                :key="rb"
                :label="VisaReminderTypeLabel[rb]"
                :value="rb"
              />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>
    </div>
  </el-form>
</template>

<style scoped lang="scss">
.visa-registry-search {
  display: block;
  margin-bottom: 0;

  :deep(.el-form-item--label-top .el-form-item__label) {
    margin-bottom: 4px;
    line-height: 1.35;
    font-size: var(--app-font-size-sm);
    font-weight: var(--app-font-weight-semibold);
    color: var(--app-text-primary);
  }

  :deep(.el-form-item--label-top) {
    margin-bottom: 0;
  }

  &__toolbar {
    padding-bottom: var(--app-spacing-md);
    margin-bottom: var(--app-spacing-md);
    border-bottom: 1px solid var(--app-border-color-light);
  }

  &__toolbar-grid {
    display: grid;
    grid-template-columns:
      minmax(200px, 1.35fr)
      minmax(150px, 1fr)
      minmax(150px, 1fr)
      minmax(160px, max-content)
      auto;
    gap: var(--app-spacing-sm) var(--app-spacing-lg);
    align-items: end;
  }

  &__toolbar-field {
    margin-bottom: 0 !important;
    min-width: 0;
  }

  &__toolbar-field :deep(.el-form-item__content) {
    width: 100%;
    max-width: 100%;
  }

  &__toolbar-unassigned {
    display: flex;
    align-items: center;
    padding-bottom: 2px;
    white-space: nowrap;
  }

  &__toolbar-unassigned :deep(.el-checkbox) {
    height: auto;
    align-items: center;
  }

  &__toolbar-unassigned :deep(.el-checkbox__label) {
    font-size: var(--app-font-size-sm);
    font-weight: var(--app-font-weight-semibold);
    color: var(--app-text-primary);
    line-height: 1.35;
    padding-left: 6px;
  }

  &__toolbar-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--app-spacing-sm);
    padding-bottom: 2px;
  }

  &__select,
  &__control-full {
    width: 100%;
    max-width: 100%;
  }

  &__more-badge {
    display: inline-flex;
    align-items: center;
    margin-left: 2px;
  }

  &__more-panel {
    padding-top: var(--app-spacing-md);
    margin-top: var(--app-spacing-xs);
    margin-bottom: var(--app-spacing-xs);
    border-top: 1px dashed var(--el-border-color-lighter);
  }

  &__more-panel :deep(.el-form-item__content) {
    width: 100%;
    max-width: 100%;
  }
}

@media (max-width: 1200px) {
  .visa-registry-search__toolbar-grid {
    grid-template-columns: 1fr 1fr;
  }

  .visa-registry-search__toolbar-field--keyword {
    grid-column: 1 / -1;
  }

  .visa-registry-search__toolbar-actions {
    grid-column: 1 / -1;
    justify-content: flex-start;
  }
}

@media (max-width: 900px) {
  .visa-registry-search__toolbar-grid {
    grid-template-columns: 1fr;
  }

  .visa-registry-search__toolbar-field--keyword {
    grid-column: 1 / -1;
  }

  .visa-registry-search__toolbar-actions {
    grid-column: 1 / -1;
  }
}
</style>
