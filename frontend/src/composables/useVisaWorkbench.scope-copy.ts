import { computed, type ComputedRef } from 'vue'

import { VisaDataScope } from '@/constants/enums'

type WorkbenchScopeI18nSuffix = 'Mine' | 'Team' | 'All'

/**
 * 将签证数据范围映射为 `pages.workbenchVisa.*{Suffix}` 文案键后缀。
 *
 * @param scope - 当前路由解析后的签证数据范围
 * @returns `Mine` / `Team` / `All`
 */
export function visaWorkbenchScopeI18nSuffix(scope: VisaDataScope): WorkbenchScopeI18nSuffix {
  if (scope === VisaDataScope.MINE) {return 'Mine'}
  if (scope === VisaDataScope.TEAM) {return 'Team'}
  return 'All'
}

/**
 * 按 `dataScope` 生成工作台 KPI 标题与空态提示的 computed 文案。
 *
 * @param params - 依赖注入
 * @param params.dataScopeForApi - 与路由、接口一致的数据范围
 * @param params.t - 全局 i18n 翻译函数
 * @returns 供 `VisaWorkbenchView` 模板绑定的文案 computed
 */
export function createVisaWorkbenchScopeCopySelectors(params: {
  dataScopeForApi: ComputedRef<VisaDataScope>
  t: (key: string) => string
}): {
  workbenchEmptyScopeHint: ComputedRef<string>
  workbenchKpiSectionTitle: ComputedRef<string>
} {
  const { dataScopeForApi, t } = params
  const suf = (): WorkbenchScopeI18nSuffix => visaWorkbenchScopeI18nSuffix(dataScopeForApi.value)

  const workbenchKpiSectionTitle = computed(() => t(`pages.workbenchVisa.sectionKpi${suf()}`))
  const workbenchEmptyScopeHint = computed(() => t(`pages.workbenchVisa.emptyWorkbenchScopeHint${suf()}`))

  return {
    workbenchEmptyScopeHint,
    workbenchKpiSectionTitle,
  }
}
