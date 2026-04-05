<script setup lang="ts">
import { Refresh, Search, View } from '@element-plus/icons-vue'
import { computed, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { getExportLogs } from '@/api/log'
import PageList from '@/components/PageList.vue'
import ProTable from '@/components/ProTable.vue'
import { useProTable } from '@/composables/useProTable'
import { ExportTypeLabel, OperationResultLabel } from '@/constants/enum-labels'
import { ExportType, OperationResult } from '@/constants/enums'
import type { ProTableColumn } from '@/types/components'
import type { ExportLogItem, ExportLogQueryParams } from '@/types/log'
import { useLocaleFormatter } from '@/utils/locale-format'

defineOptions({ name: 'ExportLogListView' })

const { t } = useI18n({ useScope: 'global' })
const { formatDateTime } = useLocaleFormatter()

const columns = computed<ProTableColumn[]>(() => [
  { prop: 'occurredAt', label: t('pages.exportLogs.occurredAt'), width: 170, slot: 'occurredAt', sortable: 'custom' },
  { prop: 'displayName', label: t('pages.exportLogs.operator'), width: 120 },
  { prop: 'exportType', label: t('pages.exportLogs.exportType'), width: 200, slot: 'exportType' },
  { prop: 'fileName', label: t('pages.exportLogs.fileName'), minWidth: 160 },
  { prop: 'status', label: t('pages.exportLogs.status'), width: 90, slot: 'status', align: 'center' },
])

const searchForm = reactive<ExportLogQueryParams>({
  keyword: '',
  exportType: undefined,
  status: undefined,
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
  handlePageChange,
  handleSizeChange,
  handleSearch,
  handleReset,
} = useProTable<ExportLogItem>(getExportLogs)

const detailVisible = ref(false)
const detailData = ref<ExportLogItem | null>(null)

/**
 * 打开单行导出日志详情对话框。
 *
 * @param row - 当前表格行对应的导出日志 DTO
 * @returns 无返回值
 */
function showDetail(row: ExportLogItem) {
  detailData.value = row
  detailVisible.value = true
}

/**
 * 汇总筛选表单与时间范围并触发导出日志检索。
 *
 * @returns 无返回值
 */
function doSearch() {
  const params: Record<string, unknown> = {}
  if (searchForm.keyword) {params.keyword = searchForm.keyword}
  if (searchForm.exportType) {params.exportType = searchForm.exportType}
  if (searchForm.status) {params.status = searchForm.status}
  if (dateRange.value?.[0]) {params.startDate = dateRange.value[0]}
  if (dateRange.value?.[1]) {params.endDate = dateRange.value[1]}
  handleSearch(params)
}

/**
 * 清空筛选条件并恢复默认列表。
 *
 * @returns 无返回值
 */
function doReset() {
  searchForm.keyword = ''
  searchForm.exportType = undefined
  searchForm.status = undefined
  dateRange.value = null
  handleReset()
}

/**
 * 根据表格排序事件同步导出日志列表的排序字段。
 *
 * @param sort - Element Plus 表格排序事件载荷
 * @param sort.prop - 后端排序字段名
 * @param sort.order - 升序或降序
 * @returns 无返回值
 */
function handleSortChange(sort: { prop: string; order: string }) {
  const params: Record<string, unknown> = {}
  if (sort.prop && sort.order) {
    params.sortBy = sort.prop
    params.sortOrder = sort.order === 'ascending' ? 'ASC' : 'DESC'
  }
  handleSearch({ ...searchForm, ...params })
}

/**
 * 将导出参数对象格式化为可读 JSON 文本。
 *
 * @param value - 导出参数 JSON 对象
 * @returns 缩进后的 JSON 字符串；空值时返回短横线
 */
function formatJson(value: Record<string, unknown> | null): string {
  if (value === null || value === undefined) {
    return '-'
  }
  return JSON.stringify(value, null, 2)
}

const resultTagType: Record<string, 'success' | 'danger'> = {
  [OperationResult.SUCCESS]: 'success',
  [OperationResult.FAILURE]: 'danger',
}
</script>

<template>
  <PageList :title="t('pages.exportLogs.title')">
    <template #search>
      <el-form :model="searchForm" inline>
        <el-form-item :label="t('common.keyword')">
          <el-input
            v-model="searchForm.keyword"
            :placeholder="t('pages.exportLogs.keywordPlaceholder')"
            clearable
            style="width: 180px"
            @keyup.enter="doSearch"
          />
        </el-form-item>
        <el-form-item :label="t('pages.exportLogs.exportType')">
          <el-select
            v-model="searchForm.exportType"
            :placeholder="t('common.all')"
            clearable
            style="width: 200px"
          >
            <el-option
              v-for="(label, value) in ExportTypeLabel"
              :key="value"
              :label="label"
              :value="value"
            />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('pages.exportLogs.status')">
          <el-select
            v-model="searchForm.status"
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
        <el-form-item :label="t('pages.exportLogs.period')">
          <el-date-picker
            v-model="dateRange"
            type="datetimerange"
            range-separator="〜"
            :start-placeholder="t('pages.exportLogs.start')"
            :end-placeholder="t('pages.exportLogs.end')"
            value-format="YYYY-MM-DDTHH:mm:ss"
            style="width: 340px"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search" :loading="loading" @click="doSearch">{{ t('common.search') }}</el-button>
          <el-button :icon="Refresh" @click="doReset">{{ t('common.reset') }}</el-button>
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
        {{ formatDateTime((row as ExportLogItem).occurredAt) }}
      </template>

      <template #exportType="{ row }">
        <el-tag type="info" size="small">
          {{ ExportTypeLabel[(row as ExportLogItem).exportType as ExportType] ?? (row as ExportLogItem).exportType }}
        </el-tag>
      </template>

      <template #status="{ row }">
        <el-tag
          :type="resultTagType[(row as ExportLogItem).status] ?? undefined"
          size="small"
        >
          {{ OperationResultLabel[(row as ExportLogItem).status as keyof typeof OperationResultLabel] ?? (row as ExportLogItem).status }}
        </el-tag>
      </template>

      <template #actions="{ row }">
        <el-button
          type="primary"
          link
          size="small"
          :icon="View"
          @click.stop="showDetail(row as ExportLogItem)"
        >
          {{ t('common.detail') }}
        </el-button>
      </template>
    </ProTable>

    <el-dialog
      v-model="detailVisible"
      :title="t('pages.exportLogs.detailTitle')"
      width="560px"
      destroy-on-close
    >
      <el-descriptions v-if="detailData" :column="1" border>
        <el-descriptions-item :label="t('pages.exportLogs.occurredAt')">
          {{ formatDateTime(detailData.occurredAt) }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('pages.exportLogs.operator')">
          {{ detailData.displayName ?? detailData.username ?? '-' }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('pages.exportLogs.exportType')">
          {{ ExportTypeLabel[detailData.exportType as ExportType] ?? detailData.exportType }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('pages.exportLogs.fileName')">
          {{ detailData.fileName ?? '-' }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('pages.exportLogs.status')">
          <el-tag
            :type="detailData.status != null ? (resultTagType[detailData.status] ?? undefined) : undefined"
            size="small"
          >
            {{ OperationResultLabel[detailData.status as keyof typeof OperationResultLabel] ?? detailData.status }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item :label="t('pages.exportLogs.exportParams')">
          <pre class="export-log-json">{{ formatJson(detailData.exportParams) }}</pre>
        </el-descriptions-item>
      </el-descriptions>
    </el-dialog>
  </PageList>
</template>

<style scoped>
.export-log-json {
  margin: 0;
  max-height: 240px;
  overflow: auto;
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
