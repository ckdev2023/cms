<script setup lang="ts">
import { Filter, InfoFilled, QuestionFilled, Refresh, Search } from '@element-plus/icons-vue'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { PRIMARY_CASE_STATUS_FILTER_OPTIONS } from '@/constants/customer-list-primary-case-filter'
import { RESIDENCE_EXPIRE_WITHIN_DAY_PRESETS } from '@/constants/customer-list-residence-presets'
import {
  CustomerStatusLabel,
  CustomerTypeLabel,
  FamilyLinkModeLabel,
  ServiceTypeLabel,
  VisaCaseStatusLabel,
  VisaReminderTypeLabel,
} from '@/constants/enum-labels'
import {
  CustomerStatus,
  CustomerType,
  FamilyLinkMode,
  ServiceType,
} from '@/constants/enums'
import type { CustomerQueryParams } from '@/types/customer'
import {
  buildCustomerListFilterChips,
  clearCustomerListFilterChip,
  type CustomerListFilterChipId,
} from '@/utils/customer-list-search-filter-chips'
import { VISA_REMINDER_BUCKET_DISPLAY_ORDER } from '@/utils/visa-reminder-type-ui'

import CustomerListVisaCaseTypeFilter from './CustomerListVisaCaseTypeFilter.vue'

defineProps<{
  showResidenceHint: boolean
  loading: boolean
}>()

const emit = defineEmits<{
  search: []
  reset: []
}>()

defineOptions({ name: 'CustomerListSearchPanel' })

const searchForm = defineModel<CustomerQueryParams>('searchForm', { required: true })

const { t } = useI18n({ useScope: 'global' })

/** 与筛选区布局联动的视口上限：iPad 竖屏与窄侧栏下的横屏 */
const COMPACT_FILTER_MEDIA = '(max-width: 1024px)'

const compactLayout = ref(false)
let compactMql: MediaQueryList | null = null

/**
 * 将 matchMedia 结果同步到紧凑布局开关，便于小屏下标签置顶、控件全宽。
 *
 * @param mql - 媒体查询对象或 change 事件目标
 */
function syncCompactLayout(mql: MediaQueryList | MediaQueryListEvent): void {
  compactLayout.value = mql.matches
}

const moreFiltersDrawerOpen = ref(false)

const DRAWER_WIDTH_PX = 440

/**
 * 统计「更多筛选」抽屉内已生效条件数量，用于顶栏按钮角标提示。
 *
 * @param f - 当前查询表单快照
 * @returns 主案件与在留/提醒相关非空筛选项个数
 */
function countDrawerScopeFilters(f: CustomerQueryParams): number {
  let n = 0
  if (f.listPrimaryVisaCaseStatus) {
    n += 1
  }
  const visaKw =
    typeof f.visaCaseTypeKeyword === 'string' ? f.visaCaseTypeKeyword.trim() : ''
  if (visaKw) {
    n += 1
  }
  if (f.listPrimaryFamilyCaseFilter === 'yes' || f.listPrimaryFamilyCaseFilter === 'no') {
    n += 1
  }
  if (f.listPrimaryFamilyLinkMode) {
    n += 1
  }
  if (f.visaReminderBucket) {
    n += 1
  }
  if (
    f.residenceExpireWithinDays !== undefined &&
    f.residenceExpireWithinDays !== null &&
    Number.isFinite(f.residenceExpireWithinDays)
  ) {
    n += 1
  }
  return n
}

const drawerActiveFilterCount = computed((): number =>
  countDrawerScopeFilters(searchForm.value),
)

onMounted(() => {
  compactMql = window.matchMedia(COMPACT_FILTER_MEDIA)
  syncCompactLayout(compactMql)
  compactMql.addEventListener('change', syncCompactLayout)
})

onUnmounted(() => {
  compactMql?.removeEventListener('change', syncCompactLayout)
})

/**
 * 打开「更多筛选」抽屉。
 */
function openMoreFiltersDrawer(): void {
  moreFiltersDrawerOpen.value = true
}

/**
 * 清空抽屉范围内字段并立即按新条件查询列表。
 */
function resetDrawerScopeFilters(): void {
  searchForm.value.listPrimaryVisaCaseStatus = undefined
  searchForm.value.visaCaseTypeKeyword = undefined
  searchForm.value.listPrimaryFamilyCaseFilter = undefined
  searchForm.value.listPrimaryFamilyLinkMode = undefined
  searchForm.value.visaReminderBucket = undefined
  searchForm.value.residenceExpireWithinDays = undefined
  emit('search')
}

/**
 * 应用当前表单（含抽屉内条件）并关闭抽屉。
 */
function applyDrawerAndClose(): void {
  emit('search')
  moreFiltersDrawerOpen.value = false
}

const filterChips = computed(() => buildCustomerListFilterChips(searchForm.value, t))

/**
 * 关闭单个已选条件标签、写回表单并立即按新条件重新查询列表。
 *
 * @param id - 筛选项标识
 */
function removeFilterChip(id: CustomerListFilterChipId): void {
  clearCustomerListFilterChip(searchForm.value, id)
  emit('search')
}
</script>

<template>
  <div class="customer-list-search">
    <el-alert
      v-if="showResidenceHint"
      type="info"
      show-icon
      :closable="false"
      class="customer-list-search__residence-hint"
    >
      {{ t('pages.customers.residenceReminderScopeHint') }}
    </el-alert>
    <el-form
      class="customer-list-search__form"
      :model="searchForm"
      :inline="false"
      label-position="top"
    >
      <div class="customer-list-search__toolbar">
        <div class="customer-list-search__toolbar-grid">
          <div class="customer-list-search__toolbar-keyword">
            <span class="customer-list-search__toolbar-label">{{ t('common.keyword') }}</span>
            <el-input
              v-model="searchForm.keyword"
              class="customer-list-search__toolbar-input"
              :placeholder="t('pages.customers.keywordPlaceholder')"
              clearable
              :aria-label="t('common.keyword')"
              @keyup.enter="emit('search')"
            >
              <template #prefix>
                <el-icon class="customer-list-search__toolbar-input-icon"><Search /></el-icon>
              </template>
            </el-input>
          </div>

          <el-form-item class="customer-list-search__toolbar-field" :label="t('common.type')">
            <el-select
              v-model="searchForm.customerType"
              :placeholder="t('common.all')"
              clearable
              class="customer-list-search__select"
            >
              <el-option
                :label="CustomerTypeLabel[CustomerType.COMPANY]"
                :value="CustomerType.COMPANY"
              />
              <el-option
                :label="CustomerTypeLabel[CustomerType.PERSONAL]"
                :value="CustomerType.PERSONAL"
              />
            </el-select>
          </el-form-item>

          <el-form-item
            class="customer-list-search__toolbar-field"
            :label="t('pages.customers.serviceTypeFilter')"
          >
            <el-select
              v-model="searchForm.serviceType"
              :placeholder="t('common.all')"
              clearable
              class="customer-list-search__select"
            >
              <el-option :label="ServiceTypeLabel[ServiceType.ADMIN]" :value="ServiceType.ADMIN" />
              <el-option :label="ServiceTypeLabel[ServiceType.TAX]" :value="ServiceType.TAX" />
              <el-option :label="ServiceTypeLabel[ServiceType.BOTH]" :value="ServiceType.BOTH" />
            </el-select>
          </el-form-item>

          <el-form-item class="customer-list-search__toolbar-field" :label="t('common.status')">
            <el-select
              v-model="searchForm.status"
              :placeholder="t('common.all')"
              clearable
              class="customer-list-search__select"
            >
              <el-option
                :label="CustomerStatusLabel[CustomerStatus.ACTIVE]"
                :value="CustomerStatus.ACTIVE"
              />
              <el-option
                :label="CustomerStatusLabel[CustomerStatus.INACTIVE]"
                :value="CustomerStatus.INACTIVE"
              />
            </el-select>
          </el-form-item>

          <div class="customer-list-search__toolbar-actions">
            <el-button type="primary" :icon="Search" :loading="loading" @click="emit('search')">
              {{ t('common.search') }}
            </el-button>
            <el-button :icon="Refresh" @click="emit('reset')">{{ t('common.reset') }}</el-button>
          </div>

          <div class="customer-list-search__toolbar-more">
            <el-badge
              :value="drawerActiveFilterCount"
              :hidden="drawerActiveFilterCount === 0"
              class="customer-list-search__more-badge"
            >
              <el-button :icon="Filter" @click="openMoreFiltersDrawer">
                {{ t('pages.customers.searchMoreFiltersButton') }}
              </el-button>
            </el-badge>
          </div>
        </div>
      </div>

      <div
        v-if="filterChips.length > 0"
        class="customer-list-search__chips"
        role="region"
        :aria-label="t('pages.customers.searchAppliedFilters')"
      >
        <span class="customer-list-search__chips-label">{{ t('pages.customers.searchAppliedFilters') }}</span>
        <div class="customer-list-search__chips-list">
          <el-tag
            v-for="chip in filterChips"
            :key="chip.id"
            class="customer-list-search__chip"
            type="info"
            effect="plain"
            closable
            :aria-label="t('pages.customers.searchRemoveFilterChip', { label: chip.label })"
            @close="removeFilterChip(chip.id)"
          >
            {{ chip.label }}
          </el-tag>
        </div>
        <el-button
          class="customer-list-search__chips-clear"
          text
          type="primary"
          size="small"
          @click="emit('reset')"
        >
          {{ t('pages.customers.searchClearAllFilters') }}
        </el-button>
      </div>
    </el-form>

    <el-drawer
      v-model="moreFiltersDrawerOpen"
      :title="t('pages.customers.searchMoreFiltersDrawerTitle')"
      :size="DRAWER_WIDTH_PX"
      direction="rtl"
      append-to-body
      class="customer-list-more-filters-drawer"
    >
      <el-form
        class="customer-list-search__drawer-form"
        :model="searchForm"
        label-position="top"
      >
        <div class="customer-list-search__surface customer-list-search__drawer-section">
          <section
            class="customer-list-search__section customer-list-search__section--case"
            aria-labelledby="customer-list-search-drawer-case"
          >
            <div class="customer-list-search__section-head">
              <h4 id="customer-list-search-drawer-case" class="customer-list-search__section-title">
                {{ t('pages.customers.searchFilterGroupVisaCase') }}
              </h4>
            </div>
            <div class="customer-list-search__row customer-list-search__row--advanced-stack">
              <el-form-item
                class="customer-list-search__item customer-list-search__item--primary-status"
                :label="t('pages.customers.listPrimaryVisaCaseStatusFilter')"
              >
                <el-select
                  v-model="searchForm.listPrimaryVisaCaseStatus"
                  :placeholder="t('common.all')"
                  clearable
                  class="customer-list-search__select customer-list-search__select--wide"
                >
                  <el-option
                    v-for="st in PRIMARY_CASE_STATUS_FILTER_OPTIONS"
                    :key="st"
                    :label="VisaCaseStatusLabel[st]"
                    :value="st"
                  />
                </el-select>
              </el-form-item>
              <el-form-item class="customer-list-search__item" :label="t('pages.customers.visaCaseTypeFilter')">
                <CustomerListVisaCaseTypeFilter v-model="searchForm.visaCaseTypeKeyword" />
              </el-form-item>
              <el-form-item
                class="customer-list-search__item"
                :label="t('pages.customers.listPrimaryFamilyCaseFilter')"
              >
                <el-select
                  v-model="searchForm.listPrimaryFamilyCaseFilter"
                  :placeholder="t('common.all')"
                  clearable
                  class="customer-list-search__select"
                >
                  <el-option
                    :label="t('pages.customers.listPrimaryFamilyCaseFilterYes')"
                    value="yes"
                  />
                  <el-option
                    :label="t('pages.customers.listPrimaryFamilyCaseFilterNo')"
                    value="no"
                  />
                </el-select>
              </el-form-item>
              <el-form-item
                class="customer-list-search__item"
                :label="t('pages.customers.listPrimaryFamilyLinkModeFilter')"
              >
                <el-select
                  v-model="searchForm.listPrimaryFamilyLinkMode"
                  :placeholder="t('common.all')"
                  clearable
                  class="customer-list-search__select"
                >
                  <el-option
                    :label="FamilyLinkModeLabel[FamilyLinkMode.INTERNAL]"
                    :value="FamilyLinkMode.INTERNAL"
                  />
                  <el-option
                    :label="FamilyLinkModeLabel[FamilyLinkMode.EXTERNAL]"
                    :value="FamilyLinkMode.EXTERNAL"
                  />
                </el-select>
              </el-form-item>
            </div>
          </section>
        </div>

        <div class="customer-list-search__surface customer-list-search__drawer-section">
          <section
            class="customer-list-search__section customer-list-search__section--alert"
            aria-labelledby="customer-list-search-drawer-alert"
          >
            <h4 id="customer-list-search-drawer-alert" class="customer-list-search__section-title">
              {{ t('pages.customers.searchFilterGroupAlert') }}
            </h4>
            <div class="customer-list-search__row customer-list-search__row--alert-fields">
              <el-form-item class="customer-list-search__item customer-list-search__item--fill">
                <template #label>
                  <span class="customer-list-search__label-wrap">
                    {{ t('pages.customers.visaRiskBucketFilter') }}
                    <el-tooltip
                      v-if="!compactLayout"
                      :content="t('pages.customers.searchFilterReminderBucketHint')"
                      placement="top"
                    >
                      <el-icon class="customer-list-search__hint-icon" :aria-label="t('common.hint')">
                        <QuestionFilled />
                      </el-icon>
                    </el-tooltip>
                  </span>
                </template>
                <el-select
                  v-model="searchForm.visaReminderBucket"
                  :placeholder="t('common.all')"
                  clearable
                  class="customer-list-search__select customer-list-search__select--wide"
                >
                  <el-option
                    v-for="rb in VISA_REMINDER_BUCKET_DISPLAY_ORDER"
                    :key="rb"
                    :label="VisaReminderTypeLabel[rb]"
                    :value="rb"
                  />
                </el-select>
                <p v-if="compactLayout" class="customer-list-search__field-hint">
                  {{ t('pages.customers.searchFilterReminderBucketHint') }}
                </p>
              </el-form-item>
              <el-form-item class="customer-list-search__item customer-list-search__item--fill">
                <template #label>
                  <span class="customer-list-search__label-wrap">
                    {{ t('pages.customers.residenceExpireWithinDaysFilter') }}
                    <el-tooltip
                      v-if="!compactLayout"
                      :content="t('pages.customers.searchFilterResidenceHint')"
                      placement="top"
                    >
                      <el-icon class="customer-list-search__hint-icon" :aria-label="t('common.hint')">
                        <QuestionFilled />
                      </el-icon>
                    </el-tooltip>
                  </span>
                </template>
                <el-select
                  v-model="searchForm.residenceExpireWithinDays"
                  :placeholder="t('common.all')"
                  clearable
                  class="customer-list-search__select"
                >
                  <el-option
                    v-for="days in RESIDENCE_EXPIRE_WITHIN_DAY_PRESETS"
                    :key="days"
                    :label="t('pages.customers.residenceWithinDaysOption', { days })"
                    :value="days"
                  />
                </el-select>
                <p v-if="compactLayout" class="customer-list-search__field-hint">
                  {{ t('pages.customers.searchFilterResidenceHint') }}
                </p>
              </el-form-item>
            </div>
          </section>
        </div>

        <div class="customer-list-search__drawer-hint customer-list-search__drawer-hint--customer">
          <el-icon class="customer-list-search__drawer-hint-icon" aria-hidden="true">
            <InfoFilled />
          </el-icon>
          <span>{{ t('pages.customers.searchFilterGroupCustomerHint') }}</span>
        </div>
      </el-form>

      <template #footer>
        <div class="customer-list-search__drawer-footer">
          <el-button @click="resetDrawerScopeFilters">
            {{ t('pages.customers.searchResetDrawerFilters') }}
          </el-button>
          <el-button type="primary" :loading="loading" @click="applyDrawerAndClose">
            {{ t('pages.customers.searchApplyDrawerFilters') }}
          </el-button>
        </div>
      </template>
    </el-drawer>
  </div>
</template>

<style scoped lang="scss" src="./CustomerListSearchPanel.scoped.scss"></style>
