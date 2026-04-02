<script setup lang="ts">
import ja from 'element-plus/es/locale/lang/ja'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import { storeToRefs } from 'pinia'
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'

import { useAppStore } from '@/stores/app'

const route = useRoute()
const appStore = useAppStore()
const { locale } = storeToRefs(appStore)
const { t } = useI18n({ useScope: 'global' })

const elementLocale = computed(() =>
  locale.value === 'zh-CN' ? zhCn : ja,
)

const pageTitleKey = computed(() =>
  typeof route.meta.titleKey === 'string' ? route.meta.titleKey : undefined,
)

const documentTitle = computed(() => {
  const appTitle = t('app.title')
  return pageTitleKey.value ? `${t(pageTitleKey.value)} - ${appTitle}` : appTitle
})

watch(
  documentTitle,
  (title) => {
    document.title = title
  },
  { immediate: true },
)
</script>

<template>
  <el-config-provider :locale="elementLocale">
    <router-view :key="locale" />
  </el-config-provider>
</template>
