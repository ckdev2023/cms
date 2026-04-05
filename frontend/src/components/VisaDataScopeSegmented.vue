<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import { VisaDataScope } from '@/constants/enums'

const props = defineProps<{
  /** 当前生效范围，与路由及接口一致 */
  modelValue: VisaDataScope
  /** 当前用户可选档位（已由权限预过滤） */
  options: VisaDataScope[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: VisaDataScope]
}>()

defineOptions({ name: 'VisaDataScopeSegmented' })

const { t } = useI18n({ useScope: 'global' })

/**
 * 将分段控件的值写回父级并驱动路由更新。
 *
 * @param value - 选中的数据范围
 */
function onChange(value: VisaDataScope | string | number | boolean | undefined): void {
  if (typeof value !== 'string') {return}
  if (!(props.options as string[]).includes(value)) {return}
  emit('update:modelValue', value as VisaDataScope)
}

/**
 * 将枚举值映射为 i18n 标签键路径下的展示文案。
 *
 * @param scope - 数据范围枚举
 * @returns 中日双语下的短标签
 */
function labelFor(scope: VisaDataScope): string {
  if (scope === VisaDataScope.MINE) {return t('common.visaDataScope.mine')}
  if (scope === VisaDataScope.TEAM) {return t('common.visaDataScope.team')}
  return t('common.visaDataScope.all')
}
</script>

<template>
  <div class="visa-data-scope-segmented" role="group" :aria-label="t('common.visaDataScope.label')">
    <span class="visa-data-scope-segmented__label">{{ t('common.visaDataScope.label') }}</span>
    <el-radio-group
      class="visa-data-scope-segmented__group"
      :model-value="modelValue"
      @update:model-value="onChange"
    >
      <el-radio-button
        v-for="opt in options"
        :key="opt"
        :value="opt"
      >
        {{ labelFor(opt) }}
      </el-radio-button>
    </el-radio-group>
  </div>
</template>

<style scoped lang="scss">
.visa-data-scope-segmented {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: var(--app-spacing-sm);

  &__label {
    font-size: var(--app-font-size-sm);
    color: var(--el-text-color-secondary);
    white-space: nowrap;
  }

  &__group {
    flex: 1 1 auto;
    min-width: 0;
  }
}
</style>
