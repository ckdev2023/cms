/**
 * 将新段落追加到已有文本末尾，在两段非空内容之间插入空行以保持可读性。
 *
 * @param existing - 当前文本
 * @param addition - 待追加段落
 * @returns 合并后的文本
 */
export function appendTextBlock(existing: string, addition: string): string {
  const next = addition.trim()
  if (!next) {
    return existing
  }
  const prev = existing.trim()
  if (!prev) {
    return next
  }
  return `${prev}\n\n${next}`
}
