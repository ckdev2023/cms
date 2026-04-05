/**
 * 向导内待提交家属行的临时 ID 序列，重置向导时归零。
 */
let tempIdSeq = 0

/**
 * 分配下一个临时家属行 ID（仅内存，提交前标识列表行）。
 */
export function allocTempMemberId(): number {
  return ++tempIdSeq
}

/**
 * 在向导重置时清空临时 ID 计数，避免数字无限增长。
 */
export function resetTempMemberIds(): void {
  tempIdSeq = 0
}
