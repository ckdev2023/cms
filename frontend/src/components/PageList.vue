<script setup lang="ts">
defineProps<{
  title?: string
}>()

defineOptions({ name: 'PageList' })
</script>

<template>
  <div class="page-list">
    <div v-if="title || $slots.headerExtra" class="page-list__header">
      <h3 v-if="title" class="page-list__title">{{ title }}</h3>
      <div v-if="$slots.headerExtra" class="page-list__header-actions">
        <slot name="headerExtra" />
      </div>
    </div>

    <div class="page-list__content">
      <div v-if="$slots.search" class="page-list__filter">
        <slot name="search" />
      </div>
      <div class="page-list__body">
        <slot />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.page-list {
  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--app-spacing-lg);
    gap: var(--app-spacing-base);
  }

  &__title {
    font-size: var(--app-font-size-xl);
    font-weight: var(--app-font-weight-semibold);
    color: var(--app-text-primary);
    margin: 0;
    line-height: 1.3;
  }

  &__content {
    background: var(--app-bg-base);
    border: 1px solid var(--app-border-color-light);
    border-radius: var(--app-radius-lg);
    box-shadow: var(--app-shadow-xs);
    overflow: hidden;
  }

  &__filter {
    padding: var(--app-spacing-base) var(--app-spacing-lg) var(--app-spacing-xs);
    border-bottom: 1px solid var(--app-border-color-light);
    background: var(--app-bg-page);

    :deep(.el-form) {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      gap: 0 var(--app-spacing-md);
    }

    :deep(.el-form-item) {
      margin-bottom: var(--app-spacing-sm);
      margin-right: 0;
    }

    :deep(.el-form-item__label) {
      font-size: var(--app-font-size-sm);
      color: var(--app-text-secondary);
    }
  }

  &__body {
    padding: var(--app-spacing-lg);
  }
}
</style>
