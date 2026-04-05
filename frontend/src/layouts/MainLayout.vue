<script setup lang="ts">
import { Expand, Fold, SwitchButton, UserFilled } from '@element-plus/icons-vue'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import Breadcrumb from '@/components/Breadcrumb.vue'
import TagsView from '@/components/TagsView.vue'
import { useIdleTimeout } from '@/composables/useIdleTimeout'
import { useMainLayoutMenu } from '@/composables/useMainLayoutMenu'
import type { AppLocale } from '@/i18n'
import { useAppStore } from '@/stores/app'
import { useTagsViewStore } from '@/stores/tagsView'
import { useUserStore } from '@/stores/user'

const appStore = useAppStore()
const userStore = useUserStore()
const tagsViewStore = useTagsViewStore()
const router = useRouter()
const { t } = useI18n({ useScope: 'global' })

const { localizedMenuItems, visaMenuDefaultOpeneds } = useMainLayoutMenu()

useIdleTimeout()

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

/**
 * 登出当前用户并跳转登录页。
 *
 * @returns Promise，在登出与路由跳转完成后 resolve
 */
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
          :default-openeds="visaMenuDefaultOpeneds"
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
                <el-tooltip
                  :disabled="!child.menuTooltip"
                  :content="child.menuTooltip ?? ''"
                  placement="right"
                  :show-after="400"
                >
                  <span
                    class="sidebar-menu-entry"
                    :class="{ 'sidebar-menu-entry--stacked': !!child.menuSubtitle }"
                  >
                    <span class="sidebar-menu-entry__primary">{{ child.title }}</span>
                    <span v-if="child.menuSubtitle" class="sidebar-menu-entry__sub">
                      {{ child.menuSubtitle }}
                    </span>
                  </span>
                </el-tooltip>
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

<style scoped lang="scss" src="./main-layout.scss"></style>
