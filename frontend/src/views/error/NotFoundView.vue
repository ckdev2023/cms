<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

const router = useRouter()
const { t } = useI18n({ useScope: 'global' })

const navigateToHome = (): void => {
  router.push('/')
}
</script>

<template>
  <div class="not-found">
    <h1 class="not-found__code">404</h1>
    <p class="not-found__title">{{ t('errors.notFoundTitle') }}</p>
    <el-button type="primary" @click="navigateToHome">
      {{ t('errors.backHome') }}
    </el-button>
  </div>
</template>

<style scoped>
.not-found {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  gap: 16px;
}

.not-found__code {
  font-size: 72px;
  color: #dcdfe6;
  margin: 0;
}

.not-found__title {
  font-size: 18px;
  color: #909399;
  margin: 0;
}
</style>
