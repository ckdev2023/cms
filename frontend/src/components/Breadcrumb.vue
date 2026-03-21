<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'

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
  <el-breadcrumb separator="/" class="app-breadcrumb">
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

  .is-current {
    color: #97a8be;
  }

  .is-link {
    color: #606266;
    cursor: pointer;
    &:hover {
      color: var(--el-color-primary);
    }
  }
}
</style>
