import type { RouteLocationNormalizedLoaded, Router } from 'vue-router'

/**
 * 与路由 `visaDomainBlock` query 及堆叠分区 DOM `id="visa-domain-*"` 对齐的签证域分区键顺序（展示与导航一致）。
 *
 * 顺序与 `docs/36_客户详情Stitch布局_产品口径冻結.md` §7 主栏堆叠一致：基本信息摘要 → 家属 → 材料 → 路径 → 案件 → 日志。
 * 其中 `basicSnapshot` 对应 DOM id `visa-domain-basic-snapshot`（`visaDomainSectionElementId` 内映射）。
 */
export const VISA_DOMAIN_BLOCK_KEYS = [
  'basicSnapshot',
  'family',
  'materials',
  'paths',
  'cases',
  'logs',
] as const

/**
 * 单值路由 `visaDomainBlock` 与堆叠锚点共用的分区键字面量类型。
 */
export type VisaDomainBlockQueryValue = (typeof VISA_DOMAIN_BLOCK_KEYS)[number]

/** 签证域堆叠 section 元素 id 前缀，与模板中 `id="visa-domain-cases"` 等一致。 */
export const VISA_DOMAIN_SECTION_ID_PREFIX = 'visa-domain-' as const

/**
 * 判断字符串是否为已登记的签证域分区 query 值，用于白名单校验路由深链。
 *
 * @param s - 路由 query 或 hash 解析出的片段
 * @returns 属于已登记分区之一时为 true 且收窄类型
 */
export function isVisaDomainBlockQueryValue(s: string): s is VisaDomainBlockQueryValue {
  return (VISA_DOMAIN_BLOCK_KEYS as readonly string[]).includes(s)
}

/**
 * 将锚点元素 id 去掉 `visa-domain-` 前缀后的片段解析为与 query 一致的分区键（`basic-snapshot` ↔ `basicSnapshot`）。
 *
 * @param suffix - 例如 `logs`、`basic-snapshot`
 * @returns 可识别时返回分区键；否则返回 null
 */
export function visaDomainBlockFromSectionIdSuffix(suffix: string): VisaDomainBlockQueryValue | null {
  if (suffix === 'basic-snapshot') {
    return 'basicSnapshot'
  }
  return isVisaDomainBlockQueryValue(suffix) ? suffix : null
}

/**
 * 将分区键转为页面内锚点元素的 id，供 `scrollIntoView` 与 `document.getElementById` 使用。
 *
 * @param block - 与 `visaDomainBlock` 一致的堆叠分区键
 * @returns 以 `visa-domain-` 为前缀的 DOM id 字符串
 */
export function visaDomainSectionElementId(block: VisaDomainBlockQueryValue): string {
  if (block === 'basicSnapshot') {
    return `${VISA_DOMAIN_SECTION_ID_PREFIX}basic-snapshot`
  }
  return `${VISA_DOMAIN_SECTION_ID_PREFIX}${block}`
}

/**
 * 从 history 模式地址栏 hash 解析签证域分区键（形如 `#visa-domain-logs`），与 query `visaDomainBlock` 语义对齐。
 *
 * @param rawHash - `useRoute().hash`，通常以 `#` 开头
 * @returns 可识别为已登记分区之一时返回该键；否则返回 null（含 `#other`、空串）
 */
export function parseVisaDomainBlockFromLocationHash(rawHash: string): VisaDomainBlockQueryValue | null {
  const h = rawHash.trim()
  if (!h.startsWith('#')) {
    return null
  }
  const id = h.slice(1).trim()
  if (!id.startsWith(VISA_DOMAIN_SECTION_ID_PREFIX)) {
    return null
  }
  const suffix = id.slice(VISA_DOMAIN_SECTION_ID_PREFIX.length)
  return visaDomainBlockFromSectionIdSuffix(suffix)
}

/**
 * 消费签证域堆叠深链：移除 query `visaDomainBlock`，并在 hash 为 `#visa-domain-*` 时清空 hash，避免刷新重复滚动且与其余 query 剥离函数兼容；有变更时调用 `router.replace`。
 *
 * @param route - 当前 `useRoute()` 返回值
 * @param router - 当前 `useRouter()` 返回值
 */
export function stripVisaDomainDeepLinkFromLocation(
  route: RouteLocationNormalizedLoaded,
  router: Router,
): void {
  const q = { ...route.query } as Record<string, string | string[] | undefined>
  let changed = false
  if (q.visaDomainBlock !== undefined) {
    delete q.visaDomainBlock
    changed = true
  }
  const hadVisaHash = parseVisaDomainBlockFromLocationHash(route.hash) !== null
  if (hadVisaHash) {
    changed = true
  }
  if (!changed) {
    return
  }
  void router.replace({
    path: route.path,
    query: q,
    hash: hadVisaHash ? '' : route.hash,
  })
}
