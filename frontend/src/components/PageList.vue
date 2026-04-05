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
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--app-spacing-lg);
    gap: var(--app-spacing-sm) var(--app-spacing-base);

    /** 标签栏已承载标题时仅保留右侧工具区，与签证工作台等页对齐 */
    &:not(:has(.page-list__title)) {
      justify-content: flex-end;
      margin-bottom: var(--app-spacing-base);
    }
  }

  &__title {
    flex: 1 1 auto;
    min-width: 0;
    font-size: var(--app-font-size-xl);
    font-weight: var(--app-font-weight-semibold);
    color: var(--app-text-primary);
    margin: 0;
    line-height: 1.3;
  }

  &__header-actions {
    flex: 0 1 auto;
    min-width: 0;
    display: flex;
    justify-content: flex-end;
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

    &:has(:deep(.customer-list-search)) {
      padding-top: var(--app-spacing-sm);
      padding-bottom: 2px;
    }

    &:has(:deep(.visa-registry-search)) {
      padding-top: var(--app-spacing-sm);
      padding-bottom: var(--app-spacing-xs);
    }

    /* 客户列表 / 签证登记册等复杂筛选自带栅格布局，此处不强制 flex（避免 el-row 被横向排列） */
    :deep(.el-form:not(.customer-list-search__form):not(.visa-registry-search)) {
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
