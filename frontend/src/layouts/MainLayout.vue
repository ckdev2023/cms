<script setup lang="ts">
import { computed, type Component } from 'vue'
import { useAppStore } from '@/stores/app'
import { useUserStore } from '@/stores/user'
import { useTagsViewStore } from '@/stores/tagsView'
import { useRouter } from 'vue-router'
import { useIdleTimeout } from '@/composables/useIdleTimeout'
import type { AppLocale } from '@/i18n'
import { P } from '@/constants/permissions'
import Breadcrumb from '@/components/Breadcrumb.vue'
import TagsView from '@/components/TagsView.vue'
import { useI18n } from 'vue-i18n'
import {
  Fold,
  Expand,
  UserFilled,
  SwitchButton,
  Monitor,
  User,
  Document,
  Tickets,
  Money,
  Folder,
  Setting,
} from '@element-plus/icons-vue'

interface MenuItem {
  path: string
  titleKey: string
  icon: Component
  permissions?: string[]
  children?: { path: string; titleKey: string; permissions?: string[] }[]
}

const appStore = useAppStore()
const userStore = useUserStore()
const tagsViewStore = useTagsViewStore()
const router = useRouter()
const { t } = useI18n({ useScope: 'global' })

useIdleTimeout()

const allMenuItems: MenuItem[] = [
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

const menuItems = computed(() =>
  allMenuItems
    .filter((item) => hasMenuPermission(item.permissions))
    .map((item) => {
      if (!item.children) return item
      const children = item.children.filter((c) => hasMenuPermission(c.permissions))
      return children.length ? { ...item, children } : null
    })
    .filter(Boolean) as MenuItem[],
)
const localizedMenuItems = computed(() =>
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
const currentLocale = computed<AppLocale>({
  get: () => appStore.locale,
  set: (value) => appStore.setLocale(value),
})
const localeOptions = computed(() => [
  { value: 'zh-CN' as AppLocale, label: t('locale.zhCN') },
  { value: 'ja' as AppLocale, label: t('locale.ja') },
])

async function handleLogout() {
  await userStore.logout()
  router.push('/login')
}
</script>

<template>
  <el-container class="main-layout">
    <el-aside
      :width="appStore.sidebarCollapsed ? '64px' : '220px'"
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
          :default-active="$route.path"
          :collapse="appStore.sidebarCollapsed"
          router
          background-color="#304156"
          text-color="#bfcbd9"
          active-text-color="#409eff"
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
          <el-icon class="header__collapse" @click="appStore.toggleSidebar">
            <Fold v-if="!appStore.sidebarCollapsed" />
            <Expand v-else />
          </el-icon>
          <Breadcrumb />
        </div>
        <div class="header__right">
          <el-select v-model="currentLocale" size="small" class="header__locale" aria-label="language">
            <el-option
              v-for="option in localeOptions"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
          <el-dropdown>
            <span class="header__user">
              <el-icon><UserFilled /></el-icon>
              <span>{{ userStore.userInfo?.displayName || t('layout.defaultUser') }}</span>
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
}

.sidebar {
  background-color: #304156;
  transition: width 0.3s;
  overflow: hidden;

  &__logo {
    height: 56px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    background-color: #263445;
    overflow: hidden;
  }

  &__logo-text {
    font-size: 18px;
    font-weight: 600;
    white-space: nowrap;
  }

  &__logo-icon {
    font-size: 20px;
    font-weight: 700;
  }

  .el-menu {
    border-right: none;
  }

  .el-scrollbar {
    height: calc(100vh - 56px);
  }
}

.main-container {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #ebeef5;
  padding: 0 20px;
  height: 56px;
  background: #fff;

  &__left {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  &__collapse {
    font-size: 20px;
    cursor: pointer;
    &:hover {
      color: var(--el-color-primary);
    }
  }

  &__right {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  &__user {
    display: flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
  }
}

.header__locale {
  width: 112px;
}

.main-content {
  background-color: #f0f2f5;
  overflow-y: auto;
  padding: 16px;
}
</style>
