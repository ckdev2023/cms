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

    <ul v-else-if="items.length > 0" class="accompanying-deps__list">
      <li v-for="item in items" :key="item.id" class="accompanying-deps__list-item">
        <router-link
          :to="dependentDetailTo(item.id)"
          class="accompanying-deps__card"
          :aria-label="`${item.customerName} — ${t('common.detail')}`"
        >
          <el-avatar :size="40" class="accompanying-deps__avatar" shape="circle">
            {{ item.customerName?.trim().charAt(0) || '?' }}
          </el-avatar>
          <div class="accompanying-deps__card-main">
            <div class="accompanying-deps__card-row">
              <span class="accompanying-deps__name">{{ item.customerName }}</span>
              <template v-if="item.personInfo?.familyRelation">
                <el-tag size="small" type="info">
                  {{ FamilyRelationLabel[item.personInfo.familyRelation as FamilyRelation] }}
                </el-tag>
              </template>
              <span v-else class="accompanying-deps__dash">-</span>
            </div>
            <div class="accompanying-deps__card-meta">
              <span class="accompanying-deps__meta-item">
                <span class="accompanying-deps__meta-label">{{
                  t('detailViews.customer.basicFields.customerCode')
                }}</span>
                <span class="accompanying-deps__meta-value">{{ item.customerCode }}</span>
              </span>
              <span class="accompanying-deps__meta-item">
                <span class="accompanying-deps__meta-label">{{
                  t('detailViews.customer.basicFields.phone')
                }}</span>
                <span class="accompanying-deps__meta-value">
                  <template v-if="item.phone?.trim()">{{ item.phone }}</template>
                  <span v-else class="accompanying-deps__dash">-</span>
                </span>
              </span>
            </div>
          </div>
          <span class="accompanying-deps__detail-pill">{{ t('common.detail') }}</span>
        </router-link>
      </li>
    </ul>
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

  &__list {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: var(--app-spacing-sm);
  }

  &__list-item {
    margin: 0;
    padding: 0;
  }

  &__card {
    display: flex;
    align-items: center;
    gap: var(--app-spacing-md);
    padding: var(--app-spacing-sm) var(--app-spacing-md);
    border-radius: var(--customer-detail-radius-card, var(--el-border-radius-base));
    border: var(
      --customer-detail-border-surface,
      1px solid var(--el-border-color-extra-light)
    );
    box-shadow: var(--customer-detail-shadow-card, var(--el-box-shadow-light));
    background: var(--el-bg-color);
    text-decoration: none;
    color: inherit;
    transition:
      border-color 0.15s ease,
      box-shadow 0.15s ease;

    &:hover {
      border-color: var(--el-color-primary-light-5);
      box-shadow: var(--el-box-shadow);
    }

    &:focus-visible {
      outline: 2px solid var(--el-color-primary);
      outline-offset: 2px;
    }
  }

  &__avatar {
    flex-shrink: 0;
  }

  &__card-main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  &__card-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--app-spacing-sm);
    min-width: 0;
  }

  &__name {
    font-size: var(--el-font-size-base);
    font-weight: var(--app-font-weight-medium, 500);
    color: var(--app-text-primary);
    word-break: break-word;
  }

  &__card-meta {
    display: flex;
    flex-wrap: wrap;
    gap: var(--app-spacing-md);
    font-size: var(--el-font-size-small);
  }

  &__meta-item {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 6px;
    min-width: 0;
    color: var(--el-text-color-regular);
  }

  &__meta-label {
    color: var(--el-text-color-secondary);
    white-space: nowrap;
  }

  &__meta-value {
    color: var(--app-text-primary);
    word-break: break-word;
  }

  &__detail-pill {
    flex-shrink: 0;
    font-size: var(--el-font-size-small);
    font-weight: var(--app-font-weight-medium, 500);
    color: var(--el-color-primary);
    white-space: nowrap;
  }

  &__dash {
    color: var(--el-text-color-placeholder);
  }
}
</style>
