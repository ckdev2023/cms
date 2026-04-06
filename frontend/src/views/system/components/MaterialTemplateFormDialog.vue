<script setup lang="ts">
import type { FormInstance, FormRules } from "element-plus";
import { ElMessage } from "element-plus";
import { computed, nextTick, reactive, ref, watch } from "vue";
import { useI18n } from "vue-i18n";

import {
  createMaterialTemplate,
  updateMaterialTemplate,
} from "@/api/visa-case";
import { MaterialItemScopeLabel } from "@/constants/enum-labels";
import { MaterialItemScope, VisaCaseApplicationCategory } from "@/constants/enums";
import type { MaterialTemplateDetail } from "@/types/visa-case";

const props = defineProps<{
  modelValue: boolean;
  /** 传入时为编辑；为 null 时为新建 */
  template: MaterialTemplateDetail | null;
}>();

const emit = defineEmits<{
  "update:modelValue": [val: boolean];
  saved: [];
}>();

defineOptions({ name: "MaterialTemplateFormDialog" });

const { t } = useI18n({ useScope: "global" });

const formRef = ref<FormInstance>();
const submitting = ref(false);

const isEdit = computed((): boolean => Boolean(props.template?.id));

const dialogTitle = computed((): string =>
  isEdit.value
    ? t("pages.materialTemplates.editDialogTitle")
    : t("pages.materialTemplates.createDialogTitle"),
);

const caseTypeOptions = computed((): string[] =>
  Object.values(VisaCaseApplicationCategory),
);

interface RowModel {
  clientKey: string;
  id?: string;
  groupName: string;
  itemName: string;
  scope: MaterialItemScope;
  sortOrder: number;
  isRequired: boolean;
}

const form = reactive({
  caseType: "",
  displayName: "",
});

const rows = ref<RowModel[]>([]);

const scopeSelectOptions = computed(() => [
  { value: MaterialItemScope.CASE, label: MaterialItemScopeLabel[MaterialItemScope.CASE] },
  {
    value: MaterialItemScope.MEMBER,
    label: MaterialItemScopeLabel[MaterialItemScope.MEMBER],
  },
]);

const rules = computed<FormRules>(() => ({
  caseType: [
    {
      required: !isEdit.value,
      message: t("common.enterField", {
        field: t("pages.materialTemplates.caseType"),
      }),
      trigger: "blur",
    },
  ],
  displayName: [
    {
      required: true,
      message: t("common.enterField", {
        field: t("pages.materialTemplates.displayName"),
      }),
      trigger: "blur",
    },
    { max: 200, message: t("validation.maxChars", { max: 200 }), trigger: "blur" },
  ],
}));

/**
 * 生成表格编辑行用的稳定 `clientKey` 与默认字段。
 *
 * @returns 空行模型
 */
function newRow(): RowModel {
  return {
    clientKey: crypto.randomUUID(),
    groupName: "",
    itemName: "",
    scope: MaterialItemScope.CASE,
    sortOrder: 0,
    isRequired: true,
  };
}

/**
 * 校验子表至少一行且分组名、材料名非空。
 *
 * @returns 是否通过
 */
function validateRows(): boolean {
  if (rows.value.length < 1) {
    ElMessage.warning(t("pages.materialTemplates.needOneItem"));
    return false;
  }
  for (const r of rows.value) {
    if (!r.groupName.trim() || !r.itemName.trim()) {
      ElMessage.warning(t("pages.materialTemplates.rowIncomplete"));
      return false;
    }
  }
  return true;
}

/**
 * 打开弹窗时根据新建/编辑重置表单与子表。
 *
 * @returns Promise，在 DOM 更新后清理校验状态
 */
async function resetFormFromProps(): Promise<void> {
  const tpl = props.template;
  if (tpl) {
    form.caseType = tpl.caseType;
    form.displayName = tpl.displayName;
    rows.value = [...tpl.items]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((i) => ({
        clientKey: i.id,
        id: i.id,
        groupName: i.groupName,
        itemName: i.itemName,
        scope: i.scope,
        sortOrder: i.sortOrder,
        isRequired: i.isRequired,
      }));
  } else {
    form.caseType = "";
    form.displayName = "";
    rows.value = [newRow()];
  }
  await nextTick();
  formRef.value?.clearValidate();
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      void resetFormFromProps();
    }
  },
);

/**
 * 追加一行可编辑模板项。
 *
 * @returns 无返回值
 */
function addRow(): void {
  rows.value.push(newRow());
}

/**
 * 按 `clientKey` 删除一行编辑中模板项。
 *
 * @param clientKey - 行键
 * @returns 无返回值
 */
function removeRow(clientKey: string): void {
  rows.value = rows.value.filter((r) => r.clientKey !== clientKey);
}

/**
 * 关闭弹窗并向父组件同步 `modelValue`。
 *
 * @returns 无返回值
 */
function handleClose(): void {
  emit("update:modelValue", false);
}

/**
 * 提交创建或更新请求，成功后提示并 `saved`。
 *
 * @returns 无返回值
 */
async function handleSubmit(): Promise<void> {
  if (submitting.value) {
    return;
  }
  const ok = await formRef.value?.validate().catch(() => false);
  if (!ok) {
    return;
  }
  if (!validateRows()) {
    return;
  }
  submitting.value = true;
  try {
    const itemPayload = rows.value.map((r) => ({
      ...(r.id ? { id: r.id } : {}),
      groupName: r.groupName.trim(),
      itemName: r.itemName.trim(),
      scope: r.scope,
      sortOrder: r.sortOrder,
      isRequired: r.isRequired,
    }));
    if (isEdit.value && props.template) {
      await updateMaterialTemplate(props.template.id, {
        displayName: form.displayName.trim(),
        items: itemPayload,
      });
      ElMessage.success(t("pages.materialTemplates.updateSuccess"));
    } else {
      await createMaterialTemplate({
        caseType: form.caseType.trim(),
        displayName: form.displayName.trim(),
        items: itemPayload,
      });
      ElMessage.success(t("pages.materialTemplates.createSuccess"));
    }
    emit("saved");
    handleClose();
  } catch {
    // 错误提示由请求层统一处理
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    :title="dialogTitle"
    width="min(920px, 96vw)"
    destroy-on-close
    @update:model-value="emit('update:modelValue', $event)"
  >
    <el-form ref="formRef" :model="form" :rules="rules" label-width="120px">
      <el-form-item
        :label="t('pages.materialTemplates.caseType')"
        prop="caseType"
      >
        <el-select
          v-model="form.caseType"
          class="material-tpl-form__case-type"
          filterable
          allow-create
          default-first-option
          :placeholder="t('pages.materialTemplates.caseTypePlaceholder')"
          :disabled="isEdit"
        >
          <el-option
            v-for="opt in caseTypeOptions"
            :key="opt"
            :label="opt"
            :value="opt"
          />
        </el-select>
        <div class="material-tpl-form__hint">
          {{ t("pages.materialTemplates.caseTypeHint") }}
        </div>
      </el-form-item>
      <el-form-item
        :label="t('pages.materialTemplates.displayName')"
        prop="displayName"
      >
        <el-input
          v-model="form.displayName"
          maxlength="200"
          show-word-limit
          :placeholder="t('pages.materialTemplates.displayNamePlaceholder')"
        />
      </el-form-item>
    </el-form>

    <div class="material-tpl-form__items-head">
      <span>{{ t("pages.materialTemplates.itemsSection") }}</span>
      <el-button type="primary" link @click="addRow">
        {{ t("pages.materialTemplates.addItemRow") }}
      </el-button>
    </div>

    <el-table
      :data="rows"
      border
      size="small"
      class="material-tpl-form__table"
      max-height="360"
    >
      <el-table-column
        :label="t('pages.materialTemplates.groupName')"
        min-width="120"
      >
        <template #default="{ row }">
          <el-input v-model="row.groupName" maxlength="100" show-word-limit />
        </template>
      </el-table-column>
      <el-table-column
        :label="t('pages.materialTemplates.itemName')"
        min-width="160"
      >
        <template #default="{ row }">
          <el-input v-model="row.itemName" maxlength="200" show-word-limit />
        </template>
      </el-table-column>
      <el-table-column
        :label="t('pages.materialTemplates.scope')"
        width="140"
      >
        <template #default="{ row }">
          <el-select v-model="row.scope" class="material-tpl-form__scope">
            <el-option
              v-for="opt in scopeSelectOptions"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </template>
      </el-table-column>
      <el-table-column
        :label="t('pages.materialTemplates.sortOrder')"
        width="110"
      >
        <template #default="{ row }">
          <el-input-number
            v-model="row.sortOrder"
            :min="0"
            controls
            class="material-tpl-form__sort"
          />
        </template>
      </el-table-column>
      <el-table-column
        :label="t('pages.materialTemplates.required')"
        width="88"
        align="center"
      >
        <template #default="{ row }">
          <el-switch v-model="row.isRequired" />
        </template>
      </el-table-column>
      <el-table-column
        :label="t('common.actions')"
        width="88"
        align="center"
      >
        <template #default="{ row }">
          <el-button
            type="danger"
            link
            :disabled="rows.length <= 1"
            @click="removeRow(row.clientKey)"
          >
            {{ t("common.delete") }}
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <p class="material-tpl-form__replace-hint">
      {{ t("pages.materialTemplates.itemsReplaceHint") }}
    </p>

    <template #footer>
      <el-button @click="handleClose">{{ t("common.cancel") }}</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSubmit">
        {{ t("common.save") }}
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">
.material-tpl-form__case-type {
  width: 100%;
  max-width: 28rem;
}

.material-tpl-form__hint {
  margin-top: 0.35rem;
  font-size: 0.75rem;
  line-height: 1.4;
  color: var(--el-text-color-secondary);
}

.material-tpl-form__replace-hint {
  margin: 0.75rem 0 0;
  font-size: 0.75rem;
  line-height: 1.45;
  color: var(--el-text-color-secondary);
}

.material-tpl-form__items-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 0.5rem 0 0.5rem;
  font-weight: 600;
}

.material-tpl-form__table {
  width: 100%;
}

.material-tpl-form__scope {
  width: 100%;
}

.material-tpl-form__sort {
  width: 100%;
}
</style>
