<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { getVisaCases } from '@/api/visa-case'
import {
  VisaCaseMemberRoleLabel,
  VisaCaseStatusLabel,
} from '@/constants/enum-labels'
import {
  FamilyLinkMode,
  type VisaCaseMemberRole,
  VisaCaseStatus,
} from '@/constants/enums'
import type { VisaCaseItem } from '@/types/visa-case'
import { formatVisaCaseTypeDisplay } from '@/utils/visa-case-type-display'

const props = defineProps<{
  customerId: string
}>()

defineOptions({ name: 'CustomerFamilyMembersBlock' })

const { t } = useI18n({ useScope: 'global' })
const T = (key: string, params?: Record<string, unknown>) =>
  t(`detailViews.customer.familyMembersBlock.${key}`, params ?? {})

const loading = ref(false)
const familyCases = ref<VisaCaseItem[]>([])

const statusTagType: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'primary'> = {
  [VisaCaseStatus.DRAFT]: 'info',
  [VisaCaseStatus.IN_PROGRESS]: 'primary',
  [VisaCaseStatus.SUBMITTED]: 'primary',
  [VisaCaseStatus.SUPPLEMENT]: 'warning',
  [VisaCaseStatus.APPROVED]: 'success',
  [VisaCaseStatus.REJECTED]: 'danger',
  [VisaCaseStatus.COMPLETED]: 'success',
  [VisaCaseStatus.CANCELLED]: 'info',
}

watch(
  () => props.customerId,
  () => {
    if (props.customerId) {fetchData()}
  },
  { immediate: true },
)

/**
 * 加载当前客户所有家庭签证案件并筛选出含家属成员的案件。
 *
 * @throws {Error} 案件列表接口请求失败时由请求层继续抛出
 */
async function fetchData(): Promise<void> {
  loading.value = true
  try {
    const res = await getVisaCases(props.customerId, { page: 1, pageSize: 100 })
    familyCases.value = res.data.items.filter(
      (c) => c.isFamilyCase && c.familyMembers && c.familyMembers.length > 0,
    )
  } finally {
    loading.value = false
  }
}

/**
 * 获取家庭签证案件的主申请人展示文本：优先外部快照，其次内部关联名称，最后从成员中查找。
 *
 * @param vc - 签证案件数据
 * @returns 主申请人展示文本
 */
function getPrimaryLabel(vc: VisaCaseItem): string {
  if (vc.familyLinkMode === FamilyLinkMode.EXTERNAL && vc.externalPrimaryName) {
    return `${vc.externalPrimaryName} (${T('external')})`
  }
  if (vc.familyLinkMode === FamilyLinkMode.INTERNAL && vc.internalPrimaryCustomerName) {
    return vc.internalPrimaryCustomerName
  }
  const primary = vc.familyMembers.find((m) => m.isPrimary)
  return primary?.displayNameSnapshot ?? '-'
}
</script>

<template>
  <div v-loading="loading" class="family-block">
    <el-empty v-if="!loading && familyCases.length === 0" :description="T('empty')" />

    <div v-for="vc in familyCases" :key="vc.id" class="family-block__case-group">
      <div class="family-block__case-header">
        <span class="family-block__case-type">
          {{ formatVisaCaseTypeDisplay(vc.caseType) || `#${vc.id.slice(0, 8)}` }}
        </span>
        <el-tag size="small" :type="statusTagType[vc.caseStatus] ?? 'info'">
          {{ VisaCaseStatusLabel[vc.caseStatus] ?? vc.caseStatus }}
        </el-tag>
        <span class="family-block__primary-info">
          {{ T('primaryApplicant') }}: {{ getPrimaryLabel(vc) }}
        </span>
      </div>

      <el-table :data="vc.familyMembers" size="small" stripe>
        <el-table-column :label="T('memberName')" prop="displayNameSnapshot" min-width="150" />
        <el-table-column :label="T('role')" width="120">
          <template #default="{ row }">
            {{ VisaCaseMemberRoleLabel[row.memberRole as VisaCaseMemberRole] ?? row.memberRole }}
          </template>
        </el-table-column>
        <el-table-column :label="T('isPrimary')" width="110" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.isPrimary" size="small" type="warning">{{ T('primaryTag') }}</el-tag>
            <span v-else class="text-placeholder">-</span>
          </template>
        </el-table-column>
        <el-table-column :label="T('linkedCustomer')" min-width="120">
          <template #default="{ row }">
            <span v-if="row.customerName">{{ row.customerName }}</span>
            <span v-else class="text-placeholder">-</span>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<style scoped lang="scss">
.family-block {
  &__case-group {
    margin-bottom: 20px;

    &:last-child {
      margin-bottom: 0;
    }
  }

  &__case-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
    padding: 8px 12px;
    background: var(--el-fill-color-lighter);
    border-radius: 4px;
  }

  &__case-type {
    font-weight: 500;
    color: var(--app-text-primary);
  }

  &__primary-info {
    margin-left: auto;
    font-size: var(--app-font-size-sm);
    color: var(--app-text-secondary);
  }
}

.text-placeholder {
  color: var(--el-text-color-placeholder);
}
</style>
