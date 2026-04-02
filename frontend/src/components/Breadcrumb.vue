<script setup lang="ts">
import { ArrowRight } from '@element-plus/icons-vue'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

defineOptions({ name: 'Breadcrumb' })

const route = useRoute()
const router = useRouter()
const { t } = useI18n({ useScope: 'global' })

const items = computed(() =>
  route.matched
    .filter((r) => (r.meta?.titleKey || r.meta?.title) && r.meta?.breadcrumb !== false)
    .map((r) => ({
      title: r.meta.titleKey ? t(r.meta.titleKey as string) : (r.meta.title as string),
      path: r.redirect ? String(r.redirect) : r.path,
    })),
)

function handleClick(path: string) {
  router.push(path)
}
</script>

<template>
  <el-breadcrumb :separator-icon="ArrowRight" class="app-breadcrumb">
    <el-breadcrumb-item v-for="(item, idx) in items" :key="item.path">
      <span v-if="idx === items.length - 1" class="is-current">
        {{ item.title }}
      </span>
      <a v-else class="is-link" @click.prevent="handleClick(item.path)">
        {{ item.title }}
      </a>
    </el-breadcrumb-item>
  </el-breadcrumb>
</template>

<style scoped lang="scss">
.app-breadcrumb {
  line-height: 1;

  :deep(.el-breadcrumb__separator) {
    color: var(--app-text-disabled);
    font-size: 12px;
    margin: 0 6px;

    .el-icon {
      font-size: 12px;
      vertical-align: middle;
    }
  }

  .is-current {
    color: var(--app-text-primary);
    font-size: var(--app-font-size-sm);
    font-weight: var(--app-font-weight-medium);
  }

  .is-link {
    color: var(--app-text-placeholder);
    font-size: var(--app-font-size-sm);
    cursor: pointer;
    transition: color var(--app-transition-fast);

    &:hover {
      color: var(--app-color-primary);
    }
  }
}
</style>
