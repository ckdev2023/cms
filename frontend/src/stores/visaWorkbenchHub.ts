import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { getVisaWorkbenchAggregate } from '@/api/visa-case'
import { VisaDataScope } from '@/constants/enums'
import type { VisaDomainStats } from '@/types/visa-case'

/**
 * 同一 `VisaDataScope` 下两次枢纽拉取之间的最短间隔（毫秒），用于减轻 `GET /workbench/visa` 压力。
 */
const VISA_WORKBENCH_HUB_MIN_FETCH_INTERVAL_MS = 60_000

/**
 * 初始化各档位的节流时间戳表（未发起过请求时为 `undefined`）。
 *
 * @returns `mine` / `team` / `all` 三键均为 `undefined` 的记录表
 */
function createEmptyScopeThrottleMap(): Record<VisaDataScope, number | undefined> {
  return {
    [VisaDataScope.MINE]: undefined,
    [VisaDataScope.TEAM]: undefined,
    [VisaDataScope.ALL]: undefined,
  }
}

/**
 * 判断指定 scope 距上次发起请求是否仍处于枢纽最小拉取间隔内。
 *
 * @param map - 各档位上次请求开始时间
 * @param dataScope - 目标数据范围
 * @param nowMs - 当前时间戳
 * @returns 应跳过节流后的重复请求时返回 true
 */
function isHubScopeThrottled(
  map: Record<VisaDataScope, number | undefined>,
  dataScope: VisaDataScope,
  nowMs: number,
): boolean {
  const lastAt = map[dataScope]
  if (lastAt === undefined) {
    return false
  }
  return nowMs - lastAt < VISA_WORKBENCH_HUB_MIN_FETCH_INTERVAL_MS
}

/**
 * 发起仅统计的工作台聚合请求并在 generation 仍最新时写回成功或失败副作用。
 *
 * @param params - 拉取上下文（含并发代与状态写入闭包）
 * @param params.dataScope - 请求携带的 `dataScope`
 * @param params.generation - 本次请求的并发代
 * @param params.getLatestGeneration - 读取 store 内最新并发代
 * @param params.setLoading - 设置加载态
 * @param params.onSuccess - 成功且未过期时更新统计与成功标记
 * @param params.onFailure - 失败且未过期时置失败标记
 * @returns Promise；解析完成后 resolve，不向上抛出网络或业务异常
 */
async function runVisaWorkbenchHubAggregateLoad(params: {
  dataScope: VisaDataScope
  generation: number
  getLatestGeneration: () => number
  setLoading: (value: boolean) => void
  onSuccess: (next: VisaDomainStats) => void
  onFailure: () => void
}): Promise<void> {
  const {
    dataScope,
    generation,
    getLatestGeneration,
    setLoading,
    onSuccess,
    onFailure,
  } = params

  setLoading(true)
  try {
    const res = await getVisaWorkbenchAggregate({
      dataScope,
      previewLimit: 0,
    })
    if (generation !== getLatestGeneration()) {
      return
    }
    onSuccess(res.data.stats)
  } catch (e: unknown) {
    if (generation !== getLatestGeneration()) {
      return
    }
    onFailure()
    console.warn('[visaWorkbenchHub] fetchAggregateStatsOnly failed', e)
  } finally {
    if (generation === getLatestGeneration()) {
      setLoading(false)
    }
  }
}

/**
 * 管理客户中心枢纽与工作台页共享的签证工作台**仅统计**聚合缓存（`previewLimit: 0`）。
 *
 * 失败时不抛错、不弹全局消息；`fetchFailed` 置位供 Tab 副标题回退静态文案，成功则清除失败标记。
 *
 * @returns 含 `stats`、`fetchedAt`、节流拉取 action 的 Pinia store 实例
 */
export const useVisaWorkbenchHubStore = defineStore('visaWorkbenchHub', () => {
  const stats = ref<VisaDomainStats | null>(null)
  const fetchedAt = ref<number | null>(null)
  const lastSuccessfulDataScope = ref<VisaDataScope | null>(null)
  const fetchFailed = ref(false)
  const loading = ref(false)

  const lastFetchStartedAtMsByScope = ref<Record<VisaDataScope, number | undefined>>(
    createEmptyScopeThrottleMap(),
  )

  let latestFetchGeneration = 0

  const reminderBuckets = computed(() => stats.value?.reminderBuckets ?? null)

  /**
   * 在节流与并发安全前提下调用 `GET /workbench/visa`（`previewLimit: 0`）并刷新枢纽统计缓存。
   *
   * 副作用：成功时更新 `stats` / `fetchedAt` / `lastSuccessfulDataScope`；失败时置 `fetchFailed` 并 `console.warn`，不抛出异常。
   *
   * @param dataScope - 与 `useVisaDataScopeRoute` / `clampVisaDataScope` 一致的请求范围
   * @param options - 可选行为覆盖
   * @param options.force - 为 `true` 时跳过 60s 节流
   * @returns Promise；无论成功或失败均 resolve
   */
  async function fetchAggregateStatsOnly(
    dataScope: VisaDataScope,
    options?: { force?: boolean },
  ): Promise<void> {
    const nowMs = Date.now()
    if (!options?.force && isHubScopeThrottled(lastFetchStartedAtMsByScope.value, dataScope, nowMs)) {
      return
    }

    lastFetchStartedAtMsByScope.value = {
      ...lastFetchStartedAtMsByScope.value,
      [dataScope]: nowMs,
    }

    const generation = ++latestFetchGeneration

    await runVisaWorkbenchHubAggregateLoad({
      dataScope,
      generation,
      getLatestGeneration: () => latestFetchGeneration,
      setLoading: (value) => {
        loading.value = value
      },
      onSuccess: (next) => {
        stats.value = next
        fetchedAt.value = Date.now()
        lastSuccessfulDataScope.value = dataScope
        fetchFailed.value = false
      },
      onFailure: () => {
        const haveScopeStats =
          stats.value !== null && lastSuccessfulDataScope.value === dataScope
        if (!haveScopeStats) {
          fetchFailed.value = true
        }
      },
    })
  }

  /**
   * 将工作台全量聚合结果中的统计部分写入枢纽缓存，仅在 scope 与当前路由有效范围一致时用于去重。
   *
   * @param dataScope - 本次聚合请求使用的数据范围
   * @param nextStats - 接口返回的 `VisaWorkbenchAggregate.stats`
   * @returns void
   */
  function applyStatsFromFullAggregate(dataScope: VisaDataScope, nextStats: VisaDomainStats): void {
    latestFetchGeneration += 1
    stats.value = nextStats
    fetchedAt.value = Date.now()
    lastSuccessfulDataScope.value = dataScope
    fetchFailed.value = false
    const nowMs = Date.now()
    lastFetchStartedAtMsByScope.value = {
      ...lastFetchStartedAtMsByScope.value,
      [dataScope]: nowMs,
    }
  }

  /**
   * 清空枢纽缓存与节流表，用于登出或切换账号等需要丢弃旧摘要的场景。
   *
   * @returns void
   */
  function resetHubSummary(): void {
    stats.value = null
    fetchedAt.value = null
    lastSuccessfulDataScope.value = null
    fetchFailed.value = false
    loading.value = false
    lastFetchStartedAtMsByScope.value = createEmptyScopeThrottleMap()
    latestFetchGeneration += 1
  }

  return {
    stats,
    fetchedAt,
    lastSuccessfulDataScope,
    fetchFailed,
    loading,
    reminderBuckets,
    fetchAggregateStatsOnly,
    applyStatsFromFullAggregate,
    resetHubSummary,
  }
})
