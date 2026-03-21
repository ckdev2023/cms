<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

defineOptions({ name: 'ProDrawer' })

interface Props {
  modelValue: boolean
  title?: string
  size?: string | number
  loading?: boolean
  showFooter?: boolean
  confirmText?: string
  cancelText?: string
  confirmLoading?: boolean
  direction?: 'rtl' | 'ltr' | 'ttb' | 'btt'
  destroyOnClose?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  title: '',
  size: '500px',
  loading: false,
  showFooter: true,
  confirmText: undefined,
  cancelText: undefined,
  confirmLoading: false,
  direction: 'rtl',
  destroyOnClose: true,
})
const { t } = useI18n({ useScope: 'global' })
const resolvedConfirmText = computed(() => props.confirmText || t('common.confirm'))
const resolvedCancelText = computed(() => props.cancelText || t('common.cancel'))

const emit = defineEmits<{
  'update:modelValue': [val: boolean]
  confirm: []
  cancel: []
}>()

function handleClose() {
  emit('update:modelValue', false)
  emit('cancel')
}

function handleConfirm() {
  emit('confirm')
}
</script>

<template>
  <el-drawer
    :model-value="modelValue"
    :title="title"
    :size="size"
    :direction="direction"
    :destroy-on-close="destroyOnClose"
    @close="handleClose"
  >
    <template v-if="$slots.header" #header>
      <slot name="header" />
    </template>

    <div v-loading="loading" class="pro-drawer__body">
      <slot />
    </div>

    <template v-if="showFooter" #footer>
      <slot name="footer">
        <el-button @click="handleClose">{{ resolvedCancelText }}</el-button>
        <el-button
          type="primary"
          :loading="confirmLoading"
          @click="handleConfirm"
        >
          {{ resolvedConfirmText }}
        </el-button>
      </slot>
    </template>
  </el-drawer>
</template>

<style scoped lang="scss">
.pro-drawer__body {
  height: 100%;
}
</style>
