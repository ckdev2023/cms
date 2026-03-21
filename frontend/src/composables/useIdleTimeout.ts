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

export function useIdleTimeout() {
  const userStore = useUserStore()
  const router = useRouter()
  let timer: ReturnType<typeof setTimeout> | null = null

  function clearTimer() {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }

  function startTimer() {
    clearTimer()
    if (!userStore.isLoggedIn) return
    timer = setTimeout(handleTimeout, IDLE_TIMEOUT_MS)
  }

  async function handleTimeout() {
    if (!userStore.isLoggedIn) return
    await userStore.logout()
    router.push({ path: '/login', query: { reason: 'idle' } })
  }

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
