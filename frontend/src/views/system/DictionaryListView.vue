<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { getDictTypes, getDictByType } from '@/api/dictionary'
import type { DictItem } from '@/api/dictionary'

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

async function fetchItems() {
  if (!selectedType.value) return
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
  <div class="dictionary-page">
    <h2 class="dictionary-page__title">{{ t('pages.dictionaries.title') }}</h2>

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
          <el-table :data="dictItems" v-loading="itemsLoading" stripe border>
            <el-table-column prop="value" :label="t('pages.dictionaries.value')" min-width="200" />
            <el-table-column prop="label" :label="t('pages.dictionaries.label')" min-width="200" />
          </el-table>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<style scoped lang="scss">
.dictionary-page {
  &__title {
    font-size: 20px;
    font-weight: 600;
    margin: 0 0 16px;
  }
}

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
    font-size: 13px;
  }
}
</style>
