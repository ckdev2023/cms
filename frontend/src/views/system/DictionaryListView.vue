<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import type { DictItem } from '@/api/dictionary'
import { getDictByType, getDictTypes } from '@/api/dictionary'
import PageList from '@/components/PageList.vue'

const { t, te } = useI18n({ useScope: 'global' })
const loading = ref(false)
const dictTypes = ref<string[]>([])
const selectedType = ref('')
const dictItems = ref<DictItem[]>([])
const itemsLoading = ref(false)

function getTypeLabel(type: string) {
  const key = `pages.dictionaries.types.${type}`
  return te(key) ? t(key) : type
}

const displayLabel = computed(() => {
  return selectedType.value ? getTypeLabel(selectedType.value) : ''
})

/**
 * 加载字典类型列表，并在首次进入时默认选中首个类型。
 *
 * @returns 无返回值
 */
async function fetchTypes() {
  loading.value = true
  try {
    const res = await getDictTypes()
    dictTypes.value = res.data
    if (dictTypes.value.length > 0 && !selectedType.value) {
      selectedType.value = dictTypes.value[0]
      await fetchItems()
    }
  } finally {
    loading.value = false
  }
}

/**
 * 按当前选中的字典类型刷新右侧字典项列表。
 *
 * @returns 无返回值
 */
async function fetchItems() {
  if (!selectedType.value) {return}
  itemsLoading.value = true
  try {
    const res = await getDictByType(selectedType.value)
    dictItems.value = res.data
  } finally {
    itemsLoading.value = false
  }
}

async function handleTypeSelect(type: string) {
  selectedType.value = type
  await fetchItems()
}

onMounted(fetchTypes)
</script>

<template>
  <PageList :title="t('pages.dictionaries.title')">
    <el-row :gutter="16">
      <el-col :xs="24" :sm="8" :md="6">
        <el-card shadow="never" class="dict-type-card">
          <template #header>
            <span>{{ t('pages.dictionaries.typeCardTitle') }}</span>
          </template>
          <el-skeleton :rows="6" :loading="loading" animated>
            <template #default>
              <el-menu :default-active="selectedType" @select="handleTypeSelect">
                <el-menu-item
                  v-for="type in dictTypes"
                  :key="type"
                  :index="type"
                >
                  {{ getTypeLabel(type) }}
                </el-menu-item>
              </el-menu>
            </template>
          </el-skeleton>
        </el-card>
      </el-col>

      <el-col :xs="24" :sm="16" :md="18">
        <el-card shadow="never">
          <template #header>
            <span>{{ t('pages.dictionaries.dataTitle', { name: displayLabel }) }}</span>
          </template>
          <el-table v-loading="itemsLoading" :data="dictItems" stripe border>
            <el-table-column prop="value" :label="t('pages.dictionaries.value')" min-width="200" />
            <el-table-column prop="label" :label="t('pages.dictionaries.label')" min-width="200" />
          </el-table>
        </el-card>
      </el-col>
    </el-row>
  </PageList>
</template>

<style scoped lang="scss">
.dict-type-card {
  :deep(.el-card__body) {
    padding: 0;
  }

  .el-menu {
    border-right: none;
  }

  .el-menu-item {
    height: 40px;
    line-height: 40px;
    font-size: var(--app-font-size-sm);
  }
}
</style>
