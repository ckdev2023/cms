<script setup lang="ts">
defineOptions({ name: 'PageList' })

defineProps<{
  title?: string
}>()
</script>

<template>
  <div class="page-list">
    <div v-if="title || $slots.headerExtra" class="page-list__header">
      <h3 v-if="title" class="page-list__title">{{ title }}</h3>
      <div v-if="$slots.headerExtra" class="page-list__header-extra">
        <slot name="headerExtra" />
      </div>
    </div>

    <el-card v-if="$slots.search" class="page-list__search" shadow="never">
      <slot name="search" />
    </el-card>

    <el-card class="page-list__body" shadow="never">
      <slot />
    </el-card>
  </div>
</template>

<style scoped lang="scss">
.page-list {
  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
  }

  &__title {
    font-size: 18px;
    font-weight: 600;
    color: #303133;
    margin: 0;
  }

  &__search {
    margin-bottom: 16px;
  }

  &__body {
    :deep(.el-card__body) {
      padding: 16px;
    }
  }
}
</style>
