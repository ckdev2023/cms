/**
 * 签证案件「案件类型」变更与材料清单预检相关的纯函数，供编辑对话框判断是否需二次确认。
 */

/**
 * 将案件类型字符串规范为比较用键（去首尾空白，空与 null 视为等价）。
 *
 * @param value - 后端或表单上的案件类型
 * @returns 用于相等比较的去空白字符串
 */
export function normalizeVisaCaseTypeKey(value: string | null | undefined): string {
  return (value ?? '').trim()
}

/**
 * 判断保存时案件类型相对初始值是否发生实质变更（仅空白差异视为未变）。
 *
 * @param previousType - 打开编辑时的案件类型
 * @param nextType - 表单当前选中的案件类型
 * @returns 规范化后不一致时返回 true
 */
export function isVisaCaseTypeChanging(
  previousType: string | null | undefined,
  nextType: string | null | undefined,
): boolean {
  return normalizeVisaCaseTypeKey(previousType) !== normalizeVisaCaseTypeKey(nextType)
}
