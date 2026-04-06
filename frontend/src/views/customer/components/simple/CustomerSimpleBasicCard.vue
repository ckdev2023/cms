<script setup lang="ts">
import {
  ArrowDown,
  ArrowUp,
  Calendar,
  ChatDotRound,
  ChatLineRound,
  CircleCheck,
  Clock,
  Document,
  Flag,
  Location,
  Message,
  Notebook,
  OfficeBuilding,
  Phone,
  Postcard,
  Tickets,
  User,
  UserFilled,
} from "@element-plus/icons-vue";
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute, useRouter } from "vue-router";

import {
  CustomerStatusLabel,
  CustomerTypeLabel,
  ServiceTypeLabel,
} from "@/constants/enum-labels";
import type { CustomerStatus, CustomerType, ServiceType } from "@/constants/enums";
import type { CustomerDetail } from "@/types/customer";
import { mergeCustomerDetailReturnQuery } from "@/utils/customer-detail-return-navigation";

import CustomerSimpleSectionCard from "./CustomerSimpleSectionCard.vue";

const props = defineProps<{
  /** 与 `GET /customers/:id` 一致的客户详情，字段展示口径对齐 `CustomerBasicInfoTab` 只读区 */
  customer: CustomerDetail;
}>();

defineOptions({ name: "CustomerSimpleBasicCard" });

const route = useRoute();
const router = useRouter();
const { t } = useI18n({ useScope: "global" });

/** 默认折叠：摘要键值（编码/类型/服务/状态）+ 联系方式，减少首屏纵向占用 */
const basicExpanded = ref(false);

const hasCompanyInfo = computed((): boolean => !!props.customer.companyInfo);
const hasPersonInfo = computed((): boolean => !!props.customer.personInfo);

/**
 * 将可空主档字符串格式化为与简化详情一致的占位（空值用「未填写」类文案，避免整屏 `-` 难扫读）。
 *
 * @param value - 原始字段
 * @returns 非空trim 后原值，否则 i18n 空字段占位
 */
function displayBasicField(value: string | null | undefined): string {
  if (value === null || value === undefined) {
    return t("detailViews.customer.stitchLayout.simpleBasicCard.fieldEmpty");
  }
  const trimmed = value.trim();
  if (trimmed !== "") {
    return value;
  }
  return t("detailViews.customer.stitchLayout.simpleBasicCard.fieldEmpty");
}

/** 折叠态首段「客户类型」展示文案，与 `CustomerBasicInfoTab` 标签映射一致 */
const basicSummaryCustomerType = computed((): string =>
  displayBasicField(CustomerTypeLabel[props.customer.customerType as CustomerType]),
);

/** 折叠态首段「服务类型」展示文案 */
const basicSummaryServiceType = computed((): string =>
  displayBasicField(ServiceTypeLabel[props.customer.serviceType as ServiceType]),
);

/** 折叠态首段「客户状态」展示文案 */
const basicSummaryStatus = computed((): string =>
  displayBasicField(CustomerStatusLabel[props.customer.status as CustomerStatus]),
);

/**
 * 法人决算月展示：与 `CustomerBasicInfoTab` 中 `fiscalMonth` 行一致（数字 + 「月」后缀）。
 *
 * @returns 已拼接的文案；无值时返回 `-`
 */
function formatFiscalMonthDisplay(): string {
  const m = props.customer.companyInfo?.fiscalMonth;
  if (m === null || m === undefined) {
    return t("detailViews.customer.stitchLayout.simpleBasicCard.fieldEmpty");
  }
  return `${m}${t("dialogs.customerForm.month")}`;
}

/**
 * 打开标准客户详情并定位「基本信息」Tab，同时把当前简化详情路径写入 `ccFrom`。
 */
function openFullBasic(): void {
  const query: Record<string, string> = { tab: "basic" };
  mergeCustomerDetailReturnQuery(query, route);
  void router.push({
    name: "CustomerDetail",
    params: { id: props.customer.id },
    query,
  });
}

/**
 * 切换简化卡片内次要字段的展开/折叠，不影响「查看全部」完整 Tab。
 */
function toggleBasicExpanded(): void {
  basicExpanded.value = !basicExpanded.value;
}
</script>

<template>
  <CustomerSimpleSectionCard
    class="customer-simple-basic-card-root"
    :title="t('detailViews.customer.basicInfo')"
    title-tag="h3"
  >
    <template #icon>
      <el-icon><User /></el-icon>
    </template>
    <template #actions>
      <el-button text type="primary" @click="openFullBasic">
        {{ t("detailViews.customer.stitchLayout.simpleBasicCard.viewAll") }}
      </el-button>
    </template>

    <div class="customer-simple-basic-card">
      <!-- 摘要：2×2 浅底卡片 + 图标，对齐稿面「联系方式」宫格气质 -->
      <div class="customer-simple-basic-card__segment">
        <div class="customer-simple-basic-card__tile-grid" role="list">
          <div class="customer-simple-basic-card__tile" role="listitem">
            <div class="customer-simple-basic-card__tile-head">
              <el-icon class="customer-simple-basic-card__tile-icon" aria-hidden="true">
                <Tickets />
              </el-icon>
              <span class="customer-simple-basic-card__tile-label">{{
                t("detailViews.customer.basicFields.customerCode")
              }}</span>
            </div>
            <span class="customer-simple-basic-card__tile-value">{{
              displayBasicField(customer.customerCode)
            }}</span>
          </div>
          <div class="customer-simple-basic-card__tile" role="listitem">
            <div class="customer-simple-basic-card__tile-head">
              <el-icon class="customer-simple-basic-card__tile-icon" aria-hidden="true">
                <User />
              </el-icon>
              <span class="customer-simple-basic-card__tile-label">{{
                t("detailViews.customer.basicFields.customerType")
              }}</span>
            </div>
            <span class="customer-simple-basic-card__tile-value">{{
              basicSummaryCustomerType
            }}</span>
          </div>
          <div class="customer-simple-basic-card__tile" role="listitem">
            <div class="customer-simple-basic-card__tile-head">
              <el-icon class="customer-simple-basic-card__tile-icon" aria-hidden="true">
                <OfficeBuilding />
              </el-icon>
              <span class="customer-simple-basic-card__tile-label">{{
                t("detailViews.customer.basicFields.serviceType")
              }}</span>
            </div>
            <span class="customer-simple-basic-card__tile-value">{{
              basicSummaryServiceType
            }}</span>
          </div>
          <div class="customer-simple-basic-card__tile" role="listitem">
            <div class="customer-simple-basic-card__tile-head">
              <el-icon class="customer-simple-basic-card__tile-icon" aria-hidden="true">
                <CircleCheck />
              </el-icon>
              <span class="customer-simple-basic-card__tile-label">{{
                t("detailViews.customer.basicFields.status")
              }}</span>
            </div>
            <span class="customer-simple-basic-card__tile-value">{{
              basicSummaryStatus
            }}</span>
          </div>
        </div>
      </div>

      <!-- 联系方式：默认电话 + 邮箱；微信 / LINE 随「展开更多信息」一并显示 -->
      <div class="customer-simple-basic-card__segment">
        <h4 class="customer-simple-basic-card__segment-title">
          {{ t("detailViews.customer.basicInfoLayout.contactHeading") }}
        </h4>
        <div
          class="customer-simple-basic-card__contact-block"
          data-testid="customer-simple-basic-contact-grid"
        >
          <div class="customer-simple-basic-card__tile-grid" role="list">
            <div class="customer-simple-basic-card__tile" role="listitem">
              <div class="customer-simple-basic-card__tile-head">
                <el-icon class="customer-simple-basic-card__tile-icon" aria-hidden="true">
                  <Phone />
                </el-icon>
                <span class="customer-simple-basic-card__tile-label">{{
                  t("detailViews.customer.basicFields.phone")
                }}</span>
              </div>
              <span class="customer-simple-basic-card__tile-value">{{
                displayBasicField(customer.phone)
              }}</span>
            </div>
            <div class="customer-simple-basic-card__tile" role="listitem">
              <div class="customer-simple-basic-card__tile-head">
                <el-icon class="customer-simple-basic-card__tile-icon" aria-hidden="true">
                  <Message />
                </el-icon>
                <span class="customer-simple-basic-card__tile-label">{{
                  t("detailViews.customer.basicFields.email")
                }}</span>
              </div>
              <span class="customer-simple-basic-card__tile-value">{{
                displayBasicField(customer.email)
              }}</span>
            </div>
          </div>
          <div
            v-if="basicExpanded"
            class="customer-simple-basic-card__tile-grid customer-simple-basic-card__contact-expanded-channels"
            data-testid="customer-simple-basic-contact-expanded-channels"
            role="list"
          >
            <div class="customer-simple-basic-card__tile" role="listitem">
              <div class="customer-simple-basic-card__tile-head">
                <el-icon class="customer-simple-basic-card__tile-icon" aria-hidden="true">
                  <ChatDotRound />
                </el-icon>
                <span class="customer-simple-basic-card__tile-label">{{
                  t("detailViews.customer.basicFields.wechatId")
                }}</span>
              </div>
              <span class="customer-simple-basic-card__tile-value">{{
                displayBasicField(customer.wechatId)
              }}</span>
            </div>
            <div class="customer-simple-basic-card__tile" role="listitem">
              <div class="customer-simple-basic-card__tile-head">
                <el-icon class="customer-simple-basic-card__tile-icon" aria-hidden="true">
                  <ChatLineRound />
                </el-icon>
                <span class="customer-simple-basic-card__tile-label">{{
                  t("detailViews.customer.basicFields.lineId")
                }}</span>
              </div>
              <span class="customer-simple-basic-card__tile-value">{{
                displayBasicField(customer.lineId)
              }}</span>
            </div>
          </div>
        </div>
      </div>

      <template v-if="basicExpanded">
        <!-- 地址：与稿面一致为小节标题 + 卡片内仅图标与多行值 -->
        <div class="customer-simple-basic-card__segment">
          <h4 class="customer-simple-basic-card__segment-title">
            {{ t("detailViews.customer.basicInfoLayout.addressHeading") }}
          </h4>
          <div class="customer-simple-basic-card__tile-grid" role="list">
            <div
              class="customer-simple-basic-card__tile customer-simple-basic-card__tile--full"
              role="listitem"
            >
              <div
                class="customer-simple-basic-card__tile-head customer-simple-basic-card__tile-head--icon-only"
              >
                <el-icon class="customer-simple-basic-card__tile-icon" aria-hidden="true">
                  <Location />
                </el-icon>
              </div>
              <span
                class="customer-simple-basic-card__tile-value customer-simple-basic-card__tile-value--multiline"
                >{{ displayBasicField(customer.address) }}</span>
            </div>
          </div>
        </div>

        <div v-if="hasCompanyInfo" class="customer-simple-basic-card__segment">
          <h4 class="customer-simple-basic-card__segment-title">
            {{ t("detailViews.customer.companyInfoTitle") }}
          </h4>
          <div class="customer-simple-basic-card__tile-grid" role="list">
            <div class="customer-simple-basic-card__tile" role="listitem">
              <div class="customer-simple-basic-card__tile-head">
                <el-icon class="customer-simple-basic-card__tile-icon" aria-hidden="true">
                  <Document />
                </el-icon>
                <span class="customer-simple-basic-card__tile-label">{{
                  t("detailViews.customer.basicFields.corporationNumber")
                }}</span>
              </div>
              <span class="customer-simple-basic-card__tile-value">{{
                displayBasicField(customer.companyInfo!.corporationNumber)
              }}</span>
            </div>
            <div class="customer-simple-basic-card__tile" role="listitem">
              <div class="customer-simple-basic-card__tile-head">
                <el-icon class="customer-simple-basic-card__tile-icon" aria-hidden="true">
                  <Calendar />
                </el-icon>
                <span class="customer-simple-basic-card__tile-label">{{
                  t("detailViews.customer.basicFields.fiscalMonth")
                }}</span>
              </div>
              <span class="customer-simple-basic-card__tile-value">{{
                formatFiscalMonthDisplay()
              }}</span>
            </div>
            <div
              class="customer-simple-basic-card__tile customer-simple-basic-card__tile--full"
              role="listitem"
            >
              <div class="customer-simple-basic-card__tile-head">
                <el-icon class="customer-simple-basic-card__tile-icon" aria-hidden="true">
                  <User />
                </el-icon>
                <span class="customer-simple-basic-card__tile-label">{{
                  t("detailViews.customer.basicFields.representativeName")
                }}</span>
              </div>
              <span class="customer-simple-basic-card__tile-value">{{
                displayBasicField(customer.companyInfo!.representativeName)
              }}</span>
            </div>
          </div>
        </div>

        <div v-if="hasPersonInfo" class="customer-simple-basic-card__segment">
          <h4 class="customer-simple-basic-card__segment-title">
            {{ t("detailViews.customer.personalInfoTitle") }}
          </h4>
          <div class="customer-simple-basic-card__tile-grid" role="list">
            <div class="customer-simple-basic-card__tile" role="listitem">
              <div class="customer-simple-basic-card__tile-head">
                <el-icon class="customer-simple-basic-card__tile-icon" aria-hidden="true">
                  <Flag />
                </el-icon>
                <span class="customer-simple-basic-card__tile-label">{{
                  t("detailViews.customer.basicFields.nationality")
                }}</span>
              </div>
              <span class="customer-simple-basic-card__tile-value">{{
                displayBasicField(customer.personInfo!.nationality)
              }}</span>
            </div>
            <div class="customer-simple-basic-card__tile" role="listitem">
              <div class="customer-simple-basic-card__tile-head">
                <el-icon class="customer-simple-basic-card__tile-icon" aria-hidden="true">
                  <Notebook />
                </el-icon>
                <span class="customer-simple-basic-card__tile-label">{{
                  t("detailViews.customer.basicFields.residenceStatus")
                }}</span>
              </div>
              <span class="customer-simple-basic-card__tile-value">{{
                displayBasicField(customer.personInfo!.residenceStatus)
              }}</span>
            </div>
            <div
              class="customer-simple-basic-card__tile customer-simple-basic-card__tile--full"
              role="listitem"
            >
              <div class="customer-simple-basic-card__tile-head">
                <el-icon class="customer-simple-basic-card__tile-icon" aria-hidden="true">
                  <Postcard />
                </el-icon>
                <span class="customer-simple-basic-card__tile-label">{{
                  t("detailViews.customer.basicFields.passportNumber")
                }}</span>
              </div>
              <span class="customer-simple-basic-card__tile-value">{{
                displayBasicField(customer.personInfo!.passportNumber)
              }}</span>
            </div>
          </div>
        </div>

        <div class="customer-simple-basic-card__segment">
          <h4 class="customer-simple-basic-card__segment-title">
            {{ t("detailViews.customer.basicInfoLayout.recordHeading") }}
          </h4>
          <div class="customer-simple-basic-card__tile-grid" role="list">
            <div
              class="customer-simple-basic-card__tile customer-simple-basic-card__tile--full"
              role="listitem"
            >
              <div class="customer-simple-basic-card__tile-head">
                <el-icon class="customer-simple-basic-card__tile-icon" aria-hidden="true">
                  <UserFilled />
                </el-icon>
                <span class="customer-simple-basic-card__tile-label">{{
                  t("detailViews.customer.basicFields.owner")
                }}</span>
              </div>
              <span class="customer-simple-basic-card__tile-value">{{
                displayBasicField(customer.ownerName)
              }}</span>
            </div>
            <div class="customer-simple-basic-card__tile" role="listitem">
              <div class="customer-simple-basic-card__tile-head">
                <el-icon class="customer-simple-basic-card__tile-icon" aria-hidden="true">
                  <Calendar />
                </el-icon>
                <span class="customer-simple-basic-card__tile-label">{{
                  t("detailViews.customer.basicFields.createdAt")
                }}</span>
              </div>
              <span class="customer-simple-basic-card__tile-value">{{
                customer.createdAt?.slice(0, 10) ??
                t("detailViews.customer.stitchLayout.simpleBasicCard.fieldEmpty")
              }}</span>
            </div>
            <div class="customer-simple-basic-card__tile" role="listitem">
              <div class="customer-simple-basic-card__tile-head">
                <el-icon class="customer-simple-basic-card__tile-icon" aria-hidden="true">
                  <Clock />
                </el-icon>
                <span class="customer-simple-basic-card__tile-label">{{
                  t("detailViews.customer.basicFields.updatedAt")
                }}</span>
              </div>
              <span class="customer-simple-basic-card__tile-value">{{
                customer.updatedAt?.slice(0, 10) ??
                t("detailViews.customer.stitchLayout.simpleBasicCard.fieldEmpty")
              }}</span>
            </div>
          </div>
        </div>
      </template>

      <div class="customer-simple-basic-card__footer">
        <el-button
          data-testid="customer-simple-basic-expand"
          class="customer-simple-basic-card__expand-btn"
          plain
          type="primary"
          :aria-expanded="basicExpanded"
          @click="toggleBasicExpanded"
        >
          <span class="customer-simple-basic-card__expand-inner">
            <el-icon class="customer-simple-basic-card__expand-icon" aria-hidden="true">
              <ArrowUp v-if="basicExpanded" />
              <ArrowDown v-else />
            </el-icon>
            {{
              basicExpanded
                ? t("detailViews.customer.stitchLayout.simpleBasicCard.collapseDetails")
                : t("detailViews.customer.stitchLayout.simpleBasicCard.expandDetails")
            }}
          </span>
        </el-button>
      </div>
    </div>
  </CustomerSimpleSectionCard>
</template>

<style scoped lang="scss" src="./CustomerSimpleBasicCard.scoped.scss"></style>
