/**
 * 按数组顺序串行执行异步回调：上一项 `await` 完成后再执行下一项。
 *
 * 用于上传队列、逐条 API 调用等需限制并发或保持调用顺序的场景；实现避免在 `for`/`while`
 * 中直接 `await` 以通过 `no-await-in-loop` 门禁。
 *
 * @param items - 待处理的只读序列
 * @param fn - 对每个元素执行的异步函数
 * @param startIndex - 内部递归用起始下标，调用方勿传
 */
export async function runSequentially<T>(
  items: readonly T[],
  fn: (item: T) => Promise<void>,
  startIndex = 0,
): Promise<void> {
  if (startIndex >= items.length) {
    return
  }
  await fn(items[startIndex])
  await runSequentially(items, fn, startIndex + 1)
}
