<script setup lang="ts">
import { Refresh } from '@element-plus/icons-vue'
import { computed, type Ref, ref, unref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'

import PageList from '@/components/PageList.vue'
import VisaDataScopeSegmented from '@/components/VisaDataScopeSegmented.vue'
import { useVisaDataScopeRoute } from '@/composables/useVisaDataScopeRoute'
import { VisaReminderTypeLabel } from '@/constants/enum-labels'
import { VisaReminderType } from '@/constants/enums'
import { assignedToFromQuery, reminderTypeFromQuery } from '@/utils/visa-reminder-route-query'
import { VISA_REMINDER_BUCKET_DISPLAY_ORDER } from '@/utils/visa-reminder-type-ui'
import VisaReminderProTablePanel from '@/views/visa/components/VisaReminderProTablePanel.vue'

/** 与 `VisaReminderProTablePanel` 的 `defineExpose` 对齐，供父级读取 `loading` 与 `reload`。 */
interface VisaReminderProTablePanelExposed {
  loading: Ref<boolean>
  reload: () => void | Promise<void>
}

defineOptions({ name: 'VisaReminderListView' })

const route = useRoute()
const { t } = useI18n({ useScope: 'global' })

const {
  dataScopeForApi,
  showScopeSwitch,
  setDataScope,
  selectableScopes,
} = useVisaDataScopeRoute()

const activeFilter = ref<VisaReminderType | ''>(reminderTypeFromQuery(route.query.reminderType))

/** 与路由 `assignedTo` 同步，供 `GET /visa-reminders` 负责人筛选 */
const activeAssignedTo = computed((): string | undefined => assignedToFromQuery(route.query.assignedTo))

const reminderPanelRef = ref<VisaReminderProTablePanelExposed | null>(null)

const reminderTableLoading = computed((): boolean => {
  const panel = reminderPanelRef.value as VisaReminderProTablePanelExposed | null
  return unref(panel?.loading) ?? false
})

watch(
  () => route.query.reminderType,
  (raw) => {
    const next = reminderTypeFromQuery(raw)
    if (next !== activeFilter.value) {
      activeFilter.value = next
    }
  },
)

/**
 * 触发子表格按当前筛选条件重新请求。
 */
function reloadVisaReminders(): void {
  void reminderPanelRef.value?.reload()
}

const visaScopeHintText = computed(() => t('pages.visaReminders.scopeHint'))
</script>

<template>
  <PageList>
    <template v-if="showScopeSwitch" #headerExtra>
      <div class="visa-reminders__header-actions">
        <VisaDataScopeSegmented
          class="visa-reminders__scope"
          :model-value="dataScopeForApi"
          :options="selectableScopes"
          @update:model-value="setDataScope"
        />
      </div>
    </template>

    <el-alert
      type="info"
      :closable="false"
      show-icon
      class="visa-reminders__scope-hint"
    >
      {{ visaScopeHintText }}
    </el-alert>

    <div class="visa-reminders__filter-row">
      <el-radio-group v-model="activeFilter" class="visa-reminders__filter">
        <el-radio-button value="">
          {{ t('pages.visaReminders.filterAll') }}
        </el-radio-button>
        <el-radio-button
          v-for="rt in VISA_REMINDER_BUCKET_DISPLAY_ORDER"
          :key="rt"
          :value="rt"
        >
          {{ VisaReminderTypeLabel[rt] }}
        </el-radio-button>
      </el-radio-group>
      <el-button :icon="Refresh" :loading="reminderTableLoading" @click="reloadVisaReminders">
        {{ t('pages.visaReminders.reload') }}
      </el-button>
    </div>

    <VisaReminderProTablePanel
      ref="reminderPanelRef"
      :data-scope="dataScopeForApi"
      :reminder-type="activeFilter"
      :assigned-to="activeAssignedTo"
    />
  </PageList>
</template>

<style scoped lang="scss">
.visa-reminders {
  &__header-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: var(--app-spacing-sm);
    max-width: 100%;
  }

  &__scope {
    flex: 0 1 auto;
    min-width: 0;
  }

  &__scope-hint {
    margin-bottom: var(--app-spacing-md);
  }

  &__filter-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--app-spacing-sm) var(--app-spacing-md);
    margin-bottom: var(--app-spacing-md);
  }

  &__filter {
    flex: 1 1 auto;
    min-width: 0;
    margin-bottom: 0;
  }
}
</style>
