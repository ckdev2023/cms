import type { RouteLocationNormalizedLoaded, Router } from 'vue-router'

/**
 * 将 ISO 时间串格式化为案件日志表单 `el-date-picker` 的 `YYYY-MM-DDTHH:mm`（本地展示）。
 *
 * @param iso - API 或路由传入的日期时间字符串
 * @returns 无法解析或空串时返回空串
 */
export function formatIsoToDatetimeLocalPickerValue(iso: string): string {
  const s = iso.trim()
  if (!s) {return ''}
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) {return ''}
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/**
 * 消费写案件日志深链相关 query，避免刷新页重复自动打开新建表单。
 *
 * @param route - 当前路由
 * @param router - 路由器实例
 */
export function stripVisaCaseLogDeepLinkQuery(
  route: RouteLocationNormalizedLoaded,
  router: Router,
): void {
  const q = { ...route.query } as Record<string, string | string[] | undefined>
  let changed = false
  for (const k of ['logVisaCaseId', 'openVisaCaseLogForm', 'suggestedNextFollowUpAt'] as const) {
    if (q[k] !== undefined) {
      delete q[k]
      changed = true
    }
  }
  if (changed) {
    void router.replace({ path: route.path, query: q })
  }
}
