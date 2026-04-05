<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  getInvoiceTransitions,
  updateInvoiceStatus,
  voidInvoice,
} from '@/api/invoice'
import { useConfirm } from '@/composables/useConfirm'
import { useSubmitLock } from '@/composables/useSubmitLock'
import { InvoiceStatusLabel } from '@/constants/enum-labels'
import { InvoiceStatus } from '@/constants/enums'

const props = defineProps<{
  invoiceId: string
  currentStatus: InvoiceStatus
}>()

const emit = defineEmits<{
  updated: []
}>()

defineOptions({ name: 'InvoiceStatusFlow' })

const transitions = ref<InvoiceStatus[]>([])
const { submitting, withLock } = useSubmitLock()
const { confirm } = useConfirm()
const showVoidDialog = ref(false)
const voidReason = ref('')
const { t } = useI18n({ useScope: 'global' })

watch(
  () => [props.invoiceId, props.currentStatus],
  () => {
    void fetchTransitions()
  },
  { immediate: true },
)

/**
 * 根据当前发票状态重新加载允许执行的下一步动作，避免状态流转按钮滞后。
 */
async function fetchTransitions() {
  try {
    const res = await getInvoiceTransitions(props.invoiceId)
    transitions.value = res.data
  } catch {
    transitions.value = []
  }
}

/**
 * 确认后推进发票状态；如果目标状态是作废，则先打开作废原因弹窗。
 *
 * @param target - 用户准备切换到的目标发票状态
 */
async function handleTransition(target: InvoiceStatus) {
  if (target === InvoiceStatus.VOID) {
    showVoidDialog.value = true
    return
  }

  const label = InvoiceStatusLabel[target]
  const ok = await confirm({
    title: t('detailViews.invoice.statusFlow.confirmTitle'),
    message: t('detailViews.invoice.statusFlow.confirmChange', { status: label }),
  })
  if (!ok) {return}

  await withLock(async () => {
    await updateInvoiceStatus(props.invoiceId, target)
    ElMessage.success(t('detailViews.invoice.statusFlow.successMessage', { status: label }))
    emit('updated')
  })
}

function resetVoidDialog(): void {
  showVoidDialog.value = false
  voidReason.value = ''
}

/**
 * 校验作废原因后提交作废请求，并在成功后关闭弹窗与通知父组件刷新。
 */
async function handleVoid() {
  const reason = voidReason.value.trim()
  if (!reason) {
    ElMessage.warning(t('detailViews.invoice.statusFlow.voidReasonRequired'))
    return
  }

  await withLock(async () => {
    await voidInvoice(props.invoiceId, { voidReason: reason })
    ElMessage.success(t('detailViews.invoice.statusFlow.successMessage', { status: InvoiceStatusLabel[InvoiceStatus.VOID] }))
    resetVoidDialog()
    emit('updated')
  })
}

const statusSteps: InvoiceStatus[] = [
  InvoiceStatus.DRAFT,
  InvoiceStatus.SENT,
  InvoiceStatus.PARTIAL,
  InvoiceStatus.PAID,
]

/**
 * 根据当前状态计算步骤条上每个节点的展示状态。
 *
 * @param step - 步骤条中的目标状态节点
 * @returns Element Plus Steps 组件需要的状态标识
 */
function stepStatus(step: InvoiceStatus): 'finish' | 'process' | 'wait' | 'error' {
  if (props.currentStatus === InvoiceStatus.VOID) {return 'error'}
  const currentIdx = statusSteps.indexOf(props.currentStatus)
  const stepIdx = statusSteps.indexOf(step)
  if (stepIdx < currentIdx) {return 'finish'}
  if (stepIdx === currentIdx) {return 'process'}
  return 'wait'
}

/**
 * 为不同目标状态分配按钮色彩，突出关键动作并弱化普通流转。
 *
 * @param target - 即将触发的目标状态
 * @returns 状态操作按钮对应的 Element Plus 类型
 */
function buttonType(target: InvoiceStatus): '' | 'success' | 'danger' | 'warning' | 'primary' {
  if (target === InvoiceStatus.VOID) {return 'danger'}
  if (target === InvoiceStatus.SENT) {return 'primary'}
  if (target === InvoiceStatus.PAID) {return 'success'}
  return ''
}
</script>

<template>
  <div class="invoice-status-flow">
    <div class="status-steps">
      <el-steps :active="statusSteps.indexOf(currentStatus)" align-center>
        <el-step
          v-for="step in statusSteps"
          :key="step"
          :title="InvoiceStatusLabel[step]"
          :status="stepStatus(step)"
        />
      </el-steps>
      <div v-if="currentStatus === InvoiceStatus.VOID" class="void-badge">
        <el-tag type="danger" size="large" effect="dark">{{ t('detailViews.invoice.statusFlow.voidTag') }}</el-tag>
      </div>
    </div>

    <div v-if="transitions.length > 0" class="status-actions">
      <span class="status-actions__label">{{ t('detailViews.invoice.statusFlow.actionLabel') }}</span>
      <el-button
        v-for="status in transitions"
        :key="status"
        :type="buttonType(status)"
        :loading="submitting"
        size="small"
        @click="handleTransition(status)"
      >
        {{ t('detailViews.invoice.statusFlow.changeTo', { status: InvoiceStatusLabel[status] }) }}
      </el-button>
    </div>

    <el-dialog
      v-model="showVoidDialog"
      :title="t('detailViews.invoice.statusFlow.voidDialogTitle')"
      width="500px"
      destroy-on-close
    >
      <el-alert
        type="warning"
        :closable="false"
        show-icon
        style="margin-bottom: var(--app-spacing-base)"
      >
        {{ t('detailViews.invoice.statusFlow.voidIrreversible') }}
      </el-alert>
      <el-form label-width="100px">
        <el-form-item :label="t('detailViews.invoice.voidReason')" required>
          <el-input
            v-model="voidReason"
            type="textarea"
            :rows="3"
            :placeholder="t('detailViews.invoice.statusFlow.voidReasonRequired')"
            maxlength="500"
            show-word-limit
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="resetVoidDialog">{{ t('common.cancel') }}</el-button>
        <el-button type="danger" :loading="submitting" @click="handleVoid">
          {{ t('detailViews.invoice.statusFlow.voidAction') }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.invoice-status-flow {
  padding: var(--app-spacing-base) 0;
}

.status-steps {
  position: relative;
  margin-bottom: var(--app-spacing-xl);
}

.void-badge {
  position: absolute;
  top: 0;
  right: 0;
}

.status-actions {
  display: flex;
  align-items: center;
  gap: var(--app-spacing-sm);
  padding-top: var(--app-spacing-sm);
  border-top: 1px solid var(--app-border-color-light);

  &__label {
    font-size: var(--app-font-size-base);
    color: var(--app-text-secondary);
    white-space: nowrap;
  }
}
</style>
