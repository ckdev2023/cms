<script setup lang="ts">
import { computed, watchEffect } from 'vue'
import { useRoute } from 'vue-router'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import ja from 'element-plus/es/locale/lang/ja'
import { useAppStore } from '@/stores/app'
import { useI18n } from 'vue-i18n'

const route = useRoute()
const appStore = useAppStore()
const { t } = useI18n({ useScope: 'global' })

const elementLocale = computed(() =>
  appStore.locale === 'zh-CN' ? zhCn : ja,
)

watchEffect(() => {
  const titleKey =
    typeof route.meta.titleKey === 'string' ? route.meta.titleKey : undefined
  const pageTitle = titleKey ? t(titleKey) : ''
  const appTitle = t('app.title')
  document.title = pageTitle ? `${pageTitle} - ${appTitle}` : appTitle
})
</script>

<template>
  <el-config-provider :locale="elementLocale">
    <router-view :key="appStore.locale" />
  </el-config-provider>
</template>
