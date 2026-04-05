import { onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'

import { useUserStore } from '@/stores/user'

const IDLE_TIMEOUT_MS = 2 * 60 * 60 * 1000 // 2 hours
const ACTIVITY_EVENTS: (keyof DocumentEventMap)[] = [
  'mousedown',
  'keydown',
  'touchstart',
  'scroll',
]

/**
 * 监听页面空闲状态，并在超时后自动注销当前用户。
 *
 * 该组合式函数会注册全局用户活动事件，在登录状态下持续刷新空闲计时器。
 */
export function useIdleTimeout() {
  const userStore = useUserStore()
  const router = useRouter()
  let timer: ReturnType<typeof setTimeout> | null = null

  /**
   * 清除当前空闲计时器，避免重复注册超时任务。
   */
  function clearTimer() {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }

  /**
   * 在用户保持登录时重新启动空闲超时计时器。
   */
  function startTimer() {
    clearTimer()
    if (!userStore.isLoggedIn) {return}
    timer = setTimeout(handleTimeout, IDLE_TIMEOUT_MS)
  }

  /**
   * 处理用户空闲超时后的注销与跳转流程。
   *
   * 副作用：会清理当前登录态，并跳转到带有空闲原因标识的登录页。
   */
  async function handleTimeout() {
    if (!userStore.isLoggedIn) {return}
    await userStore.logout()
    await router.push({ path: '/login', query: { reason: 'idle' } })
  }

  /**
   * 响应用户活动事件并刷新空闲计时器。
   */
  function onActivity() {
    startTimer()
  }

  onMounted(() => {
    ACTIVITY_EVENTS.forEach((e) => document.addEventListener(e, onActivity))
    startTimer()
  })

  onUnmounted(() => {
    ACTIVITY_EVENTS.forEach((e) => document.removeEventListener(e, onActivity))
    clearTimer()
  })

  watch(
    () => userStore.isLoggedIn,
    (loggedIn) => {
      if (loggedIn) {
        startTimer()
      } else {
        clearTimer()
      }
    },
  )
}
