<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import {
  buildVisibleCustomerCenterSidebarGroups,
  customerCenterKeepAliveViewNames,
  customerCenterTabDefs,
  filterVisibleCustomerCenterTabs,
} from '@/layouts/customer-center-tabs.config'
import { useUserStore } from '@/stores/user'
import {
  resolveDefaultCustomerCenterHubEntryFullPath,
  shouldSkipDefaultCustomerCenterWorkbenchRedirect,
} from '@/utils/customer-center-root-redirect'

defineOptions({ name: 'CustomerCenterLayout' })

/** 内层 KeepAlive 白名单（模板中展开为可变数组） */
const customerCenterKeepAliveIncludes = [...customerCenterKeepAliveViewNames]

const route = useRoute()
const router = useRouter()
const { t } = useI18n({ useScope: 'global' })
const userStore = useUserStore()

const visibleTabs = computed(() =>
  filterVisibleCustomerCenterTabs(customerCenterTabDefs, (perms) => {
    if (!perms?.length) {
      return true
    }
    return perms.some((p) => userStore.hasPermission(p))
  }),
)

/** 左侧分组导航数据（剔除仅顶栏可见项如「全表」签证提醒） */
const sidebarGroups = computed(() => buildVisibleCustomerCenterSidebarGroups(visibleTabs.value))

/** 多入口时展示左侧分组侧栏 */
const showSidebar = computed(() => visibleTabs.value.length > 1)

const activePath = computed(() => route.path)

/**
 * 记录上一次客户中心相关的 `route.path`，用于区分侧栏进入 `/customers`（默认进工作台）与从子路径切回客户列表。
 */
const previousCustomerCenterRoutePath = ref<string | null>(null)

/**
 * 客户中心根路径 `/customers` 的统一入口策略（单 `watch`，避免双跳）：
 *
 * 1. 从侧栏或外链进入 `/customers` 时，`replace` 到与侧栏首项一致的默认 path（`resolveDefaultCustomerCenterHubEntryFullPath`，保留 `query`）。
 * 2. 从 `/customers/...` 子路径切回 `/customers`，或已停留在 `/customers` 时，不 replace，避免与侧栏选中冲突。
 */
watch(
  () => [route.path, visibleTabs.value] as const,
  ([path, tabs]) => {
    if (path !== '/customers' || tabs.length === 0) {
      previousCustomerCenterRoutePath.value = path
      return
    }

    if (shouldSkipDefaultCustomerCenterWorkbenchRedirect(previousCustomerCenterRoutePath.value)) {
      previousCustomerCenterRoutePath.value = path
      return
    }

    const defaultEntry = resolveDefaultCustomerCenterHubEntryFullPath(tabs)
    if (defaultEntry && defaultEntry !== path) {
      void router.replace({ path: defaultEntry, query: { ...route.query } })
    }

    previousCustomerCenterRoutePath.value = path
  },
  { immediate: true },
)
</script>

<template>
  <div
    class="customer-center-layout"
    :class="{ 'customer-center-layout--with-sidebar': showSidebar }"
  >
    <nav
      v-if="showSidebar"
      class="customer-center-layout__sidebar"
      :aria-label="t('layout.customerCenterSidebarNavAria')"
    >
      <el-menu
        :default-active="activePath"
        class="customer-center-layout__menu"
        router
        :ellipsis="false"
      >
        <template
          v-for="group in sidebarGroups"
          :key="group.group"
        >
          <el-menu-item-group :title="t(group.titleKey)">
            <el-menu-item
              v-for="tab in group.items"
              :key="tab.fullPath"
              :index="tab.fullPath"
            >
              <el-tooltip
                :disabled="!tab.menuTooltipKey"
                :content="tab.menuTooltipKey ? t(tab.menuTooltipKey) : ''"
                placement="right"
                :show-after="400"
              >
                <span class="customer-center-layout__menu-item-label">
                  {{ t(tab.titleKey) }}
                </span>
              </el-tooltip>
            </el-menu-item>
          </el-menu-item-group>
        </template>
      </el-menu>
    </nav>

    <div class="customer-center-layout__main">
      <router-view v-slot="{ Component: RoutedView }">
        <keep-alive :include="customerCenterKeepAliveIncludes">
          <component :is="RoutedView" />
        </keep-alive>
      </router-view>
    </div>
  </div>
</template>

<style scoped lang="scss">
.customer-center-layout {
  display: flex;
  flex-direction: column;
  gap: var(--app-spacing-md);
  min-height: 100%;
}

.customer-center-layout--with-sidebar {
  flex-direction: row;
  align-items: stretch;
  gap: 0;
}

/**
 * 左侧分组导航：固定宽度，与主内容区底对齐的浅色卡片。
 */
.customer-center-layout__sidebar {
  flex-shrink: 0;
  width: 220px;
  box-sizing: border-box;
  padding: 8px 0 12px;
  border-radius: 12px;
  margin-right: var(--app-spacing-md);
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
}

.customer-center-layout__menu {
  border-right: none;
  background: transparent;

  :deep(.el-menu-item-group__title) {
    padding-left: 16px;
    padding-right: 12px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--el-text-color-secondary);
    line-height: 1.4;
  }

  :deep(.el-menu-item) {
    height: auto;
    min-height: 40px;
    line-height: 1.35;
    padding: 8px 12px 8px 16px !important;
    margin: 2px 8px;
    border-radius: 10px;
    white-space: normal;

    &.is-active {
      color: var(--el-text-color-primary);
      background-color: var(--el-fill-color-light);
      font-weight: 600;
    }

    &:hover:not(.is-active) {
      background-color: var(--el-fill-color-lighter);
    }
  }

  :deep(.el-menu-item .el-tooltip__trigger) {
    display: block;
    width: 100%;
  }
}

.customer-center-layout__main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  min-height: 100%;
}

.customer-center-layout__menu-item-label {
  display: block;
  text-align: left;
  font-size: 13px;
  font-weight: 500;
}
</style>
