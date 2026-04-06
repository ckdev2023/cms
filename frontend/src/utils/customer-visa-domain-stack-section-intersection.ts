import {
  VISA_DOMAIN_BLOCK_KEYS,
  VISA_DOMAIN_SECTION_ID_PREFIX,
  visaDomainBlockFromSectionIdSuffix,
  type VisaDomainBlockQueryValue,
  visaDomainSectionElementId,
} from './customer-detail-visa-domain-deeplink'

type VisaDomainBlockKey = VisaDomainBlockQueryValue

/** 与详情壳层宽屏主栏断点一致（与 `visa-domain-tab__stack` 双列栅格同步） */
export const VISA_DOMAIN_STACK_WIDE_MEDIA = '(min-width: 1200px)'

/** 多阈值便于双列布局下区分各块可见比例 */
export const VISA_DOMAIN_SECTION_IO_THRESHOLDS: number[] = [
  0, 0.05, 0.1, 0.2, 0.35, 0.5, 0.65, 0.8, 1,
]

/**
 * 按当前 `matchMedia` 结果返回 `IntersectionObserver` 的 `rootMargin`，宽屏略收紧纵向根区域以减轻双列同屏多区误判。
 *
 * @param isWideLayout - 是否命中 `VISA_DOMAIN_STACK_WIDE_MEDIA`
 * @returns 传给 `IntersectionObserver` 的 rootMargin 字符串
 */
export function visaDomainStackObserverRootMargin(isWideLayout: boolean): string {
  return isWideLayout ? '-10% 0px -34% 0px' : '-12% 0px -20% 0px'
}

/**
 * 根据各锚点 id 的缓存可见比例，在登记分区内选出应对齐导航 pill 的键。
 *
 * @param ratios - 锚点元素 id → 最近一次 `intersectionRatio`
 * @returns 比例明显高于噪声阈值的最大者；并列时取 `VISA_DOMAIN_BLOCK_KEYS` 中更靠前的一项
 */
export function pickVisaDomainStackActiveBlockByRatios(
  ratios: ReadonlyMap<string, number>,
): VisaDomainBlockKey | null {
  let best: { key: VisaDomainBlockKey; ratio: number; index: number } | null = null
  for (let i = 0; i < VISA_DOMAIN_BLOCK_KEYS.length; i++) {
    const key = VISA_DOMAIN_BLOCK_KEYS[i]!
    const id = visaDomainSectionElementId(key)
    const ratio = ratios.get(id) ?? 0
    if (ratio <= 0.02) {
      continue
    }
    if (!best || ratio > best.ratio || (ratio === best.ratio && i < best.index)) {
      best = { key, ratio, index: i }
    }
  }
  return best?.key ?? null
}

export type VisaDomainStackSectionObserverHandlers = {
  sectionVisibilityRatios: Map<string, number>
  ensureBlockMounted: (block: VisaDomainBlockKey) => void
  schedulePickActiveBlock: () => void
  getRootMargin: () => string
}

/**
 * 创建用于各 `#visa-domain-*` 分区的 `IntersectionObserver`，写入可见比例并在每批条目后触发调度回调。
 *
 * @param handlers - 可见比例缓存、懒挂载、根边距与「结算活动分区」调度
 * @returns 已创建、待调用方对堆叠根下各锚点执行 `observe` 的观察器实例
 */
export function createVisaDomainStackSectionObserver(
  handlers: VisaDomainStackSectionObserverHandlers,
): IntersectionObserver {
  const { sectionVisibilityRatios, ensureBlockMounted, schedulePickActiveBlock, getRootMargin } =
    handlers
  return new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const id = entry.target.id
        if (!id.startsWith(VISA_DOMAIN_SECTION_ID_PREFIX)) {
          continue
        }
        const ratio = entry.isIntersecting ? entry.intersectionRatio : 0
        sectionVisibilityRatios.set(id, ratio)
        const suffix = id.slice(VISA_DOMAIN_SECTION_ID_PREFIX.length)
        const block = visaDomainBlockFromSectionIdSuffix(suffix)
        if (block !== null && entry.isIntersecting) {
          ensureBlockMounted(block)
        }
      }
      schedulePickActiveBlock()
    },
    {
      root: null,
      rootMargin: getRootMargin(),
      threshold: VISA_DOMAIN_SECTION_IO_THRESHOLDS,
    },
  )
}
