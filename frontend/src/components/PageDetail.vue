<script setup lang="ts">
import { ArrowLeft } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'

withDefaults(
  defineProps<{
    title?: string
    loading?: boolean
    /**
     * 为 true 时 `headerBar` 与顶栏主行同一行排布（左侧返回/标题、中间插槽、右侧 actions），
     * 适用于客户详情签证主轴等高密度页眉。
     */
    headerBarInline?: boolean
    /**
     * 为 true 时不渲染顶栏（返回/标题/actions/headerBar），仅保留 `page-detail__body`；
     * 返回与标题改由页内区块（如 Stitch Hero）承担。
     */
    hideHeader?: boolean
    /**
     * 为 true 时向左向右扩展，抵消主布局 `el-main` 的 `padding`（`--app-spacing-lg`），
     * 避免详情子页出现「主栏内再缩一层」的双层留白。
     */
    bleedMain?: boolean
  }>(),
  {
    headerBarInline: false,
    hideHeader: false,
    bleedMain: false,
    title: undefined,
    loading: undefined,
  },
)

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
  <div
    class="page-detail"
    :class="{
      'page-detail--hide-header': hideHeader,
      'page-detail--bleed-main': bleedMain,
    }"
  >
    <div
      v-if="!hideHeader"
      class="page-detail__header"
      :class="{
        'page-detail__header--with-bar':
          $slots.headerBar && !headerBarInline,
        'page-detail__header--inline-bar':
          $slots.headerBar && headerBarInline,
      }"
    >
      <template v-if="$slots.headerBar && headerBarInline && !loading">
        <div class="page-detail__header-inline-row">
          <div class="page-detail__header-left">
            <el-button class="page-detail__back-btn" :icon="ArrowLeft" @click="handleBack">
              {{ t('common.back') }}
            </el-button>
            <template v-if="title || $slots.actions">
              <span class="page-detail__divider" />
              <h3 v-if="title" class="page-detail__title">{{ title }}</h3>
            </template>
          </div>
          <div class="page-detail__header-bar page-detail__header-bar--inline">
            <slot name="headerBar" />
          </div>
          <div v-if="$slots.actions" class="page-detail__actions">
            <slot name="actions" />
          </div>
        </div>
      </template>
      <template v-else>
        <div class="page-detail__header-main">
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
        <div
          v-if="$slots.headerBar && !loading"
          class="page-detail__header-bar"
        >
          <slot name="headerBar" />
        </div>
      </template>
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
  box-sizing: border-box;
  min-width: 0;
  width: 100%;

  &--bleed-main {
    width: calc(100% + 2 * var(--app-spacing-lg));
    margin-left: calc(-1 * var(--app-spacing-lg));
    margin-right: calc(-1 * var(--app-spacing-lg));
  }

  &__header {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 0;
    margin-bottom: var(--app-spacing-lg);
    padding: var(--app-spacing-md) var(--app-spacing-lg);
    background: var(--app-bg-base);
    border: 1px solid var(--app-border-color-light);
    border-radius: var(--app-radius-lg);
    box-shadow: var(--app-shadow-xs);
    min-height: 52px;
  }

  &__header-main {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--app-spacing-base);
    min-height: 52px;
  }

  &__header--with-bar &__header-main {
    padding-bottom: var(--app-spacing-sm);
    border-bottom: 1px solid var(--app-border-color-light);
    margin-bottom: var(--app-spacing-sm);
  }

  &__header--inline-bar {
    flex-direction: column;
    align-items: stretch;
  }

  &__header-inline-row {
    display: flex;
    align-items: center;
    gap: var(--app-spacing-md);
    min-width: 0;
    width: 100%;
  }

  &__header-bar {
    min-width: 0;
  }

  &__header-bar--inline {
    flex: 1 1 0;
    min-width: 0;
  }

  &__header-inline-row &__header-left {
    flex-shrink: 0;
    max-width: min(100%, 280px);
  }

  &__header-inline-row &__actions {
    flex-shrink: 0;
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
    box-sizing: border-box;
    min-width: 0;
    width: 100%;

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
