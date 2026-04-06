<script setup lang="ts">
import { ArrowLeft } from "@element-plus/icons-vue";
import { ElMessage } from "element-plus";
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute, useRouter } from "vue-router";

import { getFilePreviewUrl } from "@/api/file";
import { useCustomerSimpleDetailBackLabel } from "@/composables/useCustomerSimpleDetailBackLabel";
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
import type { CustomerDetail, CustomerListPrimaryVisaCaseSummary } from "@/types/customer";
import {
  computeContextStripDatePriority,
  primaryCaseStatusLabel as stripPrimaryCaseStatusLabel,
} from "@/utils/customer-detail-context-strip-helpers";
import {
  mergeCustomerDetailReturnQuery,
  pickCustomerDetailDeepLinkPreserve,
} from "@/utils/customer-detail-return-navigation";
import { useLocaleFormatter } from "@/utils/locale-format";
import { formatVisaCaseTypeDisplay } from "@/utils/visa-case-type-display";
import CustomerSimpleFollowUpLogDialog from "@/views/customer/components/simple/CustomerSimpleFollowUpLogDialog.vue";

const props = defineProps<{
  /** 当前路由客户详情，含与列表同源的主展示案件摘要 */
  customer: CustomerDetail;
}>();

const emit = defineEmits<{
  /** 请求执行与 `PageDetail` 返回一致的上游导航（列表 / ccFrom / history） */
  "request-back": [];
  /** 请求打开客户主档编辑对话框（与旧详情「编辑」一致） */
  "request-edit": [];
  /** 弹框方式新建案件日志已成功，供父级刷新简化页随访时间线 */
  "follow-up-log-saved": [];
}>();

defineOptions({ name: "CustomerSimpleStitchHero" });

const route = useRoute();
const router = useRouter();
const { t } = useI18n({ useScope: "global" });
const userStore = useUserStore();
const { formatDate } = useLocaleFormatter();
const backMessageKey = useCustomerSimpleDetailBackLabel();

const listPrimaryVisaCase = computed(
  (): CustomerListPrimaryVisaCaseSummary | null =>
    props.customer.listPrimaryVisaCase ?? null,
);

const showFamilyCaseRow = computed(
  (): boolean => !!listPrimaryVisaCase.value?.isFamilyCase,
);

const canOpenPrimaryCustomerDetail = computed((): boolean =>
  userStore.hasPermission(P.CUSTOMER_DETAIL),
);

const showPrimaryCustomerFallbackBanner = computed((): boolean => {
  if (props.customer.listPrimaryVisaCaseSource !== "PRIMARY_CUSTOMER_FALLBACK") {
    return false;
  }
  const pid = (props.customer.primaryCustomerIdForListFallback ?? "").trim();
  if (!pid || pid === props.customer.id) {
    return false;
  }
  return true;
});

const primaryCustomerDetailRoute = computed(() => {
  const pid = (props.customer.primaryCustomerIdForListFallback ?? "").trim();
  return {
    path: `/customers/${pid}`,
    query: pickCustomerDetailDeepLinkPreserve(route.query),
  };
});

const customerPhotoPreviewUrl = computed((): string => {
  const id = props.customer.photoFileId?.trim();
  return id ? getFilePreviewUrl(id) : "";
});

const avatarFallbackChar = computed((): string => {
  const name = props.customer.customerName?.trim();
  return name ? name.slice(0, 1) : "?";
});

const canEditCustomer = computed((): boolean =>
  userStore.hasPermission(P.CUSTOMER_EDIT),
);

const canOpenCaseContext = computed(
  (): boolean =>
    userStore.hasPermission(P.VISA_CASE_DETAIL) ||
    userStore.hasPermission(P.VISA_CASE_LIST),
);

const canWriteCaseLog = computed((): boolean =>
  userStore.hasPermission(P.VISA_CASE_LOG_CREATE),
);

const canOpenVisaWizard = computed((): boolean =>
  userStore.hasPermission(P.VISA_CASE_CREATE),
);

const showAddFollowUpCta = computed(
  (): boolean => canWriteCaseLog.value && !!listPrimaryVisaCase.value,
);

const showFollowUpLogDialog = ref(false);

const stripDatePriority = computed(() =>
  computeContextStripDatePriority(listPrimaryVisaCase.value),
);

const assigneeDisplayLabel = computed((): string => {
  const raw = listPrimaryVisaCase.value?.assignedToDisplayName;
  const trimmed = typeof raw === "string" ? raw.trim() : "";
  return trimmed || t("detailViews.customer.contextStrip.unassigned");
});

function preserveBase(): Record<string, string> {
  return pickCustomerDetailDeepLinkPreserve(route.query);
}

/**
 * 写入 `ccFrom`：从标准详情返回时可回到当前简化详情页（与随访时间线「查看全部」一致）。
 *
 * @param query - 目标详情页 query（就地合并）
 */
function mergeReturnToSimple(query: Record<string, string>): void {
  mergeCustomerDetailReturnQuery(query, route, {
    overrideFullPath: `/customers/${props.customer.id}/simple`,
  });
}

function primaryCaseTypeLabel(pc: CustomerListPrimaryVisaCaseSummary): string {
  return formatVisaCaseTypeDisplay(pc.caseType);
}

function primaryCaseStatusLabel(pc: CustomerListPrimaryVisaCaseSummary): string {
  return stripPrimaryCaseStatusLabel(pc);
}

/**
 * 将当前简化详情页完整 URL 写入系统剪贴板并提示结果。
 */
async function copyPageUrl(): Promise<void> {
  const url = window.location.href;
  try {
    await navigator.clipboard.writeText(url);
    ElMessage.success(t("detailViews.customer.stitchLayout.simpleHero.shareCopied"));
  } catch {
    ElMessage.error(t("detailViews.customer.stitchLayout.simpleHero.shareFailed"));
  }
}

/**
 * 打开与稿面一致的「新增跟进记录」弹框，在主展示案件下直接创建案件日志。
 */
function openAddFollowUp(): void {
  if (!listPrimaryVisaCase.value) {
    return;
  }
  showFollowUpLogDialog.value = true;
}

/**
 * 跳转旧版客户详情签证域「案件」子块以查看全部签证案件。
 */
function openAllVisaCases(): void {
  const query: Record<string, string> = {
    ...preserveBase(),
    tab: "visa-domain",
    visaDomainBlock: "cases",
  };
  mergeReturnToSimple(query);
  void router.push({
    name: "CustomerDetail",
    params: { id: props.customer.id },
    query,
  });
}

/**
 * 跳转旧版客户详情并打开建案向导。
 */
function goVisaWizard(): void {
  const query: Record<string, string> = {
    ...preserveBase(),
    tab: "visa-domain",
    openVisaCaseWizard: "1",
  };
  mergeReturnToSimple(query);
  void router.push({
    name: "CustomerDetail",
    params: { id: props.customer.id },
    query,
  });
}
</script>

<template>
  <div class="customer-simple-stitch-hero">
    <el-alert
      v-if="showPrimaryCustomerFallbackBanner"
      class="customer-simple-stitch-hero__fallback-alert"
      type="info"
      :closable="false"
      show-icon
    >
      <template #default>
        <span class="customer-simple-stitch-hero__fallback-line">
          {{ t("detailViews.customer.contextStrip.primaryCustomerFallbackLine") }}
          <router-link
            v-if="canOpenPrimaryCustomerDetail"
            class="customer-simple-stitch-hero__fallback-link"
            :to="primaryCustomerDetailRoute"
          >
            {{ t("detailViews.customer.contextStrip.primaryCustomerFallbackOpen") }}
          </router-link>
        </span>
      </template>
    </el-alert>

    <div class="customer-simple-stitch-hero__shell">
      <div class="customer-simple-stitch-hero__back-row">
        <el-button
          class="customer-simple-stitch-hero__back-btn"
          :icon="ArrowLeft"
          link
          type="primary"
          @click="emit('request-back')"
        >
          {{ t(backMessageKey) }}
        </el-button>
      </div>
      <header
        class="customer-simple-stitch-hero__grid"
        :aria-label="t('detailViews.customer.stitchLayout.simpleHero.regionAria')"
      >
        <div class="customer-simple-stitch-hero__avatar-wrap">
          <el-avatar
            :size="80"
            :src="customerPhotoPreviewUrl || undefined"
            :alt="customer.customerName"
          >
            {{ avatarFallbackChar }}
          </el-avatar>
        </div>

        <div class="customer-simple-stitch-hero__main">
          <div class="customer-simple-stitch-hero__identity-row">
            <h1 class="customer-simple-stitch-hero__name">
              {{ customer.customerName }}
            </h1>
            <div class="customer-simple-stitch-hero__tags">
              <el-tag size="small">
                {{ CustomerTypeLabel[customer.customerType as CustomerType] }}
              </el-tag>
              <el-tag
                size="small"
                :type="customer.status === 'ACTIVE' ? 'success' : 'danger'"
              >
                {{ CustomerStatusLabel[customer.status as CustomerStatus] }}
              </el-tag>
            </div>
          </div>

          <div
            v-if="showFamilyCaseRow && listPrimaryVisaCase"
            class="customer-simple-stitch-hero__family-row"
          >
            <el-tag size="small" type="info">
              {{ t("pages.customers.familyCaseShortTag") }}
            </el-tag>
            <el-tag
              v-if="listPrimaryVisaCase.familyLinkMode === FamilyLinkMode.INTERNAL"
              size="small"
              type="success"
            >
              {{ t("detailViews.customer.visaCaseWizard.previewLinkInternal") }}
            </el-tag>
            <el-tag
              v-else-if="listPrimaryVisaCase.familyLinkMode === FamilyLinkMode.EXTERNAL"
              size="small"
              type="warning"
            >
              {{ t("detailViews.customer.visaCaseWizard.previewLinkExternal") }}
            </el-tag>
            <el-tag v-else size="small" type="info">
              {{ t("detailViews.customer.visaCaseWizard.previewFamilyModePending") }}
            </el-tag>
            <span class="customer-simple-stitch-hero__family-meta">
              {{
                t("detailViews.customer.visaCasesTab.familyMembersCount", {
                  count: listPrimaryVisaCase.familyDependentsCount ?? 0,
                })
              }}
            </span>
          </div>

          <template v-if="listPrimaryVisaCase">
            <div class="customer-simple-stitch-hero__case-block">
              <div class="customer-simple-stitch-hero__case-row">
                <span class="customer-simple-stitch-hero__case-type">
                  {{ primaryCaseTypeLabel(listPrimaryVisaCase) }}
                </span>
                <el-tag size="small" type="info">
                  {{ primaryCaseStatusLabel(listPrimaryVisaCase) }}
                </el-tag>
                <span
                  class="customer-simple-stitch-hero__case-row-sep"
                  aria-hidden="true"
                />
                <span class="customer-simple-stitch-hero__kv">
                  <span class="customer-simple-stitch-hero__k">{{
                    t("detailViews.customer.contextStrip.nextFollowUp")
                  }}</span>
                  <span
                    class="customer-simple-stitch-hero__date-pill"
                    :class="{
                      'customer-simple-stitch-hero__date-pill--priority':
                        stripDatePriority.nextFollowUp,
                    }"
                    >{{ formatDate(listPrimaryVisaCase.nextFollowUpAt) }}</span>
                </span>
                <span
                  class="customer-simple-stitch-hero__kv customer-simple-stitch-hero__kv--residence-expire"
                >
                  <span class="customer-simple-stitch-hero__k">{{
                    t("detailViews.customer.contextStrip.expireDate")
                  }}</span>
                  <span
                    class="customer-simple-stitch-hero__date-pill customer-simple-stitch-hero__date-pill--residence-expire"
                    :class="{
                      'customer-simple-stitch-hero__date-pill--priority':
                        stripDatePriority.expireDate,
                    }"
                    >{{ formatDate(listPrimaryVisaCase.expireDate) }}</span>
                </span>
                <span
                  class="customer-simple-stitch-hero__case-row-sep"
                  aria-hidden="true"
                />
                <span class="customer-simple-stitch-hero__assignee">
                  <span class="customer-simple-stitch-hero__assignee-k">{{
                    t("detailViews.customer.contextStrip.assignee")
                  }}</span>
                  <span class="customer-simple-stitch-hero__assignee-v">{{
                    assigneeDisplayLabel
                  }}</span>
                </span>
              </div>
            </div>
          </template>

          <div v-else class="customer-simple-stitch-hero__empty-case">
            <p class="customer-simple-stitch-hero__empty-text">
              {{ t("detailViews.customer.contextStrip.noPrimaryCase") }}
            </p>
            <el-button
              v-if="canOpenCaseContext"
              class="customer-simple-stitch-hero__cta customer-simple-stitch-hero__cta--secondary-link"
              @click="openAllVisaCases"
            >
              {{ t("detailViews.customer.contextStrip.viewAllVisaCases") }}
            </el-button>
            <el-button
              v-if="canOpenVisaWizard"
              class="customer-simple-stitch-hero__cta customer-simple-stitch-hero__cta--add-follow-up"
              type="primary"
              @click="goVisaWizard"
            >
              {{ t("detailViews.customer.contextStrip.goCreateCase") }}
            </el-button>
          </div>
        </div>

        <div class="customer-simple-stitch-hero__ctas">
          <el-button
            v-if="canEditCustomer"
            class="customer-simple-stitch-hero__cta customer-simple-stitch-hero__cta--text-muted"
            text
            @click="emit('request-edit')"
          >
            {{ t("detailViews.customer.stitchLayout.simpleHero.edit") }}
          </el-button>
          <el-button
            class="customer-simple-stitch-hero__cta customer-simple-stitch-hero__cta--text-link"
            text
            @click="copyPageUrl"
          >
            {{ t("detailViews.customer.stitchLayout.simpleHero.copyPageLink") }}
          </el-button>
          <el-button
            v-if="showAddFollowUpCta"
            class="customer-simple-stitch-hero__cta customer-simple-stitch-hero__cta--add-follow-up"
            type="primary"
            @click="openAddFollowUp"
          >
            {{ t("detailViews.customer.stitchLayout.simpleHero.addFollowUp") }}
          </el-button>
        </div>
      </header>
    </div>

    <CustomerSimpleFollowUpLogDialog
      v-if="listPrimaryVisaCase"
      v-model="showFollowUpLogDialog"
      :visa-case-id="listPrimaryVisaCase.visaCaseId"
      :suggested-next-follow-up-at="listPrimaryVisaCase.nextFollowUpAt"
      @saved="emit('follow-up-log-saved')"
    />
  </div>
</template>

<style scoped lang="scss" src="./CustomerSimpleStitchHero.scoped.scss"></style>
