<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useTagsViewStore, type TagView } from '@/stores/tagsView'
import { Close, ArrowDown } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'

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
      <el-icon class="tags-view__actions-btn"><ArrowDown /></el-icon>
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
  height: 34px;
  border-bottom: 1px solid #d8dce5;
  background: #fff;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.04);

  &__scroll {
    display: flex;
    flex: 1;
    overflow-x: auto;
    gap: 4px;
    padding: 0 8px;
    scrollbar-width: none;
    &::-webkit-scrollbar {
      display: none;
    }
  }

  &__item {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    height: 26px;
    padding: 0 10px;
    border: 1px solid #d8dce5;
    border-radius: 3px;
    font-size: 12px;
    color: #495060;
    background: #fff;
    cursor: pointer;
    white-space: nowrap;
    flex-shrink: 0;
    transition: all 0.2s;

    &:hover {
      color: var(--el-color-primary);
    }

    &.is-active {
      background-color: var(--el-color-primary);
      color: #fff;
      border-color: var(--el-color-primary);

      .tags-view__close:hover {
        background-color: rgba(255, 255, 255, 0.3);
      }
    }
  }

  &__close {
    font-size: 12px;
    border-radius: 50%;
    width: 16px;
    height: 16px;
    transition: all 0.15s;

    &:hover {
      background-color: rgba(0, 0, 0, 0.1);
    }
  }

  &__actions {
    padding: 0 8px;
  }

  &__actions-btn {
    font-size: 16px;
    cursor: pointer;
    color: #606266;
    &:hover {
      color: var(--el-color-primary);
    }
  }
}
</style>
