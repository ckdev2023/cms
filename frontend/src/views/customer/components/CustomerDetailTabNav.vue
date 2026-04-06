<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";

const props = defineProps<{
  /** 是否展示签证域主路径 Tab（与详情页 `showVisaDomainTab` 一致）。 */
  showVisaDomainTab: boolean;
  /** 是否展示行政案件 Tab（与详情页 `showAdminCasesTab` 一致）。 */
  showAdminCasesTab: boolean;
  /**
   * 主展示案件处于未结案管道时详情会默认落在该 Tab；此时略加强激活态，区分于「堆叠工作台」主视图语义。
   */
  visaDomainWorkbenchHint: boolean;
}>();

defineOptions({ name: "CustomerDetailTabNav" });

const activeTab = defineModel<string>("activeTab", { required: true });

const { t } = useI18n();

/** 与堆叠签证域、默认 Tab 规则（`customerDetailPrefersVisaDomainTab`）对齐的说明：有工作台默认提示时前置一句，再接正文。 */
const visaDomainTabTooltipText = computed((): string => {
  const body = t("detailViews.customer.stitchLayout.visaWorkbenchTabTooltip");
  if (!props.visaDomainWorkbenchHint) {
    return body;
  }
  return `${t("detailViews.customer.stitchLayout.tabNavVisaDefaultLandingHint")} ${body}`;
});
</script>

<template>
  <div
    class="customer-detail-tab-nav"
    role="tablist"
    aria-orientation="horizontal"
  >
    <div
      class="customer-detail-tab-nav__row customer-detail-tab-nav__row--primary"
    >
      <span
        class="customer-detail-tab-nav__primary-row-label"
        aria-hidden="true"
      >
        {{ t("detailViews.customer.stitchLayout.detailTabsPrimaryRowLabel") }}
      </span>
      <div
        class="customer-detail-tab-nav__primary-tabs"
        role="group"
        :aria-label="
          t('detailViews.customer.stitchLayout.detailTabsPrimaryTabsScrollAriaLabel')
        "
      >
        <button
          type="button"
          role="tab"
          class="customer-detail-tab-nav__item"
          :class="{ 'is-active': activeTab === 'basic' }"
          :aria-selected="activeTab === 'basic'"
          @click="activeTab = 'basic'"
        >
          {{ t("detailViews.customer.basicInfo") }}
        </button>
        <button
          type="button"
          role="tab"
          class="customer-detail-tab-nav__item"
          :class="{ 'is-active': activeTab === 'notes' }"
          :aria-selected="activeTab === 'notes'"
          @click="activeTab = 'notes'"
        >
          {{ t("detailViews.customer.notes") }}
        </button>
        <el-tooltip
          v-if="showVisaDomainTab"
          :content="visaDomainTabTooltipText"
          placement="top"
        >
          <span class="customer-detail-tab-nav__tooltip-host">
            <button
              type="button"
              role="tab"
              class="customer-detail-tab-nav__item"
              :class="{
                'is-active': activeTab === 'visa-domain',
                'is-visa-workbench-default': visaDomainWorkbenchHint,
              }"
              :aria-selected="activeTab === 'visa-domain'"
              @click="activeTab = 'visa-domain'"
            >
              {{ t("detailViews.customer.stitchLayout.visaWorkbenchTab") }}
            </button>
          </span>
        </el-tooltip>
      </div>
    </div>
    <div
      class="customer-detail-tab-nav__row customer-detail-tab-nav__row--secondary"
    >
      <el-tooltip
        :content="t('detailViews.customer.stitchLayout.ledgerRowTooltip')"
        placement="top"
      >
        <span class="customer-detail-tab-nav__tooltip-host">
          <span
            class="customer-detail-tab-nav__secondary-label"
            aria-hidden="true"
          >
            {{ t("detailViews.customer.detailTabsLedgerRowLabel") }}
          </span>
        </span>
      </el-tooltip>
      <div
        class="customer-detail-tab-nav__segmented"
        role="presentation"
      >
        <button
          type="button"
          role="tab"
          class="customer-detail-tab-nav__item customer-detail-tab-nav__item--secondary"
          :class="{ 'is-active': activeTab === 'tax' }"
          :aria-selected="activeTab === 'tax'"
          @click="activeTab = 'tax'"
        >
          {{ t("detailViews.customer.tax") }}
        </button>
        <button
          type="button"
          role="tab"
          class="customer-detail-tab-nav__item customer-detail-tab-nav__item--secondary"
          :class="{ 'is-active': activeTab === 'finance' }"
          :aria-selected="activeTab === 'finance'"
          @click="activeTab = 'finance'"
        >
          {{ t("detailViews.customer.finance") }}
        </button>
        <button
          type="button"
          role="tab"
          class="customer-detail-tab-nav__item customer-detail-tab-nav__item--secondary"
          :class="{ 'is-active': activeTab === 'files' }"
          :aria-selected="activeTab === 'files'"
          @click="activeTab = 'files'"
        >
          {{ t("detailViews.customer.files") }}
        </button>
        <el-tooltip
          v-if="showAdminCasesTab"
          :content="t('detailViews.customer.adminCasesTabTooltip')"
          placement="top"
        >
          <span class="customer-detail-tab-nav__tooltip-host">
            <button
              type="button"
              role="tab"
              class="customer-detail-tab-nav__item customer-detail-tab-nav__item--secondary"
              :class="{ 'is-active': activeTab === 'admin-cases' }"
              :aria-selected="activeTab === 'admin-cases'"
              @click="activeTab = 'admin-cases'"
            >
              <span
                :class="{
                  'customer-detail-tab-label--weakened':
                    activeTab !== 'admin-cases',
                }"
              >
                {{ t("detailViews.customer.adminCases") }}
              </span>
            </button>
          </span>
        </el-tooltip>
      </div>
    </div>
  </div>
</template>

<style scoped>
/**
 * 导航与 design/apple/DESIGN.md 对齐：单行分隔线、去竖线分割、分段控件用 Filter Button 式描边。
 */
.customer-detail-tab-nav {
  margin-bottom: 0;
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}

.customer-detail-tab-nav__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0;
  border-bottom: none;
}

.customer-detail-tab-nav__row--primary {
  align-items: flex-end;
  gap: 10px 12px;
}

.customer-detail-tab-nav__primary-row-label {
  flex-shrink: 0;
  align-self: center;
  margin: 0;
  padding: 2px 14px 2px 0;
  font-size: var(--el-font-size-extra-small);
  font-weight: 400;
  letter-spacing: -0.02em;
  color: rgba(0, 0, 0, 0.48);
  border-right: none;
  white-space: nowrap;
}

.customer-detail-tab-nav__primary-tabs {
  display: flex;
  flex: 1 1 auto;
  flex-wrap: nowrap;
  align-items: flex-end;
  gap: 0;
  min-width: 0;
  overflow-x: auto;
  overflow-y: hidden;
  overscroll-behavior-x: contain;
  scrollbar-width: thin;
}

.customer-detail-tab-nav__primary-tabs::-webkit-scrollbar {
  height: 6px;
}

.customer-detail-tab-nav__primary-tabs::-webkit-scrollbar-thumb {
  border-radius: 3px;
  background-color: var(--el-border-color);
}

.customer-detail-tab-nav__row--secondary {
  flex-wrap: wrap;
  gap: 10px 12px;
  margin-top: 10px;
  padding-top: 0;
  padding-bottom: 0;
  border-bottom: none;
}

.customer-detail-tab-nav__secondary-label {
  flex-shrink: 0;
  align-self: center;
  margin: 0;
  padding: 2px 14px 2px 0;
  font-size: var(--el-font-size-extra-small);
  font-weight: 400;
  letter-spacing: -0.02em;
  color: rgba(0, 0, 0, 0.48);
  border-right: none;
  white-space: nowrap;
}

.customer-detail-tab-nav__segmented {
  display: inline-flex;
  flex: 1 1 auto;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px;
  min-height: 32px;
  padding: 3px;
  border: 3px solid rgba(0, 0, 0, 0.04);
  border-radius: 11px;
  background: #fafafc;
  box-sizing: border-box;
}

.customer-detail-tab-nav__tooltip-host {
  display: inline-flex;
  vertical-align: bottom;
}

.customer-detail-tab-nav__item {
  position: relative;
  flex: 0 0 auto;
  box-sizing: border-box;
  margin: 0;
  padding: 0 20px;
  height: 40px;
  line-height: 40px;
  font-size: var(--el-font-size-base);
  font-family: inherit;
  color: var(--el-text-color-regular);
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  transition:
    color var(--el-transition-duration) ease,
    border-color var(--el-transition-duration) ease;
}

.customer-detail-tab-nav__item:not(.customer-detail-tab-nav__item--secondary):focus-visible {
  z-index: 1;
  border-radius: var(--el-border-radius-small) var(--el-border-radius-small) 0 0;
  outline: 2px solid #0071e3;
  outline-offset: 2px;
}

.customer-detail-tab-nav__item:hover {
  color: var(--el-color-primary);
}

.customer-detail-tab-nav__item.is-active {
  color: var(--el-color-primary);
  border-bottom-color: var(--el-color-primary);
  font-weight: 500;
}

/* 有进行中主展示案件时详情常落在此 Tab；激活态略加强以标示「工作台」主路径 */
.customer-detail-tab-nav__item.is-visa-workbench-default.is-active {
  font-weight: 600;
  border-bottom-width: 3px;
  border-radius: var(--el-border-radius-small) var(--el-border-radius-small) 0 0;
  background: var(--el-color-primary-light-9);
}

.customer-detail-tab-nav__item:not(.is-active) .customer-detail-tab-label--weakened {
  color: var(--el-text-color-secondary);
  font-size: var(--el-font-size-small);
  font-weight: 400;
}

.customer-detail-tab-nav__item--secondary {
  height: 26px;
  line-height: 26px;
  padding: 0 12px;
  font-size: var(--el-font-size-small);
  color: var(--el-text-color-regular);
  border: none;
  border-bottom: none;
  border-radius: calc(var(--el-border-radius-base) - 2px);
  box-shadow: none;
  transition:
    color var(--el-transition-duration) ease,
    background-color var(--el-transition-duration) ease,
    box-shadow var(--el-transition-duration) ease;
}

.customer-detail-tab-nav__item--secondary:hover {
  color: var(--el-color-primary);
  background: var(--el-fill-color-blank);
}

.customer-detail-tab-nav__item--secondary:focus-visible {
  outline: 2px solid #0071e3;
  outline-offset: 1px;
}

.customer-detail-tab-nav__item--secondary.is-active {
  font-weight: 500;
  color: var(--el-color-primary);
  background: var(--el-bg-color);
  box-shadow: 0 1px 2px rgb(0 0 0 / 8%);
}

.customer-detail-tab-nav__item--secondary.is-active:hover {
  background: var(--el-bg-color);
}
</style>
