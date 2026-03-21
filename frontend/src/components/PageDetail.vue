<script setup lang="ts">
import { ArrowLeft } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'

defineOptions({ name: 'PageDetail' })

defineProps<{
  title?: string
  loading?: boolean
}>()
const { t } = useI18n({ useScope: 'global' })

const emit = defineEmits<{
  back: []
}>()

function handleBack() {
  emit('back')
}
</script>

<template>
  <div v-loading="loading" class="page-detail">
    <div class="page-detail__header">
      <div class="page-detail__header-left">
        <el-button :icon="ArrowLeft" text @click="handleBack">
          {{ t('common.back') }}
        </el-button>
        <h3 v-if="title" class="page-detail__title">{{ title }}</h3>
      </div>
      <div v-if="$slots.actions" class="page-detail__actions">
        <slot name="actions" />
      </div>
    </div>

    <div class="page-detail__body">
      <slot />
    </div>
  </div>
</template>

<style scoped lang="scss">
.page-detail {
  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid #ebeef5;
  }

  &__header-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  &__title {
    font-size: 18px;
    font-weight: 600;
    color: #303133;
    margin: 0;
  }

  &__body {
    :deep(.el-card) {
      margin-bottom: 16px;
    }
  }
}
</style>
