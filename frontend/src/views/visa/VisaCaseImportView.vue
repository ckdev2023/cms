<script setup lang="ts">
import { Download, RefreshRight, UploadFilled } from '@element-plus/icons-vue'
import type { UploadFile } from 'element-plus'
import { ElMessage } from 'element-plus'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { commitVisaCaseImport, previewVisaCaseImport } from '@/api/visa-case'
import { P } from '@/constants/permissions'
import { useUserStore } from '@/stores/user'
import type {
  VisaCaseImportCommitResult,
  VisaCaseImportPreviewResult,
  VisaCaseImportPreviewRow,
} from '@/types/visa-case'
import { buildVisaCaseImportSubset } from '@/utils/visa-case-import-csv'

defineOptions({ name: 'VisaCaseImportView' })

const { t } = useI18n({ useScope: 'global' })
const userStore = useUserStore()

const MAX_BYTES = 5 * 1024 * 1024
const IMPORT_OUTCOME_OK = new Set([
  'CASE_CREATED',
  'MEMBER_ADDED',
  'FILE_PATH_CREATED',
  'CASE_LOG_CREATED',
  'SKIPPED_DUPLICATE',
])

const canImport = computed(() => userStore.hasPermission(P.VISA_CASE_IMPORT))

const rawCsvText = ref<string | null>(null)
const sourceFileName = ref('')
const lastPreview = ref<VisaCaseImportPreviewResult | null>(null)
const selectedMap = ref<Record<number, boolean>>({})
const previewLoading = ref(false)
const commitLoading = ref(false)
const page = ref(1)
const pageSize = ref(25)

const resultDialogVisible = ref(false)
const commitResult = ref<VisaCaseImportCommitResult | null>(null)
/** 与最近一次提交子集结果行顺序对应的原始 CSV 物理行号 */
const lastBatchOriginalLines = ref<number[]>([])

/** 子集二次预览通过后、待用户确认写入的批次上下文 */
const pendingSubsetCommit = ref<{
  file: File
  originalLineNumbers: number[]
  preview: VisaCaseImportPreviewResult
} | null>(null)
const subsetConfirmVisible = ref(false)

const pagedRows = computed(() => {
  const rows = lastPreview.value?.rows ?? []
  const start = (page.value - 1) * pageSize.value
  return rows.slice(start, start + pageSize.value)
})

const selectedCount = computed(() =>
  Object.values(selectedMap.value).filter(Boolean).length,
)

/** 最近一次提交结果中 outcome 属于成功/跳过类的行数，用于结果摘要 */
const commitSuccessRowCount = computed(() => {
  const r = commitResult.value
  if (!r?.rows.length) {return 0}
  return r.rows.filter((row) => IMPORT_OUTCOME_OK.has(row.outcome)).length
})

/**
 * 将预览行状态映射为 Element Plus 标签类型，便于表格中快速识别。
 *
 * @param status - 后端返回的行状态枚举值
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
 * 将提交结果 outcome 映射为表格标签类型，便于区分成功、失败与跳过。
 *
 * @param outcome - 后端返回的单行提交结果枚举
 * @returns 标签配色类型
 */
function commitOutcomeTagType(
  outcome: string,
): 'success' | 'warning' | 'danger' | 'info' {
  if (IMPORT_OUTCOME_OK.has(outcome)) {return 'success'}
  if (outcome === 'FAILED') {return 'danger'}
  return 'info'
}

/**
 * 根据行状态初始化默认可提交行的勾选（错误行默认不选）。
 *
 * @param preview - 全量预览响应
 */
function initSelectionFromPreview(preview: VisaCaseImportPreviewResult): void {
  const m: Record<number, boolean> = {}
  for (const r of preview.rows) {
    m[r.rowNumber] = r.status !== 'ERROR'
  }
  selectedMap.value = m
}

/**
 * 将上传文件交给预览接口，并在成功后刷新勾选状态。
 *
 * @param file - 原始 CSV 文件对象
 */
async function runFullPreview(file: File): Promise<void> {
  previewLoading.value = true
  try {
    const { data } = await previewVisaCaseImport(file)
    lastPreview.value = data
    page.value = 1
    initSelectionFromPreview(data)
  } finally {
    previewLoading.value = false
  }
}

/**
 * 处理 el-upload 选择的 CSV：校验大小后读取文本并触发全量预览。
 *
 * @param uploadFile - Element Plus 包装的上传项
 */
function handleFilePick(uploadFile: UploadFile): void {
  const file = uploadFile.raw
  if (!file) {return}
  if (!canImport.value) {
    ElMessage.warning(t('pages.visaCaseImport.noPermission'))
    return
  }
  if (file.size > MAX_BYTES) {
    ElMessage.error(t('pages.visaCaseImport.fileTooLarge'))
    return
  }
  const reader = new FileReader()
  reader.onload = () => {
    rawCsvText.value = String(reader.result ?? '')
    sourceFileName.value = file.name
    void runFullPreview(file)
  }
  reader.readAsText(file, 'UTF-8')
}

/**
 * 勾选所有非错误行，便于整批提交。
 */
function selectAllCommittable(): void {
  const p = lastPreview.value
  if (!p) {return}
  const next = { ...selectedMap.value }
  for (const r of p.rows) {
    if (r.status !== 'ERROR') {
      next[r.rowNumber] = true
    }
  }
  selectedMap.value = next
}

/**
 * 取消所有行的勾选。
 */
function clearAllSelection(): void {
  const next = { ...selectedMap.value }
  for (const k of Object.keys(next)) {
    next[Number(k)] = false
  }
  selectedMap.value = next
}

/**
 * 切换单行勾选状态（错误行不可选）。
 *
 * @param rowNumber - 物理行号
 * @param checked - 是否选中
 */
function toggleRow(rowNumber: number, checked: boolean): void {
  const row = lastPreview.value?.rows.find((r) => r.rowNumber === rowNumber)
  if (row?.status === 'ERROR') {return}
  selectedMap.value = { ...selectedMap.value, [rowNumber]: checked }
}

/**
 * 将勾选集合交给子集构建器并封装为 UTF-8 文本文件。
 *
 * @returns 子集文本与原始行号序；无有效行时返回 null
 */
function buildSubsetFile():
  | { file: File; originalLineNumbers: number[] }
  | null {
  const text = rawCsvText.value
  if (!text) {return null}
  const selected = new Set<number>()
  for (const [k, v] of Object.entries(selectedMap.value)) {
    if (v) {selected.add(Number(k))}
  }
  const built = buildVisaCaseImportSubset(text, selected)
  if (!built) {return null}
  const name = sourceFileName.value
    ? `subset-${sourceFileName.value.replace(/\.csv$/i, '')}.csv`
    : 'visa-case-import-subset.csv'
  const file = new File([built.csvText], name, { type: 'text/csv;charset=utf-8' })
  return { file, originalLineNumbers: built.originalDataLineNumbers }
}

/**
 * 对当前勾选行生成子集并跑子集预览；通过后打开分批确认对话框（含摘要与 SHA），不写库。
 */
async function submitSelectedBatch(): Promise<void> {
  if (!canImport.value) {
    ElMessage.warning(t('pages.visaCaseImport.noPermission'))
    return
  }
  const subset = buildSubsetFile()
  if (!subset) {
    ElMessage.warning(t('pages.visaCaseImport.selectAtLeastOne'))
    return
  }

  previewLoading.value = true
  try {
    const { data: subsetPreview } = await previewVisaCaseImport(subset.file)
    if (!subsetPreview.summary.canProceed) {
      ElMessage.error(t('pages.visaCaseImport.subsetPreviewBlocked'))
      return
    }
    pendingSubsetCommit.value = {
      file: subset.file,
      originalLineNumbers: subset.originalLineNumbers,
      preview: subsetPreview,
    }
    subsetConfirmVisible.value = true
  } catch {
    /* 预览失败：全局拦截器已提示 */
  } finally {
    previewLoading.value = false
  }
}

/**
 * 关闭子集确认对话框（动画结束后由 `onSubsetDialogClosed` 清空 pending）。
 */
function cancelSubsetConfirm(): void {
  subsetConfirmVisible.value = false
}

/**
 * 子集对话框完全关闭后丢弃待提交文件引用，避免断点续作流程外泄漏大对象。
 */
function onSubsetDialogClosed(): void {
  pendingSubsetCommit.value = null
}

/**
 * 在用户确认子集摘要后调用 commit，与预览使用同一文件对象。
 */
async function executeSubsetCommit(): Promise<void> {
  const pending = pendingSubsetCommit.value
  if (!pending || !canImport.value) {return}
  commitLoading.value = true
  try {
    const { data } = await commitVisaCaseImport(pending.file)
    subsetConfirmVisible.value = false
    pendingSubsetCommit.value = null
    commitResult.value = data
    lastBatchOriginalLines.value = pending.originalLineNumbers
    resultDialogVisible.value = true
    ElMessage.success(t('pages.visaCaseImport.commitSuccess'))
  } catch {
    /* 全局拦截器已提示；保留 pending 以便用户修正后重试 */
  } finally {
    commitLoading.value = false
  }
}

/**
 * 将取込结果序列化为 JSON 并触发浏览器下载，便于与审计批次对账。
 *
 * @param payload - 后端返回的批次结果对象
 */
function downloadResultJson(payload: VisaCaseImportCommitResult): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `visa-import-${payload.importBatchId}.json`
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * 根据提交结果取消已成功处理行的勾选，便于同一原文件继续下一批。
 */
function uncheckCommittedRows(): void {
  const res = commitResult.value
  const orig = lastBatchOriginalLines.value
  if (!res || orig.length === 0) {return}
  const next = { ...selectedMap.value }
  res.rows.forEach((row, i) => {
    if (IMPORT_OUTCOME_OK.has(row.outcome)) {
      const line = orig[i]
      if (line !== undefined) {
        next[line] = false
      }
    }
  })
  selectedMap.value = next
  resultDialogVisible.value = false
  ElMessage.success(t('pages.visaCaseImport.selectionAdjusted'))
}

/**
 * 清空本地状态并允许重新选择文件。
 */
function resetWorkspace(): void {
  rawCsvText.value = null
  sourceFileName.value = ''
  lastPreview.value = null
  selectedMap.value = {}
  commitResult.value = null
  lastBatchOriginalLines.value = []
  resultDialogVisible.value = false
  subsetConfirmVisible.value = false
  pendingSubsetCommit.value = null
  page.value = 1
}

/**
 * 拼接行级错误文案供表格单元格展示。
 *
 * @param row - 预览行
 * @returns 简短错误文本
 */
function formatErrors(row: VisaCaseImportPreviewRow): string {
  if (!row.errors.length) {return '—'}
  return row.errors.map((e) => e.message || e.code).join('；')
}

/**
 * 拼接行级警告文案供表格单元格展示。
 *
 * @param row - 预览行
 * @returns 简短警告文本
 */
function formatWarnings(row: VisaCaseImportPreviewRow): string {
  if (!row.warnings.length) {return '—'}
  return row.warnings.map((w) => w.message || w.code).join('；')
}
</script>

<template>
  <div class="visa-import page-pad">
    <el-alert
      v-if="!canImport"
      type="warning"
      show-icon
      :closable="false"
      class="visa-import__alert"
      :title="t('pages.visaCaseImport.noPermission')"
    />

    <el-card shadow="never" class="visa-import__card">
      <template #header>
        <div class="visa-import__header">
          <span class="visa-import__title">{{ t('pages.visaCaseImport.title') }}</span>
          <div class="visa-import__actions">
            <span v-permission="P.VISA_CASE_IMPORT">
            <el-button
              v-if="lastPreview"
              v-permission="P.VISA_CASE_IMPORT"
              :disabled="!canImport"
              @click="resetWorkspace"
            >
                <el-icon class="el-icon--left">
                  <RefreshRight />
                </el-icon>
                {{ t('pages.visaCaseImport.reset') }}
              </el-button>
            </span>
          </div>
        </div>
      </template>

      <div v-permission="P.VISA_CASE_IMPORT">
      <p class="visa-import__hint">
        {{ t('pages.visaCaseImport.scopeHint') }}
      </p>

      <el-upload
        class="visa-import__upload"
        drag
        :auto-upload="false"
        :show-file-list="false"
        accept=".csv,text/csv"
        :disabled="!canImport || previewLoading"
        :on-change="handleFilePick"
      >
        <el-icon class="visa-import__upload-icon">
          <UploadFilled />
        </el-icon>
        <div class="el-upload__text">
          {{ t('pages.visaCaseImport.dropHint') }}
        </div>
        <template #tip>
          <p class="visa-import__tip">
            {{ t('pages.visaCaseImport.uploadTip') }}
          </p>
        </template>
      </el-upload>

      <el-alert
        v-for="(err, idx) in lastPreview?.blockingFileErrors ?? []"
        :key="'b-' + idx"
        type="error"
        show-icon
        :closable="false"
        class="visa-import__blocking"
        :title="err.message || err.code"
      />

      <template v-if="lastPreview && lastPreview.rows.length">
        <div class="visa-import__summary">
          <el-descriptions :column="3" border size="small">
            <el-descriptions-item :label="t('pages.visaCaseImport.sha256')">
              <span class="visa-import__mono">{{ lastPreview.contentSha256 }}</span>
            </el-descriptions-item>
            <el-descriptions-item :label="t('pages.visaCaseImport.rowCount')">
              {{ lastPreview.summary.rowCount }}
            </el-descriptions-item>
            <el-descriptions-item :label="t('pages.visaCaseImport.canProceed')">
              <el-tag :type="lastPreview.summary.canProceed ? 'success' : 'danger'" size="small">
                {{ lastPreview.summary.canProceed ? t('pages.visaCaseImport.yes') : t('pages.visaCaseImport.no') }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item :label="t('pages.visaCaseImport.okRows')">
              {{ lastPreview.summary.okRowCount }}
            </el-descriptions-item>
            <el-descriptions-item :label="t('pages.visaCaseImport.errorRows')">
              {{ lastPreview.summary.errorRowCount }}
            </el-descriptions-item>
            <el-descriptions-item :label="t('pages.visaCaseImport.warnRows')">
              {{ lastPreview.summary.warningRowCount }}
            </el-descriptions-item>
            <el-descriptions-item :label="t('pages.visaCaseImport.dupSkipped')">
              {{ lastPreview.summary.duplicateSkippedRowCount }}
            </el-descriptions-item>
            <el-descriptions-item :label="t('pages.visaCaseImport.selectedRows')">
              {{ selectedCount }}
            </el-descriptions-item>
          </el-descriptions>
        </div>

        <div class="visa-import__toolbar">
          <el-button
            v-permission="P.VISA_CASE_IMPORT"
            size="small"
            :disabled="!canImport"
            @click="selectAllCommittable"
          >
            {{ t('pages.visaCaseImport.selectAllValid') }}
          </el-button>
          <el-button
            v-permission="P.VISA_CASE_IMPORT"
            size="small"
            :disabled="!canImport"
            @click="clearAllSelection"
          >
            {{ t('pages.visaCaseImport.clearSelection') }}
          </el-button>
          <el-button
            v-permission="P.VISA_CASE_IMPORT"
            type="primary"
            size="small"
            :loading="commitLoading || previewLoading"
            :disabled="!canImport || selectedCount === 0 || subsetConfirmVisible"
            @click="submitSelectedBatch"
          >
            {{ t('pages.visaCaseImport.commitSelected') }}
          </el-button>
        </div>

        <el-alert
          type="info"
          show-icon
          :closable="false"
          class="visa-import__resume-hint"
          :title="t('pages.visaCaseImport.batchResumeHint')"
        />

        <el-table
          v-loading="previewLoading"
          :data="pagedRows"
          border
          stripe
          size="small"
          class="visa-import__table"
          row-key="rowNumber"
        >
          <el-table-column width="52" align="center" fixed>
            <template #default="{ row }">
              <el-checkbox
                :model-value="!!selectedMap[row.rowNumber]"
                :disabled="row.status === 'ERROR' || !canImport"
                @update:model-value="(v) => toggleRow(row.rowNumber, v === true)"
              />
            </template>
          </el-table-column>
          <el-table-column
            prop="rowNumber"
            :label="t('pages.visaCaseImport.colLine')"
            width="72"
            align="center"
          />
          <el-table-column
            prop="recordType"
            :label="t('pages.visaCaseImport.colRecordType')"
            width="130"
          />
          <el-table-column
            prop="status"
            :label="t('pages.visaCaseImport.colStatus')"
            width="120"
            align="center"
          >
            <template #default="{ row }">
              <el-tag size="small" :type="statusTagType(row.status)">
                {{ row.status }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column
            :label="t('pages.visaCaseImport.colErrors')"
            min-width="160"
            show-overflow-tooltip
          >
            <template #default="{ row }">
              {{ formatErrors(row) }}
            </template>
          </el-table-column>
          <el-table-column
            :label="t('pages.visaCaseImport.colWarnings')"
            min-width="140"
            show-overflow-tooltip
          >
            <template #default="{ row }">
              {{ formatWarnings(row) }}
            </template>
          </el-table-column>
          <el-table-column type="expand">
            <template #default="{ row }">
              <pre v-if="row.resolved" class="visa-import__json">{{ JSON.stringify(row.resolved, null, 2) }}</pre>
              <span v-else class="visa-import__empty-resolved">—</span>
            </template>
          </el-table-column>
        </el-table>

        <div class="visa-import__pager">
          <el-pagination
            v-model:current-page="page"
            v-model:page-size="pageSize"
            layout="total, sizes, prev, pager, next"
            :total="lastPreview.rows.length"
            :page-sizes="[10, 25, 50, 100]"
            background
          />
        </div>
      </template>
      </div>
    </el-card>

    <el-dialog
      v-model="subsetConfirmVisible"
      :title="t('pages.visaCaseImport.subsetConfirmTitle')"
      width="640px"
      destroy-on-close
      @closed="onSubsetDialogClosed"
    >
      <template v-if="pendingSubsetCommit">
        <el-alert
          type="warning"
          show-icon
          :closable="false"
          class="visa-import__subset-intro"
          :title="t('pages.visaCaseImport.subsetConfirmIntro')"
        />
        <p class="visa-import__subset-confirm-text">
          {{ t('pages.visaCaseImport.confirmCommit', { count: pendingSubsetCommit.preview.summary.rowCount }) }}
        </p>
        <el-descriptions :column="2" border size="small" class="visa-import__subset-desc">
          <el-descriptions-item :label="t('pages.visaCaseImport.subsetSha256')">
            <span class="visa-import__mono">{{ pendingSubsetCommit.preview.contentSha256 }}</span>
          </el-descriptions-item>
          <el-descriptions-item :label="t('pages.visaCaseImport.rowCount')">
            {{ pendingSubsetCommit.preview.summary.rowCount }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('pages.visaCaseImport.okRows')">
            {{ pendingSubsetCommit.preview.summary.okRowCount }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('pages.visaCaseImport.errorRows')">
            {{ pendingSubsetCommit.preview.summary.errorRowCount }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('pages.visaCaseImport.warnRows')">
            {{ pendingSubsetCommit.preview.summary.warningRowCount }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('pages.visaCaseImport.dupSkipped')">
            {{ pendingSubsetCommit.preview.summary.duplicateSkippedRowCount }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('pages.visaCaseImport.canProceed')">
            <el-tag
              :type="pendingSubsetCommit.preview.summary.canProceed ? 'success' : 'danger'"
              size="small"
            >
              {{
                pendingSubsetCommit.preview.summary.canProceed
                  ? t('pages.visaCaseImport.yes')
                  : t('pages.visaCaseImport.no')
              }}
            </el-tag>
          </el-descriptions-item>
        </el-descriptions>
      </template>
      <template #footer>
        <el-button :disabled="commitLoading" @click="cancelSubsetConfirm">
          {{ t('confirm.cancel') }}
        </el-button>
        <el-button
          type="primary"
          :loading="commitLoading"
          :disabled="!pendingSubsetCommit"
          @click="executeSubsetCommit"
        >
          {{ t('pages.visaCaseImport.confirmWriteBatch') }}
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="resultDialogVisible"
      :title="t('pages.visaCaseImport.resultTitle')"
      width="720px"
      destroy-on-close
    >
      <template v-if="commitResult">
        <el-alert
          :type="commitResult.summary.failedRowCount > 0 ? 'warning' : 'success'"
          show-icon
          :closable="false"
          class="visa-import__result-alert"
          :title="
            commitResult.summary.failedRowCount > 0
              ? t('pages.visaCaseImport.resultSummaryPartial')
              : t('pages.visaCaseImport.resultSummaryAllOk')
          "
        />

        <el-descriptions :column="2" border size="small" class="visa-import__result-desc">
          <el-descriptions-item :label="t('pages.visaCaseImport.batchId')">
            <span class="visa-import__mono">{{ commitResult.importBatchId }}</span>
          </el-descriptions-item>
          <el-descriptions-item :label="t('pages.visaCaseImport.sha256')">
            <span class="visa-import__mono">{{ commitResult.contentSha256 }}</span>
          </el-descriptions-item>
          <el-descriptions-item :label="t('pages.visaCaseImport.successRowsInBatch')">
            {{ commitSuccessRowCount }} / {{ commitResult.summary.rowCount }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('pages.visaCaseImport.failedRows')">
            {{ commitResult.summary.failedRowCount }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('pages.visaCaseImport.createdCases')">
            {{ commitResult.summary.createdCaseCount }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('pages.visaCaseImport.skippedDup')">
            {{ commitResult.summary.skippedDuplicateCaseCount }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('pages.visaCaseImport.addedMembers')">
            {{ commitResult.summary.addedMemberCount }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('pages.visaCaseImport.createdPaths')">
            {{ commitResult.summary.createdFilePathCount }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('pages.visaCaseImport.createdLogs')">
            {{ commitResult.summary.createdLogCount }}
          </el-descriptions-item>
        </el-descriptions>

        <el-table
          :data="commitResult.rows"
          border
          stripe
          size="small"
          max-height="280"
          class="visa-import__result-table"
        >
          <el-table-column prop="rowNumber" :label="t('pages.visaCaseImport.colLine')" width="72" />
          <el-table-column prop="recordType" :label="t('pages.visaCaseImport.colRecordType')" width="120" />
          <el-table-column :label="t('pages.visaCaseImport.colOutcome')" width="168">
            <template #default="{ row }">
              <el-tag size="small" :type="commitOutcomeTagType(row.outcome)">
                {{ row.outcome }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column
            prop="message"
            :label="t('pages.visaCaseImport.colMessage')"
            min-width="140"
            show-overflow-tooltip
          />
        </el-table>

        <p
          v-if="commitSuccessRowCount > 0"
          class="visa-import__result-resume-footnote"
        >
          {{ t('pages.visaCaseImport.resultFooterResume') }}
        </p>
      </template>

      <template #footer>
        <el-button @click="resultDialogVisible = false">
          {{ t('confirm.cancel') }}
        </el-button>
        <el-button
          v-if="commitResult"
          type="primary"
          plain
          @click="downloadResultJson(commitResult)"
        >
          <el-icon class="el-icon--left">
            <Download />
          </el-icon>
          {{ t('pages.visaCaseImport.downloadJson') }}
        </el-button>
        <el-button type="primary" @click="uncheckCommittedRows">
          {{ t('pages.visaCaseImport.uncheckCommitted') }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.visa-import {
  &__alert {
    margin-bottom: 16px;
  }

  &__card {
    border-radius: var(--app-radius-md, 8px);
  }

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  &__title {
    font-weight: var(--app-font-weight-medium, 600);
    font-size: var(--app-font-size-md, 15px);
  }

  &__hint {
    color: var(--app-text-secondary, #606266);
    font-size: 13px;
    line-height: 1.6;
    margin: 0 0 16px;
  }

  &__upload {
    width: 100%;
    max-width: 520px;
    margin-bottom: 8px;

    :deep(.el-upload-dragger) {
      padding: 28px 16px;
    }
  }

  &__upload-icon {
    font-size: 42px;
    color: var(--el-color-primary);
    margin-bottom: 8px;
  }

  &__tip {
    font-size: 12px;
    color: var(--app-text-placeholder);
    margin: 8px 0 0;
  }

  &__blocking {
    margin-bottom: 10px;
  }

  &__summary {
    margin: 16px 0;
  }

  &__mono {
    font-family: ui-monospace, monospace;
    font-size: 12px;
    word-break: break-all;
  }

  &__toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 12px;
  }

  &__resume-hint {
    margin-bottom: 12px;
  }

  &__subset-intro {
    margin-bottom: 12px;
  }

  &__subset-confirm-text {
    margin: 0 0 12px;
    font-size: 13px;
    line-height: 1.6;
    color: var(--app-text-regular, #303133);
  }

  &__subset-desc {
    margin-bottom: 0;
  }

  &__result-alert {
    margin-bottom: 12px;
  }

  &__result-resume-footnote {
    margin: 12px 0 0;
    font-size: 12px;
    line-height: 1.5;
    color: var(--app-text-secondary, #606266);
  }

  &__table {
    width: 100%;
  }

  &__pager {
    display: flex;
    justify-content: flex-end;
    margin-top: 12px;
  }

  &__json {
    margin: 0;
    padding: 8px 12px;
    background: var(--el-fill-color-light);
    border-radius: 4px;
    font-size: 11px;
    max-height: 220px;
    overflow: auto;
  }

  &__empty-resolved {
    color: var(--app-text-placeholder);
    padding: 8px 12px;
    display: inline-block;
  }

  &__result-desc {
    margin-bottom: 12px;
  }

  &__result-table {
    width: 100%;
  }
}

.page-pad {
  padding: 16px;
}
</style>
