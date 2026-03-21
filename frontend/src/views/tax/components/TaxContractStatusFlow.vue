<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useI18n } from 'vue-i18n'
import { TaxContractStatus } from '@/constants/enums'
import { TaxContractStatusLabel } from '@/constants/enum-labels'
import {
  updateTaxContractStatus,
  getTaxContractTransitions,
} from '@/api/tax'

defineOptions({ name: 'TaxContractStatusFlow' })

const props = defineProps<{
  contractId: string
  currentStatus: TaxContractStatus
}>()

const emit = defineEmits<{
  updated: []
}>()

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

async function fetchTransitions() {
  if (!props.contractId) return
  loading.value = true
  try {
    const res = await getTaxContractTransitions(props.contractId)
    transitions.value = res.data
  } finally {
    loading.value = false
  }
}

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
        v-for="t in transitions"
        :key="t"
        :type="getButtonType(t)"
        :loading="transitioning"
        size="default"
        @click="handleTransition(t)"
      >
        {{ t('detailViews.taxContract.statusFlow.changeTo', { status: TaxContractStatusLabel[t] }) }}
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
    gap: 8px;
    margin-bottom: 16px;
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  &__label {
    font-size: 14px;
    color: #606266;
    white-space: nowrap;
  }

  &__terminal {
    margin-top: 8px;
  }
}
</style>
