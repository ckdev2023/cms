import { ref } from 'vue'

/**
 * 提供提交互斥锁，避免同一操作被重复触发。
 *
 * @returns 包含提交中状态与加锁执行方法的对象
 */
export function useSubmitLock() {
  const submitting = ref(false)

  /**
   * 在提交锁空闲时执行异步任务，并在结束后自动释放锁。
   *
   * @param fn - 需要串行执行的异步任务
   * @returns 锁空闲时返回任务结果；锁已占用时返回 undefined
   */
  async function withLock<T>(fn: () => Promise<T>): Promise<T | undefined> {
    if (submitting.value) {return undefined}
    submitting.value = true
    try {
      return await fn()
    } finally {
      submitting.value = false
    }
  }

  return { submitting, withLock }
}
