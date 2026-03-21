<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'

const router = useRouter()
const { t } = useI18n({ useScope: 'global' })
</script>

<template>
  <div class="not-found">
    <h1>404</h1>
    <p>{{ t('errors.notFoundTitle') }}</p>
    <el-button type="primary" @click="router.push('/')">{{ t('errors.backHome') }}</el-button>
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
.not-found h1 {
  font-size: 72px;
  color: #dcdfe6;
}
.not-found p {
  font-size: 18px;
  color: #909399;
}
</style>
