<script setup lang="ts">
import { ArrowDown,Close } from '@element-plus/icons-vue'
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import { type TagView,useTagsViewStore } from '@/stores/tagsView'

defineOptions({ name: 'TagsView' })

const route = useRoute()
const router = useRouter()
const store = useTagsViewStore()
const { t } = useI18n({ useScope: 'global' })

const visitedViews = computed(() => store.visitedViews)
const translatedVisitedViews = computed(() =>
  visitedViews.value.map((view) => ({
    ...view,
    title: view.titleKey ? t(view.titleKey) : view.title || t('tags.untitled'),
  })),
)

watch(
  route,
  () => {
    if (route.name && !route.meta?.public) {
      store.addView(route)
    }
  },
  { immediate: true },
)

function isActive(view: TagView) {
  return view.path === route.path
}

function handleClick(view: TagView) {
  router.push({ path: view.path, query: view.query })
}

function handleClose(view: TagView) {
  store.removeView(view.path)
  if (isActive(view)) {
    toLastView()
  }
}

function toLastView() {
  const last = visitedViews.value[visitedViews.value.length - 1]
  router.push(last ? { path: last.path, query: last.query } : '/dashboard')
}

function handleCommand(cmd: string) {
  if (cmd === 'closeOthers') {
    store.removeOtherViews(route.path)
  } else if (cmd === 'closeAll') {
    store.removeAllViews()
    toLastView()
  }
}
</script>

<template>
  <div class="tags-view">
    <div class="tags-view__scroll">
      <div
        v-for="tag in translatedVisitedViews"
        :key="tag.path"
        class="tags-view__item"
        :class="{ 'is-active': isActive(tag) }"
        @click="handleClick(tag)"
      >
        <span class="tags-view__dot" />
        <span class="tags-view__title">{{ tag.title }}</span>
        <el-icon
          v-if="!tag.affix"
          class="tags-view__close"
          @click.stop="handleClose(tag)"
        >
          <Close />
        </el-icon>
      </div>
    </div>
    <el-dropdown class="tags-view__actions" @command="handleCommand">
      <span class="tags-view__actions-btn">
        <el-icon><ArrowDown /></el-icon>
      </span>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item command="closeOthers">
            {{ t('tags.closeOthers') }}
          </el-dropdown-item>
          <el-dropdown-item command="closeAll">
            {{ t('tags.closeAll') }}
          </el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
  </div>
</template>

<style scoped lang="scss">
.tags-view {
  display: flex;
  align-items: center;
  height: var(--app-tags-height);
  background: var(--app-bg-base);
  border-bottom: 1px solid var(--app-border-color-light);

  &__scroll {
    display: flex;
    flex: 1;
    align-items: center;
    overflow-x: auto;
    gap: 6px;
    padding: 0 var(--app-spacing-md);
    scrollbar-width: none;

    &::-webkit-scrollbar {
      display: none;
    }
  }

  &__item {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 28px;
    padding: 0 var(--app-spacing-sm) 0 10px;
    border-radius: var(--app-radius-base);
    font-size: var(--app-font-size-xs);
    color: var(--app-text-secondary);
    background: transparent;
    cursor: pointer;
    white-space: nowrap;
    flex-shrink: 0;
    transition: color var(--app-transition-fast),
                background-color var(--app-transition-fast);

    .tags-view__close {
      opacity: 0;
      transform: scale(0.7);
    }

    &:hover {
      color: var(--app-text-primary);
      background: var(--app-bg-hover);

      .tags-view__close {
        opacity: 1;
        transform: scale(1);
      }
    }

    &.is-active {
      color: var(--app-color-primary);
      background: var(--app-color-primary-light);
      font-weight: var(--app-font-weight-medium);

      .tags-view__dot {
        background: var(--app-color-primary);
        opacity: 1;
      }

      .tags-view__close {
        opacity: 1;
        transform: scale(1);
        color: var(--app-color-primary);

        &:hover {
          background: rgba(67, 97, 238, 0.15);
        }
      }
    }
  }

  &__dot {
    width: 6px;
    height: 6px;
    border-radius: var(--app-radius-round);
    background: var(--app-text-placeholder);
    flex-shrink: 0;
    opacity: 0.5;
    transition: all var(--app-transition-fast);
  }

  &__title {
    line-height: 1;
  }

  &__close {
    font-size: 12px;
    border-radius: var(--app-radius-round);
    width: 16px;
    height: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--app-text-placeholder);
    transition: all var(--app-transition-fast);

    &:hover {
      background-color: rgba(0, 0, 0, 0.08);
      color: var(--app-text-primary);
    }
  }

  &__actions {
    flex-shrink: 0;
    padding: 0 var(--app-spacing-sm);
    border-left: 1px solid var(--app-border-color-light);
    height: 100%;
    display: flex;
    align-items: center;
  }

  &__actions-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: var(--app-radius-base);
    font-size: 14px;
    cursor: pointer;
    color: var(--app-text-placeholder);
    transition: all var(--app-transition-fast);

    &:hover {
      color: var(--app-color-primary);
      background: var(--app-bg-hover);
    }
  }
}
</style>
