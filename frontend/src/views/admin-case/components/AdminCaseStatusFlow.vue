<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useI18n } from 'vue-i18n'
import { AdminCaseStatus } from '@/constants/enums'
import { AdminCaseStatusLabel } from '@/constants/enum-labels'
import { updateAdminCaseStatus, getAdminCaseTransitions } from '@/api/admin-case'

defineOptions({ name: 'AdminCaseStatusFlow' })

const props = defineProps<{
  caseId: string
  currentStatus: AdminCaseStatus
}>()

const emit = defineEmits<{
  updated: []
}>()

const transitions = ref<AdminCaseStatus[]>([])
const loading = ref(false)
const transitioning = ref(false)
const { t } = useI18n({ useScope: 'global' })

const isTerminal = computed(
  () =>
    props.currentStatus === AdminCaseStatus.COMPLETED ||
    props.currentStatus === AdminCaseStatus.CANCELLED,
)

const statusSteps = [
  AdminCaseStatus.DRAFT,
  AdminCaseStatus.ACCEPTED,
  AdminCaseStatus.MATERIAL_PENDING,
  AdminCaseStatus.SUBMITTED,
  AdminCaseStatus.APPROVED,
  AdminCaseStatus.COMPLETED,
]

const activeStep = computed(() => {
  const idx = statusSteps.indexOf(props.currentStatus)
  return idx >= 0 ? idx : -1
})

watch(
  () => [props.caseId, props.currentStatus],
  () => fetchTransitions(),
  { immediate: true },
)

async function fetchTransitions() {
  if (!props.caseId) return
  loading.value = true
  try {
    const res = await getAdminCaseTransitions(props.caseId)
    transitions.value = res.data
  } finally {
    loading.value = false
  }
}

function getButtonType(status: AdminCaseStatus): '' | 'primary' | 'success' | 'warning' | 'danger' | 'info' {
  switch (status) {
    case AdminCaseStatus.CANCELLED:
      return 'danger'
    case AdminCaseStatus.COMPLETED:
    case AdminCaseStatus.APPROVED:
      return 'success'
    case AdminCaseStatus.REJECTED:
      return 'danger'
    default:
      return 'primary'
  }
}

async function handleTransition(newStatus: AdminCaseStatus) {
  const label = AdminCaseStatusLabel[newStatus]
  const confirmMsg =
    newStatus === AdminCaseStatus.CANCELLED
      ? t('detailViews.adminCase.statusFlow.confirmCancelled', { status: label })
      : t('detailViews.adminCase.statusFlow.confirmChange', { status: label })

  try {
    await ElMessageBox.confirm(confirmMsg, t('detailViews.adminCase.statusFlow.confirmTitle'), {
      confirmButtonText: t('detailViews.adminCase.statusFlow.confirmButton'),
      cancelButtonText: t('common.cancel'),
      type: newStatus === AdminCaseStatus.CANCELLED ? 'warning' : 'info',
    })
  } catch {
    return
  }

  transitioning.value = true
  try {
    await updateAdminCaseStatus(props.caseId, newStatus)
    ElMessage.success(t('detailViews.adminCase.statusFlow.successMessage', { status: label }))
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
    <div class="status-flow__steps">
      <el-steps :active="activeStep" finish-status="success" simple>
        <el-step
          v-for="step in statusSteps"
          :key="step"
          :title="AdminCaseStatusLabel[step]"
        />
      </el-steps>
    </div>

    <div v-if="currentStatus === AdminCaseStatus.REJECTED" class="status-flow__rejected">
      <el-alert type="error" :closable="false" show-icon>
        {{ t('detailViews.adminCase.statusFlow.rejectedHint') }}
      </el-alert>
    </div>

    <div v-if="!isTerminal && transitions.length > 0" class="status-flow__actions">
      <span class="status-flow__label">{{ t('detailViews.adminCase.statusFlow.nextAction') }}</span>
      <el-button
        v-for="t in transitions"
        :key="t"
        :type="getButtonType(t)"
        :loading="transitioning"
        size="default"
        @click="handleTransition(t)"
      >
        {{ t('detailViews.adminCase.statusFlow.changeTo', { status: AdminCaseStatusLabel[t] }) }}
      </el-button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.status-flow {
  &__steps {
    margin-bottom: 20px;
  }

  &__rejected {
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
}
</style>
