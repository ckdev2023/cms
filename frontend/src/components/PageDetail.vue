<script setup lang="ts">
import { ArrowLeft } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'

defineProps<{
  title?: string
  loading?: boolean
}>()

const emit = defineEmits<{
  back: []
}>()

defineOptions({ name: 'PageDetail' })

const { t } = useI18n({ useScope: 'global' })

function handleBack() {
  emit('back')
}
</script>

<template>
  <div class="page-detail">
    <div class="page-detail__header">
      <div class="page-detail__header-left">
        <el-button class="page-detail__back-btn" :icon="ArrowLeft" @click="handleBack">
          {{ t('common.back') }}
        </el-button>
        <template v-if="!loading">
          <span v-if="title || $slots.actions" class="page-detail__divider" />
          <h3 v-if="title" class="page-detail__title">{{ title }}</h3>
        </template>
        <template v-else>
          <span class="page-detail__divider" />
          <el-skeleton style="width: 140px" animated>
            <template #template>
              <el-skeleton-item variant="text" style="height: 22px" />
            </template>
          </el-skeleton>
        </template>
      </div>
      <div v-if="$slots.actions && !loading" class="page-detail__actions">
        <slot name="actions" />
      </div>
    </div>

    <div class="page-detail__body">
      <template v-if="loading">
        <el-card shadow="never" class="page-detail__skeleton-card">
          <el-skeleton animated :rows="6" />
        </el-card>
        <el-card shadow="never" class="page-detail__skeleton-card">
          <el-skeleton animated :rows="4" />
        </el-card>
      </template>
      <template v-else>
        <slot />
      </template>
    </div>
  </div>
</template>

<style scoped lang="scss">
.page-detail {
  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--app-spacing-base);
    margin-bottom: var(--app-spacing-lg);
    padding: var(--app-spacing-md) var(--app-spacing-lg);
    background: var(--app-bg-base);
    border: 1px solid var(--app-border-color-light);
    border-radius: var(--app-radius-lg);
    box-shadow: var(--app-shadow-xs);
    min-height: 52px;
  }

  &__header-left {
    display: flex;
    align-items: center;
    gap: var(--app-spacing-md);
    min-width: 0;
  }

  &__back-btn {
    flex-shrink: 0;
    font-weight: var(--app-font-weight-medium);
    color: var(--app-text-secondary);

    &:hover,
    &:focus {
      color: var(--app-color-primary);
    }
  }

  &__divider {
    width: 1px;
    height: 20px;
    background: var(--app-border-color);
    flex-shrink: 0;
  }

  &__title {
    font-size: var(--app-font-size-xl);
    font-weight: var(--app-font-weight-semibold);
    color: var(--app-text-primary);
    margin: 0;
    line-height: 1.3;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__actions {
    flex-shrink: 0;

    :deep(.detail-header-info) {
      display: flex;
      align-items: center;
      gap: var(--app-spacing-sm);
    }

    :deep(.detail-header-info__name) {
      margin: 0;
      font-size: var(--app-font-size-xl);
      font-weight: var(--app-font-weight-semibold);
      color: var(--app-text-primary);
      line-height: 1.3;
    }
  }

  &__skeleton-card {
    margin-bottom: var(--app-spacing-base);

    &:last-child {
      margin-bottom: 0;
    }
  }

  &__body {
    :deep(.el-card) {
      margin-bottom: var(--app-spacing-base);

      &:last-child {
        margin-bottom: 0;
      }
    }

    :deep(.detail-section) {
      margin-bottom: var(--app-spacing-base);

      &:last-child {
        margin-bottom: 0;
      }
    }

    :deep(.el-descriptions) {
      --el-descriptions-item-bordered-label-background: var(--app-bg-page);
    }
  }
}
</style>
