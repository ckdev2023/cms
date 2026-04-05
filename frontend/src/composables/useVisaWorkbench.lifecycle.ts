import { type ComputedRef, onActivated, type Ref,watch } from 'vue'

import type { VisaDataScope } from '@/constants/enums'
import type { VisaWorkbenchAggregate } from '@/types/visa-case'

/**
 * 订阅 `dataScope` 变化与 `onActivated` 时自动刷新工作台聚合。
 *
 * @param params - 生命周期依赖
 * @param params.dataScopeForApi - 当前 API 数据范围
 * @param params.loadWorkbench - 聚合拉取函数
 * @param params.aggregate - 用于判断激活时是否跳过冷启动重复请求
 * @returns void（仅注册副作用）
 */
export function subscribeVisaWorkbenchReloadLifecycle(params: {
  aggregate: Ref<VisaWorkbenchAggregate | null>
  dataScopeForApi: ComputedRef<VisaDataScope>
  loadWorkbench: (options?: { manual?: boolean }) => Promise<void>
}): void {
  const { aggregate, dataScopeForApi, loadWorkbench } = params

  watch(
    dataScopeForApi,
    () => {
      void loadWorkbench()
    },
    { immediate: true },
  )

  onActivated(() => {
    if (aggregate.value !== null) {
      void loadWorkbench()
    }
  })
}
