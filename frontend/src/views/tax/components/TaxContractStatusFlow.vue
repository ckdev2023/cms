<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  getTaxContractTransitions,
  updateTaxContractStatus,
} from '@/api/tax'
import { TaxContractStatusLabel } from '@/constants/enum-labels'
import { TaxContractStatus } from '@/constants/enums'

const props = defineProps<{
  contractId: string
  currentStatus: TaxContractStatus
}>()

const emit = defineEmits<{
  updated: []
}>()

defineOptions({ name: 'TaxContractStatusFlow' })

const transitions = ref<TaxContractStatus[]>([])
const loading = ref(false)
const transitioning = ref(false)
const { t } = useI18n({ useScope: 'global' })

const isTerminal = computed(
  () => props.currentStatus === TaxContractStatus.TERMINATED,
)

watch(
  () => [props.contractId, props.currentStatus],
  () => fetchTransitions(),
  { immediate: true },
)

/**
 * 拉取当前状态下允许的税务合约状态流转选项。
 *
 * @returns 完成请求后更新可执行流转按钮列表
 */
async function fetchTransitions() {
  if (!props.contractId) {return}
  loading.value = true
  try {
    const res = await getTaxContractTransitions(props.contractId)
    transitions.value = res.data
  } finally {
    loading.value = false
  }
}

/**
 * 将目标合约状态映射为操作按钮的视觉类型。
 *
 * @param status 目标税务合约状态
 * @returns Element Plus 按钮类型
 */
function getButtonType(
  status: TaxContractStatus,
): '' | 'primary' | 'success' | 'warning' | 'danger' | 'info' {
  switch (status) {
    case TaxContractStatus.TERMINATED:
      return 'danger'
    case TaxContractStatus.ACTIVE:
      return 'success'
    case TaxContractStatus.EXPIRED:
      return 'warning'
    default:
      return 'primary'
  }
}

/**
 * 确认并提交税务合约状态流转。
 *
 * @param newStatus 用户选择的目标状态
 * @returns 用户取消时提前结束；成功流转后通知父层刷新详情
 */
async function handleTransition(newStatus: TaxContractStatus) {
  const label = TaxContractStatusLabel[newStatus]
  const confirmMsg =
    newStatus === TaxContractStatus.TERMINATED
      ? t('detailViews.taxContract.statusFlow.confirmTerminated', { status: label })
      : t('detailViews.taxContract.statusFlow.confirmChange', { status: label })

  try {
    await ElMessageBox.confirm(confirmMsg, t('detailViews.taxContract.statusFlow.confirmTitle'), {
      confirmButtonText: t('detailViews.taxContract.statusFlow.confirmButton'),
      cancelButtonText: t('common.cancel'),
      type:
        newStatus === TaxContractStatus.TERMINATED ? 'warning' : 'info',
    })
  } catch {
    return
  }

  transitioning.value = true
  try {
    await updateTaxContractStatus(props.contractId, newStatus)
    ElMessage.success(t('detailViews.taxContract.statusFlow.successMessage', { status: label }))
    emit('updated')
  } catch {
    // handled by interceptor
  } finally {
    transitioning.value = false
  }
}
</script>

<template>
  <div class="status-flow">
    <div class="status-flow__current">
      <span class="status-flow__label">{{ t('detailViews.taxContract.statusFlow.currentStatus') }}</span>
      <el-tag
        :type="
          currentStatus === TaxContractStatus.ACTIVE
            ? 'success'
            : currentStatus === TaxContractStatus.EXPIRED
              ? 'warning'
              : 'danger'
        "
      >
        {{ TaxContractStatusLabel[currentStatus] }}
      </el-tag>
    </div>

    <div
      v-if="!isTerminal && transitions.length > 0"
      class="status-flow__actions"
    >
      <span class="status-flow__label">{{ t('detailViews.taxContract.statusFlow.nextAction') }}</span>
      <el-button
        v-for="status in transitions"
        :key="status"
        :type="getButtonType(status)"
        :loading="transitioning"
        size="default"
        @click="handleTransition(status)"
      >
        {{ t('detailViews.taxContract.statusFlow.changeTo', { status: TaxContractStatusLabel[status] }) }}
      </el-button>
    </div>

    <div v-if="isTerminal" class="status-flow__terminal">
      <el-alert type="info" :closable="false" show-icon>
        {{ t('detailViews.taxContract.statusFlow.terminalHint') }}
      </el-alert>
    </div>
  </div>
</template>

<style scoped lang="scss">
.status-flow {
  &__current {
    display: flex;
    align-items: center;
    gap: var(--app-spacing-sm);
    margin-bottom: var(--app-spacing-base);
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: var(--app-spacing-sm);
    flex-wrap: wrap;
  }

  &__label {
    font-size: var(--app-font-size-base);
    color: var(--app-text-regular);
    white-space: nowrap;
  }

  &__terminal {
    margin-top: var(--app-spacing-sm);
  }
}
</style>
