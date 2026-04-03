<script setup lang="ts">
import { Refresh } from '@element-plus/icons-vue'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import { getResidenceExpiryReminders } from '@/api/customer'
import PageList from '@/components/PageList.vue'
import ProTable from '@/components/ProTable.vue'
import { useProTable } from '@/composables/useProTable'
import { FamilyRelationLabel, VisaAlertLevelLabel } from '@/constants/enum-labels'
import { FamilyRelation, VisaAlertLevel } from '@/constants/enums'
import { useAppStore } from '@/stores/app'
import type { ProTableColumn } from '@/types/components'
import type { ResidenceExpiryReminderItem } from '@/types/customer'

defineOptions({ name: 'ResidenceReminderListView' })

const router = useRouter()
const appStore = useAppStore()
const { t } = useI18n({ useScope: 'global' })

const visaAlertElTagType: Partial<Record<VisaAlertLevel, 'danger' | 'warning'>> = {
  [VisaAlertLevel.EXPIRED]: 'danger',
  [VisaAlertLevel.URGENT]: 'danger',
  [VisaAlertLevel.HIGH]: 'warning',
}

const columns = computed<ProTableColumn[]>(() => [
  { prop: 'customerName', label: t('pages.residenceReminders.customerName'), minWidth: 160 },
  {
    prop: 'familyRelation',
    label: t('pages.residenceReminders.familyRelation'),
    width: 120,
    slot: 'familyRelation',
    align: 'center',
  },
  {
    prop: 'visaExpireDate',
    label: t('pages.residenceReminders.visaExpireDate'),
    width: 130,
    slot: 'visaExpireDate',
  },
  { prop: 'daysLeft', label: t('pages.residenceReminders.daysLeft'), width: 100, align: 'center' },
  {
    prop: 'alertLevel',
    label: t('pages.residenceReminders.alertLevel'),
    width: 150,
    slot: 'alertLevel',
    align: 'center',
  },
])

const { loading, data, total, page, pageSize, fetchData, handlePageChange, handleSizeChange } =
  useProTable<ResidenceExpiryReminderItem>(getResidenceExpiryReminders)

/**
 * 将 ProTable 行数据断言为在留提醒项，供模板槽内安全读取字段类型。
 *
 * @param row - 表格行对象
 * @returns 带类型的提醒记录
 */
function asReminderRow(row: unknown): ResidenceExpiryReminderItem {
  return row as ResidenceExpiryReminderItem
}

/**
 * 重新拉取当前分页的在留提醒列表（忽略点击事件参数）。
 */
function reloadReminders(): void {
  void fetchData()
}

/**
 * 将 ISO 日期字符串格式化为当前应用语言环境下的短日期展示。
 *
 * @param dateStr - 签证到期日等日期字段
 * @returns 本地化日期文本，空字符串时返回占位符
 */
function formatDate(dateStr: string): string {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString(appStore.locale === 'zh-CN' ? 'zh-CN' : 'ja-JP')
}

/**
 * 跳转至提醒行对应客户的档案详情页。
 *
 * @param row - 单条在留提醒记录
 */
function goDetail(row: ResidenceExpiryReminderItem): void {
  router.push(`/customers/${row.customerId}`)
}
</script>

<template>
  <PageList :title="t('pages.residenceReminders.title')">
    <template #headerExtra>
      <el-button :icon="Refresh" :loading="loading" @click="reloadReminders">
        {{ t('pages.residenceReminders.reload') }}
      </el-button>
    </template>

    <el-alert
      type="info"
      :closable="false"
      show-icon
      class="residence-reminders__scope-hint"
    >
      {{ t('pages.residenceReminders.scopeHint') }}
    </el-alert>

    <ProTable
      row-key="customerId"
      :columns="columns"
      :data="data"
      :loading="loading"
      :total="total"
      :page="page"
      :page-size="pageSize"
      :actions-width="100"
      :empty-text="t('pages.residenceReminders.noData')"
      @page-change="handlePageChange"
      @size-change="handleSizeChange"
    >
      <template #familyRelation="{ row }">
        <span v-if="asReminderRow(row).familyRelation === null || asReminderRow(row).familyRelation === undefined">-</span>
        <el-tag v-else size="small" type="info">
          {{
            FamilyRelationLabel[asReminderRow(row).familyRelation as FamilyRelation] ??
            asReminderRow(row).familyRelation
          }}
        </el-tag>
      </template>

      <template #visaExpireDate="{ row }">
        {{ formatDate(asReminderRow(row).visaExpireDate) }}
      </template>

      <template #alertLevel="{ row }">
        <el-tag
          v-if="asReminderRow(row).alertLevel === VisaAlertLevel.NORMAL"
          size="small"
          class="visa-alert-tag visa-alert-tag--normal"
        >
          {{ VisaAlertLevelLabel[asReminderRow(row).alertLevel] }}
        </el-tag>
        <el-tag
          v-else
          size="small"
          :type="visaAlertElTagType[asReminderRow(row).alertLevel] ?? 'info'"
        >
          {{ VisaAlertLevelLabel[asReminderRow(row).alertLevel] }}
        </el-tag>
      </template>

      <template #actions="{ row }">
        <el-button type="primary" link size="small" @click="goDetail(asReminderRow(row))">
          {{ t('common.detail') }}
        </el-button>
      </template>
    </ProTable>
  </PageList>
</template>

<style scoped lang="scss">
.residence-reminders__scope-hint {
  margin-bottom: var(--app-spacing-md);
}

.visa-alert-tag--normal {
  --el-tag-bg-color: #fef9c3;
  --el-tag-border-color: #fde047;
  --el-tag-text-color: #854d0e;
}
</style>
