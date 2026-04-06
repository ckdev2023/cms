<script setup lang="ts">
import { CopyDocument, FolderOpened } from "@element-plus/icons-vue";
import { ElMessage } from "element-plus";
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute, useRouter } from "vue-router";

import { getCustomerFilePaths } from "@/api/visa-case";
import { FilePathTypeLabel } from "@/constants/enum-labels";
import { FilePathType } from "@/constants/enums";
import { P } from "@/constants/permissions";
import { useUserStore } from "@/stores/user";
import type { CustomerFilePathItem } from "@/types/visa-case";
import {
  mergeCustomerDetailReturnQuery,
  pickCustomerDetailDeepLinkPreserve,
} from "@/utils/customer-detail-return-navigation";

import CustomerSimpleSectionCard from "./CustomerSimpleSectionCard.vue";

const props = defineProps<{
  /** 客户主键，与 `CustomerFilePathsTab` 一致 */
  customerId: string;
}>();

defineOptions({ name: "CustomerSimpleFilePathsCard" });

const route = useRoute();
const router = useRouter();
const { t } = useI18n({ useScope: "global" });
const userStore = useUserStore();

const T = (key: string, params?: Record<string, unknown>): string =>
  t(`detailViews.customer.filePathsTab.${key}`, params ?? {});

const canList = computed((): boolean =>
  userStore.hasPermission(P.CUSTOMER_FILE_PATH_LIST),
);

const loading = ref(false);
const paths = ref<CustomerFilePathItem[]>([]);

/** 与 Stitch 稿「三段路径」对齐的固定类型顺序（案件 / 个人 / 证书）。 */
const pathTypeSlots: FilePathType[] = [
  FilePathType.CASE_DOCUMENT,
  FilePathType.PERSONAL_DOCUMENT,
  FilePathType.CERTIFICATE,
];

/**
 * 在同类型多条记录中取 `updatedAt` 最新的一条，避免分页顺序导致展示陈旧路径。
 *
 * @param pathType - 台账类型
 * @returns 最新记录或 null
 */
function pickLatestForType(pathType: FilePathType): CustomerFilePathItem | null {
  const list = paths.value.filter((p) => p.pathType === pathType);
  if (list.length === 0) {
    return null;
  }
  return [...list].sort((a, b) => {
    const ta = new Date(a.updatedAt).getTime();
    const tb = new Date(b.updatedAt).getTime();
    return tb - ta;
  })[0]!;
}

const rows = computed((): { pathType: FilePathType; item: CustomerFilePathItem | null }[] => {
  return pathTypeSlots.map((pathType) => ({
    pathType,
    item: pickLatestForType(pathType),
  }));
});

/**
 * 拉取客户资料路径台账首页，供三联行各取首条同类型记录展示。
 */
async function fetchPaths(): Promise<void> {
  if (!canList.value || !props.customerId) {
    paths.value = [];
    return;
  }
  loading.value = true;
  try {
    const res = await getCustomerFilePaths(props.customerId, {
      page: 1,
      pageSize: 100,
    });
    paths.value = res.data.items;
  } catch {
    paths.value = [];
  } finally {
    loading.value = false;
  }
}

watch(
  () => [props.customerId, canList.value] as const,
  () => {
    void fetchPaths();
  },
  { immediate: true },
);

/**
 * 复制路径文本到剪贴板，失败时回退 `execCommand`。
 *
 * @param filePath - 服务器路径原文
 */
async function handleCopy(filePath: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(filePath);
    ElMessage.success(T("copySuccess"));
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = filePath;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
    ElMessage.success(T("copySuccess"));
  }
}

/**
 * 跳转签证域资料路径分区。
 */
function openPathsWorkbench(): void {
  const query: Record<string, string> = {
    tab: "visa-domain",
    visaDomainBlock: "paths",
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
  <CustomerSimpleSectionCard
    :title="t('detailViews.customer.stitchLayout.simplePathsCard.title')"
    title-tag="h3"
  >
    <template #icon>
      <el-icon><FolderOpened /></el-icon>
    </template>
    <template v-if="canList" #actions>
      <el-button text type="primary" @click="openPathsWorkbench">
        {{ t("detailViews.customer.stitchLayout.simplePathsCard.viewAll") }}
      </el-button>
    </template>

    <el-empty
      v-if="!canList"
      :description="
        t('detailViews.customer.stitchLayout.simplePathsCard.needListPermission')
      "
    />

    <div v-else v-loading="loading" class="customer-simple-paths-card">
      <div
        v-for="row in rows"
        :key="row.pathType"
        class="customer-simple-paths-card__row"
      >
        <div class="customer-simple-paths-card__label">
          {{ FilePathTypeLabel[row.pathType] ?? row.pathType }}
        </div>
        <div class="customer-simple-paths-card__path-wrap">
          <code class="customer-simple-paths-card__path">{{
            row.item?.filePath?.trim() ||
            t("detailViews.customer.stitchLayout.simplePathsCard.emptyPath")
          }}</code>
          <el-button
            class="customer-simple-paths-card__copy"
            :icon="CopyDocument"
            :disabled="!row.item?.filePath?.trim()"
            text
            type="primary"
            :aria-label="
              t('detailViews.customer.stitchLayout.simplePathsCard.copyPath')
            "
            @click="
              row.item?.filePath ? handleCopy(row.item.filePath) : undefined
            "
          />
        </div>
      </div>
    </div>
  </CustomerSimpleSectionCard>
</template>

<style scoped lang="scss" src="./CustomerSimpleFilePathsCard.scoped.scss"></style>
