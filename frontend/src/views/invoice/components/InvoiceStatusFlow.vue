<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { useI18n } from 'vue-i18n'
import { InvoiceStatus } from '@/constants/enums'
import { InvoiceStatusLabel } from '@/constants/enum-labels'
import {
  getInvoiceTransitions,
  updateInvoiceStatus,
  voidInvoice,
} from '@/api/invoice'
import { useSubmitLock } from '@/composables/useSubmitLock'
import { useConfirm } from '@/composables/useConfirm'

defineOptions({ name: 'InvoiceStatusFlow' })

const props = defineProps<{
  invoiceId: string
  currentStatus: InvoiceStatus
}>()

const emit = defineEmits<{
  updated: []
}>()

const transitions = ref<InvoiceStatus[]>([])
const { submitting, withLock } = useSubmitLock()
const { confirm } = useConfirm()
const showVoidDialog = ref(false)
const voidReason = ref('')
const { t } = useI18n({ useScope: 'global' })

onMounted(fetchTransitions)

async function fetchTransitions() {
  try {
    const res = await getInvoiceTransitions(props.invoiceId)
    transitions.value = res.data
  } catch {
    transitions.value = []
  }
}

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
  if (!ok) return

  await withLock(async () => {
    await updateInvoiceStatus(props.invoiceId, target)
    ElMessage.success(t('detailViews.invoice.statusFlow.successMessage', { status: label }))
    emit('updated')
  })
}

async function handleVoid() {
  if (!voidReason.value.trim()) {
    ElMessage.warning(t('detailViews.invoice.statusFlow.voidReasonRequired'))
    return
  }

  await withLock(async () => {
    await voidInvoice(props.invoiceId, { voidReason: voidReason.value })
    ElMessage.success(t('detailViews.invoice.statusFlow.successMessage', { status: InvoiceStatusLabel[InvoiceStatus.VOID] }))
    showVoidDialog.value = false
    voidReason.value = ''
    emit('updated')
  })
}

const statusSteps: InvoiceStatus[] = [
  InvoiceStatus.DRAFT,
  InvoiceStatus.SENT,
  InvoiceStatus.PARTIAL,
  InvoiceStatus.PAID,
]

function stepStatus(step: InvoiceStatus): 'finish' | 'process' | 'wait' | 'error' {
  if (props.currentStatus === InvoiceStatus.VOID) return 'error'
  const currentIdx = statusSteps.indexOf(props.currentStatus)
  const stepIdx = statusSteps.indexOf(step)
  if (stepIdx < currentIdx) return 'finish'
  if (stepIdx === currentIdx) return 'process'
  return 'wait'
}

function buttonType(target: InvoiceStatus): '' | 'success' | 'danger' | 'warning' | 'primary' {
  if (target === InvoiceStatus.VOID) return 'danger'
  if (target === InvoiceStatus.SENT) return 'primary'
  if (target === InvoiceStatus.PAID) return 'success'
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
        v-for="t in transitions"
        :key="t"
        :type="buttonType(t)"
        :loading="submitting"
        size="small"
        @click="handleTransition(t)"
      >
        {{ t('detailViews.invoice.statusFlow.changeTo', { status: InvoiceStatusLabel[t] }) }}
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
        style="margin-bottom: 16px"
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
        <el-button @click="showVoidDialog = false">{{ t('common.cancel') }}</el-button>
        <el-button type="danger" :loading="submitting" @click="handleVoid">
          {{ t('detailViews.invoice.statusFlow.voidAction') }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.invoice-status-flow {
  padding: 16px 0;
}

.status-steps {
  position: relative;
  margin-bottom: 24px;
}

.void-badge {
  position: absolute;
  top: 0;
  right: 0;
}

.status-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 8px;
  border-top: 1px solid #ebeef5;

  &__label {
    font-size: 14px;
    color: #909399;
    white-space: nowrap;
  }
}
</style>
