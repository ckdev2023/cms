<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute, useRouter } from "vue-router";

import { getCustomer } from "@/api/customer";
import PageDetail from "@/components/PageDetail.vue";
import { useCustomerSimpleDetailBackLabel } from "@/composables/useCustomerSimpleDetailBackLabel";
import type { CustomerDetail } from "@/types/customer";
import {
  isTrustedCustomerDetailHistoryBack,
  parseCustomerDetailReturnTarget,
} from "@/utils/customer-detail-return-navigation";
import { pickCustomerHubReturnQueryPreserve } from "@/utils/customer-detail-return-path";
import CustomerFormDialog from "@/views/customer/components/CustomerFormDialog.vue";
import CustomerSimpleBasicCard from "@/views/customer/components/simple/CustomerSimpleBasicCard.vue";
import CustomerSimpleFamilyCard from "@/views/customer/components/simple/CustomerSimpleFamilyCard.vue";
import CustomerSimpleFilePathsCard from "@/views/customer/components/simple/CustomerSimpleFilePathsCard.vue";
import CustomerSimpleFollowUpTimeline from "@/views/customer/components/simple/CustomerSimpleFollowUpTimeline.vue";
import CustomerSimpleMaterialsCard from "@/views/customer/components/simple/CustomerSimpleMaterialsCard.vue";
import CustomerSimpleStitchHero from "@/views/customer/components/simple/CustomerSimpleStitchHero.vue";

defineOptions({ name: "CustomerDetailSimpleView" });

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const backMessageKey = useCustomerSimpleDetailBackLabel();

const loading = ref(false);
const loadError = ref(false);
const customer = ref<CustomerDetail | null>(null);
const showEditDialog = ref(false);
const followUpTimelineRefreshNonce = ref(0);

const customerId = computed(() => route.params.id as string);

watch(
  customerId,
  () => {
    loadError.value = false;
    customer.value = null;
    if (customerId.value) {
      void fetchCustomer();
    }
  },
  { immediate: true },
);

/**
 * 拉取当前路由客户详情；失败时标记 `loadError` 并清空 `customer`（拦截器已提示消息）。
 */
async function fetchCustomer(): Promise<void> {
  loading.value = true;
  loadError.value = false;
  try {
    const res = await getCustomer(customerId.value);
    customer.value = res.data;
  } catch {
    loadError.value = true;
    customer.value = null;
  } finally {
    loading.value = false;
  }
}

function handleCustomerSaved(): void {
  void fetchCustomer();
}

/**
 * 随访弹框保存成功后递增 nonce，驱动下方时间线重新拉取案件日志。
 */
function bumpFollowUpTimeline(): void {
  followUpTimelineRefreshNonce.value += 1;
}

/**
 * 返回列表或上一页：优先 `ccFrom` 白名单，其次可信 history.back，否则客户中心根路径。
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
</script>

<template>
  <PageDetail :loading="loading" bleed-main hide-header>
    <div v-if="!loading" class="customer-detail-simple">
      <div class="customer-detail-simple__main">
        <div v-if="!customerId" class="customer-detail-simple__state customer-detail-simple__state--with-toolbar">
          <el-button
            class="customer-detail-simple__toolbar-back"
            text
            type="primary"
            @click="goBack"
          >
            {{ t(backMessageKey) }}
          </el-button>
          <el-empty :description="t('common.noData')" />
        </div>
        <div v-else-if="loadError" class="customer-detail-simple__state customer-detail-simple__state--with-toolbar">
          <el-button
            class="customer-detail-simple__toolbar-back"
            text
            type="primary"
            @click="goBack"
          >
            {{ t(backMessageKey) }}
          </el-button>
          <el-empty :description="t('request.requestError')" />
        </div>
        <div v-else-if="customer" class="customer-detail-simple__stack">
          <CustomerSimpleStitchHero
            :customer="customer"
            @request-back="goBack"
            @request-edit="showEditDialog = true"
            @follow-up-log-saved="bumpFollowUpTimeline"
          />
          <div class="customer-detail-simple__two-col">
            <div class="customer-detail-simple__cell-basic">
              <CustomerSimpleBasicCard :customer="customer" />
            </div>
            <div class="customer-detail-simple__cell-paths">
              <CustomerSimpleFilePathsCard :customer-id="customer.id" />
            </div>
            <div class="customer-detail-simple__cell-left-lower">
              <CustomerSimpleFamilyCard :customer="customer" />
              <CustomerSimpleMaterialsCard :customer="customer" />
            </div>
            <div class="customer-detail-simple__cell-logs">
              <CustomerSimpleFollowUpTimeline
                :customer-id="customer.id"
                :list-primary-visa-case="customer.listPrimaryVisaCase ?? null"
                :refresh-nonce="followUpTimelineRefreshNonce"
              />
            </div>
          </div>
        </div>
        <div v-else class="customer-detail-simple__state customer-detail-simple__state--with-toolbar">
          <el-button
            class="customer-detail-simple__toolbar-back"
            text
            type="primary"
            @click="goBack"
          >
            {{ t(backMessageKey) }}
          </el-button>
          <el-empty :description="t('common.noData')" />
        </div>
      </div>
    </div>

    <CustomerFormDialog
      v-if="customer"
      v-model="showEditDialog"
      :edit-data="customer"
      @saved="handleCustomerSaved"
    />
  </PageDetail>
</template>

<style scoped lang="scss" src="./CustomerDetailSimpleView.scoped.scss"></style>
<style lang="scss" src="./CustomerDetailSimpleView.airbnb-controls.scss"></style>
