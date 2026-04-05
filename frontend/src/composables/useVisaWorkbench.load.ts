import { ElMessage } from 'element-plus'
import type { ComputedRef, Ref } from 'vue'
import type { ComposerTranslation } from 'vue-i18n'

import { getVisaWorkbenchAggregate } from '@/api/visa-case'
import type { VisaDataScope } from '@/constants/enums'
import { useVisaWorkbenchHubStore } from '@/stores/visaWorkbenchHub'
import type { ApiResponse } from '@/types'
import type { VisaWorkbenchAggregate } from '@/types/visa-case'
import { pickApiErrorMessage } from '@/utils/api-error-message'

/**
 * 拉取工作台聚合接口并区分首屏失败与手动刷新失败时的错误展示策略。
 *
 * @param params - 聚合拉取入参对象（含 refs、`fetchAggregate` 闭包与 `t`）
 * @param params.manual - 是否为显式刷新触发的加载
 * @param params.loading - 全屏阻塞加载态（仅首屏或手动刷新时置位）
 * @param params.aggregate - 聚合结果 ref
 * @param params.initialLoadError - 首屏失败文案
 * @param params.refreshError - 有存量数据时刷新失败文案
 * @param params.fetchAggregate - 调用后端聚合接口（闭包内绑定 `dataScope`）
 * @param params.dataScope - 本次请求使用的数据范围（与枢纽 store `applyStatsFromFullAggregate` 回写一致）
 * @param params.t - i18n 全局 `t`
 * @returns 无返回值；通过 ref、`useVisaWorkbenchHubStore` 与 `ElMessage` 产生副作用
 */
export async function runVisaWorkbenchAggregateLoad(params: {
  manual: boolean
  loading: Ref<boolean>
  aggregate: Ref<VisaWorkbenchAggregate | null>
  initialLoadError: Ref<string>
  refreshError: Ref<string>
  fetchAggregate: () => Promise<ApiResponse<VisaWorkbenchAggregate>>
  dataScope: VisaDataScope
  t: ComposerTranslation
}): Promise<void> {
  const {
    manual,
    loading,
    aggregate,
    initialLoadError,
    refreshError,
    fetchAggregate,
    dataScope,
    t,
  } = params

  const hadData = aggregate.value !== null
  const blocking = !hadData || manual

  if (blocking) {
    loading.value = true
  }
  refreshError.value = ''
  initialLoadError.value = ''
  try {
    const res = await fetchAggregate()
    aggregate.value = res.data
    refreshError.value = ''
    const hub = useVisaWorkbenchHubStore()
    hub.applyStatsFromFullAggregate(dataScope, res.data.stats)
    if (manual && hadData) {
      ElMessage.success(t('pages.workbenchVisa.refreshSuccess'))
    }
  } catch (e: unknown) {
    const apiMsg = pickApiErrorMessage(e)
    if (hadData) {
      refreshError.value = apiMsg
        ? `${t('pages.workbenchVisa.refreshFailedKeepStale')} ${apiMsg}`
        : t('pages.workbenchVisa.refreshFailedKeepStale')
    } else {
      initialLoadError.value = apiMsg || t('pages.workbenchVisa.loadFailedDescription')
    }
  } finally {
    if (blocking) {
      loading.value = false
    }
  }
}

/**
 * 绑定工作台聚合拉取函数，内部按当前 `dataScopeForApi` 调用 `getVisaWorkbenchAggregate`。
 *
 * @param params - 与 `runVisaWorkbenchAggregateLoad` 对齐的 refs 与 `dataScopeForApi`
 * @param params.loading - 首屏/手动刷新时的阻塞加载态 ref
 * @param params.aggregate - 工作台聚合数据 ref
 * @param params.initialLoadError - 首屏失败提示 ref
 * @param params.refreshError - 有存量数据时刷新失败提示 ref
 * @param params.dataScopeForApi - 请求聚合接口时使用的数据范围
 * @param params.t - 全局 i18n `t`
 * @returns 供模板与生命周期订阅调用的 `loadWorkbench` 函数
 */
export function createVisaWorkbenchLoader(params: {
  loading: Ref<boolean>
  aggregate: Ref<VisaWorkbenchAggregate | null>
  initialLoadError: Ref<string>
  refreshError: Ref<string>
  dataScopeForApi: ComputedRef<VisaDataScope>
  t: ComposerTranslation
}): (options?: { manual?: boolean }) => Promise<void> {
  const {
    loading,
    aggregate,
    initialLoadError,
    refreshError,
    dataScopeForApi,
    t,
  } = params

  return async (options?: { manual?: boolean }): Promise<void> => {
    await runVisaWorkbenchAggregateLoad({
      manual: options?.manual ?? false,
      loading,
      aggregate,
      initialLoadError,
      refreshError,
      fetchAggregate: () =>
        getVisaWorkbenchAggregate({
          previewLimit: 8,
          dataScope: dataScopeForApi.value,
        }),
      dataScope: dataScopeForApi.value,
      t,
    })
  }
}
