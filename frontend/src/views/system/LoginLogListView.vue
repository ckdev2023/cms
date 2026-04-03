<script setup lang="ts">
import { Refresh, Search } from '@element-plus/icons-vue'
import { computed, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { getLoginLogs } from '@/api/log'
import PageList from '@/components/PageList.vue'
import ProTable from '@/components/ProTable.vue'
import { useProTable } from '@/composables/useProTable'
import { LoginTypeLabel, OperationResultLabel } from '@/constants/enum-labels'
import { LoginType, OperationResult } from '@/constants/enums'
import type { ProTableColumn } from '@/types/components'
import type { LoginLogItem, LoginLogQueryParams } from '@/types/log'
import { useLocaleFormatter } from '@/utils/locale-format'

defineOptions({ name: 'LoginLogListView' })

const { t } = useI18n({ useScope: 'global' })
const { formatDateTime } = useLocaleFormatter()

const columns = computed<ProTableColumn[]>(() => [
  { prop: 'occurredAt', label: t('pages.loginLogs.occurredAt'), width: 170, slot: 'occurredAt', sortable: 'custom' },
  { prop: 'displayName', label: t('pages.loginLogs.user'), width: 120, slot: 'user' },
  { prop: 'username', label: t('pages.loginLogs.username'), width: 120 },
  { prop: 'loginType', label: t('pages.loginLogs.type'), width: 120, slot: 'loginType', align: 'center' },
  { prop: 'result', label: t('pages.loginLogs.result'), width: 80, slot: 'result', align: 'center' },
  { prop: 'failureReason', label: t('pages.loginLogs.failureReason'), minWidth: 180 },
  { prop: 'ipAddress', label: t('pages.loginLogs.ipAddress'), width: 140 },
  { prop: 'deviceInfo', label: t('pages.loginLogs.device'), minWidth: 200 },
])

const searchForm = reactive<LoginLogQueryParams>({
  keyword: '',
  loginType: undefined,
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
  handlePageChange,
  handleSizeChange,
  handleSearch,
  handleReset,
} = useProTable<LoginLogItem>(getLoginLogs)

/**
 * 汇总筛选表单与时间范围，触发登录日志检索。
 *
 * @returns 无返回值
 */
function doSearch() {
  const params: Record<string, unknown> = {}
  if (searchForm.keyword) params.keyword = searchForm.keyword
  if (searchForm.loginType) params.loginType = searchForm.loginType
  if (searchForm.result) params.result = searchForm.result
  if (dateRange.value?.[0]) params.startDate = dateRange.value[0]
  if (dateRange.value?.[1]) params.endDate = dateRange.value[1]
  handleSearch(params)
}

/**
 * 清空当前登录日志筛选条件，并恢复默认列表状态。
 *
 * @returns 无返回值
 */
function doReset() {
  searchForm.keyword = ''
  searchForm.loginType = undefined
  searchForm.result = undefined
  dateRange.value = null
  handleReset()
}

/**
 * 根据表格排序事件同步登录日志列表的排序字段。
 *
 * @param sort - 当前表格返回的排序字段与方向
 * @param sort.prop - 后端排序使用的字段名
 * @param sort.order - Element Plus 返回的排序方向
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

const resultTagType: Record<string, 'success' | 'danger'> = {
  [OperationResult.SUCCESS]: 'success',
  [OperationResult.FAILURE]: 'danger',
}

const loginTypeTagType: Record<string, 'primary' | 'info'> = {
  [LoginType.LOGIN]: 'primary',
  [LoginType.LOGOUT]: 'info',
}
</script>

<template>
  <PageList :title="t('pages.loginLogs.title')">
    <template #search>
      <el-form :model="searchForm" inline>
        <el-form-item :label="t('common.keyword')">
          <el-input
            v-model="searchForm.keyword"
            :placeholder="t('pages.loginLogs.keywordPlaceholder')"
            clearable
            style="width: 180px"
            @keyup.enter="doSearch"
          />
        </el-form-item>
        <el-form-item :label="t('pages.loginLogs.type')">
          <el-select
            v-model="searchForm.loginType"
            :placeholder="t('common.all')"
            clearable
            style="width: 130px"
          >
            <el-option
              v-for="(label, value) in LoginTypeLabel"
              :key="value"
              :label="label"
              :value="value"
            />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('pages.loginLogs.result')">
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
        <el-form-item :label="t('pages.loginLogs.period')">
          <el-date-picker
            v-model="dateRange"
            type="datetimerange"
            range-separator="〜"
            :start-placeholder="t('pages.loginLogs.start')"
            :end-placeholder="t('pages.loginLogs.end')"
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
      @page-change="handlePageChange"
      @size-change="handleSizeChange"
      @sort-change="handleSortChange"
    >
      <template #occurredAt="{ row }">
        {{ formatDateTime((row as LoginLogItem).occurredAt) }}
      </template>

      <template #user="{ row }">
        {{ (row as LoginLogItem).displayName ?? '-' }}
      </template>

      <template #loginType="{ row }">
        <el-tag
          :type="loginTypeTagType[(row as LoginLogItem).loginType] ?? undefined"
          size="small"
        >
          {{ LoginTypeLabel[(row as LoginLogItem).loginType as LoginType] ?? (row as LoginLogItem).loginType }}
        </el-tag>
      </template>

      <template #result="{ row }">
        <el-tag
          :type="resultTagType[(row as LoginLogItem).result] ?? undefined"
          size="small"
        >
          {{ OperationResultLabel[(row as LoginLogItem).result as keyof typeof OperationResultLabel] ?? (row as LoginLogItem).result }}
        </el-tag>
      </template>
    </ProTable>
  </PageList>
</template>
