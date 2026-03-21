<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'

const router = useRouter()
const { t } = useI18n({ useScope: 'global' })
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
    <h1>403</h1>
    <p>{{ t('errors.forbiddenTitle') }}</p>
    <p class="forbidden__hint">
      {{ t('errors.forbiddenHint') }}
    </p>
    <div class="forbidden__actions">
      <el-button type="primary" @click="router.push('/')">
        {{ t('errors.backHome') }}
      </el-button>
      <el-button @click="router.back()">
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

.forbidden h1 {
  font-size: 72px;
  color: #e6a23c;
  margin: 0;
  line-height: 1;
}

.forbidden p {
  font-size: 18px;
  color: #909399;
  margin: 0;
}

.forbidden__hint {
  font-size: 14px !important;
  color: #c0c4cc !important;
}

.forbidden__actions {
  margin-top: 16px;
  display: flex;
  gap: 12px;
}
</style>
