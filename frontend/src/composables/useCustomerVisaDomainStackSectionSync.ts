import { onBeforeUnmount, onMounted, type Ref } from 'vue'

import type { VisaDomainBlockQueryValue } from '@/utils/customer-detail-visa-domain-deeplink'
import {
  createVisaDomainStackSectionObserver,
  pickVisaDomainStackActiveBlockByRatios,
  VISA_DOMAIN_STACK_WIDE_MEDIA,
  visaDomainStackObserverRootMargin,
} from '@/utils/customer-visa-domain-stack-section-intersection'

type VisaDomainBlockKey = VisaDomainBlockQueryValue

/* eslint-disable max-lines-per-function -- 签证域 stack 与 matchMedia 重连、IO 生命周期集中在单一 composable */
/**
 * 注册签证域堆叠分区的 `IntersectionObserver`，宽屏双列下按可见比例同步顶部分区 pill，并在卸载时清理。
 *
 * @param stackRootRef - 包裹各 `#visa-domain-*` 的容器
 * @param activeBlock - 与 pill `is-active` 同步的当前分区键
 * @param ensureBlockMounted - 相交时触发对应子块懒挂载
 * @returns `pauseSectionObserverActiveSync`：程序化滚动前调用，避免动画期间 observer 改写 `activeBlock`
 */
export function useCustomerVisaDomainStackSectionSync(
  stackRootRef: Ref<HTMLElement | null>,
  activeBlock: Ref<VisaDomainBlockKey>,
  ensureBlockMounted: (block: VisaDomainBlockKey) => void,
): { pauseSectionObserverActiveSync: (ms: number) => void } {
  let sectionObserver: IntersectionObserver | null = null
  const sectionVisibilityRatios = new Map<string, number>()
  let observerActiveSyncPausedUntil = 0
  let intersectionPickRafId: number | null = null
  let removeMediaQueryListener: (() => void) | null = null

  /**
   * 在接下来若干毫秒内忽略观察器对 `activeBlock` 的改写。
   *
   * @param ms - 暂停时长（毫秒）
   */
  function pauseSectionObserverActiveSync(ms: number): void {
    observerActiveSyncPausedUntil = Date.now() + ms
  }

  /**
   * 在暂停窗口外根据已缓存的各锚点可见比例刷新活动分区并触发懒挂载。
   */
  function flushActiveBlockFromIntersections(): void {
    if (Date.now() < observerActiveSyncPausedUntil) {
      return
    }
    const next = pickVisaDomainStackActiveBlockByRatios(sectionVisibilityRatios)
    if (next !== null) {
      activeBlock.value = next
      ensureBlockMounted(next)
    }
  }

  /**
   * 将多次 `IntersectionObserver` 回调合并到同一帧末再刷新 pill，减少双列布局下的抖动。
   */
  function scheduleFlushActiveBlockFromIntersections(): void {
    if (typeof window === 'undefined') {
      flushActiveBlockFromIntersections()
      return
    }
    if (intersectionPickRafId !== null) {
      return
    }
    intersectionPickRafId = window.requestAnimationFrame(() => {
      intersectionPickRafId = null
      flushActiveBlockFromIntersections()
    })
  }

  onMounted(() => {
    if (typeof IntersectionObserver === 'undefined' || !stackRootRef.value) {
      return
    }
    const mq =
      typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia(VISA_DOMAIN_STACK_WIDE_MEDIA)
        : null
    const getRootMargin = (): string => visaDomainStackObserverRootMargin(mq?.matches ?? false)

    const attachSectionObserver = (): void => {
      sectionObserver?.disconnect()
      sectionObserver = null
      sectionVisibilityRatios.clear()
      const root = stackRootRef.value
      if (!root) {
        return
      }
      sectionObserver = createVisaDomainStackSectionObserver({
        sectionVisibilityRatios,
        ensureBlockMounted,
        schedulePickActiveBlock: scheduleFlushActiveBlockFromIntersections,
        getRootMargin,
      })
      root.querySelectorAll('[id^="visa-domain-"]').forEach((el) => {
        sectionObserver?.observe(el)
      })
    }

    attachSectionObserver()
    const onWideLayoutChange = (): void => {
      attachSectionObserver()
    }
    mq?.addEventListener('change', onWideLayoutChange)
    removeMediaQueryListener = (): void => {
      mq?.removeEventListener('change', onWideLayoutChange)
      removeMediaQueryListener = null
    }
  })

  onBeforeUnmount(() => {
    removeMediaQueryListener?.()
    removeMediaQueryListener = null
    if (intersectionPickRafId !== null && typeof window !== 'undefined') {
      window.cancelAnimationFrame(intersectionPickRafId)
      intersectionPickRafId = null
    }
    sectionObserver?.disconnect()
    sectionObserver = null
    sectionVisibilityRatios.clear()
  })

  return { pauseSectionObserverActiveSync }
}

/* eslint-enable max-lines-per-function */
