<script setup lang="ts">
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import { getVisaReminders } from '@/api/visa-case'
import ProTable from '@/components/ProTable.vue'
import { useProTable } from '@/composables/useProTable'
import { VisaCaseStatusLabel, VisaReminderTypeLabel } from '@/constants/enum-labels'
import { VisaCaseStatus, VisaDataScope, VisaReminderType } from '@/constants/enums'
import { P } from '@/constants/permissions'
import { useAppStore } from '@/stores/app'
import type { ProTableColumn } from '@/types/components'
import type { VisaReminderItem, VisaReminderQueryParams } from '@/types/visa-case'
import { mergeCustomerDetailReturnQuery } from '@/utils/customer-detail-return-navigation'
import { formatVisaCaseTypeDisplay } from '@/utils/visa-case-type-display'
import { VISA_REMINDER_TYPE_EL_TAG_TYPE } from '@/utils/visa-reminder-type-ui'

const props = defineProps<{
  /** 与 `GET /visa-reminders` 的 dataScope 一致 */
  dataScope: VisaDataScope
  /** 提醒桶筛选；空串表示不按桶过滤 */
  reminderType: VisaReminderType | ''
  /** 负责人用户 UUID；与 query `assignedTo` 对齐，缺省不按负责人筛选 */
  assignedTo?: string
  /**
   * 附加列表查询参数；在 `dataScope` / `reminderType` / `assignedTo` 之后浅合并，同名键以后者 props 为准。
   * 用于扩展筛选而不增加 props 数量。
   */
  extraSearchParams?: Partial<Pick<VisaReminderQueryParams, 'assignedTo' | 'reminderType' | 'dataScope'>>
}>()

defineOptions({ name: 'VisaReminderProTablePanel' })

const router = useRouter()
const route = useRoute()
const appStore = useAppStore()
const { t } = useI18n({ useScope: 'global' })

const reminderTypeTagMap = VISA_REMINDER_TYPE_EL_TAG_TYPE

const caseStatusTagMap: Partial<Record<VisaCaseStatus, 'success' | 'warning' | 'danger' | 'info'>> = {
  [VisaCaseStatus.DRAFT]: 'info',
  [VisaCaseStatus.SUPPLEMENT]: 'warning',
  [VisaCaseStatus.APPROVED]: 'success',
  [VisaCaseStatus.REJECTED]: 'danger',
}

const columns = computed<ProTableColumn[]>(() => [
  {
    prop: 'customerName',
    label: t('pages.visaReminders.customerName'),
    minWidth: 140,
  },
  {
    prop: 'caseType',
    label: t('pages.visaReminders.caseType'),
    minWidth: 140,
    slot: 'caseType',
    showOverflowTooltip: true,
  },
  {
    prop: 'reminderType',
    label: t('pages.visaReminders.reminderType'),
    width: 160,
    slot: 'reminderType',
    align: 'center',
  },
  {
    prop: 'caseStatus',
    label: t('pages.visaReminders.caseStatus'),
    width: 120,
    slot: 'caseStatus',
    align: 'center',
  },
  {
    prop: 'expireDate',
    label: t('pages.visaReminders.expireDate'),
    width: 130,
    slot: 'expireDate',
  },
  {
    prop: 'daysLeft',
    label: t('pages.visaReminders.daysLeft'),
    width: 100,
    slot: 'daysLeft',
    align: 'center',
  },
  {
    prop: 'assigneeName',
    label: t('pages.visaReminders.assignee'),
    width: 120,
    slot: 'assigneeName',
  },
])

const {
  loading,
  data,
  total,
  page,
  pageSize,
  searchParams,
  fetchData,
  handlePageChange,
  handleSizeChange,
} = useProTable<VisaReminderItem, VisaReminderQueryParams>(getVisaReminders, {
  immediate: false,
})

watch(
  () => ({
    bucket: props.reminderType,
    scope: props.dataScope,
    assignee: props.assignedTo,
    extra: props.extraSearchParams,
  }),
  ({ bucket, scope, assignee, extra }) => {
    page.value = 1
    searchParams.value = {
      ...extra,
      dataScope: scope,
      ...(bucket ? { reminderType: bucket } : {}),
      ...(assignee ? { assignedTo: assignee } : {}),
    }
    void fetchData()
  },
  { immediate: true },
)

/**
 * 将 ProTable 行数据断言为签证提醒项，供模板槽内安全读取字段。
 *
 * @param row - 表格行对象
 * @returns 带类型的提醒记录
 */
function asRow(row: unknown): VisaReminderItem {
  return row as VisaReminderItem
}

/**
 * 将 ISO 日期字符串格式化为当前语言环境下的短日期展示。
 *
 * @param dateStr - 日期字段值
 * @returns 本地化日期文本
 */
function formatDate(dateStr: string | null): string {
  if (!dateStr) {
    return '-'
  }
  return new Date(dateStr).toLocaleDateString(appStore.locale === 'zh-CN' ? 'zh-CN' : 'ja-JP')
}

/**
 * 跳转至提醒行对应客户的档案详情页。
 *
 * @param row - 单条签证提醒记录
 */
function goDetail(row: VisaReminderItem): void {
  const query: Record<string, string> = {}
  mergeCustomerDetailReturnQuery(query, route)
  void router.push(
    Object.keys(query).length > 0
      ? { path: `/customers/${row.customerId}`, query }
      : `/customers/${row.customerId}`,
  )
}

defineExpose({
  reload: fetchData,
  loading,
})
</script>

<template>
  <div class="visa-reminder-pro-table-panel">
    <ProTable
      row-key="id"
      :columns="columns"
      :data="data"
      :loading="loading"
      :total="total"
      :page="page"
      :page-size="pageSize"
      :actions-width="100"
      :empty-text="t('pages.visaReminders.noData')"
      @page-change="handlePageChange"
      @size-change="handleSizeChange"
    >
    <template #caseType="{ row }">
      {{ formatVisaCaseTypeDisplay(asRow(row).caseType) || '—' }}
    </template>

    <template #reminderType="{ row }">
      <el-tag size="small" :type="reminderTypeTagMap[asRow(row).reminderType]">
        {{ VisaReminderTypeLabel[asRow(row).reminderType] }}
      </el-tag>
    </template>

    <template #caseStatus="{ row }">
      <el-tag size="small" :type="caseStatusTagMap[asRow(row).caseStatus] ?? 'info'">
        {{ VisaCaseStatusLabel[asRow(row).caseStatus] }}
      </el-tag>
    </template>

    <template #expireDate="{ row }">
      {{ formatDate(asRow(row).expireDate) }}
    </template>

    <template #daysLeft="{ row }">
      <template v-if="asRow(row).daysLeft != null">
        <span
          :class="{
            'visa-reminder-pro-table-panel__days--expired': asRow(row).daysLeft! < 0,
            'visa-reminder-pro-table-panel__days--urgent':
              asRow(row).daysLeft! >= 0 && asRow(row).daysLeft! <= 7,
          }"
        >
          {{
            asRow(row).daysLeft! < 0
              ? `${t('pages.visaReminders.expired')} (${Math.abs(asRow(row).daysLeft!)})`
              : asRow(row).daysLeft
          }}
        </span>
      </template>
      <span v-else>-</span>
    </template>

    <template #assigneeName="{ row }">
      {{ asRow(row).assigneeName ?? t('common.unassigned') }}
    </template>

    <template #actions="{ row }">
      <span v-permission="P.CUSTOMER_DETAIL">
        <el-button type="primary" link size="small" @click="goDetail(asRow(row))">
          {{ t('common.detail') }}
        </el-button>
      </span>
    </template>
    </ProTable>
  </div>
</template>

<style scoped lang="scss">
/**
 * 在工作台 flex 列内占满剩余高度；`v-loading` 与 `el-empty` 仍挂在内部 `ProTable` / `el-table` 上。
 */
.visa-reminder-pro-table-panel {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;

  :deep(.pro-table) {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  :deep(.pro-table__table-wrap) {
    flex: 1;
    min-height: 0;
  }

  :deep(.visa-reminder-pro-table-panel__days--expired) {
    color: var(--el-color-danger);
    font-weight: 600;
  }

  :deep(.visa-reminder-pro-table-panel__days--urgent) {
    color: var(--el-color-warning);
    font-weight: 600;
  }
}
</style>
