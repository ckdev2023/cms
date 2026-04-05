<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'

import { getCustomers } from '@/api/customer'
import { FamilyRelationLabel } from '@/constants/enum-labels'
import type { FamilyRelation } from '@/constants/enums'
import { P } from '@/constants/permissions'
import { useUserStore } from '@/stores/user'
import type { CustomerItem } from '@/types/customer'
import { mergeCustomerDetailReturnQuery } from '@/utils/customer-detail-return-navigation'

const props = defineProps<{
  /** 当前详情页客户 ID（作为 `person_info.primary_customer_id` 的查询主键） */
  primaryCustomerId: string
}>()

defineOptions({ name: 'CustomerAccompanyingDependentsBlock' })

const route = useRoute()
const { t } = useI18n({ useScope: 'global' })
const userStore = useUserStore()
const T = (key: string) => t(`detailViews.customer.${key}`)

const canList = computed((): boolean => userStore.hasPermission(P.CUSTOMER_LIST))
const loading = ref(false)
const items = ref<CustomerItem[]>([])

/**
 * 拉取挂在当前主档下的随附家属子客户列表（与编辑抽屉同源 `GET /customers?primaryCustomerId=`）。
 */
async function fetchDependents(): Promise<void> {
  if (!canList.value || !props.primaryCustomerId) {
    items.value = []
    return
  }
  loading.value = true
  try {
    const res = await getCustomers({
      primaryCustomerId: props.primaryCustomerId,
      page: 1,
      pageSize: 100,
    })
    items.value = res.data.items
  } catch {
    items.value = []
    ElMessage.warning(t('dialogs.customerForm.accompanyingFamilyLoadFailed'))
  } finally {
    loading.value = false
  }
}

watch(
  () => [props.primaryCustomerId, canList.value] as const,
  () => {
    void fetchDependents()
  },
  { immediate: true },
)

/**
 * 组装随附家属「详情」链路的 query，并把 `ccFrom` 设为当前主档详情路径。
 *
 * @param customerId - 子客户主键
 * @returns 供 `router-link` 绑定的目标
 */
function dependentDetailTo(
  customerId: string,
): string | { path: string; query: Record<string, string> } {
  const query: Record<string, string> = {}
  mergeCustomerDetailReturnQuery(query, route, { overrideFullPath: `/customers/${props.primaryCustomerId}` })
  return Object.keys(query).length > 0 ? { path: `/customers/${customerId}`, query } : `/customers/${customerId}`
}
</script>

<template>
  <div v-if="canList" v-loading="loading" class="accompanying-deps">
    <h4 class="accompanying-deps__title">
      {{ t('dialogs.customerForm.accompanyingFamilyTitle') }}
    </h4>
    <el-text class="accompanying-deps__hint" size="small" type="info">
      {{ T('accompanyingDependentsHint') }}
    </el-text>

    <el-empty
      v-if="!loading && items.length === 0"
      :description="T('accompanyingDependentsEmpty')"
    />

    <el-table v-else-if="items.length > 0" :data="items" border size="small" class="accompanying-deps__table">
      <el-table-column :label="t('detailViews.customer.basicFields.customerCode')" prop="customerCode" width="120" />
      <el-table-column :label="t('detailViews.customer.basicFields.customerName')" prop="customerName" min-width="140" />
      <el-table-column :label="t('detailViews.customer.basicFields.familyRelation')" width="140">
        <template #default="{ row }">
          <template v-if="row.personInfo?.familyRelation">
            <el-tag size="small" type="info">
              {{ FamilyRelationLabel[row.personInfo.familyRelation as FamilyRelation] }}
            </el-tag>
          </template>
          <span v-else class="accompanying-deps__dash">-</span>
        </template>
      </el-table-column>
      <el-table-column :label="t('detailViews.customer.basicFields.phone')" prop="phone" min-width="130" />
      <el-table-column :label="t('common.actions')" width="100" align="center">
        <template #default="{ row }">
          <router-link :to="dependentDetailTo(row.id)" class="accompanying-deps__link">
            {{ t('common.detail') }}
          </router-link>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<style scoped lang="scss">
.accompanying-deps {
  margin-top: 20px;

  &__title {
    margin: 0 0 8px;
    font-size: var(--el-font-size-base);
    font-weight: 600;
    color: var(--app-text-primary);
  }

  &__hint {
    display: block;
    margin-bottom: 12px;
    line-height: 1.5;
  }

  &__table {
    width: 100%;
  }

  &__dash {
    color: var(--el-text-color-placeholder);
  }

  &__link {
    color: var(--el-color-primary);
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }
}
</style>
