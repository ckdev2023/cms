<script setup lang="ts">
import { Download, Refresh, Search, View } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { computed, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { exportAuditLogsCsv, getAuditLogs } from '@/api/log'
import PageList from '@/components/PageList.vue'
import ProTable from '@/components/ProTable.vue'
import { useProTable } from '@/composables/useProTable'
import {
  AuditActionTypeLabel,
  AuditTargetTypeLabel,
  OperationResultLabel,
} from '@/constants/enum-labels'
import { AuditActionType, AuditTargetType, OperationResult } from '@/constants/enums'
import type { ProTableColumn } from '@/types/components'
import type { AuditLogExportParams, AuditLogItem, AuditLogQueryParams } from '@/types/log'
import { useLocaleFormatter } from '@/utils/locale-format'

defineOptions({ name: 'AuditLogListView' })

const { t } = useI18n({ useScope: 'global' })
const { formatDateTime } = useLocaleFormatter()

const columns = computed<ProTableColumn[]>(() => [
  { prop: 'occurredAt', label: t('pages.auditLogs.occurredAt'), width: 170, slot: 'occurredAt', sortable: 'custom' },
  { prop: 'displayName', label: t('pages.auditLogs.operator'), width: 120 },
  { prop: 'actionType', label: t('pages.auditLogs.action'), width: 130, slot: 'actionType' },
  { prop: 'targetType', label: t('pages.auditLogs.target'), width: 120, slot: 'targetType' },
  { prop: 'targetId', label: t('pages.auditLogs.targetId'), width: 120, slot: 'targetId' },
  { prop: 'result', label: t('pages.auditLogs.result'), width: 80, slot: 'result', align: 'center' },
  { prop: 'ipAddress', label: t('pages.auditLogs.ipAddress'), width: 140 },
])

const searchForm = reactive<AuditLogQueryParams>({
  keyword: '',
  actionType: undefined,
  targetType: undefined,
  result: undefined,
  startDate: undefined,
  endDate: undefined,
})

const dateRange = ref<[string, string] | null>(null)

const {
  loading,
  data,
  total,
  page,
  pageSize,
  searchParams,
  handlePageChange,
  handleSizeChange,
  handleSearch,
  handleReset,
} = useProTable<AuditLogItem>(getAuditLogs)

const exportLoading = ref(false)

const detailVisible = ref(false)
const detailData = ref<AuditLogItem | null>(null)

function showDetail(row: AuditLogItem) {
  detailData.value = row
  detailVisible.value = true
}

/**
 * 从当前表单与时间范围组装审计日志列表筛选参数。
 *
 * @returns 可供列表检索与 CSV 导出复用的查询字段集合
 */
function buildAuditFilterParams(): Record<string, unknown> {
  const params: Record<string, unknown> = {}
  if (searchForm.keyword) {params.keyword = searchForm.keyword}
  if (searchForm.actionType) {params.actionType = searchForm.actionType}
  if (searchForm.targetType) {params.targetType = searchForm.targetType}
  if (searchForm.result) {params.result = searchForm.result}
  if (dateRange.value?.[0]) {params.startDate = dateRange.value[0]}
  if (dateRange.value?.[1]) {params.endDate = dateRange.value[1]}
  return params
}

/**
 * 汇总筛选表单与时间范围，触发审计日志检索。
 *
 * @returns 无返回值
 */
function doSearch() {
  handleSearch(buildAuditFilterParams())
}

/**
 * 按当前表单、时间范围与表格排序导出审计 CSV，并依赖后端写入导出日志。
 *
 * @returns 无返回值
 */
async function handleExportCsv() {
  exportLoading.value = true
  try {
    const extra = searchParams.value as Record<string, unknown>
    const payload: AuditLogExportParams = {
      ...buildAuditFilterParams(),
      limit: 2000,
    }
    if (typeof extra.sortBy === 'string') {payload.sortBy = extra.sortBy}
    if (extra.sortOrder === 'ASC' || extra.sortOrder === 'DESC') {
      payload.sortOrder = extra.sortOrder
    }
    await exportAuditLogsCsv(payload)
    ElMessage.success(t('pages.auditLogs.exportSuccess'))
  } catch {
    ElMessage.error(t('common.downloadFailed'))
  } finally {
    exportLoading.value = false
  }
}

/**
 * 清空当前审计日志筛选条件，并恢复默认列表状态。
 *
 * @returns 无返回值
 */
function doReset() {
  searchForm.keyword = ''
  searchForm.actionType = undefined
  searchForm.targetType = undefined
  searchForm.result = undefined
  dateRange.value = null
  handleReset()
}

/**
 * 根据表格排序事件同步审计日志列表的排序字段。
 *
 * @param sort - 当前表格返回的排序字段与方向
 * @param sort.prop - 后端排序使用的字段名
 * @param sort.order - Element Plus 返回的排序方向
 * @returns 无返回值
 */
function handleSortChange(sort: { prop: string; order: string }) {
  const params: Record<string, unknown> = { ...buildAuditFilterParams() }
  if (sort.prop && sort.order) {
    params.sortBy = sort.prop
    params.sortOrder = sort.order === 'ascending' ? 'ASC' : 'DESC'
  }
  handleSearch(params)
}

function shortId(id: string | null) {
  if (!id) {return '-'}
  return id.substring(0, 8) + '...'
}

function formatJson(value: Record<string, unknown> | null) {
  if (!value) {return '-'}
  return JSON.stringify(value, null, 2)
}

const resultTagType: Record<string, 'success' | 'danger'> = {
  [OperationResult.SUCCESS]: 'success',
  [OperationResult.FAILURE]: 'danger',
}

const actionTagType: Record<string, 'primary' | 'success' | 'warning' | 'danger' | 'info'> = {
  [AuditActionType.CREATE]: 'success',
  [AuditActionType.UPDATE]: 'primary',
  [AuditActionType.DELETE]: 'danger',
  [AuditActionType.RESTORE]: 'warning',
  [AuditActionType.STATUS_CHANGE]: 'info',
  [AuditActionType.VOID]: 'danger',
  [AuditActionType.UPLOAD]: 'success',
  [AuditActionType.DOWNLOAD]: 'info',
  [AuditActionType.PASSWORD_CHANGE]: 'warning',
  [AuditActionType.IMPORT]: 'info',
}
</script>

<template>
  <PageList :title="t('pages.auditLogs.title')">
    <template #headerExtra>
      <el-button
        type="primary"
        plain
        :icon="Download"
        :loading="exportLoading"
        @click="handleExportCsv"
      >
        {{ t('pages.auditLogs.exportCsv') }}
      </el-button>
    </template>
    <template #search>
      <el-form :model="searchForm" inline>
        <el-form-item :label="t('common.keyword')">
          <el-input
            v-model="searchForm.keyword"
            :placeholder="t('pages.auditLogs.keywordPlaceholder')"
            clearable
            style="width: 180px"
            @keyup.enter="doSearch"
          />
        </el-form-item>
        <el-form-item :label="t('pages.auditLogs.action')">
          <el-select
            v-model="searchForm.actionType"
            :placeholder="t('common.all')"
            clearable
            style="width: 140px"
          >
            <el-option
              v-for="(label, value) in AuditActionTypeLabel"
              :key="value"
              :label="label"
              :value="value"
            />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('pages.auditLogs.target')">
          <el-select
            v-model="searchForm.targetType"
            :placeholder="t('common.all')"
            clearable
            style="width: 140px"
          >
            <el-option
              v-for="(label, value) in AuditTargetTypeLabel"
              :key="value"
              :label="label"
              :value="value"
            />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('pages.auditLogs.result')">
          <el-select
            v-model="searchForm.result"
            :placeholder="t('common.all')"
            clearable
            style="width: 100px"
          >
            <el-option
              v-for="(label, value) in OperationResultLabel"
              :key="value"
              :label="label"
              :value="value"
            />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('pages.auditLogs.period')">
          <el-date-picker
            v-model="dateRange"
            type="datetimerange"
            range-separator="〜"
            :start-placeholder="t('pages.auditLogs.start')"
            :end-placeholder="t('pages.auditLogs.end')"
            value-format="YYYY-MM-DDTHH:mm:ss"
            style="width: 340px"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search" :loading="loading" @click="doSearch">{{ t('common.search') }}</el-button>
          <el-button :icon="Refresh" @click="doReset">{{ t('common.reset') }}</el-button>
          <el-button
            type="success"
            plain
            :icon="Download"
            :loading="exportLoading"
            @click="handleExportCsv"
          >
            {{ t('pages.auditLogs.exportCsv') }}
          </el-button>
        </el-form-item>
      </el-form>
    </template>

    <ProTable
      :columns="columns"
      :data="data"
      :loading="loading"
      :total="total"
      :page="page"
      :page-size="pageSize"
      :actions-width="80"
      @page-change="handlePageChange"
      @size-change="handleSizeChange"
      @sort-change="handleSortChange"
    >
      <template #occurredAt="{ row }">
        {{ formatDateTime((row as AuditLogItem).occurredAt) }}
      </template>

      <template #actionType="{ row }">
        <el-tag
          :type="actionTagType[(row as AuditLogItem).actionType] ?? 'info'"
          size="small"
        >
          {{ AuditActionTypeLabel[(row as AuditLogItem).actionType as AuditActionType] ?? (row as AuditLogItem).actionType }}
        </el-tag>
      </template>

      <template #targetType="{ row }">
        {{ AuditTargetTypeLabel[(row as AuditLogItem).targetType as AuditTargetType] ?? (row as AuditLogItem).targetType ?? '-' }}
      </template>

      <template #targetId="{ row }">
        <el-tooltip
          v-if="(row as AuditLogItem).targetId"
          :content="(row as AuditLogItem).targetId!"
          placement="top"
        >
          <span style="cursor: help">{{ shortId((row as AuditLogItem).targetId) }}</span>
        </el-tooltip>
        <span v-else>-</span>
      </template>

      <template #result="{ row }">
        <el-tag
          :type="(row as AuditLogItem).result != null ? (resultTagType[(row as AuditLogItem).result!] ?? undefined) : undefined"
          size="small"
        >
          {{ OperationResultLabel[(row as AuditLogItem).result as keyof typeof OperationResultLabel] ?? (row as AuditLogItem).result }}
        </el-tag>
      </template>

      <template #actions="{ row }">
        <el-button
          type="primary"
          link
          size="small"
          :icon="View"
          @click.stop="showDetail(row)"
        >
          {{ t('common.detail') }}
        </el-button>
      </template>
    </ProTable>

    <el-dialog
      v-model="detailVisible"
      :title="t('pages.auditLogs.detailTitle')"
      width="600px"
      destroy-on-close
    >
      <el-descriptions v-if="detailData" :column="2" border>
        <el-descriptions-item :label="t('pages.auditLogs.occurredAt')" :span="2">
          {{ formatDateTime(detailData.occurredAt) }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('pages.auditLogs.operator')">
          {{ detailData.displayName ?? detailData.username ?? '-' }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('pages.auditLogs.action')">
          {{ AuditActionTypeLabel[detailData.actionType as AuditActionType] ?? detailData.actionType }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('pages.auditLogs.targetModule')">
          {{ AuditTargetTypeLabel[detailData.targetType as AuditTargetType] ?? detailData.targetType ?? '-' }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('pages.auditLogs.targetId')">
          {{ detailData.targetId ?? '-' }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('pages.auditLogs.result')">
          <el-tag
            :type="detailData.result != null ? (resultTagType[detailData.result!] ?? undefined) : undefined"
            size="small"
          >
            {{ OperationResultLabel[detailData.result as keyof typeof OperationResultLabel] ?? detailData.result }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item :label="t('pages.auditLogs.ipAddress')">
          {{ detailData.ipAddress ?? '-' }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('pages.auditLogs.device')" :span="2">
          {{ detailData.deviceInfo ?? '-' }}
        </el-descriptions-item>
        <el-descriptions-item v-if="detailData.beforeValue" :label="t('pages.auditLogs.beforeValue')" :span="2">
          <pre class="log-json">{{ formatJson(detailData.beforeValue) }}</pre>
        </el-descriptions-item>
        <el-descriptions-item v-if="detailData.afterValue" :label="t('pages.auditLogs.afterValue')" :span="2">
          <pre class="log-json">{{ formatJson(detailData.afterValue) }}</pre>
        </el-descriptions-item>
      </el-descriptions>
    </el-dialog>
  </PageList>
</template>

