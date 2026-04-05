import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { useVisaDataScopeRoute } from '@/composables/useVisaDataScopeRoute'
import { createVisaWorkbenchDerivedSelectors } from '@/composables/useVisaWorkbench.derived'
import { subscribeVisaWorkbenchReloadLifecycle } from '@/composables/useVisaWorkbench.lifecycle'
import { createVisaWorkbenchLoader } from '@/composables/useVisaWorkbench.load'
import type { UseVisaWorkbenchReturn } from '@/composables/useVisaWorkbench.return-types'
import { createVisaWorkbenchScopeCopySelectors } from '@/composables/useVisaWorkbench.scope-copy'
import type { VisaWorkbenchAggregate } from '@/types/visa-case'

export type { UseVisaWorkbenchReturn } from '@/composables/useVisaWorkbench.return-types'

/**
 * 签证工作台页：聚合数据拉取、数据范围与 KPI / 提醒主表配套状态。
 *
 * @returns 供 `VisaWorkbenchView` 模板绑定的状态与方法
 */
export function useVisaWorkbench(): UseVisaWorkbenchReturn {
  const { t } = useI18n({ useScope: 'global' })

  const { dataScopeForApi, showScopeSwitch, setDataScope, selectableScopes } = useVisaDataScopeRoute()

  const loading = ref(false)
  const aggregate = ref<VisaWorkbenchAggregate | null>(null)
  const initialLoadError = ref('')
  const refreshError = ref('')

  const { isWorkbenchBusinessEmpty } = createVisaWorkbenchDerivedSelectors({ aggregate })

  const loadWorkbench = createVisaWorkbenchLoader({
    loading,
    aggregate,
    initialLoadError,
    refreshError,
    dataScopeForApi,
    t,
  })

  const { workbenchEmptyScopeHint, workbenchKpiSectionTitle } = createVisaWorkbenchScopeCopySelectors({
    dataScopeForApi,
    t,
  })

  subscribeVisaWorkbenchReloadLifecycle({
    aggregate,
    dataScopeForApi,
    loadWorkbench,
  })

  return {
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
  }
}
