/**
 * 供案件日志「缺失材料」复用挑选：列表按创建时间降序（新 → 旧）。
 */

/** 日志条目中与缺件复用相关的最小字段 */
export interface VisaCaseLogMissingReuseCandidate {
  id: string
  missingItems?: string | null
}

/**
 * 从案件日志时间线片段中选取用于复写「缺失材料」字段的来源记录。
 *
 * @param items - 当前已加载的日志列表，须为创建时间降序
 * @param editingLogId - 编辑中的日志 id；新建模式传 undefined 时取列表中最近一条含缺件的记录
 * @returns 可供复用的日志；无则返回 null
 */
export function pickVisaCaseLogForMissingItemsReuse(
  items: ReadonlyArray<VisaCaseLogMissingReuseCandidate>,
  editingLogId?: string,
): VisaCaseLogMissingReuseCandidate | null {
  if (items.length === 0) {
    return null
  }
  const editing = editingLogId?.trim()
  if (!editing) {
    return items.find((l) => l.missingItems?.trim()) ?? null
  }
  const idx = items.findIndex((l) => l.id === editing)
  if (idx === -1) {
    return items.find((l) => l.missingItems?.trim() && l.id !== editing) ?? null
  }
  for (let i = idx + 1; i < items.length; i++) {
    if (items[i].missingItems?.trim()) {
      return items[i]
    }
  }
  return null
}
