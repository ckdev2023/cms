<script setup lang="ts">
import {
  Document,
  Expand,
  Fold,
  Folder,
  Money,
  Monitor,
  Setting,
  SwitchButton,
  Tickets,
  User,
  UserFilled,
} from '@element-plus/icons-vue'
import { type Component,computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import Breadcrumb from '@/components/Breadcrumb.vue'
import TagsView from '@/components/TagsView.vue'
import { useIdleTimeout } from '@/composables/useIdleTimeout'
import { P } from '@/constants/permissions'
import type { AppLocale } from '@/i18n'
import { useAppStore } from '@/stores/app'
import { useTagsViewStore } from '@/stores/tagsView'
import { useUserStore } from '@/stores/user'

interface MenuChild {
  path: string
  titleKey: string
  permissions?: string[]
}

interface MenuItem {
  path: string
  titleKey: string
  icon: Component
  permissions?: string[]
  children?: MenuChild[]
}

interface LocalizedMenuChild extends MenuChild {
  title: string
}

interface LocalizedMenuItem extends MenuItem {
  title: string
  children?: LocalizedMenuChild[]
}

const appStore = useAppStore()
const userStore = useUserStore()
const tagsViewStore = useTagsViewStore()
const router = useRouter()
const { t } = useI18n({ useScope: 'global' })

useIdleTimeout()

const allMenuItems: Readonly<MenuItem[]> = [
  { path: '/dashboard', titleKey: 'routes.dashboard', icon: Monitor, permissions: [P.DASHBOARD_VIEW] },
  { path: '/customers', titleKey: 'routes.customers', icon: User, permissions: [P.CUSTOMER_LIST] },
  { path: '/admin-cases', titleKey: 'routes.adminCases', icon: Document, permissions: [P.ADMIN_CASE_LIST] },
  { path: '/tax-contracts', titleKey: 'routes.taxContracts', icon: Tickets, permissions: [P.TAX_LIST] },
  {
    path: '/finance',
    titleKey: 'routes.finance',
    icon: Money,
    permissions: [P.FINANCE_LIST],
    children: [
      { path: '/finance/invoices', titleKey: 'routes.invoices', permissions: [P.FINANCE_LIST] },
      { path: '/finance/payments', titleKey: 'routes.payments', permissions: [P.FINANCE_LIST] },
      { path: '/finance/deposits', titleKey: 'routes.deposits', permissions: [P.FINANCE_LIST] },
    ],
  },
  { path: '/files', titleKey: 'routes.files', icon: Folder, permissions: [P.FILE_LIST] },
  {
    path: '/system',
    titleKey: 'routes.system',
    icon: Setting,
    permissions: [P.SYSTEM_USER_MANAGE, P.SYSTEM_ROLE_MANAGE, P.SYSTEM_DICT_MANAGE, P.LOG_LIST],
    children: [
      { path: '/system/users', titleKey: 'routes.systemUsers', permissions: [P.SYSTEM_USER_MANAGE] },
      { path: '/system/roles', titleKey: 'routes.systemRoles', permissions: [P.SYSTEM_ROLE_MANAGE] },
      { path: '/system/dictionaries', titleKey: 'routes.systemDictionaries', permissions: [P.SYSTEM_DICT_MANAGE] },
      { path: '/system/audit-logs', titleKey: 'routes.auditLogs', permissions: [P.LOG_LIST] },
      { path: '/system/login-logs', titleKey: 'routes.loginLogs', permissions: [P.LOG_LIST] },
    ],
  },
]

function hasMenuPermission(perms?: string[]): boolean {
  if (!perms?.length) return true
  return perms.some((p) => userStore.hasPermission(p))
}

function isMenuItem(item: MenuItem | null): item is MenuItem {
  return item !== null
}

const menuItems = computed<MenuItem[]>(() =>
  allMenuItems
    .filter((item) => hasMenuPermission(item.permissions))
    .map((item) => {
      if (!item.children) return item
      const children = item.children.filter((c) => hasMenuPermission(c.permissions))
      return children.length ? { ...item, children } : null
    })
    .filter(isMenuItem),
)
const localizedMenuItems = computed<LocalizedMenuItem[]>(() =>
  menuItems.value.map((item) => ({
    ...item,
    title: t(item.titleKey),
    children: item.children?.map((child) => ({
      ...child,
      title: t(child.titleKey),
    })),
  })),
)

const cachedViews = computed(() => Array.from(tagsViewStore.cachedViews))
const currentRoutePath = computed(() => router.currentRoute.value.path)
const currentLocale = computed<AppLocale>({
  get: () => appStore.locale,
  set: (value) => appStore.setLocale(value),
})
const sidebarWidth = computed(() => (appStore.sidebarCollapsed ? '64px' : '220px'))
const localeOptions = computed(() => [
  { value: 'zh-CN' as AppLocale, label: t('locale.zhCN') },
  { value: 'ja' as AppLocale, label: t('locale.ja') },
])
const displayName = computed(() => userStore.userInfo?.displayName || t('layout.defaultUser'))

async function handleLogout(): Promise<void> {
  await userStore.logout()
  router.push('/login')
}
</script>

<template>
  <el-container class="main-layout">
    <el-aside
      :width="sidebarWidth"
      class="sidebar"
    >
      <div class="sidebar__logo">
        <span v-show="!appStore.sidebarCollapsed" class="sidebar__logo-text">
          {{ t('layout.systemTitle') }}
        </span>
        <span v-show="appStore.sidebarCollapsed" class="sidebar__logo-icon">
          事
        </span>
      </div>

      <el-scrollbar>
        <el-menu
          :default-active="currentRoutePath"
          :collapse="appStore.sidebarCollapsed"
          router
          :collapse-transition="false"
        >
          <template v-for="item in localizedMenuItems" :key="item.path">
            <el-sub-menu v-if="item.children?.length" :index="item.path">
              <template #title>
                <el-icon><component :is="item.icon" /></el-icon>
                <span>{{ item.title }}</span>
              </template>
              <el-menu-item
                v-for="child in item.children"
                :key="child.path"
                :index="child.path"
              >
                {{ child.title }}
              </el-menu-item>
            </el-sub-menu>

            <el-menu-item v-else :index="item.path">
              <el-icon><component :is="item.icon" /></el-icon>
              <template #title>{{ item.title }}</template>
            </el-menu-item>
          </template>
        </el-menu>
      </el-scrollbar>
    </el-aside>

    <el-container class="main-container">
      <el-header class="header">
        <div class="header__left">
          <button
            type="button"
            class="header__collapse-btn"
            @click="appStore.toggleSidebar"
          >
            <el-icon :size="18">
              <Fold v-if="!appStore.sidebarCollapsed" />
              <Expand v-else />
            </el-icon>
          </button>
          <Breadcrumb />
        </div>
        <div class="header__right">
          <el-select
            v-model="currentLocale"
            size="small"
            class="header__locale"
            aria-label="language"
          >
            <el-option
              v-for="option in localeOptions"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
          <el-dropdown>
            <span class="header__user">
              <span class="header__avatar">
                <el-icon :size="14"><UserFilled /></el-icon>
              </span>
              <span class="header__username">
                {{ displayName }}
              </span>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item @click="handleLogout">
                  <el-icon><SwitchButton /></el-icon>
                  {{ t('layout.logout') }}
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>

      <TagsView />

      <el-main class="main-content">
        <router-view v-slot="{ Component: ViewComponent }">
          <keep-alive :include="cachedViews">
            <component :is="ViewComponent" />
          </keep-alive>
        </router-view>
      </el-main>
    </el-container>
  </el-container>
</template>

<style scoped lang="scss">
.main-layout {
  height: 100vh;
  overflow: hidden;
}

// ---- Sidebar ----
.sidebar {
  background-color: var(--app-sidebar-bg);
  transition: width var(--app-transition-slow);
  overflow: hidden;

  :deep(.el-menu) {
    --el-menu-bg-color: var(--app-sidebar-bg);
    --el-menu-text-color: var(--app-sidebar-text);
    --el-menu-active-color: var(--app-sidebar-text-active);
    --el-menu-hover-bg-color: var(--app-sidebar-menu-hover-bg);
    border-right: none;
  }

  :deep(.el-sub-menu .el-menu) {
    --el-menu-bg-color: var(--app-sidebar-bg);
  }

  :deep(.el-menu-item),
  :deep(.el-sub-menu__title) {
    height: 44px;
    line-height: 44px;
    margin: 2px 8px;
    border-radius: var(--app-radius-base);
    transition: background-color var(--app-transition-fast),
                color var(--app-transition-fast);
  }

  :deep(.el-menu-item.is-active) {
    background-color: var(--app-sidebar-active-bg) !important;
    color: var(--app-sidebar-text-active);
  }

  :deep(.el-sub-menu .el-menu-item) {
    min-width: unset;
    padding-left: 52px !important;
  }

  :deep(.el-menu--collapse .el-menu-item),
  :deep(.el-menu--collapse .el-sub-menu__title) {
    margin: 2px 8px;
    padding: 0;
    justify-content: center;
  }

  &__logo {
    height: var(--app-header-height);
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: var(--app-sidebar-logo-bg);
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    overflow: hidden;
  }

  &__logo-text {
    font-size: var(--app-font-size-lg);
    font-weight: var(--app-font-weight-semibold);
    color: #fff;
    white-space: nowrap;
    letter-spacing: 0.025em;
  }

  &__logo-icon {
    font-size: var(--app-font-size-2xl);
    font-weight: var(--app-font-weight-bold);
    color: #fff;
  }

  .el-scrollbar {
    height: calc(100vh - var(--app-header-height));
  }
}

// ---- Main Container ----
.main-container {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background-color: var(--app-bg-page);
}

// ---- Header ----
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: var(--app-header-height);
  padding: 0 var(--app-spacing-lg);
  background-color: var(--app-bg-base);
  border-bottom: 1px solid var(--app-border-color);
  box-shadow: var(--app-shadow-xs);
  z-index: 1;

  &__left {
    display: flex;
    align-items: center;
    gap: var(--app-spacing-md);
  }

  &__collapse-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: none;
    border-radius: var(--app-radius-base);
    background: transparent;
    color: var(--app-text-secondary);
    cursor: pointer;
    transition: all var(--app-transition-fast);

    &:hover {
      background-color: var(--app-bg-hover);
      color: var(--app-text-primary);
    }

    &:active {
      background-color: var(--app-bg-active);
    }
  }

  &__right {
    display: flex;
    align-items: center;
    gap: var(--app-spacing-md);
  }

  &__locale {
    width: 112px;
  }

  &__user {
    display: flex;
    align-items: center;
    gap: var(--app-spacing-sm);
    padding: var(--app-spacing-xs) var(--app-spacing-sm);
    border-radius: var(--app-radius-base);
    cursor: pointer;
    color: var(--app-text-regular);
    transition: background-color var(--app-transition-fast);

    &:hover {
      background-color: var(--app-bg-hover);
    }
  }

  &__avatar {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: var(--app-radius-round);
    background: var(--app-color-primary);
    color: #fff;
    flex-shrink: 0;
  }

  &__username {
    font-size: var(--app-font-size-sm);
    font-weight: var(--app-font-weight-medium);
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

// ---- Main Content ----
.main-content {
  flex: 1;
  overflow-y: auto;
  padding: var(--app-spacing-lg);
  background-color: var(--app-bg-page);
}
</style>
