import type { ComputedRef } from 'vue'
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { VisaDataScope } from '@/constants/enums'
import { useUserStore } from '@/stores/user'
import {
  getMaxAllowedVisaDataScope,
  parseVisaDataScopeQuery,
  resolveEffectiveVisaDataScope,
  selectableVisaDataScopes,
} from '@/utils/visa-data-scope'

/**
 * 在签证域相关页面同步 `dataScope` 与当前路由 query，并按角色权限收窄可选档位与请求参数（P2-S2e）。
 *
 * - 缺省 query 时：宽权限用户等价 `all`；仅本人/团队授权用户会自动写入对应默认 query，避免后端将缺省按 `all` 校验导致 403。
 * - 非法或超出授权的 query 会 `replace` 为合法值。
 *
 * @returns 供列表请求、分段控件与 `router-link` 复用的状态与方法
 */
export function useVisaDataScopeRoute(): {
  maxAllowed: ComputedRef<VisaDataScope>
  selectableScopes: ComputedRef<VisaDataScope[]>
  dataScopeForApi: ComputedRef<VisaDataScope>
  showScopeSwitch: ComputedRef<boolean>
  setDataScope: (scope: VisaDataScope) => void
} {
  const route = useRoute()
  const router = useRouter()
  const userStore = useUserStore()

  const maxAllowed = computed((): VisaDataScope =>
    getMaxAllowedVisaDataScope((code) => userStore.hasPermission(code)),
  )

  const selectableScopes = computed((): VisaDataScope[] =>
    selectableVisaDataScopes(maxAllowed.value),
  )

  const dataScopeForApi = computed((): VisaDataScope =>
    resolveEffectiveVisaDataScope(route.query.dataScope, (code) => userStore.hasPermission(code)),
  )

  const showScopeSwitch = computed((): boolean => selectableScopes.value.length > 1)

  /**
   * 将当前页 query 中的 `dataScope` 更新为指定档位并保留其余 query。
   *
   * @param scope - 目标数据范围（须在 `selectableScopes` 内）
   */
  function setDataScope(scope: VisaDataScope): void {
    void router.replace({
      path: route.path,
      query: { ...route.query, dataScope: scope },
    })
  }

  watch(
    () => [route.path, route.query.dataScope, maxAllowed.value] as const,
    () => {
      const raw = route.query.dataScope
      const parsed = parseVisaDataScopeQuery(raw)
      const clamped = resolveEffectiveVisaDataScope(raw, (code) => userStore.hasPermission(code))

      const invalidInUrl =
        raw !== undefined && raw !== null && raw !== '' && parsed === undefined
      const tooWide = parsed !== undefined && clamped !== parsed
      const needDefaultNarrowUrl =
        maxAllowed.value !== VisaDataScope.ALL &&
        (raw === undefined || raw === null || raw === '')

      if (!(invalidInUrl || tooWide || needDefaultNarrowUrl)) {
        return
      }

      void router.replace({
        path: route.path,
        query: { ...route.query, dataScope: clamped },
      })
    },
    { flush: 'post', immediate: true },
  )

  return {
    maxAllowed,
    selectableScopes,
    dataScopeForApi,
    showScopeSwitch,
    setDataScope,
  }
}
