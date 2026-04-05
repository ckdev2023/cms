<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { CustomerItem } from '@/types/customer'
import {
  type ListPrimaryCaseFallbackBadgeAnchor,
  listPrimaryCaseFallbackBadgeAnchor,
} from '@/utils/customer-list-view-cells'

const props = defineProps<{
  row: CustomerItem
  anchor: ListPrimaryCaseFallbackBadgeAnchor
}>()

const { t } = useI18n({ useScope: 'global' })

const visible = computed(
  (): boolean => listPrimaryCaseFallbackBadgeAnchor(props.row) === props.anchor,
)
</script>

<template>
  <el-tooltip
    v-if="visible"
    :content="t('pages.customers.listPrimaryCasePrimaryCustomerFallbackTooltip')"
    placement="top"
  >
    <el-tag size="small" type="info" class="customer-list-primary-case-fallback-badge">
      {{ t('pages.customers.listPrimaryCasePrimaryCustomerFallbackTag') }}
    </el-tag>
  </el-tooltip>
</template>

<style scoped lang="scss">
.customer-list-primary-case-fallback-badge {
  flex-shrink: 0;
  max-width: 100%;
}
</style>
