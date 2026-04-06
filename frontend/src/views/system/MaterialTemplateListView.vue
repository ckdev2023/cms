<script setup lang="ts">
import { Plus, Refresh } from "@element-plus/icons-vue";
import { ElMessage } from "element-plus";
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";

import {
  deactivateMaterialTemplate,
  getMaterialTemplates,
} from "@/api/visa-case";
import PageList from "@/components/PageList.vue";
import { useConfirm } from "@/composables/useConfirm";
import { P } from "@/constants/permissions";
import { useAppStore } from "@/stores/app";
import type { MaterialTemplateDetail } from "@/types/visa-case";
import { formatVisaCaseTypeDisplay } from "@/utils/visa-case-type-display";

import MaterialTemplateFormDialog from "./components/MaterialTemplateFormDialog.vue";

defineOptions({ name: "MaterialTemplateListView" });

const { t } = useI18n({ useScope: "global" });
const { confirm } = useConfirm();
const appStore = useAppStore();

const loading = ref(false);
const list = ref<MaterialTemplateDetail[]>([]);
const keyword = ref("");

const dialogVisible = ref(false);
const editingTemplate = ref<MaterialTemplateDetail | null>(null);

const filteredList = computed((): MaterialTemplateDetail[] => {
  const k = keyword.value.trim().toLowerCase();
  if (!k) {
    return list.value;
  }
  return list.value.filter((row: MaterialTemplateDetail) =>
    row.caseType.toLowerCase().includes(k) ||
    row.displayName.toLowerCase().includes(k),
  );
});

/**
 * 从服务端刷新材料模板全量列表（与 `GET /material-templates` 一致）。
 *
 * @returns 无返回值
 */
async function fetchList(): Promise<void> {
  loading.value = true;
  try {
    const res = await getMaterialTemplates();
    list.value = res.data ?? [];
  } catch {
    list.value = [];
  } finally {
    loading.value = false;
  }
}

/**
 * 打开新建模板弹窗。
 *
 * @returns 无返回值
 */
function handleCreate(): void {
  editingTemplate.value = null;
  dialogVisible.value = true;
}

/**
 * 打开编辑弹窗并带入当前行详情。
 *
 * @param row - 列表行
 * @returns 无返回值
 */
function handleEdit(row: MaterialTemplateDetail): void {
  editingTemplate.value = row;
  dialogVisible.value = true;
}

/**
 * 确认后停用模板并刷新列表。
 *
 * @param row - 列表行
 * @returns 无返回值
 */
async function handleDeactivate(row: MaterialTemplateDetail): Promise<void> {
  const ok = await confirm({
    title: t("pages.materialTemplates.deactivateTitle"),
    message: t("pages.materialTemplates.deactivateConfirm", {
      name: row.displayName,
    }),
    type: "warning",
  });
  if (!ok) {
    return;
  }
  try {
    await deactivateMaterialTemplate(row.id);
    ElMessage.success(t("pages.materialTemplates.deactivateSuccess"));
    await fetchList();
  } catch {
    // 错误提示由请求层统一处理
  }
}

/**
 * 弹窗保存成功后刷新列表。
 *
 * @returns 无返回值
 */
function handleSaved(): void {
  void fetchList();
}

/**
 * 将 ISO 时间格式化为当前界面语言的短日期。
 *
 * @param dateStr - 后端返回的时间字符串
 * @returns 展示用日期或占位符
 */
function formatDate(dateStr: string): string {
  if (!dateStr) {
    return "-";
  }
  return new Date(dateStr).toLocaleDateString(
    appStore.locale === "zh-CN" ? "zh-CN" : "ja-JP",
  );
}

onMounted(() => {
  void fetchList();
});
</script>

<template>
  <PageList :title="t('pages.materialTemplates.title')">
    <template #headerExtra>
      <el-button
        v-permission="P.MATERIAL_TEMPLATE_MANAGE"
        type="primary"
        :icon="Plus"
        @click="handleCreate"
      >
        {{ t("common.create") }}
      </el-button>
    </template>

    <template #search>
      <el-form inline>
        <el-form-item :label="t('common.keyword')">
          <el-input
            v-model="keyword"
            clearable
            style="width: 260px"
            :placeholder="t('pages.materialTemplates.keywordPlaceholder')"
          />
        </el-form-item>
      </el-form>
    </template>

    <el-card shadow="never">
      <template #header>
        <div class="material-tpl-list__card-head">
          <span>{{ t("pages.materialTemplates.listCardTitle") }}</span>
          <el-tooltip :content="t('pages.materialTemplates.reload')" placement="left">
            <el-button :icon="Refresh" circle @click="fetchList" />
          </el-tooltip>
        </div>
      </template>

      <el-table v-loading="loading" :data="filteredList" border stripe>
        <el-table-column
          prop="caseType"
          :label="t('pages.materialTemplates.caseType')"
          min-width="160"
        >
          <template #default="{ row }">
            {{
              formatVisaCaseTypeDisplay((row as MaterialTemplateDetail).caseType) ||
              (row as MaterialTemplateDetail).caseType
            }}
          </template>
        </el-table-column>
        <el-table-column
          prop="displayName"
          :label="t('pages.materialTemplates.displayName')"
          min-width="200"
        />
        <el-table-column
          :label="t('pages.materialTemplates.itemCount')"
          width="100"
          align="center"
        >
          <template #default="{ row }">
            {{ row.items?.length ?? 0 }}
          </template>
        </el-table-column>
        <el-table-column
          :label="t('common.status')"
          width="100"
          align="center"
        >
          <template #default="{ row }">
            <el-tag :type="row.isActive ? 'success' : 'info'" size="small">
              {{
                row.isActive
                  ? t("pages.materialTemplates.statusActive")
                  : t("pages.materialTemplates.statusInactive")
              }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          prop="updatedAt"
          :label="t('common.updatedAt')"
          width="120"
        >
          <template #default="{ row }">
            {{ formatDate(row.updatedAt) }}
          </template>
        </el-table-column>
        <el-table-column
          :label="t('common.actions')"
          width="160"
          fixed="right"
        >
          <template #default="{ row }">
            <el-button
              v-permission="P.MATERIAL_TEMPLATE_MANAGE"
              type="primary"
              link
              @click="handleEdit(row)"
            >
              {{ t("common.edit") }}
            </el-button>
            <el-button
              v-permission="P.MATERIAL_TEMPLATE_MANAGE"
              type="danger"
              link
              @click="handleDeactivate(row)"
            >
              {{ t("pages.materialTemplates.deactivate") }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <MaterialTemplateFormDialog
      v-model="dialogVisible"
      :template="editingTemplate"
      @saved="handleSaved"
    />
  </PageList>
</template>

<style scoped lang="scss">
.material-tpl-list__card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
</style>
