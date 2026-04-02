<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

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

const emit = defineEmits<{
  'update:modelValue': [val: boolean]
  confirm: []
  cancel: []
}>()

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

const { t } = useI18n({ useScope: 'global' })
const resolvedConfirmText = computed(() => props.confirmText || t('common.confirm'))
const resolvedCancelText = computed(() => props.cancelText || t('common.cancel'))

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
    class="pro-drawer"
    @close="handleClose"
  >
    <template v-if="$slots.header" #header>
      <slot name="header" />
    </template>

    <div class="pro-drawer__body">
      <template v-if="loading">
        <el-skeleton animated :rows="6" />
      </template>
      <template v-else>
        <slot />
      </template>
    </div>

    <template v-if="showFooter" #footer>
      <slot name="footer">
        <div class="pro-drawer__footer-actions">
          <el-button @click="handleClose">{{ resolvedCancelText }}</el-button>
          <el-button
            type="primary"
            :loading="confirmLoading"
            @click="handleConfirm"
          >
            {{ resolvedConfirmText }}
          </el-button>
        </div>
      </slot>
    </template>
  </el-drawer>
</template>

<style scoped lang="scss">
.pro-drawer__body {
  height: 100%;
  overflow-y: auto;

  :deep(.el-form) {
    .el-form-item:last-child {
      margin-bottom: 0;
    }
  }

  :deep(.el-descriptions) {
    --el-descriptions-item-bordered-label-background: var(--app-bg-page);
  }

  :deep(.el-card + .el-card) {
    margin-top: var(--app-spacing-base);
  }

  :deep(.el-divider) {
    margin: var(--app-spacing-lg) 0;
    border-top-color: var(--app-border-color-light);
  }
}

.pro-drawer__footer-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--app-spacing-sm);

  :deep(.el-button + .el-button) {
    margin-left: 0;
  }
}
</style>
