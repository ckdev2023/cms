<script setup lang="ts">
import { Check, DocumentChecked, MoreFilled } from "@element-plus/icons-vue";
import { ElMessage } from "element-plus";
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute, useRouter } from "vue-router";

import {
  getVisaCaseMaterials,
  getVisaCaseMaterialSummary,
  initializeVisaCaseMaterials,
} from "@/api/visa-case";
import { MaterialItemStatusLabel } from "@/constants/enum-labels";
import { MaterialItemStatus } from "@/constants/enums";
import { P } from "@/constants/permissions";
import { useUserStore } from "@/stores/user";
import type { CustomerDetail } from "@/types/customer";
import type { MaterialSummary, VisaCaseMaterialItemDetail } from "@/types/visa-case";
import {
  mergeCustomerDetailReturnQuery,
  pickCustomerDetailDeepLinkPreserve,
} from "@/utils/customer-detail-return-navigation";

import CustomerSimpleSectionCard from "./CustomerSimpleSectionCard.vue";

const props = defineProps<{
  /** 客户详情（含与列表同源的主展示案件摘要） */
  customer: CustomerDetail;
}>();

defineOptions({ name: "CustomerSimpleMaterialsCard" });

const route = useRoute();
const router = useRouter();
const { t } = useI18n({ useScope: "global" });
const userStore = useUserStore();

/** SVG 环形进度：半径与周长固定，便于 `stroke-dashoffset` 与百分比对齐 Stitch 视觉。 */
const RING_RADIUS = 26;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

/** 与 `CustomerDetailCaseLogRail` 一致：`GET /visa-cases/:id/materials` 需 `visaCase:detail`。 */
const canViewMaterials = computed((): boolean =>
  userStore.hasPermission(P.VISA_CASE_DETAIL),
);

/** 与材料 Tab 一致：`POST .../materials/initialize` 需 `visaCase:edit`。 */
const canEditMaterials = computed((): boolean =>
  userStore.hasPermission(P.VISA_CASE_EDIT),
);

const primaryCaseId = computed((): string =>
  (props.customer.listPrimaryVisaCase?.visaCaseId ?? "").trim(),
);

const hasPrimaryCase = computed((): boolean => primaryCaseId.value.length > 0);

const loading = ref(false);
const materialsFetchFailed = ref(false);
const summary = ref<MaterialSummary | null>(null);
const materials = ref<VisaCaseMaterialItemDetail[]>([]);
const initializingMaterials = ref(false);

const summaryProgressPercent = computed((): number => {
  const s = summary.value;
  if (!s || s.total === 0) {
    return 0;
  }
  const applicable = s.total - s.notApplicable;
  if (applicable <= 0) {
    return 0;
  }
  return Math.min(100, Math.round((s.collected / applicable) * 100));
});

const ringDashOffset = computed((): number => {
  const p = summaryProgressPercent.value / 100;
  return RING_CIRCUMFERENCE * (1 - p);
});

const sortedMaterials = computed((): VisaCaseMaterialItemDetail[] =>
  [...materials.value].sort((a, b) => a.sortOrder - b.sortOrder),
);

const showNoApplicableHint = computed((): boolean => {
  const s = summary.value;
  if (!s || s.total === 0) {
    return false;
  }
  return s.total - s.notApplicable <= 0;
});

const showProgressRing = computed((): boolean => {
  if (!hasPrimaryCase.value || !canViewMaterials.value || loading.value) {
    return false;
  }
  if (materialsFetchFailed.value || !summary.value || summary.value.total <= 0) {
    return false;
  }
  return !showNoApplicableHint.value;
});

const ringAriaLabel = computed((): string =>
  t("detailViews.customer.stitchLayout.simpleMaterialsCard.ringAria", {
    percent: summaryProgressPercent.value,
  }),
);

const materialsListAria = computed((): string =>
  t("detailViews.customer.stitchLayout.simpleMaterialsCard.materialsListAria"),
);

/**
 * 并行加载主展示案件的材料清单与统计摘要（与 `CustomerMaterialChecklistTab` 同源接口）。
 */
async function fetchMaterials(): Promise<void> {
  if (!canViewMaterials.value || !primaryCaseId.value) {
    summary.value = null;
    materials.value = [];
    materialsFetchFailed.value = false;
    loading.value = false;
    return;
  }
  loading.value = true;
  materialsFetchFailed.value = false;
  try {
    const [matRes, sumRes] = await Promise.all([
      getVisaCaseMaterials(primaryCaseId.value),
      getVisaCaseMaterialSummary(primaryCaseId.value),
    ]);
    materials.value = matRes.data;
    summary.value = sumRes.data;
  } catch {
    summary.value = null;
    materials.value = [];
    materialsFetchFailed.value = true;
  } finally {
    loading.value = false;
  }
}

watch(
  () => [primaryCaseId.value, canViewMaterials.value] as const,
  () => {
    void fetchMaterials();
  },
  { immediate: true },
);

const showInitializeFromTemplateCta = computed((): boolean => {
  if (
    !hasPrimaryCase.value ||
    !canViewMaterials.value ||
    !canEditMaterials.value ||
    loading.value ||
    materialsFetchFailed.value ||
    !summary.value
  ) {
    return false;
  }
  return summary.value.total === 0;
});

/**
 * 在简单视图为空态时从模板初始化材料清单（与 `CustomerMaterialChecklistTab` 同源接口），成功后刷新本卡列表。
 */
async function handleInitializeFromTemplate(): Promise<void> {
  const id = primaryCaseId.value;
  if (!id || initializingMaterials.value) {
    return;
  }
  initializingMaterials.value = true;
  try {
    await initializeVisaCaseMaterials(id);
    ElMessage.success(
      t("detailViews.customer.materialChecklistTab.initializeSuccess"),
    );
    await fetchMaterials();
  } catch {
    // 错误提示由请求层统一处理
  } finally {
    initializingMaterials.value = false;
  }
}

/**
 * 跳转标准客户详情签证域材料分区并锁定主展示案件 ID（与 `CustomerDetailContextStrip.openMaterials` 等价）。
 */
function openFullMaterials(): void {
  const id = primaryCaseId.value;
  if (!id) {
    return;
  }
  const query: Record<string, string> = {
    tab: "visa-domain",
    visaDomainBlock: "materials",
    materialsVisaCaseId: id,
    ...pickCustomerDetailDeepLinkPreserve(route.query),
  };
  mergeCustomerDetailReturnQuery(query, route, {
    overrideFullPath: `/customers/${props.customer.id}/simple`,
  });
  void router.push({
    name: "CustomerDetail",
    params: { id: props.customer.id },
    query,
  });
}

/**
 * 与 docs/36 一致：催促补件仅路由至材料子块（不调用后端通知）。
 */
function openUrgeSupplement(): void {
  openFullMaterials();
}

/**
 * 判断材料行是否处于 Stitch「已勾选」态（受领済み）。
 *
 * @param status - 行 `itemStatus`
 * @returns 是否已收集
 */
function isRowCollected(status: MaterialItemStatus): boolean {
  return status === MaterialItemStatus.COLLECTED;
}
</script>

<template>
  <CustomerSimpleSectionCard
    :title="t('detailViews.customer.stitchLayout.simpleMaterialsCard.title')"
    title-tag="h3"
    class="customer-simple-materials-card-root"
  >
    <template #icon>
      <el-icon><DocumentChecked /></el-icon>
    </template>
    <!-- 须始终提供 #actions，避免 `v-if` 整段插槽导致子组件不注册 actions 列、进度环永不出现 -->
    <template #actions>
      <div
        v-if="showProgressRing"
        class="customer-simple-materials-card__ring-wrap"
        role="img"
        :aria-label="ringAriaLabel"
      >
        <svg
          class="customer-simple-materials-card__ring-svg"
          viewBox="0 0 64 64"
          aria-hidden="true"
        >
          <circle
            class="customer-simple-materials-card__ring-track"
            cx="32"
            cy="32"
            :r="RING_RADIUS"
            fill="none"
          />
          <circle
            class="customer-simple-materials-card__ring-value"
            cx="32"
            cy="32"
            :r="RING_RADIUS"
            fill="none"
            :stroke-dasharray="RING_CIRCUMFERENCE"
            :stroke-dashoffset="ringDashOffset"
            transform="rotate(-90 32 32)"
          />
        </svg>
        <span class="customer-simple-materials-card__ring-pct" aria-hidden="true">{{
          summaryProgressPercent
        }}%</span>
      </div>
    </template>

    <div v-loading="loading" class="customer-simple-materials-card">
      <el-empty
        v-if="!hasPrimaryCase"
        :description="t('detailViews.customer.contextStrip.noPrimaryCase')"
        class="customer-simple-materials-card__empty"
      />

      <el-empty
        v-else-if="!canViewMaterials"
        :description="
          t('detailViews.customer.stitchLayout.simpleMaterialsCard.noVisaPermission')
        "
        class="customer-simple-materials-card__empty"
      />

      <el-empty
        v-else-if="
          !loading &&
          summary &&
          summary.total === 0
        "
        class="customer-simple-materials-card__empty"
      >
        <template #description>
          <p class="customer-simple-materials-card__empty-desc">
            {{ t("detailViews.customer.materialChecklistTab.empty") }}
          </p>
          <el-button
            v-if="showInitializeFromTemplateCta"
            type="primary"
            size="small"
            :loading="initializingMaterials"
            @click="handleInitializeFromTemplate"
          >
            {{ t("detailViews.customer.materialChecklistTab.initialize") }}
          </el-button>
        </template>
      </el-empty>

      <el-empty
        v-else-if="!loading && materialsFetchFailed"
        :description="t('request.requestError')"
        class="customer-simple-materials-card__empty"
      />

      <template v-else-if="summary && summary.total > 0">
        <div
          v-if="showNoApplicableHint"
          class="customer-simple-materials-card__hint"
          role="status"
        >
          {{ t("detailViews.customer.contextStrip.materialsProgressNoApplicable") }}
        </div>

        <div
          v-else
          class="customer-simple-materials-card__rows-scroll"
          tabindex="0"
          role="region"
          :aria-label="materialsListAria"
        >
          <ul class="customer-simple-materials-card__rows">
            <li
              v-for="row in sortedMaterials"
              :key="row.id"
              class="customer-simple-materials-card__row"
            >
              <span
                class="customer-simple-materials-card__fake-cb"
                :data-checked="isRowCollected(row.itemStatus)"
                aria-hidden="true"
              >
                <el-icon
                  v-if="isRowCollected(row.itemStatus)"
                  class="customer-simple-materials-card__fake-cb-icon"
                >
                  <Check />
                </el-icon>
              </span>
              <span class="customer-simple-materials-card__row-label">{{ row.itemName }}</span>
              <span class="customer-simple-materials-card__row-status">
                <span
                  v-if="row.itemStatus === MaterialItemStatus.COLLECTED"
                  class="customer-simple-materials-card__status-done"
                  :title="MaterialItemStatusLabel[MaterialItemStatus.COLLECTED]"
                >
                  <el-icon><Check /></el-icon>
                  <span class="customer-simple-materials-card__sr-only">{{
                    MaterialItemStatusLabel[MaterialItemStatus.COLLECTED]
                  }}</span>
                </span>
                <span
                  v-else-if="row.itemStatus === MaterialItemStatus.NOT_COLLECTED"
                  class="customer-simple-materials-card__status-pending"
                >
                  {{
                    t(
                      "detailViews.customer.stitchLayout.simpleMaterialsCard.rowPendingSupplement",
                    )
                  }}
                </span>
                <span
                  v-else
                  class="customer-simple-materials-card__status-other"
                  :title="MaterialItemStatusLabel[MaterialItemStatus.NOT_APPLICABLE]"
                >
                  <el-icon><MoreFilled /></el-icon>
                  <span class="customer-simple-materials-card__sr-only">{{
                    MaterialItemStatusLabel[MaterialItemStatus.NOT_APPLICABLE]
                  }}</span>
                </span>
              </span>
            </li>
          </ul>
        </div>
      </template>

      <div
        v-if="hasPrimaryCase && canViewMaterials"
        class="customer-simple-materials-card__footer"
      >
        <el-tooltip
          :content="t('detailViews.customer.stitchLayout.urgeSupplementTooltip')"
          placement="top"
        >
          <el-button
            text
            type="primary"
            class="customer-simple-materials-card__footer-btn customer-simple-materials-card__footer-btn--urge"
            @click="openUrgeSupplement"
          >
            {{ t("detailViews.customer.stitchLayout.urgeSupplementCta") }}
          </el-button>
        </el-tooltip>
        <el-button
          text
          type="primary"
          class="customer-simple-materials-card__footer-btn customer-simple-materials-card__footer-btn--view-all"
          @click="openFullMaterials"
        >
          {{ t("detailViews.customer.stitchLayout.simpleMaterialsCard.viewAll") }}
        </el-button>
      </div>
    </div>
  </CustomerSimpleSectionCard>
</template>

<style scoped lang="scss" src="./CustomerSimpleMaterialsCard.scoped.scss"></style>
