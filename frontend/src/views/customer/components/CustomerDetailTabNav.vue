<script setup lang="ts">
import { useI18n } from "vue-i18n";

defineProps<{
  /** 是否展示签证域主路径 Tab（与详情页 `showVisaDomainTab` 一致）。 */
  showVisaDomainTab: boolean;
  /** 是否展示行政案件 Tab（与详情页 `showAdminCasesTab` 一致）。 */
  showAdminCasesTab: boolean;
}>();

defineOptions({ name: "CustomerDetailTabNav" });

const activeTab = defineModel<string>("activeTab", { required: true });

const { t } = useI18n();
</script>

<template>
  <div class="customer-detail-tab-nav" role="tablist">
    <div
      class="customer-detail-tab-nav__row customer-detail-tab-nav__row--primary"
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
        :content="t('detailViews.customer.visaDomainTabTooltip')"
        placement="top"
      >
        <span class="customer-detail-tab-nav__tooltip-host">
          <button
            type="button"
            role="tab"
            class="customer-detail-tab-nav__item"
            :class="{ 'is-active': activeTab === 'visa-domain' }"
            :aria-selected="activeTab === 'visa-domain'"
            @click="activeTab = 'visa-domain'"
          >
            {{ t("detailViews.customer.visaDomain") }}
          </button>
        </span>
      </el-tooltip>
      <el-tooltip
        v-if="showAdminCasesTab"
        :content="t('detailViews.customer.adminCasesTabTooltip')"
        placement="top"
      >
        <span class="customer-detail-tab-nav__tooltip-host">
          <button
            type="button"
            role="tab"
            class="customer-detail-tab-nav__item"
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
    <div
      class="customer-detail-tab-nav__row customer-detail-tab-nav__row--secondary"
    >
      <span
        class="customer-detail-tab-nav__secondary-label"
        aria-hidden="true"
      >
        {{ t("detailViews.customer.detailTabsLedgerRowLabel") }}
      </span>
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
      </div>
    </div>
  </div>
</template>

<style scoped>
.customer-detail-tab-nav {
  margin-bottom: 0;
}

.customer-detail-tab-nav__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0;
  border-bottom: 1px solid var(--el-border-color-light);
}

.customer-detail-tab-nav__row--secondary {
  flex-wrap: wrap;
  gap: 10px 12px;
  margin-top: 6px;
  padding-top: 8px;
  padding-bottom: 2px;
  border-bottom: none;
}

.customer-detail-tab-nav__secondary-label {
  flex-shrink: 0;
  align-self: center;
  margin: 0;
  padding: 2px 12px 2px 0;
  font-size: var(--el-font-size-extra-small);
  font-weight: 500;
  letter-spacing: 0.02em;
  color: var(--el-text-color-secondary);
  border-right: 1px solid var(--el-border-color-lighter);
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
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--el-border-radius-base);
  background: var(--el-fill-color-light);
  box-sizing: border-box;
}

.customer-detail-tab-nav__tooltip-host {
  display: inline-flex;
  vertical-align: bottom;
}

.customer-detail-tab-nav__item {
  position: relative;
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

.customer-detail-tab-nav__item:hover {
  color: var(--el-color-primary);
}

.customer-detail-tab-nav__item.is-active {
  color: var(--el-color-primary);
  border-bottom-color: var(--el-color-primary);
  font-weight: 500;
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
  outline: 2px solid var(--el-color-primary-light-5);
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
