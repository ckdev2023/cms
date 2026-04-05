<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { getAdminCaseTransitions, updateAdminCaseStatus } from '@/api/admin-case'
import { AdminCaseStatusLabel } from '@/constants/enum-labels'
import { AdminCaseStatus } from '@/constants/enums'

const props = defineProps<{
  caseId: string
  currentStatus: AdminCaseStatus
}>()

const emit = defineEmits<{
  updated: []
}>()

defineOptions({ name: 'AdminCaseStatusFlow' })

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

/**
 * 根据当前案件状态加载可执行的下一步流转列表。
 *
 * @returns 在请求完成后同步更新按钮区的可流转状态集合
 */
async function fetchTransitions() {
  if (!props.caseId) {return}
  loading.value = true
  try {
    const res = await getAdminCaseTransitions(props.caseId)
    transitions.value = res.data
  } finally {
    loading.value = false
  }
}

/**
 * 为不同目标状态生成统一的按钮视觉等级。
 *
 * @param status - 用户准备切换到的案件状态
 * @returns 对应 Element Plus 按钮的 type 值
 */
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

/**
 * 确认并提交案件状态流转请求。
 *
 * 取消类流转会显示更高风险提示；成功后通知父级刷新详情数据。
 *
 * @param newStatus - 用户选中的目标案件状态
 * @returns 在用户取消确认或请求结束后完成处理流程
 */
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
        v-for="status in transitions"
        :key="status"
        :type="getButtonType(status)"
        :loading="transitioning"
        size="default"
        @click="handleTransition(status)"
      >
        {{ t('detailViews.adminCase.statusFlow.changeTo', { status: AdminCaseStatusLabel[status] }) }}
      </el-button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.status-flow {
  &__steps {
    margin-bottom: var(--app-spacing-lg);
  }

  &__rejected {
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
}
</style>
