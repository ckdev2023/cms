<script setup lang="ts">
import { Filter, Refresh } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { computed, ref, unref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import VisaDataScopeSegmented from '@/components/VisaDataScopeSegmented.vue'
import { useVisaWorkbench } from '@/composables/useVisaWorkbench'
import { VisaReminderType } from '@/constants/enums'
import { P } from '@/constants/permissions'
import { useUserStore } from '@/stores/user'
import {
  assignedToFromQuery,
  pickVisaReminderListQueryPreserve,
  reminderTypeFromQuery,
} from '@/utils/visa-reminder-route-query'
import VisaReminderProTablePanel from '@/views/visa/components/VisaReminderProTablePanel.vue'
import VisaWorkbenchAdvancedFilterDrawer from '@/views/visa/components/VisaWorkbenchAdvancedFilterDrawer.vue'
import VisaWorkbenchKpiStrip from '@/views/visa/components/VisaWorkbenchKpiStrip.vue'

defineOptions({ name: 'VisaWorkbenchView' })

const { t } = useI18n({ useScope: 'global' })
const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

/** 全表页需 `visaReminder:list`；仅 `visaCase:list` 进工作台的用户不展示，避免点到 403。 */
const showFullReminderListLink = computed((): boolean => userStore.hasPermission(P.VISA_REMINDER_LIST))

/**
 * 跳转 `/customers/visa-reminders` 时保留 `dataScope`、合法 `assignedTo` 与 `reminderType`，与书签/老路径连续使用一致。
 */
const fullReminderListRouteLocation = computed(() => {
  const query: Record<string, string> = { ...pickVisaReminderListQueryPreserve(route.query) }
  const rt = reminderTypeFromQuery(route.query.reminderType)
  if (rt) {
    query.reminderType = rt
  }
  return { path: '/customers/visa-reminders', query }
})

/** 与 `VisaReminderProTablePanel` 的 `defineExpose` 对齐，供父级读取 `loading` 与 `reload`。 */
interface VisaReminderProTablePanelExposed {
  loading: import('vue').Ref<boolean>
  reload: () => void | Promise<void>
}

const reminderPanelRef = ref<VisaReminderProTablePanelExposed | null>(null)

/** 高级筛选抽屉显隐（负责人 `assignedTo` 写入路由 query） */
const advancedFilterDrawerVisible = ref(false)

const reminderTableLoading = computed((): boolean => {
  const panel = reminderPanelRef.value as VisaReminderProTablePanelExposed | null
  return unref(panel?.loading) ?? false
})

/**
 * 与路由 `reminderType` 同步的提醒桶筛选；写入时 `replace` 并保留 `dataScope`。
 */
const activeReminderFilter = computed({
  get: (): VisaReminderType | '' => reminderTypeFromQuery(route.query.reminderType),
  set: (v: VisaReminderType | '') => {
    replaceWorkbenchReminderType(v)
  },
})

/** 与路由 `assignedTo` 同步的负责人筛选（非法 query 视为未选） */
const activeAssignedToFilter = computed((): string | undefined =>
  assignedToFromQuery(route.query.assignedTo),
)

/**
 * 使用 `replace` 更新当前工作台页 query 的 `reminderType`，并保留 `dataScope`。
 *
 * @param next - 目标提醒桶；空串表示不按桶筛选（从 query 移除 `reminderType`）
 */
function replaceWorkbenchReminderType(next: VisaReminderType | ''): void {
  if (reminderTypeFromQuery(route.query.reminderType) === next) {
    return
  }
  const base = pickVisaReminderListQueryPreserve(route.query)
  const query = next === '' ? { ...base } : { ...base, reminderType: next }
  void router.replace({ path: route.path, query })
}

/**
 * 更新当前工作台 URL 的 `assignedTo` 并保留 `dataScope` 与 `reminderType`。
 *
 * @param next - 负责人用户 UUID；`undefined` 表示从 query 移除该键
 */
function replaceWorkbenchAssignedToInQuery(next: string | undefined): void {
  const query: Record<string, string> = { ...pickVisaReminderListQueryPreserve(route.query) }
  if (next) {
    query.assignedTo = next
  } else {
    delete query.assignedTo
  }
  const rt = reminderTypeFromQuery(route.query.reminderType)
  if (rt) {
    query.reminderType = rt
  }
  void router.replace({ path: route.path, query })
}

/**
 * 高级筛选应用：将负责人条件写入当前工作台 URL。
 *
 * @param next - 负责人用户 UUID；`undefined` 表示移除 query 中的 `assignedTo`
 */
function onAdvancedFilterApply(next: string | undefined): void {
  replaceWorkbenchAssignedToInQuery(next)
}

/**
 * 触发主提醒表按当前路由条件重新请求。
 */
function reloadReminderTable(): void {
  void reminderPanelRef.value?.reload()
}

/**
 * KPI「未指派」chip — MVP 行为（写死）：
 * - 提醒列表接口仅支持 `assignedTo` 为负责人 UUID，无「仅未指派」查询参数；
 * - 路由 `assignedTo` 解析未约定未指派 sentinel，故不修改 `activeReminderFilter`、不写 `assignedTo` query。
 * 后续若后端与 `visa-reminder-route-query` 对齐未指派条件，再改为真实联动。
 */
function onWorkbenchKpiUnassignedMvp(): void {
  ElMessage.info({ message: t('pages.workbenchVisa.kpiUnassignedMvpToast'), duration: 6000 })
}

/**
 * KPI「四分桶以外」chip — MVP 行为（写死）：
 * - 列表 `reminderType` 仅支持四类提醒桶枚举，无 `noBucket`；
 * - 不修改路由 query、不发起带虚构桶参数的列表请求。
 * 用户需在案件登记册或下方「全部」浏览；登记册若日后支持桶维度再衔接。
 */
function onWorkbenchKpiNoBucketMvp(): void {
  ElMessage.info({ message: t('pages.workbenchVisa.kpiNoBucketMvpToast'), duration: 6000 })
}

const {
  aggregate,
  dataScopeForApi,
  initialLoadError,
  isWorkbenchBusinessEmpty,
  loadWorkbench,
  loading,
  refreshError,
  selectableScopes,
  setDataScope,
  showScopeSwitch,
  workbenchEmptyScopeHint,
  workbenchKpiSectionTitle,
} = useVisaWorkbench()
</script>

<template>
  <div class="visa-workbench">
    <header class="visa-workbench__page-head">
      <h1 class="visa-workbench__page-title">
        {{ t('pages.workbenchVisa.pageTitle') }}
      </h1>
      <div v-if="showScopeSwitch" class="visa-workbench__page-head-actions">
        <VisaDataScopeSegmented
          class="visa-workbench__scope"
          :model-value="dataScopeForApi"
          :options="selectableScopes"
          @update:model-value="setDataScope"
        />
      </div>
    </header>

    <div class="visa-workbench__below-head">
      <el-alert
        v-if="refreshError"
        type="error"
        closable
        show-icon
        class="visa-workbench__alert"
        @close="refreshError = ''"
      >
        <div class="visa-workbench__alert-row">
          <span>{{ refreshError }}</span>
          <el-button
            type="primary"
            link
            :loading="loading"
            @click="loadWorkbench({ manual: true })"
          >
            {{ t('pages.workbenchVisa.retryLoad') }}
          </el-button>
        </div>
      </el-alert>

      <div v-if="aggregate" class="visa-workbench__body">
        <div class="visa-workbench__summary">
          <VisaWorkbenchKpiStrip
            :section-title="workbenchKpiSectionTitle"
            :aggregate="aggregate"
            :active-reminder-filter="activeReminderFilter"
            @filter-reminder-type="replaceWorkbenchReminderType"
            @open-unassigned-mvp="onWorkbenchKpiUnassignedMvp"
            @open-no-bucket-mvp="onWorkbenchKpiNoBucketMvp"
          />
        </div>

        <el-alert
          v-if="isWorkbenchBusinessEmpty"
          type="info"
          :closable="false"
          show-icon
          class="visa-workbench__success-empty-hint"
        >
          {{ workbenchEmptyScopeHint }}
        </el-alert>

        <section class="visa-workbench__section visa-workbench__section--reminders">
          <div class="visa-workbench__section-head">
            <h2 class="visa-workbench__section-title">{{ t('pages.workbenchVisa.sectionReminderList') }}</h2>
            <div class="visa-workbench__reminder-toolbar">
              <router-link
                v-if="showFullReminderListLink"
                class="visa-workbench__full-list-link"
                :to="fullReminderListRouteLocation"
                :aria-label="t('pages.workbenchVisa.fullReminderListLinkAria')"
              >
                {{ t('pages.workbenchVisa.fullReminderListLink') }}
              </router-link>
              <el-button
                :icon="Filter"
                :aria-label="t('pages.workbenchVisa.advancedFilter')"
                @click="advancedFilterDrawerVisible = true"
              >
                {{ t('pages.workbenchVisa.advancedFilter') }}
                <el-badge v-if="activeAssignedToFilter" is-dot class="visa-workbench__filter-badge" />
              </el-button>
              <el-button
                type="primary"
                link
                :icon="Refresh"
                :loading="reminderTableLoading"
                @click="reloadReminderTable"
              >
                {{ t('pages.visaReminders.reload') }}
              </el-button>
            </div>
          </div>
          <VisaReminderProTablePanel
            ref="reminderPanelRef"
            :data-scope="dataScopeForApi"
            :reminder-type="activeReminderFilter"
            :assigned-to="activeAssignedToFilter"
          />
        </section>

        <VisaWorkbenchAdvancedFilterDrawer
          v-model="advancedFilterDrawerVisible"
          :route-assigned-to="activeAssignedToFilter"
          @apply="onAdvancedFilterApply"
        />
      </div>

      <div
        v-else-if="loading || initialLoadError"
        class="visa-workbench__state-shell"
        :aria-busy="loading"
      >
        <div
          v-if="loading"
          v-loading="true"
          class="visa-workbench__state-shell-fill visa-workbench__state-shell-fill--loading"
          :element-loading-text="t('pages.workbenchVisa.loadingHint')"
        />
        <div
          v-else
          class="visa-workbench__state-shell-fill visa-workbench__state-shell-fill--error"
          role="alert"
        >
          <p class="visa-workbench__empty-error-title">{{ t('pages.workbenchVisa.loadFailedTitle') }}</p>
          <p class="visa-workbench__empty-error-desc">{{ initialLoadError }}</p>
          <el-button type="primary" :loading="loading" @click="loadWorkbench({ manual: true })">
            {{ t('pages.workbenchVisa.retryLoad') }}
          </el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@import './visa-workbench-view.scss';
</style>
