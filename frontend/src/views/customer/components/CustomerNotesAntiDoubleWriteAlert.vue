<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import { P } from '@/constants/permissions'
import { useUserStore } from '@/stores/user'
import { visaUiVisaPrimaryEntriesVisible } from '@/utils/visa-ui-feature-flags'

defineOptions({ name: 'CustomerNotesAntiDoubleWriteAlert' })

const { t } = useI18n({ useScope: 'global' })
const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

/**
 * 与 `CustomerDetailView` 的签证域 Tab 可见性一致，用于「前往案件日志」深链。
 *
 * @returns 当前用户是否应看到签证域入口相关能力
 */
const showVisaDomainShortcut = computed((): boolean =>
  visaUiVisaPrimaryEntriesVisible() &&
  (userStore.hasPermission(P.VISA_CASE_LIST) ||
    userStore.hasPermission(P.VISA_CASE_DETAIL) ||
    userStore.hasPermission(P.VISA_REMINDER_LIST) ||
    userStore.hasPermission(P.CUSTOMER_FILE_PATH_LIST)),
)

/**
 * 将当前客户详情路由切换到签证域并展开案件日志子区块。
 */
function goToVisaCaseLogs(): void {
  void router.push({
    path: route.path,
    query: {
      ...route.query,
      tab: 'visa-domain',
      visaDomainBlock: 'logs',
    },
  })
}
</script>

<template>
  <el-alert
    type="info"
    :closable="false"
    show-icon
    class="customer-notes-anti-double-write-alert"
  >
    <template #title>{{ t('detailViews.customer.notesTab.antiDoubleWriteTitle') }}</template>
    <p class="customer-notes-anti-double-write-alert__text">
      {{ t("detailViews.customer.notesTab.antiDoubleWriteLine1") }}
    </p>
    <p class="customer-notes-anti-double-write-alert__text">
      {{ t("detailViews.customer.notesTab.antiDoubleWriteLine2") }}
    </p>
    <el-button
      v-if="showVisaDomainShortcut"
      type="primary"
      link
      class="customer-notes-anti-double-write-alert__link"
      @click="goToVisaCaseLogs"
    >
      {{ t('detailViews.customer.notesTab.goToCaseLogs') }}
    </el-button>
  </el-alert>
</template>

<style scoped lang="scss">
.customer-notes-anti-double-write-alert {
  margin-bottom: 16px;

  &__text {
    margin: 0 0 8px;
    font-size: var(--app-font-size-sm);
    line-height: 1.55;
    color: var(--app-text-regular);
  }

  &__link {
    padding: 0;
    height: auto;
  }
}
</style>
