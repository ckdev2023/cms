<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { loadVisaCaseWizardCaseTypeOptions } from './visa-case-wizard/visaCaseWizardCaseTypes'

defineOptions({ name: 'CustomerListVisaCaseTypeFilter' })

const { t } = useI18n({ useScope: 'global' })

const model = defineModel<string | undefined>({ default: undefined })

const visaCaseTypeFilterOptions = ref<Array<{ label: string; value: string }>>([])

onMounted(() => {
  void loadVisaCaseWizardCaseTypeOptions(visaCaseTypeFilterOptions)
})
</script>

<template>
  <el-select
    v-model="model"
    class="customer-list-visa-case-type-filter__select"
    filterable
    allow-create
    default-first-option
    :placeholder="t('common.all')"
    clearable
  >
    <el-option
      v-for="opt in visaCaseTypeFilterOptions"
      :key="opt.value"
      :label="opt.label"
      :value="opt.value"
    />
  </el-select>
</template>

<style scoped lang="scss">
.customer-list-visa-case-type-filter__select {
  width: 220px;
  max-width: 100%;
}
</style>
