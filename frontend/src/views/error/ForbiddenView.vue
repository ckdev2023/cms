<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

const router = useRouter()
const { t } = useI18n({ useScope: 'global' })

const navigateToHome = (): void => {
  router.push('/')
}

const navigateBack = (): void => {
  router.back()
}
</script>

<template>
  <div class="forbidden">
    <div class="forbidden__icon">
      <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <circle cx="100" cy="100" r="90" fill="none" stroke="#e6a23c" stroke-width="4" />
        <path d="M100 45 L100 115" stroke="#e6a23c" stroke-width="8" stroke-linecap="round" />
        <circle cx="100" cy="140" r="5" fill="#e6a23c" />
      </svg>
    </div>
    <h1 class="forbidden__code">403</h1>
    <p class="forbidden__title">{{ t('errors.forbiddenTitle') }}</p>
    <p class="forbidden__hint">
      {{ t('errors.forbiddenHint') }}
    </p>
    <div class="forbidden__actions">
      <el-button type="primary" @click="navigateToHome">
        {{ t('errors.backHome') }}
      </el-button>
      <el-button @click="navigateBack">
        {{ t('errors.goBack') }}
      </el-button>
    </div>
  </div>
</template>

<style scoped>
.forbidden {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  gap: 12px;
}

.forbidden__icon {
  width: 120px;
  height: 120px;
}

.forbidden__code {
  font-size: 72px;
  color: #e6a23c;
  margin: 0;
  line-height: 1;
}

.forbidden__title {
  font-size: 18px;
  color: #909399;
  margin: 0;
}

.forbidden__hint {
  margin: 0;
  font-size: 14px;
  color: #c0c4cc;
}

.forbidden__actions {
  margin-top: 16px;
  display: flex;
  gap: 12px;
}
</style>
