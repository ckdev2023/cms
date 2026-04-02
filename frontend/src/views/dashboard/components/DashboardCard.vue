<script setup lang="ts">
import type { Component } from 'vue'

withDefaults(defineProps<{
  title: string
  icon?: Component | null
  iconColor?: string
  loading?: boolean
  skeletonRows?: number
}>(), {
  icon: null,
  iconColor: '',
  loading: false,
  skeletonRows: 4,
})
</script>

<template>
  <el-card shadow="never" class="dashboard-card">
    <template #header>
      <div class="dashboard-card__header">
        <span class="dashboard-card__title">
          <el-icon v-if="icon" :color="iconColor || undefined"><component :is="icon" /></el-icon>
          {{ title }}
        </span>
        <div v-if="$slots['header-extra']" class="dashboard-card__extra">
          <slot name="header-extra" />
        </div>
      </div>
    </template>
    <el-skeleton :loading="loading" animated :rows="skeletonRows">
      <template #default>
        <slot />
      </template>
    </el-skeleton>
  </el-card>
</template>

<style scoped lang="scss">
.dashboard-card {
  &__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  &__title {
    display: flex;
    align-items: center;
    gap: var(--app-spacing-sm);
    font-weight: var(--app-font-weight-semibold);
    font-size: var(--app-font-size-md);
    color: var(--app-text-primary);
  }
}
</style>
