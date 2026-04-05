import { computed, type ComputedRef, type Ref } from 'vue'

import type { VisaWorkbenchAggregate } from '@/types/visa-case'
import { isVisaWorkbenchAggregateBusinessEmpty } from '@/utils/visa-workbench-aggregate-empty'

/**
 * 由聚合 ref 推导工作台「业务全域空」信息条用布尔值。
 *
 * @param params - 依赖注入
 * @param params.aggregate - 工作台聚合载荷 ref
 * @returns `isWorkbenchBusinessEmpty` 计算属性
 */
export function createVisaWorkbenchDerivedSelectors(params: {
  aggregate: Ref<VisaWorkbenchAggregate | null>
}): {
  isWorkbenchBusinessEmpty: ComputedRef<boolean>
} {
  const { aggregate } = params

  const isWorkbenchBusinessEmpty = computed((): boolean =>
    aggregate.value !== null ? isVisaWorkbenchAggregateBusinessEmpty(aggregate.value) : false,
  )

  return {
    isWorkbenchBusinessEmpty,
  }
}
