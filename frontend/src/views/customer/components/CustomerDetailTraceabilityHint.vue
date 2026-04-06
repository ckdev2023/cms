<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute, useRouter } from "vue-router";

import { P } from "@/constants/permissions";
import { useUserStore } from "@/stores/user";
import { visaUiVisaPrimaryEntriesVisible } from "@/utils/visa-ui-feature-flags";

const props = withDefaults(
  defineProps<{
    /**
     * `compact`：嵌入 `PageDetail` 页眉第二行时使用更短摘要与更紧间距。
     */
    density?: "default" | "compact";
    /**
     * `expandable-panel`：用于签证页眉折叠区，展示摘要+完整说明+快捷链接，不使用 Popover。
     */
    variant?: "default" | "expandable-panel";
  }>(),
  { density: "default", variant: "default" },
);

defineOptions({ name: "CustomerDetailTraceabilityHint" });

const { t } = useI18n({ useScope: "global" });
const route = useRoute();
const router = useRouter();
const userStore = useUserStore();

/**
 * 与 `CustomerDetailView` 签证域 Tab 及备注页「前往案件日志」深链一致。
 *
 * @returns 可展示「打开案件日志」入口时返回 true
 */
const showVisaCaseLogsLink = computed((): boolean =>
  visaUiVisaPrimaryEntriesVisible() &&
  (userStore.hasPermission(P.VISA_CASE_LIST) ||
    userStore.hasPermission(P.VISA_CASE_DETAIL) ||
    userStore.hasPermission(P.VISA_REMINDER_LIST) ||
    userStore.hasPermission(P.CUSTOMER_FILE_PATH_LIST)),
);

/**
 * Popover 内完整分工说明（按是否具备签证域入口分支）。
 */
const rulesDetailBody = computed((): string =>
  showVisaCaseLogsLink.value
    ? String(t("detailViews.customer.traceabilityHint.detailExpandedWithVisa"))
    : String(t("detailViews.customer.traceabilityHint.detailExpandedWithoutVisa")),
);

/**
 * 单行摘要（按是否具备签证域入口分支）。
 */
const summaryLine = computed((): string => {
  if (props.variant === "expandable-panel" || props.density === "compact") {
    return showVisaCaseLogsLink.value
      ? String(
          t(
            "detailViews.customer.traceabilityHint.summaryLineHeaderCompactWithVisa",
          ),
        )
      : String(
          t(
            "detailViews.customer.traceabilityHint.summaryLineHeaderCompactWithoutVisa",
          ),
        );
  }
  return showVisaCaseLogsLink.value
    ? String(t("detailViews.customer.traceabilityHint.summaryLineWithVisa"))
    : String(t("detailViews.customer.traceabilityHint.summaryLineWithoutVisa"));
});

/**
 * 将当前详情路由切换到签证域并展开案件日志子区块。
 */
function goVisaCaseLogs(): void {
  void router.push({
    path: route.path,
    query: {
      ...route.query,
      tab: "visa-domain",
      visaDomainBlock: "logs",
    },
  });
}

/**
 * 将当前详情路由切换到客户备注 Tab。
 */
function goCustomerNotes(): void {
  void router.push({
    path: route.path,
    query: {
      ...route.query,
      tab: "notes",
    },
  });
}
</script>

<template>
  <div
    v-if="variant === 'expandable-panel'"
    class="customer-detail-traceability-hint customer-detail-traceability-hint--expandable-panel"
  >
    <p class="customer-detail-traceability-hint__panel-summary">
      {{ summaryLine }}
    </p>
    <p class="customer-detail-traceability-hint__panel-detail">
      {{ rulesDetailBody }}
    </p>
    <div class="customer-detail-traceability-hint__actions">
      <el-button
        v-if="showVisaCaseLogsLink"
        type="primary"
        link
        @click="goVisaCaseLogs"
      >
        {{ t("detailViews.customer.traceabilityHint.goCaseLogs") }}
      </el-button>
      <el-button type="primary" link @click="goCustomerNotes">
        {{ t("detailViews.customer.traceabilityHint.goNotes") }}
      </el-button>
    </div>
  </div>
  <div
    v-else
    class="customer-detail-traceability-hint"
    :class="{ 'customer-detail-traceability-hint--compact': density === 'compact' }"
  >
    <p class="customer-detail-traceability-hint__summary">
      {{ summaryLine }}
      <el-popover
        placement="bottom-start"
        :width="360"
        trigger="click"
      >
        <template #reference>
          <el-button
            class="customer-detail-traceability-hint__rules-btn"
            type="primary"
            link
          >
            {{ t("detailViews.customer.traceabilityHint.rulesPopoverTrigger") }}
          </el-button>
        </template>
        <p class="customer-detail-traceability-hint__popover-body">
          {{ rulesDetailBody }}
        </p>
      </el-popover>
    </p>
    <div class="customer-detail-traceability-hint__actions">
      <el-button
        v-if="showVisaCaseLogsLink"
        type="primary"
        link
        @click="goVisaCaseLogs"
      >
        {{ t("detailViews.customer.traceabilityHint.goCaseLogs") }}
      </el-button>
      <el-button type="primary" link @click="goCustomerNotes">
        {{ t("detailViews.customer.traceabilityHint.goNotes") }}
      </el-button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.customer-detail-traceability-hint {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 8px 16px;
  margin-bottom: 0;
  padding: var(--app-spacing-sm) var(--app-spacing-md);
  background: transparent;
  border-radius: 0;
}

.customer-detail-traceability-hint__summary {
  flex: 1 1 240px;
  min-width: 0;
  margin: 0;
  font-size: var(--el-font-size-small);
  line-height: 1.5;
  color: var(--el-text-color-regular);
}

.customer-detail-traceability-hint__rules-btn {
  margin-left: 4px;
  vertical-align: baseline;
  height: auto;
  padding: 0 2px;
}

.customer-detail-traceability-hint__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 12px;
  flex-shrink: 0;
}

.customer-detail-traceability-hint__popover-body {
  margin: 0;
  font-size: var(--el-font-size-small);
  line-height: 1.55;
  color: var(--el-text-color-regular);
}

.customer-detail-traceability-hint--compact {
  padding: 2px 0 0;
  gap: 6px 12px;
}

.customer-detail-traceability-hint--compact .customer-detail-traceability-hint__summary {
  font-size: var(--el-font-size-extra-small);
  line-height: 1.45;
  color: var(--el-text-color-secondary);
}

.customer-detail-traceability-hint--compact .customer-detail-traceability-hint__actions {
  gap: 2px 8px;
}

.customer-detail-traceability-hint--compact .customer-detail-traceability-hint__actions :deep(.el-button) {
  font-size: var(--el-font-size-extra-small);
}

.customer-detail-traceability-hint--expandable-panel {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: var(--app-spacing-sm);
  margin: 0;
  padding: 0;
  background: transparent;
}

.customer-detail-traceability-hint__panel-summary,
.customer-detail-traceability-hint__panel-detail {
  margin: 0;
  font-size: var(--el-font-size-small);
  line-height: 1.55;
  color: var(--el-text-color-regular);
}

.customer-detail-traceability-hint__panel-summary {
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.customer-detail-traceability-hint--expandable-panel .customer-detail-traceability-hint__actions {
  padding-top: 2px;
}
</style>
