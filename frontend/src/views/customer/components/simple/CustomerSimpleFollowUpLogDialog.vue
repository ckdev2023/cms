<script setup lang="ts">
import { DocumentAdd } from "@element-plus/icons-vue";
import type { FormInstance, FormRules } from "element-plus";
import { ElMessage } from "element-plus";
import { computed, nextTick, reactive, ref, watch } from "vue";
import { useI18n } from "vue-i18n";

import { createVisaCaseLog } from "@/api/visa-case";
import { VisaCaseLogTypeLabel } from "@/constants/enum-labels";
import { VisaCaseLogType } from "@/constants/enums";
import { useUserStore } from "@/stores/user";
import { useLocaleFormatter } from "@/utils/locale-format";
import { formatIsoToDatetimeLocalPickerValue } from "@/utils/visa-case-log-deep-link";

const props = defineProps<{
  /** 弹框开关，与 `v-model` 绑定 */
  modelValue: boolean;
  /** 主展示案件 ID，用于 POST 案件日志 */
  visaCaseId: string;
  /** 预填「下次跟进」表单项（与旧详情深链同源，ISO 串） */
  suggestedNextFollowUpAt?: string | null;
}>();

const emit = defineEmits<{
  "update:modelValue": [open: boolean];
  /** 创建成功并已关闭弹框，供父级刷新时间线 */
  saved: [];
}>();

defineOptions({ name: "CustomerSimpleFollowUpLogDialog" });

const { t } = useI18n({ useScope: "global" });
const { formatDateTime } = useLocaleFormatter();
const userStore = useUserStore();

const T = (key: string, params?: Record<string, unknown>): string =>
  t(`detailViews.customer.stitchLayout.simpleFollowUpDialog.${key}`, params ?? {});

const dialogVisible = computed({
  get: (): boolean => props.modelValue,
  set: (open: boolean): void => {
    emit("update:modelValue", open);
  },
});

const formRef = ref<FormInstance>();
const submitting = ref(false);
const openedAtDisplay = ref("");

const form = reactive({
  logType: VisaCaseLogType.FOLLOW_UP as VisaCaseLogType,
  content: "",
  submittedItems: "",
  missingItems: "",
  nextAction: "",
  nextFollowUpAt: "",
});

const logTypeOptions = computed(() =>
  Object.values(VisaCaseLogType).map((value) => ({
    value,
    label: VisaCaseLogTypeLabel[value] ?? value,
  })),
);

const followerDisplayName = computed((): string => {
  const u = userStore.userInfo;
  const d = u?.displayName?.trim();
  if (d) {
    return d;
  }
  const name = u?.username?.trim();
  return name || "—";
});

const formRules = computed<FormRules>(() => ({
  logType: [
    {
      required: true,
      message: t("common.selectField", { field: T("method") }),
      trigger: "change",
    },
  ],
  content: [
    {
      required: true,
      message: t("common.enterField", { field: T("communication") }),
      trigger: "blur",
    },
    { max: 5000, message: t("validation.maxChars", { max: 5000 }), trigger: "blur" },
  ],
}));

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      void primeFormOnOpen();
    }
  },
);

/**
 * 打开弹框时重置模型、写入跟进时间只读文案并清理校验状态。
 */
async function primeFormOnOpen(): Promise<void> {
  form.logType = VisaCaseLogType.FOLLOW_UP;
  form.content = "";
  form.submittedItems = "";
  form.missingItems = "";
  form.nextAction = "";
  const suggested = props.suggestedNextFollowUpAt?.trim();
  form.nextFollowUpAt = suggested
    ? formatIsoToDatetimeLocalPickerValue(suggested)
    : "";
  openedAtDisplay.value = formatDateTime(new Date().toISOString());
  await nextTick();
  formRef.value?.clearValidate();
}

/**
 * 校验通过后调用创建接口；成功则提示、关窗并向上抛出 saved。
 */
async function requestSave(): Promise<void> {
  const id = props.visaCaseId.trim();
  if (!id) {
    return;
  }
  const ok = await formRef.value?.validate().catch(() => false);
  if (!ok) {
    return;
  }
  submitting.value = true;
  try {
    await createVisaCaseLog(id, {
      logType: form.logType,
      content: form.content,
      submittedItems: form.submittedItems || undefined,
      missingItems: form.missingItems || undefined,
      nextAction: form.nextAction || undefined,
      nextFollowUpAt: form.nextFollowUpAt
        ? new Date(form.nextFollowUpAt).toISOString()
        : undefined,
    });
    ElMessage.success(t("detailViews.customer.visaCaseLogsTab.createdSuccess"));
    dialogVisible.value = false;
    emit("saved");
  } catch {
    // 请求层已统一提示
  } finally {
    submitting.value = false;
  }
}

function requestCancel(): void {
  dialogVisible.value = false;
}
</script>

<template>
  <el-dialog
    v-model="dialogVisible"
    class="customer-simple-follow-up-log-dialog"
    modal-class="customer-simple-follow-up-log-dialog__overlay"
    width="min(680px, calc(100vw - 40px))"
    append-to-body
    align-center
    :close-on-click-modal="false"
    destroy-on-close
  >
    <template #header>
      <div class="customer-simple-follow-up-log-dialog__title-row">
        <div class="customer-simple-follow-up-log-dialog__title-icon" aria-hidden="true">
          <el-icon :size="22">
            <DocumentAdd />
          </el-icon>
        </div>
        <span class="customer-simple-follow-up-log-dialog__title-text">{{
          T("title")
        }}</span>
      </div>
    </template>

    <el-form
      ref="formRef"
      :model="form"
      :rules="formRules"
      label-position="top"
      class="customer-simple-follow-up-log-dialog__form"
    >
      <div
        class="customer-simple-follow-up-log-dialog__grid customer-simple-follow-up-log-dialog__grid--meta"
      >
        <el-form-item :label="T('method')" prop="logType">
          <el-select v-model="form.logType" class="customer-simple-follow-up-log-dialog__control">
            <el-option
              v-for="opt in logTypeOptions"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item :label="T('follower')">
          <el-input
            :model-value="followerDisplayName"
            class="customer-simple-follow-up-log-dialog__control"
            readonly
          />
        </el-form-item>
        <el-form-item :label="T('recordedAt')">
          <el-input
            :model-value="openedAtDisplay"
            class="customer-simple-follow-up-log-dialog__control"
            readonly
          />
        </el-form-item>
      </div>

      <el-form-item :label="T('communication')" prop="content">
        <el-input
          v-model="form.content"
          type="textarea"
          :rows="5"
          :placeholder="T('communicationPlaceholder')"
          maxlength="5000"
          show-word-limit
        />
      </el-form-item>

      <div
        class="customer-simple-follow-up-log-dialog__grid customer-simple-follow-up-log-dialog__grid--pair"
      >
        <el-form-item :label="T('submittedItems')">
          <el-input
            v-model="form.submittedItems"
            type="textarea"
            :rows="3"
            :placeholder="T('submittedPlaceholder')"
            maxlength="2000"
            show-word-limit
          />
        </el-form-item>
        <el-form-item :label="T('missingItems')">
          <el-input
            v-model="form.missingItems"
            type="textarea"
            :rows="3"
            :placeholder="T('missingPlaceholder')"
            maxlength="2000"
            show-word-limit
          />
        </el-form-item>
      </div>

      <el-form-item :label="T('nextAction')">
        <el-input
          v-model="form.nextAction"
          type="textarea"
          :rows="3"
          :placeholder="T('nextActionPlaceholder')"
          maxlength="1000"
          show-word-limit
        />
      </el-form-item>

      <div
        class="customer-simple-follow-up-log-dialog__grid customer-simple-follow-up-log-dialog__grid--footer-fields"
      >
        <el-form-item :label="T('nextFollowUpAt')">
          <el-date-picker
            v-model="form.nextFollowUpAt"
            type="datetime"
            value-format="YYYY-MM-DDTHH:mm"
            class="customer-simple-follow-up-log-dialog__control customer-simple-follow-up-log-dialog__control--date"
            clearable
          />
        </el-form-item>
        <el-form-item :label="T('createReminder')">
          <el-tooltip :content="T('reminderSoon')" placement="top">
            <el-switch disabled :model-value="false" />
          </el-tooltip>
        </el-form-item>
      </div>
    </el-form>

    <template #footer>
      <div class="customer-simple-follow-up-log-dialog__footer">
        <el-button
          class="customer-simple-follow-up-log-dialog__btn-cancel"
          @click="requestCancel"
        >
          {{ t("common.cancel") }}
        </el-button>
        <el-button
          type="primary"
          class="customer-simple-follow-up-log-dialog__btn-save"
          :loading="submitting"
          @click="requestSave"
        >
          {{ T("save") }}
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss" src="./CustomerSimpleFollowUpLogDialog.scoped.scss"></style>

<!-- Teleport 遮罩：单独文件、无 scoped，类名已加组件前缀 -->
<style lang="scss" src="./CustomerSimpleFollowUpLogDialog.overlay.scss"></style>
