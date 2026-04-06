<script setup lang="ts">
import { ArrowRight, UserFilled } from "@element-plus/icons-vue";
import { ElMessage } from "element-plus";
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute, useRouter } from "vue-router";

import { getCustomers } from "@/api/customer";
import { FamilyRelationLabel } from "@/constants/enum-labels";
import type { FamilyRelation } from "@/constants/enums";
import { P } from "@/constants/permissions";
import { useUserStore } from "@/stores/user";
import type { CustomerDetail, CustomerItem } from "@/types/customer";
import {
  mergeCustomerDetailReturnQuery,
  pickCustomerDetailDeepLinkPreserve,
} from "@/utils/customer-detail-return-navigation";

import CustomerSimpleSectionCard from "./CustomerSimpleSectionCard.vue";

const props = defineProps<{
  /** 当前详情客户；随附家属查询主键为 `customer.id`（与 `CustomerAccompanyingDependentsBlock` 同源） */
  customer: CustomerDetail;
}>();

defineOptions({ name: "CustomerSimpleFamilyCard" });

const route = useRoute();
const router = useRouter();
const { t } = useI18n({ useScope: "global" });
const userStore = useUserStore();

const canList = computed((): boolean => userStore.hasPermission(P.CUSTOMER_LIST));
const loading = ref(false);
const items = ref<CustomerItem[]>([]);

const displayedItems = computed((): CustomerItem[] => items.value.slice(0, 2));

const moreCount = computed((): number => Math.max(0, items.value.length - 2));

/**
 * 拉取挂在当前主档下的随附家属子客户列表（与 `CustomerAccompanyingDependentsBlock` 同源 `GET /customers?primaryCustomerId=`）。
 */
async function fetchDependents(): Promise<void> {
  if (!canList.value || !props.customer.id) {
    items.value = [];
    return;
  }
  loading.value = true;
  try {
    const res = await getCustomers({
      primaryCustomerId: props.customer.id,
      page: 1,
      pageSize: 100,
    });
    items.value = res.data.items;
  } catch {
    items.value = [];
    ElMessage.warning(t("dialogs.customerForm.accompanyingFamilyLoadFailed"));
  } finally {
    loading.value = false;
  }
}

watch(
  () => [props.customer.id, canList.value] as const,
  () => {
    void fetchDependents();
  },
  { immediate: true },
);

/**
 * 将可选家属关系枚举解析为与 `FamilyRelationLabel` 一致的单字简称，供圆形徽标展示。
 *
 * @param relation - `person_info.family_relation`
 * @returns 非空时取标签首字符；否则 `?`
 */
function relationAbbrev(relation: FamilyRelation | null | undefined): string {
  if (!relation) {
    return "?";
  }
  const label = FamilyRelationLabel[relation as FamilyRelation] ?? "";
  const trimmed = label.trim();
  return trimmed ? trimmed.charAt(0) : "?";
}

/**
 * 子行副标题：国籍（若有）与客户编号，与 Stitch「副标题」信息密度对齐。
 *
 * @param item - 子客户列表行
 * @returns 单行展示文案
 */
function rowSubtitle(item: CustomerItem): string {
  const nat = item.personInfo?.nationality?.trim();
  const code = item.customerCode?.trim() ?? "";
  if (nat && code) {
    return `${nat} · ${code}`;
  }
  if (nat) {
    return nat;
  }
  if (code) {
    return code;
  }
  return "—";
}

/**
 * 组装随附家属「详情」链路的 query，并把 `ccFrom` 固定为当前主客户的简化详情路径。
 *
 * @param customerId - 子客户主键
 * @returns 供 `router-link` 绑定的目标
 */
function dependentDetailTo(
  customerId: string,
): string | { path: string; query: Record<string, string> } {
  const query: Record<string, string> = {};
  mergeCustomerDetailReturnQuery(query, route, {
    overrideFullPath: `/customers/${props.customer.id}/simple`,
  });
  return Object.keys(query).length > 0
    ? { path: `/customers/${customerId}`, query }
    : `/customers/${customerId}`;
}

/**
 * 跳转标准客户详情签证域「家属成员」分区，保留深链白名单 query。
 */
function openVisaFamilyWorkbench(): void {
  const query: Record<string, string> = {
    ...pickCustomerDetailDeepLinkPreserve(route.query),
    tab: "visa-domain",
    visaDomainBlock: "family",
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
</script>

<template>
  <CustomerSimpleSectionCard
    :title="t('detailViews.customer.stitchLayout.simpleFamilyCard.title')"
    title-tag="h3"
    class="customer-simple-family-card-root"
  >
    <template #icon>
      <el-icon><UserFilled /></el-icon>
    </template>
    <template v-if="canList" #actions>
      <el-button
        data-testid="customer-simple-family-open-visa"
        text
        type="primary"
        @click="openVisaFamilyWorkbench"
      >
        {{ t("detailViews.customer.stitchLayout.simpleFamilyCard.openInVisaWorkbench") }}
      </el-button>
    </template>

    <div
      v-if="!canList"
      class="customer-simple-family-card__denied"
      role="note"
    >
      {{ t("detailViews.customer.stitchLayout.simpleFamilyCard.needListPermission") }}
    </div>

    <div
      v-else
      v-loading="loading"
      class="customer-simple-family-card"
    >
      <p
        v-if="!loading && items.length > 0"
        class="customer-simple-family-card__summary"
        data-testid="customer-simple-family-summary"
      >
        {{
          t("detailViews.customer.stitchLayout.simpleFamilyCard.memberSummary", {
            count: items.length,
          })
        }}
      </p>

      <p
        v-if="!loading && items.length === 0"
        class="customer-simple-family-card__empty-inline"
        role="status"
      >
        {{ t("detailViews.customer.accompanyingDependentsEmpty") }}
      </p>

      <ul
        v-else-if="items.length > 0"
        class="customer-simple-family-card__list"
        role="list"
      >
        <li
          v-for="item in displayedItems"
          :key="item.id"
          class="customer-simple-family-card__item"
          role="listitem"
        >
          <router-link
            :to="dependentDetailTo(item.id)"
            class="customer-simple-family-card__row"
            :aria-label="
              t('detailViews.customer.stitchLayout.simpleFamilyCard.rowAria', {
                name: item.customerName ?? '',
              })
            "
          >
            <span
              class="customer-simple-family-card__abbr"
              aria-hidden="true"
              >{{ relationAbbrev(item.personInfo?.familyRelation ?? null) }}</span
            >
            <div class="customer-simple-family-card__text">
              <span class="customer-simple-family-card__name">{{
                item.customerName?.trim()
                  ? item.customerName
                  : t("dialogs.customerForm.accompanyingFamilyUnnamed")
              }}</span>
              <span class="customer-simple-family-card__sub">{{
                rowSubtitle(item)
              }}</span>
            </div>
            <el-icon class="customer-simple-family-card__chevron" aria-hidden="true">
              <ArrowRight />
            </el-icon>
          </router-link>
        </li>
      </ul>

      <p
        v-if="!loading && moreCount > 0"
        class="customer-simple-family-card__more"
        data-testid="customer-simple-family-more"
      >
        {{
          t("detailViews.customer.stitchLayout.simpleFamilyCard.moreMembers", {
            count: moreCount,
          })
        }}
      </p>
    </div>
  </CustomerSimpleSectionCard>
</template>

<style scoped lang="scss" src="./CustomerSimpleFamilyCard.scoped.scss"></style>
