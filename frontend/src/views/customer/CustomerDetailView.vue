<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute, useRouter } from "vue-router";

import { getCustomer } from "@/api/customer";
import PageDetail from "@/components/PageDetail.vue";
import {
  CustomerStatusLabel,
  CustomerTypeLabel,
} from "@/constants/enum-labels";
import {
  type CustomerStatus,
  type CustomerType,
  FamilyLinkMode,
} from "@/constants/enums";
import { P } from "@/constants/permissions";
import { useUserStore } from "@/stores/user";
import type { CustomerDetail } from "@/types/customer";
import { customerDetailPrefersVisaDomainTab } from "@/utils/customer-detail-default-tab";
import {
  isTrustedCustomerDetailHistoryBack,
  parseCustomerDetailReturnTarget,
} from "@/utils/customer-detail-return-navigation";
import { pickCustomerHubReturnQueryPreserve } from "@/utils/customer-detail-return-path";
import {
  isVisaDomainBlockQueryValue,
  parseVisaDomainBlockFromLocationHash,
  type VisaDomainBlockQueryValue,
} from "@/utils/customer-detail-visa-domain-deeplink";
import { visaUiVisaPrimaryEntriesVisible } from "@/utils/visa-ui-feature-flags";

import CustomerAdminCasesTab from "./components/CustomerAdminCasesTab.vue";
import CustomerBasicInfoTab from "./components/CustomerBasicInfoTab.vue";
import CustomerDetailStickyActions from "./components/CustomerDetailStickyActions.vue";
import CustomerDetailTabNav from "./components/CustomerDetailTabNav.vue";
import CustomerDetailTraceabilityHint from "./components/CustomerDetailTraceabilityHint.vue";
import CustomerDetailVisaHeaderHub from "./components/CustomerDetailVisaHeaderHub.vue";
import CustomerFilesTab from "./components/CustomerFilesTab.vue";
import CustomerFormDialog from "./components/CustomerFormDialog.vue";
import CustomerNotesTab from "./components/CustomerNotesTab.vue";
import CustomerTaxContractsTab from "./components/CustomerTaxContractsTab.vue";
import CustomerVisaDomainTab from "./components/CustomerVisaDomainTab.vue";

defineOptions({ name: "CustomerDetailView" });

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const userStore = useUserStore();
const loading = ref(false);
const customer = ref<CustomerDetail | null>(null);
const activeTab = ref("basic");
/** 无显式 `?tab=` 时仅应用一次「有进行中主展示案件则默认签证域」规则，避免保存刷新后抢 Tab。 */
const detailDefaultTabResolved = ref(false);
const showEditDialog = ref(false);

const customerId = computed(() => route.params.id as string);

/**
 * P2-S3f + docs/21：主路径开关开启且具备任一签证域只读能力时展示签证 Tab；子区块仍各自校验细粒度权限。
 */
const showVisaDomainTab = computed(
  (): boolean =>
    visaUiVisaPrimaryEntriesVisible() &&
    (userStore.hasPermission(P.VISA_CASE_LIST) ||
      userStore.hasPermission(P.VISA_CASE_DETAIL) ||
      userStore.hasPermission(P.VISA_REMINDER_LIST) ||
      userStore.hasPermission(P.CUSTOMER_FILE_PATH_LIST)),
);

/** docs/21 §14.1 B8：行政案件 Tab 与列表路由一致，需 `admin_case:list`。 */
const showAdminCasesTab = computed((): boolean =>
  userStore.hasPermission(P.ADMIN_CASE_LIST),
);

/** 与默认 Tab 规则一致：用于签证 Tab 导航在「工作台」场景下略加强激活态。 */
const visaDomainWorkbenchHint = computed((): boolean => {
  const c = customer.value;
  if (!c || !showVisaDomainTab.value) {
    return false;
  }
  return customerDetailPrefersVisaDomainTab(c);
});

const VALID_DETAIL_TABS = new Set([
  "basic",
  "notes",
  "visa-domain",
  "admin-cases",
  "tax",
  "finance",
  "files",
]);

/**
 * 将路由 query 中的单值或重复键规范为首个非空字符串。
 *
 * @param value - `useRoute().query` 中的原始值
 * @returns 首个有效字符串或空串
 */
function queryParamAsString(value: unknown): string {
  if (typeof value === "string" && value) {
    return value;
  }
  if (Array.isArray(value) && typeof value[0] === "string") {
    return value[0];
  }
  return "";
}

const openVisaCaseIdFromQuery = computed(() =>
  queryParamAsString(route.query.openVisaCaseId),
);

/** 列表/工作台「写案件日志」深链：选中案件并可选自动打开新建表单，由日志 Tab 消费后从 URL 剥离 */
const logVisaCaseIdFromQuery = computed(() =>
  queryParamAsString(route.query.logVisaCaseId),
);

const openVisaCaseWizardFromQuery = computed(
  () => queryParamAsString(route.query.openVisaCaseWizard) === "1",
);

const openVisaCaseLogFormFromQuery = computed(
  () => queryParamAsString(route.query.openVisaCaseLogForm) === "1",
);

const suggestedNextFollowUpAtFromQuery = computed(() =>
  queryParamAsString(route.query.suggestedNextFollowUpAt),
);

/** 列表「材料清单」深链：仅材料子 Tab 消费，避免与 `openVisaCaseId`（案件子 Tab 打开编辑）冲突 */
const materialsVisaCaseIdFromQuery = computed(() =>
  queryParamAsString(route.query.materialsVisaCaseId),
);

/**
 * 签证域堆叠深链：优先消费 `visaDomainBlock` query，其次解析 history 模式下的 `#visa-domain-*` hash。
 */
const visaDomainDeepLinkBlock = computed(
  (): VisaDomainBlockQueryValue | undefined => {
    const raw = queryParamAsString(route.query.visaDomainBlock);
    if (isVisaDomainBlockQueryValue(raw)) {
      return raw;
    }
    return parseVisaDomainBlockFromLocationHash(route.hash) ?? undefined;
  },
);

const pageTitle = computed(() => {
  if (!customer.value) {
    return "";
  }
  return customer.value.customerName;
});

watch(
  () => route.query.tab,
  (tab) => {
    if (typeof tab === "string" && VALID_DETAIL_TABS.has(tab)) {
      if (tab === "visa-domain" && !showVisaDomainTab.value) {
        activeTab.value = "basic";
        return;
      }
      if (tab === "admin-cases" && !showAdminCasesTab.value) {
        activeTab.value = "basic";
        return;
      }
      activeTab.value = tab;
    }
  },
  { immediate: true },
);

/**
 * 堆叠分区深链（`visaDomainBlock` 或 `#visa-domain-*`）需落在签证域 Tab；须在 `tab` query 解析之后执行以免被覆盖。
 */
watch(
  () => [showVisaDomainTab.value, visaDomainDeepLinkBlock.value] as const,
  ([show, block]) => {
    if (show && block !== undefined) {
      activeTab.value = "visa-domain";
    }
  },
  { immediate: true },
);

watch(
  () => [showVisaDomainTab.value, queryParamAsString(route.query.tab)] as const,
  ([show, tab]) => {
    if (!show && tab === "visa-domain") {
      activeTab.value = "basic";
      const nextQuery = { ...route.query } as Record<
        string,
        string | string[] | undefined
      >;
      delete nextQuery.tab;
      delete nextQuery.openVisaCaseId;
      delete nextQuery.openVisaCaseWizard;
      delete nextQuery.logVisaCaseId;
      delete nextQuery.openVisaCaseLogForm;
      delete nextQuery.suggestedNextFollowUpAt;
      delete nextQuery.visaDomainBlock;
      delete nextQuery.materialsVisaCaseId;
      void router.replace({ query: nextQuery });
    }
  },
  { immediate: true },
);

watch(
  () => [showAdminCasesTab.value, queryParamAsString(route.query.tab)] as const,
  ([show, tab]) => {
    if (!show && tab === "admin-cases") {
      activeTab.value = "basic";
      const nextQuery = { ...route.query } as Record<
        string,
        string | string[] | undefined
      >;
      delete nextQuery.tab;
      void router.replace({ query: nextQuery });
    }
  },
  { immediate: true },
);

watch(
  customerId,
  () => {
    detailDefaultTabResolved.value = false;
    if (customerId.value) {
      fetchCustomer();
    }
  },
  { immediate: true },
);

watch(
  () =>
    [
      customer.value,
      customerId.value,
      queryParamAsString(route.query.tab),
      showVisaDomainTab.value,
    ] as const,
  ([c, , tabParam, showVisa]) => {
    if (!c) {
      return;
    }
    const tab = tabParam.trim();
    const explicit = tab.length > 0 && VALID_DETAIL_TABS.has(tab);
    if (explicit) {
      detailDefaultTabResolved.value = true;
      return;
    }
    if (detailDefaultTabResolved.value) {
      return;
    }
    detailDefaultTabResolved.value = true;
    if (showVisa && customerDetailPrefersVisaDomainTab(c)) {
      activeTab.value = "visa-domain";
    }
  },
);

/**
 * 拉取当前路由对应的客户详情并同步到页面状态。
 *
 * @throws {Error} 客户详情接口请求失败时由请求层继续抛出
 */
async function fetchCustomer() {
  loading.value = true;
  try {
    const res = await getCustomer(customerId.value);
    customer.value = res.data;
  } finally {
    loading.value = false;
  }
}

/**
 * 返回上一浏览页：优先消费 `ccFrom`（pathname 白名单 + 可恢复筛选）；无则在校验 `history.state.back` 后 `back()`；最后落到客户列表根并尽量保留数据范围类 query。
 */
function goBack(): void {
  const target = parseCustomerDetailReturnTarget(route.query);
  if (target) {
    void router.push(target);
    return;
  }
  if (
    isTrustedCustomerDetailHistoryBack(
      window.history.state?.back,
      route.fullPath,
    )
  ) {
    void router.back();
    return;
  }
  void router.push({
    path: "/customers",
    query: pickCustomerHubReturnQueryPreserve(route.query),
  });
}

function handleEdit() {
  showEditDialog.value = true;
}

function handleSaved() {
  fetchCustomer();
}

/**
 * 签证域「基本信息摘要」跳转：切换到基础信息 Tab 并同步 `?tab=basic`（与路由监听一致）。
 */
function openBasicTabFromVisaDomain(): void {
  const nextQuery = { ...route.query } as Record<
    string,
    string | string[] | undefined
  >;
  nextQuery.tab = "basic";
  void router.replace({ path: route.path, query: nextQuery });
}
</script>

<template>
  <PageDetail
    :loading="loading"
    :title="customer && showVisaDomainTab ? undefined : pageTitle"
    :header-bar-inline="Boolean(customer && showVisaDomainTab)"
    @back="goBack"
  >
    <template v-if="customer && showVisaDomainTab" #headerBar>
      <CustomerDetailVisaHeaderHub
        :customer-id="customerId"
        :customer-name="customer.customerName"
        :customer-code="customer.customerCode"
        :customer-type="customer.customerType"
        :customer-status="customer.status"
        :list-primary-visa-case="customer.listPrimaryVisaCase ?? null"
        :list-primary-visa-case-source="
          customer.listPrimaryVisaCaseSource ?? null
        "
        :primary-customer-id-for-list-fallback="
          customer.primaryCustomerIdForListFallback ?? null
        "
      />
    </template>
    <template v-else-if="customer && !showVisaDomainTab" #headerBar>
      <CustomerDetailTraceabilityHint density="compact" />
    </template>
    <template v-if="customer && !showVisaDomainTab" #actions>
      <div class="detail-header-info">
        <h3 class="detail-header-info__name">{{ pageTitle }}</h3>
        <el-tag size="small">
          {{ CustomerTypeLabel[customer.customerType as CustomerType] }}
        </el-tag>
        <el-tag
          size="small"
          :type="customer.status === 'ACTIVE' ? 'success' : 'danger'"
        >
          {{ CustomerStatusLabel[customer.status as CustomerStatus] }}
        </el-tag>
        <el-tag size="small" type="info">
          {{ customer.customerCode }}
        </el-tag>
        <template v-if="customer.listPrimaryVisaCase?.isFamilyCase">
          <el-tag size="small" type="info">
            {{ t("pages.customers.familyCaseShortTag") }}
          </el-tag>
          <el-tag
            v-if="
              customer.listPrimaryVisaCase.familyLinkMode ===
              FamilyLinkMode.INTERNAL
            "
            size="small"
            type="success"
          >
            {{ t("detailViews.customer.visaCaseWizard.previewLinkInternal") }}
          </el-tag>
          <el-tag
            v-else-if="
              customer.listPrimaryVisaCase.familyLinkMode ===
              FamilyLinkMode.EXTERNAL
            "
            size="small"
            type="warning"
          >
            {{ t("detailViews.customer.visaCaseWizard.previewLinkExternal") }}
          </el-tag>
          <el-tag v-else size="small" type="info">
            {{
              t("detailViews.customer.visaCaseWizard.previewFamilyModePending")
            }}
          </el-tag>
          <span class="detail-header-info__primary-family-meta">
            {{
              t("detailViews.customer.visaCasesTab.familyMembersCount", {
                count: customer.listPrimaryVisaCase.familyDependentsCount ?? 0,
              })
            }}
          </span>
        </template>
      </div>
    </template>

    <el-card v-if="customer" shadow="never" class="customer-detail-shell">
      <div class="customer-detail-body-grid">
        <div class="customer-detail-body-grid__main">
          <CustomerDetailTabNav
            v-model:active-tab="activeTab"
            :show-visa-domain-tab="showVisaDomainTab"
            :show-admin-cases-tab="showAdminCasesTab"
            :visa-domain-workbench-hint="visaDomainWorkbenchHint"
          />
          <el-tabs v-model="activeTab" class="customer-detail-tab-panels">
            <el-tab-pane name="basic">
              <CustomerBasicInfoTab :customer="customer" @edit="handleEdit" />
            </el-tab-pane>

            <el-tab-pane name="notes">
              <CustomerNotesTab :customer-id="customerId" />
            </el-tab-pane>

            <el-tab-pane v-if="showVisaDomainTab" name="visa-domain">
              <CustomerVisaDomainTab
                :customer-id="customerId"
                :customer="customer"
                :context-customer-name="customer?.customerName ?? ''"
                :open-visa-case-id="openVisaCaseIdFromQuery"
                :log-visa-case-id="logVisaCaseIdFromQuery"
                :open-visa-case-wizard="openVisaCaseWizardFromQuery"
                :open-visa-case-log-form="openVisaCaseLogFormFromQuery"
                :suggested-next-follow-up-at="suggestedNextFollowUpAtFromQuery"
                :initial-sub-block="visaDomainDeepLinkBlock"
                :materials-preferred-visa-case-id="materialsVisaCaseIdFromQuery"
                :list-primary-visa-case="customer.listPrimaryVisaCase ?? null"
                @visa-domain-customer-refresh="handleSaved"
                @request-basic-tab="openBasicTabFromVisaDomain"
              />
            </el-tab-pane>

            <el-tab-pane v-if="showAdminCasesTab" name="admin-cases">
              <CustomerAdminCasesTab :customer-id="customerId" />
            </el-tab-pane>

            <el-tab-pane name="tax">
              <CustomerTaxContractsTab :customer-id="customerId" />
            </el-tab-pane>

            <el-tab-pane name="finance">
              <el-empty
                :description="t('detailViews.customer.financePending')"
              />
            </el-tab-pane>

            <el-tab-pane name="files">
              <CustomerFilesTab :customer-id="customerId" />
            </el-tab-pane>
          </el-tabs>
        </div>
      </div>
      <CustomerDetailStickyActions
        v-if="showVisaDomainTab"
        :customer-id="customerId"
        :list-primary-visa-case="customer.listPrimaryVisaCase ?? null"
      />
    </el-card>

    <CustomerFormDialog
      v-model="showEditDialog"
      :edit-data="customer"
      @saved="handleSaved"
    />
  </PageDetail>
</template>

<style scoped lang="scss" src="./CustomerDetailView.scoped.scss"></style>
