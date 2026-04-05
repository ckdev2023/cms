<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { getUsers } from '@/api/system'
import type { SystemUser } from '@/types/system'

const props = defineProps<{
  /** 当前路由中的负责人 UUID；打开抽屉时同步为表单草稿 */
  routeAssignedTo?: string
}>()

const emit = defineEmits<{
  /** 用户确认应用：传入负责人 UUID，或 `undefined` 表示清除该条件 */
  apply: [assignedTo: string | undefined]
}>()

defineOptions({ name: 'VisaWorkbenchAdvancedFilterDrawer' })

const visible = defineModel<boolean>({ required: true })

const { t } = useI18n({ useScope: 'global' })

const draftAssignedTo = ref<string | undefined>(undefined)
const staffOptions = ref<{ label: string; value: string }[]>([])
const staffLoading = ref(false)

/**
 * 加载在职用户供负责人下拉使用。
 */
async function loadStaffOptions(): Promise<void> {
  staffLoading.value = true
  try {
    const res = await getUsers({ page: 1, pageSize: 500, status: 'ACTIVE' })
    staffOptions.value = res.data.items.map((u: SystemUser) => ({
      label: u.displayName || u.username,
      value: u.id,
    }))
  } finally {
    staffLoading.value = false
  }
}

watch(
  () => visible.value,
  (open) => {
    if (!open) {
      return
    }
    if (!staffOptions.value.length) {
      void loadStaffOptions()
    }
    draftAssignedTo.value = props.routeAssignedTo
  },
)

/**
 * 将草稿写回路由（由父级监听 `apply` 执行 `router.replace`）并关闭抽屉。
 */
function confirmApply(): void {
  emit('apply', draftAssignedTo.value)
  visible.value = false
}

/**
 * 清除负责人条件并关闭抽屉。
 */
function confirmClearAssignee(): void {
  draftAssignedTo.value = undefined
  emit('apply', undefined)
  visible.value = false
}
</script>

<template>
  <el-drawer
    v-model="visible"
    :title="t('pages.workbenchVisa.advancedFilterTitle')"
    direction="rtl"
    size="min(100%, 400px)"
    destroy-on-close
    class="visa-workbench-advanced-filter-drawer"
  >
    <el-form label-position="top" class="visa-workbench-advanced-filter-drawer__form">
      <el-form-item :label="t('pages.workbenchVisa.advancedFilterAssignee')">
        <el-select
          v-model="draftAssignedTo"
          filterable
          clearable
          :loading="staffLoading"
          :placeholder="t('pages.workbenchVisa.advancedFilterAssigneePlaceholder')"
          style="width: 100%"
        >
          <el-option
            v-for="opt in staffOptions"
            :key="opt.value"
            :label="opt.label"
            :value="opt.value"
          />
        </el-select>
      </el-form-item>
    </el-form>
    <template #footer>
      <div class="visa-workbench-advanced-filter-drawer__footer">
        <el-button @click="visible = false">
          {{ t('common.cancel') }}
        </el-button>
        <el-button v-if="routeAssignedTo" @click="confirmClearAssignee">
          {{ t('pages.workbenchVisa.advancedFilterClearAssignee') }}
        </el-button>
        <el-button type="primary" @click="confirmApply">
          {{ t('pages.workbenchVisa.advancedFilterApply') }}
        </el-button>
      </div>
    </template>
  </el-drawer>
</template>

<style scoped lang="scss">
.visa-workbench-advanced-filter-drawer {
  &__form {
    padding-right: var(--app-spacing-xs);
  }

  &__footer {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: var(--app-spacing-sm);
  }
}
</style>
