<script setup lang="ts">
import { RefreshRight } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  commitAdminCaseVisaSupplement,
  previewAdminCaseVisaSupplement,
} from '@/api/visa-case'
import { P } from '@/constants/permissions'
import { useUserStore } from '@/stores/user'
import type {
  AdminCaseVisaSupplementCommitResult,
  AdminCaseVisaSupplementPreviewResult,
} from '@/types/visa-case'

defineOptions({ name: 'AdminCaseVisaSupplementView' })

const { t } = useI18n({ useScope: 'global' })
const userStore = useUserStore()

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const canUse = computed(() => userStore.hasPermission(P.VISA_CASE_ADMIN_SUPPLEMENT))

const idText = ref('')
const lastPreview = ref<AdminCaseVisaSupplementPreviewResult | null>(null)
/** 与最近一次成功预览对应的请求 ID 列表（提交须一致）。 */
const lockedIds = ref<string[] | null>(null)
const previewLoading = ref(false)
const commitLoading = ref(false)
const resultVisible = ref(false)
const commitResult = ref<AdminCaseVisaSupplementCommitResult | null>(null)

/**
 * 从文本框解析行政案件 UUID：支持换行、逗号或空白分隔，去重并过滤非法 token。
 *
 * @param raw - 用户粘贴的多行文本
 * @returns 合法 UUID 列表（保持首次出现顺序）
 */
function parseAdminCaseIds(raw: string): string[] {
  const tokens = raw
    .split(/[\s,;]+/g)
    .map((s) => s.trim())
    .filter(Boolean)
  const out: string[] = []
  const seen = new Set<string>()
  for (const tok of tokens) {
    if (!UUID_RE.test(tok) || seen.has(tok.toLowerCase())) {continue}
    seen.add(tok.toLowerCase())
    out.push(tok)
  }
  return out
}

/**
 * 将预览行状态映射为 Element Plus 标签类型。
 *
 * @param status - 后端行状态
 * @returns 标签配色类型
 */
function statusTagType(
  status: string,
): 'success' | 'warning' | 'danger' | 'info' {
  if (status === 'OK') {return 'success'}
  if (status === 'WARNING') {return 'warning'}
  if (status === 'ERROR') {return 'danger'}
  return 'info'
}

/**
 * 调用预览接口并锁定本次请求的 ID 列表供提交使用。
 */
async function runPreview(): Promise<void> {
  if (!canUse.value) {
    ElMessage.warning(t('pages.adminCaseVisaSupplement.noPermission'))
    return
  }
  const ids = parseAdminCaseIds(idText.value)
  if (!ids.length) {
    ElMessage.warning(t('pages.adminCaseVisaSupplement.noIds'))
    return
  }
  previewLoading.value = true
  try {
    const { data } = await previewAdminCaseVisaSupplement(ids)
    lastPreview.value = data
    lockedIds.value = ids
  } finally {
    previewLoading.value = false
  }
}

/**
 * 在预览无 ERROR 行时确认并提交补录批次。
 */
async function runCommit(): Promise<void> {
  if (!canUse.value) {
    ElMessage.warning(t('pages.adminCaseVisaSupplement.noPermission'))
    return
  }
  const ids = lockedIds.value
  const preview = lastPreview.value
  if (!ids?.length || !preview?.summary.canProceed) {
    ElMessage.warning(t('pages.adminCaseVisaSupplement.cannotCommit'))
    return
  }
  try {
    await ElMessageBox.confirm(
      t('pages.adminCaseVisaSupplement.confirmCommit', { count: ids.length }),
      t('confirm.title'),
      { type: 'warning' },
    )
  } catch {
    return
  }
  commitLoading.value = true
  try {
    const { data } = await commitAdminCaseVisaSupplement(ids)
    commitResult.value = data
    resultVisible.value = true
    ElMessage.success(t('pages.adminCaseVisaSupplement.commitSuccess'))
    void runPreview().catch(() => {
      /* 刷新预览失败不阻断成功提示 */
    })
  } finally {
    commitLoading.value = false
  }
}

/**
 * 清空文本、预览锁定状态与结果对话框，便于重新选择行政案件 ID。
 */
function resetAll(): void {
  idText.value = ''
  lastPreview.value = null
  lockedIds.value = null
  commitResult.value = null
  resultVisible.value = false
}
</script>

<template>
  <div class="admin-supp page-container">
    <el-alert
      v-if="!canUse"
      type="warning"
      show-icon
      :closable="false"
      :title="t('pages.adminCaseVisaSupplement.noPermission')"
    />
    <template v-else>
      <div v-permission="P.VISA_CASE_ADMIN_SUPPLEMENT" class="admin-supp__main">
      <div class="admin-supp__head">
        <span class="admin-supp__title">{{ t('pages.adminCaseVisaSupplement.title') }}</span>
        <el-button v-permission="P.VISA_CASE_ADMIN_SUPPLEMENT" text :icon="RefreshRight" @click="resetAll">
          {{ t('pages.adminCaseVisaSupplement.reset') }}
        </el-button>
      </div>
      <p class="admin-supp__hint">{{ t('pages.adminCaseVisaSupplement.scopeHint') }}</p>
      <el-input
        v-model="idText"
        type="textarea"
        :rows="8"
        :placeholder="t('pages.adminCaseVisaSupplement.idPlaceholder')"
      />
      <div class="admin-supp__actions">
        <el-button v-permission="P.VISA_CASE_ADMIN_SUPPLEMENT" type="primary" :loading="previewLoading" @click="runPreview">
          {{ t('pages.adminCaseVisaSupplement.preview') }}
        </el-button>
        <el-button
          v-permission="P.VISA_CASE_ADMIN_SUPPLEMENT"
          type="success"
          :loading="commitLoading"
          :disabled="!lastPreview?.summary.canProceed"
          @click="runCommit"
        >
          {{ t('pages.adminCaseVisaSupplement.commit') }}
        </el-button>
      </div>

      <template v-if="lastPreview">
        <el-descriptions :column="2" border class="admin-supp__meta">
          <el-descriptions-item :label="t('pages.adminCaseVisaSupplement.sha256')">
            <code class="admin-supp__code">{{ lastPreview.contentSha256 }}</code>
          </el-descriptions-item>
          <el-descriptions-item :label="t('pages.adminCaseVisaSupplement.rowCount')">
            {{ lastPreview.summary.rowCount }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('pages.adminCaseVisaSupplement.canProceed')">
            <el-tag :type="lastPreview.summary.canProceed ? 'success' : 'danger'" size="small">
              {{ lastPreview.summary.canProceed ? t('pages.adminCaseVisaSupplement.yes') : t('pages.adminCaseVisaSupplement.no') }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item :label="t('pages.adminCaseVisaSupplement.okCount')">
            {{ lastPreview.summary.okCount }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('pages.adminCaseVisaSupplement.dupSkipped')">
            {{ lastPreview.summary.duplicateSkippedCount }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('pages.adminCaseVisaSupplement.errorCount')">
            {{ lastPreview.summary.errorCount }}
          </el-descriptions-item>
        </el-descriptions>

        <el-table :data="lastPreview.rows" stripe border class="admin-supp__table">
          <el-table-column prop="rowNumber" :label="t('pages.adminCaseVisaSupplement.colLine')" width="72" />
          <el-table-column prop="adminCaseId" :label="t('pages.adminCaseVisaSupplement.colAdminCaseId')" min-width="280" />
          <el-table-column prop="adminCaseName" :label="t('pages.adminCaseVisaSupplement.colCaseName')" min-width="140" />
          <el-table-column :label="t('pages.adminCaseVisaSupplement.colStatus')" width="120">
            <template #default="{ row }">
              <el-tag :type="statusTagType(row.status)" size="small">{{ row.status }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column :label="t('pages.adminCaseVisaSupplement.colWarnings')" min-width="160">
            <template #default="{ row }">
              <span v-for="w in row.warnings" :key="w.code" class="admin-supp__warn">{{ w.message }}</span>
            </template>
          </el-table-column>
          <el-table-column :label="t('pages.adminCaseVisaSupplement.colErrors')" min-width="160">
            <template #default="{ row }">
              <span v-for="e in row.errors" :key="e.code" class="admin-supp__err">{{ e.message }}</span>
            </template>
          </el-table-column>
        </el-table>
      </template>
      </div>
    </template>

    <el-dialog v-model="resultVisible" :title="t('pages.adminCaseVisaSupplement.resultTitle')" width="640px">
      <template v-if="commitResult">
        <el-descriptions :column="1" border>
          <el-descriptions-item :label="t('pages.adminCaseVisaSupplement.batchId')">
            {{ commitResult.supplementBatchId }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('pages.adminCaseVisaSupplement.createdCases')">
            {{ commitResult.summary.createdCaseCount }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('pages.adminCaseVisaSupplement.skippedDup')">
            {{ commitResult.summary.skippedDuplicateCount }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('pages.adminCaseVisaSupplement.failedRows')">
            {{ commitResult.summary.failedRowCount }}
          </el-descriptions-item>
        </el-descriptions>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.admin-supp__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.admin-supp__title {
  font-size: 18px;
  font-weight: 600;
}
.admin-supp__hint {
  color: var(--el-text-color-secondary);
  font-size: 13px;
  margin: 0 0 12px;
}
.admin-supp__actions {
  margin: 12px 0 20px;
  display: flex;
  gap: 8px;
}
.admin-supp__meta {
  margin-bottom: 16px;
}
.admin-supp__code {
  font-size: 12px;
  word-break: break-all;
}
.admin-supp__table {
  width: 100%;
}
.admin-supp__warn {
  color: var(--el-color-warning);
  display: block;
  font-size: 12px;
}
.admin-supp__err {
  color: var(--el-color-danger);
  display: block;
  font-size: 12px;
}
</style>
