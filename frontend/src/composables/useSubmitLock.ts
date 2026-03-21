import { ref } from 'vue'

export function useSubmitLock() {
  const submitting = ref(false)

  async function withLock<T>(fn: () => Promise<T>): Promise<T | undefined> {
    if (submitting.value) return undefined
    submitting.value = true
    try {
      return await fn()
    } finally {
      submitting.value = false
    }
  }

  return { submitting, withLock }
}
