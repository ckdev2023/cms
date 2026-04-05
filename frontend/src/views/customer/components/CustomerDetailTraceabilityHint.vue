<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute, useRouter } from "vue-router";

import { P } from "@/constants/permissions";
import { useUserStore } from "@/stores/user";
import { visaUiVisaPrimaryEntriesVisible } from "@/utils/visa-ui-feature-flags";

defineOptions({ name: "CustomerDetailTraceabilityHint" });

const { t } = useI18n({ useScope: "global" });
const route = useRoute();
const router = useRouter();
const userStore = useUserStore();

/** `el-collapse` 已展开面板名；默认空数组表示长说明收起。 */
const activeCollapseNames = ref<string[]>([]);

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
  <div class="customer-detail-traceability-hint">
    <div class="customer-detail-traceability-hint__intro">
      <p class="customer-detail-traceability-hint__text">
        <template v-if="showVisaCaseLogsLink">
          {{ t("detailViews.customer.traceabilityHint.summaryLineWithVisa") }}
        </template>
        <template v-else>
          {{ t("detailViews.customer.traceabilityHint.summaryLineWithoutVisa") }}
        </template>
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

    <el-collapse
      v-model="activeCollapseNames"
      class="customer-detail-traceability-hint__collapse"
    >
      <el-collapse-item name="rules">
        <template #title>
          <span class="customer-detail-traceability-hint__collapse-title">
            {{
              activeCollapseNames.includes("rules")
                ? t("detailViews.customer.traceabilityHint.collapseRulesLabel")
                : t("detailViews.customer.traceabilityHint.expandRulesLabel")
            }}
          </span>
        </template>
        <p class="customer-detail-traceability-hint__detail-body">
          <template v-if="showVisaCaseLogsLink">
            {{ t("detailViews.customer.traceabilityHint.detailExpandedWithVisa") }}
          </template>
          <template v-else>
            {{
              t("detailViews.customer.traceabilityHint.detailExpandedWithoutVisa")
            }}
          </template>
        </p>
      </el-collapse-item>
    </el-collapse>
  </div>
</template>

<style scoped lang="scss">
.customer-detail-traceability-hint {
  margin-bottom: 12px;
  padding: 8px 12px;
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--el-border-radius-base);

  &__intro {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: 8px 12px;
    margin-bottom: 4px;
  }

  &__text {
    flex: 1 1 200px;
    min-width: 0;
    margin: 0;
    font-size: var(--el-font-size-small);
    line-height: 1.55;
    color: var(--el-text-color-regular);
  }

  &__actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 12px;
    flex-shrink: 0;
  }

  &__collapse {
    margin-top: 4px;
    border: none;
    --el-collapse-header-height: auto;

    :deep(.el-collapse-item__header) {
      height: auto;
      min-height: 32px;
      line-height: 1.45;
      padding: 6px 0;
      font-size: var(--el-font-size-small);
      color: var(--el-color-primary);
      background: transparent;
      border: none;
    }

    :deep(.el-collapse-item__arrow) {
      margin: 0 6px 0 0;
    }

    :deep(.el-collapse-item__wrap) {
      background: transparent;
      border: none;
    }

    :deep(.el-collapse-item__content) {
      padding-top: 0;
      padding-bottom: 4px;
    }
  }

  &__collapse-title {
    font-weight: 500;
  }

  &__detail-body {
    margin: 0;
    font-size: var(--el-font-size-small);
    line-height: 1.55;
    color: var(--el-text-color-secondary);
  }
}
</style>
