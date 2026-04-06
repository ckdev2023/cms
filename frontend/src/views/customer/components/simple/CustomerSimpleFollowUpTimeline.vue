<script setup lang="ts">
import {
  ChatDotRound,
  ChatLineRound,
  ChatLineSquare,
  Document,
  List,
  Refresh,
  WarningFilled,
} from "@element-plus/icons-vue";
import type { Component } from "vue";
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute, useRouter } from "vue-router";

import { getVisaCaseLogs } from "@/api/visa-case";
import { VisaCaseLogTypeLabel } from "@/constants/enum-labels";
import { VisaCaseLogType } from "@/constants/enums";
import { P } from "@/constants/permissions";
import { resolveVisaCaseLogTimelineVisualTone } from "@/constants/visa-case-log-ui";
import { useUserStore } from "@/stores/user";
import type { CustomerListPrimaryVisaCaseSummary } from "@/types/customer";
import type { VisaCaseLogItem } from "@/types/visa-case";
import {
  mergeCustomerDetailReturnQuery,
  pickCustomerDetailDeepLinkPreserve,
} from "@/utils/customer-detail-return-navigation";
import { useLocaleFormatter } from "@/utils/locale-format";

import CustomerSimpleSectionCard from "./CustomerSimpleSectionCard.vue";

const props = defineProps<{
  customerId: string;
  listPrimaryVisaCase: CustomerListPrimaryVisaCaseSummary | null;
  /** 父级在弹框保存成功后递增，用于触发重新拉取日志列表 */
  refreshNonce?: number;
}>();

defineOptions({ name: "CustomerSimpleFollowUpTimeline" });

const route = useRoute();
const router = useRouter();
const { t } = useI18n({ useScope: "global" });
const userStore = useUserStore();
const { formatDateTime } = useLocaleFormatter();

const TLog = (key: string): string =>
  t(`detailViews.customer.visaCaseLogsTab.${key}`);
const TRail = (key: string): string =>
  t(`detailViews.customer.caseLogRail.${key}`);
const TSt = (key: string): string =>
  t(`detailViews.customer.stitchLayout.simpleFollowUpTimeline.${key}`);

const hasVisaCaseDetailPermission = computed((): boolean =>
  userStore.hasPermission(P.VISA_CASE_DETAIL),
);

const visaCaseId = computed((): string =>
  (props.listPrimaryVisaCase?.visaCaseId ?? "").trim(),
);

const canFetch = computed(
  (): boolean => hasVisaCaseDetailPermission.value && !!visaCaseId.value,
);

const loading = ref(false);
const loadError = ref(false);
const logs = ref<VisaCaseLogItem[]>([]);

const SIMPLE_TIMELINE_PAGE_SIZE = 25;

let fetchSeq = 0;

watch(
  () =>
    [props.customerId, visaCaseId.value, canFetch.value, props.refreshNonce ?? 0] as const,
  async ([, id, can]) => {
    const seq = ++fetchSeq;
    if (!can || !id) {
      logs.value = [];
      loadError.value = false;
      loading.value = false;
      return;
    }
    loading.value = true;
    loadError.value = false;
    try {
      const res = await getVisaCaseLogs(id, {
        page: 1,
        pageSize: SIMPLE_TIMELINE_PAGE_SIZE,
        sortOrder: "DESC",
      });
      if (seq !== fetchSeq) {
        return;
      }
      logs.value = res.data.items;
    } catch {
      if (seq !== fetchSeq) {
        return;
      }
      loadError.value = true;
      logs.value = [];
    } finally {
      if (seq === fetchSeq) {
        loading.value = false;
      }
    }
  },
  { immediate: true },
);

/**
 * 解析日志正文中的列表要点行（行首为 `-` / `•` / 数字序号等）。
 *
 * @param content - 日志正文
 * @returns 去行首符号后的要点文案列表
 */
function bulletLinesFromContent(content: string | null | undefined): string[] {
  if (!content?.trim()) {
    return [];
  }
  const out: string[] = [];
  for (const raw of content.split(/\r?\n/u)) {
    const line = raw.trim();
    if (!line) {
      continue;
    }
    if (/^[-•*·]\s*/u.test(line)) {
      out.push(line.replace(/^[-•*·]\s*/u, "").trim());
      continue;
    }
    if (/^\d+[.)]\s+/u.test(line)) {
      out.push(line.replace(/^\d+[.)]\s+/u, "").trim());
    }
  }
  return out;
}

/**
 * 为简化时间线卡片选择 `logType` 对应图标，与右侧 Rail 映射一致。
 *
 * @param logType - 后端日志类型字符串
 * @returns 图标组件
 */
function timelineIconForLogType(logType: string): Component {
  switch (logType as VisaCaseLogType) {
    case VisaCaseLogType.SUBMISSION:
      return Document;
    case VisaCaseLogType.SUPPLEMENT:
      return WarningFilled;
    case VisaCaseLogType.FOLLOW_UP:
      return ChatLineRound;
    case VisaCaseLogType.STATUS_CHANGE:
      return Refresh;
    case VisaCaseLogType.GENERAL:
      return ChatDotRound;
    default:
      return ChatLineSquare;
  }
}

/**
 * 跳转签证域日志分区并锁定主展示案件，便于查看完整分页与编辑能力。
 */
function openFullLogs(): void {
  const pc = props.listPrimaryVisaCase;
  if (!pc) {
    return;
  }
  const query: Record<string, string> = {
    tab: "visa-domain",
    visaDomainBlock: "logs",
    logVisaCaseId: pc.visaCaseId,
    ...pickCustomerDetailDeepLinkPreserve(route.query),
  };
  mergeCustomerDetailReturnQuery(query, route, {
    overrideFullPath: `/customers/${props.customerId}/simple`,
  });
  void router.push({
    name: "CustomerDetail",
    params: { id: props.customerId },
    query,
  });
}
</script>

<template>
  <CustomerSimpleSectionCard :title="TSt('sectionTitle')" title-tag="h3">
    <template #icon>
      <el-icon><List /></el-icon>
    </template>
    <template #actions>
      <el-button
        text
        type="primary"
        :disabled="!listPrimaryVisaCase"
        @click="openFullLogs"
      >
        {{ TSt("viewAll") }}
      </el-button>
    </template>

    <div class="customer-simple-follow-up-timeline">
      <div class="customer-simple-follow-up-timeline__toolbar">
        <span class="customer-simple-follow-up-timeline__sort">{{
          TSt("sortDesc")
        }}</span>
        <el-tooltip :content="TSt('exportDisabledTooltip')" placement="top-end">
          <span class="customer-simple-follow-up-timeline__export-wrap">
            <el-button disabled class="customer-simple-follow-up-timeline__export">
              {{ TSt("export") }}
            </el-button>
          </span>
        </el-tooltip>
      </div>

      <div v-loading="loading" class="customer-simple-follow-up-timeline__body">
        <template v-if="!listPrimaryVisaCase">
          <el-empty
            :description="TRail('noPrimaryCase')"
            class="customer-simple-follow-up-timeline__empty"
          />
        </template>
        <template v-else-if="!hasVisaCaseDetailPermission">
          <el-empty
            :description="TRail('needDetailPermission')"
            class="customer-simple-follow-up-timeline__empty"
          />
        </template>
        <template v-else>
          <el-empty
            v-if="loadError"
            :description="TRail('loadError')"
            class="customer-simple-follow-up-timeline__empty"
          />
          <el-empty
            v-else-if="!loading && logs.length === 0"
            :description="TRail('empty')"
            class="customer-simple-follow-up-timeline__empty"
          />
          <ul
            v-else
            class="customer-simple-follow-up-timeline__list"
            role="list"
          >
            <li
              v-for="log in logs"
              :key="log.id"
              class="customer-simple-follow-up-timeline__item"
              role="listitem"
            >
              <article
                class="customer-simple-follow-up-timeline__card"
                :class="`visa-case-log-timeline-tone--${resolveVisaCaseLogTimelineVisualTone(log.logType)}`"
              >
                <div class="customer-simple-follow-up-timeline__card-cols">
                  <div class="customer-simple-follow-up-timeline__icon-col">
                    <div class="customer-simple-follow-up-timeline__icon-ring">
                      <el-icon class="customer-simple-follow-up-timeline__type-icon">
                        <component
                          :is="timelineIconForLogType(log.logType)"
                        />
                      </el-icon>
                    </div>
                  </div>
                  <div class="customer-simple-follow-up-timeline__main-col">
                    <header class="customer-simple-follow-up-timeline__head">
                      <h4 class="customer-simple-follow-up-timeline__title">
                        {{
                          VisaCaseLogTypeLabel[log.logType as VisaCaseLogType] ??
                          log.logType
                        }}
                      </h4>
                      <div class="customer-simple-follow-up-timeline__meta">
                        <time
                          class="customer-simple-follow-up-timeline__time"
                          :datetime="log.createdAt"
                          >{{ formatDateTime(log.createdAt) }}</time
                        >
                        <span
                          v-if="log.creatorName"
                          class="customer-simple-follow-up-timeline__author"
                          >{{ log.creatorName }}</span
                        >
                      </div>
                    </header>
                    <ul
                      v-if="bulletLinesFromContent(log.content).length > 0"
                      class="customer-simple-follow-up-timeline__bullets"
                    >
                      <li
                        v-for="(line, idx) in bulletLinesFromContent(log.content)"
                        :key="idx"
                        class="customer-simple-follow-up-timeline__bullet"
                      >
                        {{ line }}
                      </li>
                    </ul>
                    <div
                      v-else
                      class="customer-simple-follow-up-timeline__content"
                    >
                      {{ log.content }}
                    </div>
                    <div
                      v-if="
                        log.nextAction ||
                        log.nextFollowUpAt ||
                        log.submittedItems ||
                        log.missingItems
                      "
                      class="customer-simple-follow-up-timeline__footer"
                    >
                      <p
                        v-if="log.submittedItems"
                        class="customer-simple-follow-up-timeline__foot-line"
                      >
                        <span class="customer-simple-follow-up-timeline__foot-k">{{
                          TLog("submittedItems")
                        }}</span>
                        {{ log.submittedItems }}
                      </p>
                      <p
                        v-if="log.missingItems"
                        class="customer-simple-follow-up-timeline__foot-line customer-simple-follow-up-timeline__foot-line--warn"
                      >
                        <span class="customer-simple-follow-up-timeline__foot-k">{{
                          TLog("missingItems")
                        }}</span>
                        {{ log.missingItems }}
                      </p>
                      <p
                        v-if="log.nextAction"
                        class="customer-simple-follow-up-timeline__foot-line"
                      >
                        <span class="customer-simple-follow-up-timeline__foot-k">{{
                          TLog("nextAction")
                        }}</span>
                        {{ log.nextAction }}
                      </p>
                      <p
                        v-if="log.nextFollowUpAt"
                        class="customer-simple-follow-up-timeline__foot-line"
                      >
                        <span class="customer-simple-follow-up-timeline__foot-k">{{
                          TLog("nextFollowUpAt")
                        }}</span>
                        {{ formatDateTime(log.nextFollowUpAt) }}
                      </p>
                    </div>
                  </div>
                </div>
              </article>
            </li>
          </ul>
        </template>
      </div>
    </div>
  </CustomerSimpleSectionCard>
</template>

<style scoped lang="scss" src="./CustomerSimpleFollowUpTimeline.scoped.scss"></style>
