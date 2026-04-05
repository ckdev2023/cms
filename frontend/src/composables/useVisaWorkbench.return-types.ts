import type { ComputedRef, Ref } from 'vue'

import type { VisaDataScope } from '@/constants/enums'
import type { VisaWorkbenchAggregate } from '@/types/visa-case'

/**
 * `useVisaWorkbench` 的模板绑定契约：聚合状态与 KPI/主表配套文案。
 */
export interface UseVisaWorkbenchReturn {
  aggregate: Ref<VisaWorkbenchAggregate | null>
  dataScopeForApi: ComputedRef<VisaDataScope>
  initialLoadError: Ref<string>
  /** 接口已成功返回且当前数据范围为「业务全域空」，用于信息条（区别于 `initialLoadError`）。 */
  isWorkbenchBusinessEmpty: ComputedRef<boolean>
  loadWorkbench: (options?: { manual?: boolean }) => Promise<void>
  loading: Ref<boolean>
  refreshError: Ref<string>
  selectableScopes: ComputedRef<VisaDataScope[]>
  setDataScope: (scope: VisaDataScope) => void
  showScopeSwitch: ComputedRef<boolean>
  /** 与 `dataScope` 对齐的 KPI 区块标题（本人 / 团队 / 全所） */
  workbenchKpiSectionTitle: ComputedRef<string>
  /** 业务空态提示（随数据范围变化） */
  workbenchEmptyScopeHint: ComputedRef<string>
}
